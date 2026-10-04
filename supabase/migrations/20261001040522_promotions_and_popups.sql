-- 프로모션(얼리버드) + 접속 팝업
--
-- 적용: test 20261001040907 (적용 완료, 2026-10-01) / 운영 20261001075401 (적용 완료)
--   ⚠️ 파일명 앞자리와 DB 에 기록된 번호가 다르다. 적용 도구가 실행 시각으로
--      번호를 새로 매기기 때문이다. "무엇이 적용됐나" 는 위 번호로 DB 에 물어본다.
-- 되돌리기:
--   drop view if exists public.public_popup;
--   drop view if exists public.public_promotion_price_tier;
--   drop view if exists public.public_promotion;
--   drop function if exists public.resolve_promotion_price(uuid, timestamptz, integer, timestamptz);
--   drop function if exists public.promotion_unit_price(uuid, uuid, integer);
--   drop function if exists public.active_promotion(timestamptz, timestamptz);
--   drop table if exists public.promotion_price_tiers;
--   drop table if exists public.promotions;
--   drop table if exists public.popups;
--   (이 파일만 되돌리면 금액은 기본가로 돌아간다. 금액 경로는 다음 마이그레이션이 바꾼다)
--
-- 왜 테마가 아니라 별도 표인가
--   얼리버드는 "10월 한 번" 이 아니다 — 같은 모양의 할인을 기간·할인폭만 바꿔
--   반복할 예정이다(2026-10-01 확인). 테마에 칸을 붙이면 지난 프로모션의
--   금액이 남지 않아 "그때 얼마였나" 를 복원할 수 없고, 다음 프로모션을
--   준비하는 동안 현재 할인을 끌 수밖에 없다.
--
-- ⚠️ 할인은 **인원 구간별 인당 고정가**로만 적는다. 정률(%)을 받지 않는 이유는
--    원 단위 반올림이 화면·DB·문자에서 제각각 달라지면 그대로 금액 분쟁이
--    되기 때문이다. 화면에 보이는 "N% OFF" 는 기본가와 이 고정가로 계산해 보여줄 뿐,
--    저장되는 값은 언제나 고정가다.
--
-- ⚠️ 기본가(theme_price_tiers)는 건드리지 않는다. 프로모션이 끝나면 아무것도
--    되돌리지 않아도 기본가로 돌아가야 한다.

-- ── 프로모션 ────────────────────────────────────────────────────
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),

  -- 어드민 목록에서 사람이 알아보는 이름. 신청 건에 그대로 박히므로
  -- 나중에 프로모션을 지워도 "무슨 할인을 받았는지" 가 남는다.
  name        text not null,

  -- 지금은 얼리버드 하나뿐이다. 다른 방식(예: 인원수 추가 할인)이 생기면
  -- 여기 값을 늘리고 적용 조건을 분기한다.
  kind        text not null default 'early_bird' check (kind in ('early_bird')),

  is_active   boolean not null default false,

  -- ── 적용 조건 ──
  -- 신청 **시점** 기준 접수 기간. 둘 다 비우면 is_active 를 끌 때까지.
  applies_from  timestamptz,
  applies_until timestamptz,

  -- 회차 **진행일**(KST 날짜) 범위. 비우면 제한 없음.
  -- ⚠️ 비워 두면 몇 달 뒤 회차까지 전부 할인 대상이 된다. 운영 회차는
  --    1년 치가 미리 열려 있다(2026-10 기준 139개, 2027-03 까지).
  session_from date,
  session_to   date,

  -- 진행일 기준 며칠 전까지 신청해야 적용되는가. 0 이면 당일까지.
  -- 판정은 KST **날짜** 차이다 — 시각으로 끊으면 폼을 채우는 동안 가격이
  -- 바뀌어, 화면에서 본 금액과 입금 요청 금액이 달라진다.
  days_before  integer not null default 7 check (days_before >= 0),

  -- ── 화면 문구 ──
  badge_label      text not null default '얼리버드',
  banner_title     text,
  banner_body      text,
  -- 비우면 기본가 대비 최대 할인율을 계산해 'N% OFF' 로 보여준다.
  banner_highlight text,
  banner_note      text,
  -- 달력·배지에 쓰는 색. 테마 강조색과 구분돼야 해서 따로 받는다.
  accent_color text not null default '#ff73b4'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint promotions_period_order check (
    applies_from is null or applies_until is null or applies_from <= applies_until),
  constraint promotions_session_range_order check (
    session_from is null or session_to is null or session_from <= session_to)
);

-- ⚠️ 켜진 프로모션은 한 번에 하나뿐이다. 둘이 겹치면 "어느 쪽 금액이 맞나" 를
--    코드가 임의로 정하게 되고, 그 판단이 그대로 고객 청구액이 된다.
--    새 프로모션을 켜려면 기존 것을 먼저 꺼야 한다 — 어드민이 안내한다.
create unique index if not exists promotions_single_active
  on public.promotions ((1)) where is_active;

comment on table public.promotions is
  '기간 한정 할인(얼리버드 등). 켜진 행은 한 번에 하나. 금액은 promotion_price_tiers 에 인당 고정가로.';
comment on column public.promotions.days_before is
  '회차 진행일 기준 며칠 전까지 신청해야 적용되는가. KST 날짜 차이로 판정한다.';

-- ── 프로모션 금액 ──────────────────────────────────────────────
-- theme_price_tiers 와 같은 규칙: min_headcount 이상일 때 적용되고
-- 조건을 만족하는 구간 중 가장 큰 것이 이긴다.
create table if not exists public.promotion_price_tiers (
  promotion_id   uuid not null references public.promotions(id) on delete cascade,
  theme_id       uuid not null references public.themes(id) on delete cascade,
  min_headcount  integer not null check (min_headcount >= 1),
  unit_price_krw integer not null check (unit_price_krw >= 0),
  primary key (promotion_id, theme_id, min_headcount)
);

comment on table public.promotion_price_tiers is
  '프로모션 적용 시의 인당 가격. 구간이 없는 테마는 그 프로모션 대상이 아니다(기본가 유지).';

-- ── 접속 팝업 ──────────────────────────────────────────────────
create table if not exists public.popups (
  id          uuid primary key default gen_random_uuid(),

  -- 어드민 목록용 이름. 고객 화면에는 안 나온다.
  title       text not null,

  -- 이미지가 본체다. 비어 있으면 body 문구만으로 그린다 —
  -- 디자인이 아직 안 나왔을 때 문구만 먼저 띄울 수 있게.
  image_url   text,
  image_alt   text,
  body        text,

  link_url    text check (link_url is null or link_url ~ '^(/|https://)'),
  link_label  text,

  -- 어느 화면에서 띄울지. home = /, themes = /contents, theme_detail = /themes/[slug]
  pages       text[] not null default '{home,themes,theme_detail}'
    check (pages <@ array['home','themes','theme_detail']::text[]),

  starts_at   timestamptz,
  ends_at     timestamptz,

  -- ⚠️ 기본값은 꺼짐이다. 만들자마자 전 고객에게 뜨면 되돌릴 수 없다.
  is_active   boolean not null default false,

  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint popups_period_order check (
    starts_at is null or ends_at is null or starts_at <= ends_at),
  -- 띄울 내용이 아무것도 없는 팝업은 빈 상자로 뜬다.
  constraint popups_has_content check (
    coalesce(image_url, '') <> '' or coalesce(body, '') <> '')
);

create index if not exists popups_active_sort_idx on public.popups (is_active, sort, created_at);

comment on table public.popups is
  '접속 시 뜨는 안내 팝업. 고객 화면은 public_popup 뷰만 읽는다.';

-- ── 권한 ────────────────────────────────────────────────────────
-- 어드민(service_role)만 쓴다. 테이블 GRANT 가 이 프로젝트의 1차 방어선이다.
-- ⚠️ 새 표는 기본값으로 아무 권한이 없다. 명시하지 않으면 어드민에서
--    'permission denied' 가 난다.
alter table public.promotions            enable row level security;
alter table public.promotion_price_tiers enable row level security;
alter table public.popups                enable row level security;

revoke all on public.promotions            from anon, authenticated;
revoke all on public.promotion_price_tiers from anon, authenticated;
revoke all on public.popups                from anon, authenticated;

grant select, insert, update, delete on public.promotions            to service_role;
grant select, insert, update, delete on public.promotion_price_tiers to service_role;
grant select, insert, update, delete on public.popups                to service_role;

-- ── 공개 뷰 ────────────────────────────────────────────────────
-- 고객 화면은 표를 직접 읽지 않는다. 꺼 둔 프로모션의 금액·기간이
-- 공개되면 안 열린 할인이 미리 드러난다.
create or replace view public.public_promotion as
select
  id, name, kind, badge_label,
  banner_title, banner_body, banner_highlight, banner_note,
  accent_color, days_before, session_from, session_to, applies_from, applies_until
from public.promotions
where is_active;

create or replace view public.public_promotion_price_tier as
select pt.promotion_id, pt.theme_id, pt.min_headcount, pt.unit_price_krw
from public.promotion_price_tiers pt
join public.promotions p on p.id = pt.promotion_id
where p.is_active;

-- 게시 기간까지 뷰에서 걸러 내보낸다. 화면이 기간을 다시 판정하면
-- 서버 시각과 브라우저 시각이 달라 꺼진 팝업이 뜨는 날이 온다.
create or replace view public.public_popup as
select id, image_url, image_alt, body, link_url, link_label, pages, sort
from public.popups
where is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at   is null or ends_at   >= now());

grant select on public.public_promotion            to anon, authenticated, service_role;
grant select on public.public_promotion_price_tier to anon, authenticated, service_role;
grant select on public.public_popup                to anon, authenticated, service_role;

-- ── 적용 판정 ──────────────────────────────────────────────────
-- ⚠️ 이 세 함수가 금액 판정의 **유일한** 기준이다. 화면(src/lib/promotion.ts)이
--    같은 규칙을 다시 구현하고 있는데, 그쪽은 **보여주기 전용**이다.
--    실제 청구액은 언제나 submit_application_v3 가 이 함수들로 다시 계산한다.

-- 지금 이 회차에 적용되는 프로모션 1건. 없으면 행이 안 나온다.
create or replace function public.active_promotion(
  p_start_at timestamptz,
  p_now      timestamptz default now()
) returns setof public.promotions
language sql
stable
as $$
  select *
    from public.promotions p
   where p.is_active
     and (p.applies_from  is null or p_now >= p.applies_from)
     and (p.applies_until is null or p_now <= p.applies_until)
     and (p.session_from  is null or (p_start_at at time zone 'Asia/Seoul')::date >= p.session_from)
     and (p.session_to    is null or (p_start_at at time zone 'Asia/Seoul')::date <= p.session_to)
     -- "진행일 N일 전까지 신청" — KST 날짜 차이로 센다.
     and (p_start_at at time zone 'Asia/Seoul')::date
         - (p_now at time zone 'Asia/Seoul')::date >= p.days_before
   limit 1;
$$;

-- 그 프로모션에서의 인당 가격. resolve_unit_price() 와 같은 규칙.
create or replace function public.promotion_unit_price(
  p_promotion_id uuid, p_theme_id uuid, p_headcount integer
) returns integer
language sql
stable
as $$
  select pt.unit_price_krw
    from public.promotion_price_tiers pt
   where pt.promotion_id = p_promotion_id
     and pt.theme_id = p_theme_id
     and pt.min_headcount <= p_headcount
   order by pt.min_headcount desc
   limit 1;
$$;

-- 신청 함수가 부르는 한 줄짜리 입구. 적용 안 되면 행이 없다.
create or replace function public.resolve_promotion_price(
  p_theme_id  uuid,
  p_start_at  timestamptz,
  p_headcount integer,
  p_now       timestamptz default now()
) returns table (promotion_id uuid, promotion_name text, unit_price_krw integer)
language sql
stable
as $$
  select p.id, p.name, public.promotion_unit_price(p.id, p_theme_id, p_headcount)
    from public.active_promotion(p_start_at, p_now) p
   where public.promotion_unit_price(p.id, p_theme_id, p_headcount) is not null;
$$;

revoke execute on function public.active_promotion(timestamptz, timestamptz) from public;
revoke execute on function public.promotion_unit_price(uuid, uuid, integer) from public;
revoke execute on function public.resolve_promotion_price(uuid, timestamptz, integer, timestamptz) from public;

grant execute on function public.active_promotion(timestamptz, timestamptz) to service_role;
grant execute on function public.promotion_unit_price(uuid, uuid, integer) to service_role;
grant execute on function public.resolve_promotion_price(uuid, timestamptz, integer, timestamptz) to anon, authenticated, service_role;

-- ⚠️ updated_at 은 트리거가 아니라 **저장하는 쪽**이 넣는다. 이 저장소에는
--    updated_at 트리거 함수가 없고, venues·themes 등도 전부 서버 액션에서
--    값을 실어 보낸다. 여기만 트리거를 두면 규칙이 두 갈래가 된다.
