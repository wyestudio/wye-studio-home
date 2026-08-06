-- wye studio 스키마 v3
-- 회원제(로그인 필수) 기준. 실행 후 하단 "시드 데이터" 블록에서 8/22 회차 2건을 입력한다.
-- Supabase SQL Editor에서 전체를 한 번에 실행하면 된다.

-- =========================================================
-- 1. profiles (회원 부가정보 — auth.users 확장)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  birth_date date not null,
  gender text not null check (gender in ('M', 'F')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- 본인 정보만 조회/수정/생성 가능
create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id);


-- =========================================================
-- 2. sessions (회차 — 방탈출 테마 목록이 아니라 날짜+타임 단위 상품)
-- =========================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  slot text not null check (slot in ('afternoon', 'evening')),
  title text not null,
  theme_label text not null, -- '비소개팅' / '소개팅'
  start_at timestamptz not null,
  end_at timestamptz,
  venue_name text not null,
  venue_area text not null, -- 대략 지역 (정확 주소는 참가확정자에게 개별 안내, 이 테이블엔 안 둠)
  price_krw int not null,
  capacity_min int not null default 16, -- 참고 정보용 (최소 진행 인원 안내), 확정 로직엔 미사용
  capacity_confirm_line int not null default 20, -- 이 인원까지는 즉시 확정
  capacity_max int not null default 24, -- 정원, 도달 시 마감
  status text not null default 'open' check (status in ('open', 'closed')),
  description text,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

-- 상품 정보는 비로그인 포함 누구나 조회 가능 (기존 rooms 테이블과 동일 패턴)
create policy "sessions_select_public"
  on sessions for select
  using (true);

-- insert/update 정책 없음 -> 지금은 Supabase 대시보드/시드 SQL로 운영자가 직접 등록


-- =========================================================
-- 3. applications (참가 신청 — user_id 기반, 로그인 필수)
-- =========================================================
create table applications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  depositor_name text not null,
  agreed_terms boolean not null default false,
  confirmation_code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id) -- 동일 회원이 같은 회차에 중복 신청 방지
);

alter table applications enable row level security;

-- 본인 신청만 조회 가능 (개인정보 보호 + 성비/집계 등은 별도 SECURITY DEFINER 함수로 노출)
create policy "applications_select_own"
  on applications for select
  to authenticated
  using (auth.uid() = user_id);

-- 직접 insert는 앱에서 막고 apply_and_recompute() 함수로만 생성한다.
-- (일반 insert 정책을 열어두면 status/confirmation_code를 클라이언트가 임의로 넣을 수 있어 policy를 만들지 않음)

-- payment_status 변경(입금확인)은 정책 없음 = 운영자가 대시보드에서 수동 처리


-- =========================================================
-- 4. 확정 로직: apply_and_recompute()
--    - 1~20명(누적, 이번 신청 포함): 즉시 confirmed
--    - 21~23명: waiting
--    - 24명(정원) 도달: 그 회차의 waiting 전원 confirmed 전환 + sessions.status = 'closed'
--    - 세션이 이미 closed면 신청 자체를 막는다 (SECURITY DEFINER로 배치 업데이트까지 원자적 처리)
-- =========================================================
create or replace function apply_and_recompute(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean
)
returns applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session sessions%rowtype;
  v_new_total int;
  v_code text;
  v_new_row applications%rowtype;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not p_agreed_terms then
    raise exception '약관에 동의해야 신청할 수 있습니다.';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception '존재하지 않는 회차입니다.';
  end if;
  if v_session.status <> 'open' then
    raise exception '이미 마감된 회차입니다.';
  end if;

  if exists (
    select 1 from applications
    where session_id = p_session_id and user_id = v_user_id
  ) then
    raise exception '이미 이 회차에 신청하셨습니다.';
  end if;

  v_code := 'WYE-' || to_char(v_session.event_date, 'MMDD') || '-'
    || upper(left(v_session.slot, 1)) || '-'
    || lpad((
      select count(*) + 1 from applications where session_id = p_session_id
    )::text, 3, '0');

  insert into applications (session_id, user_id, depositor_name, agreed_terms, confirmation_code, status)
  values (p_session_id, v_user_id, p_depositor_name, p_agreed_terms, v_code, 'waiting')
  returning * into v_new_row;

  select count(*) into v_new_total from applications where session_id = p_session_id;

  if v_new_total <= v_session.capacity_confirm_line then
    update applications set status = 'confirmed'
    where id = v_new_row.id;
  elsif v_new_total >= v_session.capacity_max then
    update applications set status = 'confirmed'
    where session_id = p_session_id and status = 'waiting';

    update sessions set status = 'closed' where id = p_session_id;
  end if;

  select * into v_new_row from applications where id = v_new_row.id;
  return v_new_row;
exception
  when unique_violation then
    raise exception '이미 이 회차에 신청하셨습니다.';
end;
$$;

revoke all on function apply_and_recompute(uuid, text, boolean) from public;
grant execute on function apply_and_recompute(uuid, text, boolean) to authenticated;


-- =========================================================
-- 5. 공개 집계: get_session_stats()
--    비로그인 방문자도 볼 수 있는 "신청 N / 목표 20명" 위젯용.
--    applications 원본은 계속 잠긴 채, 개인정보 없는 카운트만 노출.
-- =========================================================
create or replace function get_session_stats(p_session_id uuid)
returns table (confirmed_count int, waiting_count int)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where status = 'confirmed')::int as confirmed_count,
    count(*) filter (where status = 'waiting')::int as waiting_count
  from applications
  where session_id = p_session_id;
$$;

revoke all on function get_session_stats(uuid) from public;
grant execute on function get_session_stats(uuid) to anon, authenticated;


-- =========================================================
-- 시드 데이터: 8/22(토) 오후(비소개팅) · 저녁(소개팅) 2개 회차
-- (베타 상품 정보 & 타임테이블 문서 기준)
-- =========================================================
insert into sessions (
  event_date, slot, title, theme_label,
  start_at, end_at, venue_name, venue_area,
  price_krw, capacity_min, capacity_confirm_line, capacity_max,
  status, description
) values
(
  '2026-08-22', 'afternoon', '8/22(토) 오후 · 비소개팅', '비소개팅',
  '2026-08-22T12:30:00+09:00', '2026-08-22T17:00:00+09:00',
  '뮤트스페이스 신림점', '서울 신림권',
  69000, 16, 20, 24,
  'open', '방탈출과 미니게임으로 자연스럽게 친해지는 비소개팅 타임. 1부(아이스브레이킹+식사+방탈출) 진행.'
),
(
  '2026-08-22', 'evening', '8/22(토) 저녁 · 소개팅', '소개팅',
  '2026-08-22T18:30:00+09:00', '2026-08-22T23:45:00+09:00',
  '뮤트스페이스 신림점', '서울 신림권',
  69000, 16, 20, 24,
  'open', '로테이션 소개팅 + 방탈출을 결합한 저녁 타임. 4인 1조로 랜덤 편성되어 방탈출을 함께 플레이합니다.'
);
