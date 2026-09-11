-- 회차 롤링 오픈 (Phase 4)
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기:
--   drop table if exists public.theme_schedules;
--   alter table public.sessions drop column if exists opens_at;
--   (뷰는 opens_at 을 뺀 정의로 create or replace)
--
-- 매주 토·일을 계속 진행하되, 일정은 한꺼번에 다 열지 않고 3주 전에 하나씩 연다.
--
-- ⚠️ 공개 여부를 크론으로 status 를 바꿔서 처리하지 않는다. 크론이 한 번 밀리면
--    그날 열려야 할 회차가 안 열리고, 그걸 아무도 모른다. 대신 회차마다 '언제부터
--    보일지'(opens_at)를 미리 박아두고 조회할 때 걸러낸다 — 시간이 지나면 저절로
--    열리므로 실행에 의존하지 않는다.

alter table public.sessions
  add column if not exists opens_at timestamptz;

-- 기존 회차는 이미 공개된 것들이다. 생성 시각으로 채워 과거로 만든다.
update public.sessions set opens_at = coalesce(created_at, now()) where opens_at is null;

alter table public.sessions
  alter column opens_at set default now(),
  alter column opens_at set not null;

comment on column public.sessions.opens_at is
  '이 시각부터 고객 화면에 보인다. 롤링 오픈용. 과거면 바로 공개.';

create index if not exists sessions_theme_opens_idx on public.sessions (theme_id, opens_at);

-- ── 테마별 회차 편성 ────────────────────────────────────────
-- 테마 하나에 편성 하나(1:1). 여기 값으로 회차를 찍어낸다.
create table if not exists public.theme_schedules (
  theme_id            uuid primary key references public.themes(id) on delete cascade,
  start_date          date        not null,
  -- 0=일 … 6=토
  weekdays            smallint[]  not null default '{6,0}',
  -- 하루 회차 시각 (KST, 'HH:MM')
  times               text[]      not null default '{11:30,15:30,19:30}',
  -- 공개 시점: 회차일로부터 N주 전, 그 주의 지정 요일·시각
  open_weeks_before   smallint    not null default 3,
  open_weekday        smallint    not null default 6,
  open_time           time        not null default '00:00',
  -- 어디까지 회차를 만들어뒀는지 (운영자에게 보여줄 용도)
  generated_until     date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint theme_schedules_open_weeks_chk  check (open_weeks_before between 0 and 52),
  constraint theme_schedules_open_weekday_chk check (open_weekday between 0 and 6)
);

comment on table public.theme_schedules is
  '테마별 회차 편성 + 롤링 오픈 규칙. 회차는 이 값으로 생성되고 opens_at 이 계산된다.';

alter table public.theme_schedules enable row level security;
-- anon/authenticated 에는 권한을 주지 않는다. 운영 설정이라 고객이 볼 이유가 없다.
grant select, insert, update, delete on public.theme_schedules to service_role;

-- ── 뷰에 opens_at 추가 ──────────────────────────────────────
-- ⚠️ create or replace view 는 컬럼 순서를 못 바꾼다(42P16). 반드시 뒤에 붙인다.
create or replace view session_view as
select
  s.id,
  s.theme_id,
  s.start_at,
  s.end_at,
  s.status,
  s.min_age,
  s.legacy_format,
  s.legacy_slug,
  t.slug as theme_slug,
  t.name as theme_name,
  t.difficulty,
  t.duration_minutes,
  t.accent_color,
  t.max_group_size,
  s.price_krw_override,
  (select min(p.unit_price_krw) from theme_price_tiers p where p.theme_id = t.id) as min_unit_price_krw,
  (select max(p.unit_price_krw) from theme_price_tiers p where p.theme_id = t.id) as max_unit_price_krw,
  coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line) as capacity_confirm_line,
  coalesce(s.capacity_max_override, t.capacity_max) as capacity_max,
  coalesce(s.venue_id_override, t.venue_id) as venue_id,
  s.opens_at
from sessions s
join themes t on t.id = s.theme_id;

create or replace view session_display as
select
  s.id,
  s.theme_id,
  s.start_at,
  s.end_at,
  s.status,
  s.min_age,
  coalesce(t.name, s.theme_name)              as theme_name,
  coalesce(s.legacy_format, s.session_type)   as format_label,
  coalesce(v.area_label, s.venue_area)        as venue_area,
  v.address                                   as venue_address,
  v.parking_note                              as venue_parking_note,
  coalesce(t.slug, s.slug)                    as link_slug,
  case when s.theme_id is not null then '/themes/' || t.slug
       else '/sessions/' || s.slug end        as public_path,
  coalesce(s.legacy_format, s.session_type) is not null as is_legacy,
  case when coalesce(s.legacy_format, s.session_type) is not null then s.capacity_confirm_line
       else coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line) end as capacity_confirm_line,
  case when coalesce(s.legacy_format, s.session_type) is not null then s.capacity_max
       else coalesce(s.capacity_max_override, t.capacity_max) end as capacity_max,
  s.capacity_max_male,
  s.capacity_max_female,
  s.opens_at
from sessions s
left join themes t on t.id = s.theme_id
left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id);

grant select on session_display to service_role;
