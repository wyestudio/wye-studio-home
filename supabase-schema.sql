-- 우주이스케이프 스키마 v12
-- v7 이후로는 비회원 구매 플로우 기준(로그인 불필요, 신청 시점에 인적정보를 직접 받음).
-- 1~9번 섹션(profiles/kakao_links/naver_links/find_account_by_*)은 로그인 시스템이
-- 휴면 처리되며 함께 남아있는 것 — 신청 플로우는 더 이상 이들을 참조하지 않는다.
-- 실제 신청 플로우가 쓰는 건 2번(sessions), 2b번(session_venues), 그리고 맨 아래 v7/v8 섹션.
-- Supabase SQL Editor에서 전체를 한 번에 실행하면 된다. 처음 실행이 아니라면 v7/v8 섹션만
-- 이어서 실행해도 됨(단, 실행 전 `select count(*) from applications;`로 기존 데이터가
-- 없는지 반드시 확인 — v7/v8 둘 다 컬럼을 갈아엎는 파괴적 변경을 포함함).
-- v5: 전화번호 중복 가입 방지(profiles.phone_digits) + 네이버 계정 연결(naver_links) 추가
-- v6: 카카오 계정 연결(kakao_links) 추가 — 카카오도 직접 OAuth로 전환
-- v7: 회원제 → 비회원 구매 플로우 전환. applications에서 user_id 제거, 그룹 신청을 위한
--     application_attendees 신설, submit_application()이 apply_and_recompute() 대체,
--     get_session_stats()를 참여 인원 합계 기준으로 재작성, 전화번호+접수번호 조회용
--     lookup_application() 신설. 로그인 시스템(1~9번 섹션)은 삭제하지 않고 그대로 둠.
-- v8: application_attendees.name/phone, applications.depositor_name을 암호화(pgp_sym_encrypt,
--     Supabase Vault에 키 보관)해서 저장. 전화번호 매칭(동일 테마 재참여 체크, /lookup)은
--     복호화 불가능한 HMAC 해시(phone_hash)로 처리. 운영자용 복호화 뷰
--     admin_attendee_view/admin_application_view 신설(SQL Editor 전용, grant 없음).
-- v9: 소개팅(theme_label='소개팅') 회차만 성비를 맞춰야 해서 남/여 각각 정원 10명씩
--     분리 관리. sessions.capacity_confirm_line_male/female, application_attendees.gender
--     추가(둘 다 비소개팅 행은 NULL). submit_application()이 소개팅이면 1인 신청 강제 +
--     성별 필수 검증 + 확정/대기 판정을 세션 전체가 아니라 해당 성별 인원 기준으로 함.
--     전체 정원(capacity_max) 도달 시 마감은 비소개팅과 동일하지만, 소개팅은 성비가 깨질
--     수 있는 대기자 자동 승격을 하지 않음 — 운영자가 SQL Editor에서 수동으로 판단해
--     확정 처리(admin_attendee_view 보면서 update applications set status='confirmed'...).
--     get_session_stats()도 성별 분리 카운트를 추가로 반환하도록 재작성.
--     lookup_application()도 참여내역 조회 화면을 신청 완료 화면과 비슷하게 보여주기 위해
--     price_krw(무통장입금 안내용)와 참여자별 phone/gender(decrypt_pii)를 추가 반환하도록 재작성.

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

-- RLS 정책과 별개로 테이블 자체 권한도 필요(Supabase는 새 테이블을 anon/authenticated에 자동 grant하지 않음)
grant select, insert, update on profiles to authenticated;


-- =========================================================
-- 2. sessions (회차 — 방탈출 테마 목록이 아니라 날짜+타임 단위 상품)
-- =========================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, -- URL-friendly identifier (e.g., '0829-meeting', '0829-dating')
  event_date date not null,
  slot text not null check (slot in ('afternoon', 'evening')),
  title text not null,
  theme_label text not null, -- '비소개팅' / '소개팅'
  start_at timestamptz not null,
  end_at timestamptz,
  venue_area text not null, -- 대략 지역 (상호명/정확 주소는 session_venues에 별도 보관)
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

grant select on sessions to anon, authenticated;


-- =========================================================
-- 2b. session_venues (상호명 — 의도적으로 비공개)
--     sessions는 select using (true) + anon grant라 REST API로 직접 조회하면
--     테이블의 모든 컬럼이 그대로 노출된다. 정확한 장소는 참가 확정자에게만
--     개별 안내하는 정책이라, 아예 별도 표로 분리하고 select 정책/grant를
--     하나도 주지 않는다 — anon/authenticated 둘 다 이 표는 존재 자체를
--     알 수 없고, 운영자는 SQL Editor/Table Editor(테이블 소유자 권한이라
--     RLS를 우회함)에서만 열람·수정한다.
-- =========================================================
create table session_venues (
  session_id uuid primary key references sessions(id) on delete cascade,
  venue_name text not null,
  created_at timestamptz not null default now()
);

alter table session_venues enable row level security;
-- select/insert/update 정책 없음 + grant 없음 = 운영자(테이블 소유자) 전용


-- =========================================================
-- 3. applications (참가 신청 — 그룹 단위의 신청 "건".
--    v7부터 user_id 없음, 참여자 개개인은 application_attendees에 있다.
--    이 테이블 정의는 최초 생성 시점 기준이라 user_id가 남아있는데,
--    v7-1 섹션에서 drop column으로 제거하니 신경쓰지 않아도 됨)
-- =========================================================
create table applications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  depositor_name_enc bytea not null,
  consent_required boolean not null default false,
  consent_optional boolean not null default false,
  confirmation_code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id) -- v7-1에서 컬럼째 제거됨(기존 회원제 시절 유물)
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

-- select만 grant. insert는 위 정책이 없어서 어차피 막혀 있고, 실제 생성은
-- apply_and_recompute()가 SECURITY DEFINER(테이블 소유자 권한)로 수행하므로 grant 불필요.
grant select on applications to authenticated;


-- =========================================================
-- 4. 확정 로직: apply_and_recompute() — v7에서 submit_application()으로 대체됨(v7-3 참고)
--    아래 정의는 최초 생성 시점 기준으로 남겨둔 것이고, v7-3에서 drop function으로
--    제거되니 신경쓰지 않아도 됨. (참고용) 원래 로직:
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
-- 5. 공개 집계: get_session_stats() — v7-4에서 재작성됨(신청 건수 → 참여 인원 합계)
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
-- 6. profiles.phone_digits — 전화번호 중복 가입 방지
-- (하이픈/공백 제거한 숫자만 비교해 같은 사람의 재가입을 감지)
-- =========================================================
alter table profiles
  add column phone_digits text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored;

create unique index profiles_phone_digits_key on profiles (phone_digits);


-- =========================================================
-- 7. naver_links — 네이버 계정 연결 정보
-- (네이버는 Supabase의 auth.identities 시스템을 타지 않는 커스텀 로그인이라
--  naver_id ↔ auth.users.id 매핑을 직접 관리한다)
-- =========================================================
create table naver_links (
  naver_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table naver_links enable row level security;

-- 본인에게 연결된 것만 조회 가능. insert/update RLS 정책은 의도적으로 없음
-- → 일반 사용자는 절대 못 씀. 대신 관리자 API(service_role)가 직접 기록.
create policy "naver_links_select_own"
  on naver_links for select
  to authenticated
  using (auth.uid() = user_id);

grant select on naver_links to authenticated;

-- service_role은 RLS는 우회하지만 테이블 권한(GRANT)은 별개라 명시적으로 필요
-- (안 주면 "permission denied for table" 에러 — 실제로 겪은 버그, 기록해둠).
-- 콜백에서 기존 연결 조회(select)도 service_role로 하므로 select도 필요.
grant select, insert, update on naver_links to service_role;


-- =========================================================
-- 8. kakao_links — 카카오 계정 연결 정보
-- (카카오도 이메일만 요청하는 커스텀 로그인으로 전환하면서 Supabase의
--  auth.identities 시스템을 더 이상 안 타므로, naver_links와 동일한
--  패턴으로 kakao_id ↔ auth.users.id 매핑을 직접 관리한다)
-- =========================================================
create table kakao_links (
  kakao_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table kakao_links enable row level security;

create policy "kakao_links_select_own"
  on kakao_links for select
  to authenticated
  using (auth.uid() = user_id);

grant select on kakao_links to authenticated;
grant select, insert, update on kakao_links to service_role;


-- =========================================================
-- 9. find_account_by_email / find_account_by_phone
-- (로그인·가입 시 "이미 가입된 계정"과 가입 수단을 판별하는 service_role
--  전용 RPC. auth.users는 Data API로 노출 안 되고 admin.listUsers()도
--  이메일 필터가 없어(@supabase/supabase-js 2.112.0 확인) SECURITY
--  DEFINER로 직접 조회한다. anon/authenticated에 실행 권한을 주면
--  이메일/전화번호 계정-존재-여부 열거 공격이 되므로 절대 주지 않는다.
--
--  has_password는 encrypted_password의 존재 여부로 판단하지 않는다 —
--  admin.createUser()는 비밀번호를 안 넘겨도 내부적으로 랜덤 비밀번호를
--  자동 생성해 encrypted_password를 채우기 때문에(카카오/네이버 전용
--  계정도 예외 없이 채워짐 — 실제로 겪은 버그), 그 컬럼으로는 "진짜
--  본인이 설정한 비밀번호가 있는지" 구분이 불가능하다. 대신 이메일
--  회원가입(signup/actions.ts) 성공 직후에만 서버가 명시적으로 심어두는
--  app_metadata.has_password 플래그를 쓴다 — app_metadata는 client SDK가
--  건드릴 수 없고 service_role(관리자 API)로만 쓸 수 있어 위조 불가능.
-- =========================================================
create or replace function public.find_account_by_email(p_email text)
returns table (user_id uuid, has_password boolean, provider text)
language sql stable security definer
set search_path = public, auth
as $$
  select u.id,
    coalesce((u.raw_app_meta_data->>'has_password')::boolean, false),
    case when kl.kakao_id is not null then 'kakao'
         when nl.naver_id is not null then 'naver' else null end
  from auth.users u
  left join kakao_links kl on kl.user_id = u.id
  left join naver_links nl on nl.user_id = u.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.find_account_by_email(text) from public;
grant execute on function public.find_account_by_email(text) to service_role;

create or replace function public.find_account_by_phone(p_phone_digits text)
returns table (user_id uuid, provider text)
language sql stable security definer
set search_path = public, auth
as $$
  select p.id,
    case when kl.kakao_id is not null then 'kakao'
         when nl.naver_id is not null then 'naver' else null end
  from profiles p
  left join kakao_links kl on kl.user_id = p.id
  left join naver_links nl on nl.user_id = p.id
  where p.phone_digits = p_phone_digits
  limit 1;
$$;

revoke all on function public.find_account_by_phone(text) from public;
grant execute on function public.find_account_by_phone(text) to service_role;


-- =========================================================
-- v7-1. applications 재설계 — user_id(로그인 계정) 의존 제거
-- =========================================================
drop policy if exists "applications_select_own" on applications;
alter table applications drop column if exists user_id cascade;
-- select 정책/grant를 다시 만들지 않는다 — session_venues와 동일하게 완전히
-- 잠긴 상태 유지. 신청자 본인에게 정보를 보여줄 땐 lookup_application()
-- (v7-4)을 통해서만, 운영자는 대시보드(테이블 소유자 권한)에서 확인.


-- =========================================================
-- v7-2. application_attendees — 그룹 신청의 참여자 개개인
-- (대표 신청자 포함 전원이 여기 한 행씩. 로그인 계정과 무관하게
--  신청 시점에 입력받은 이름/전화/출생년도/닉네임을 그대로 저장한다)
-- =========================================================
create table application_attendees (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade, -- 세션 내 닉네임 유일성 검사용 비정규화
  is_representative boolean not null default false,
  name text not null,
  phone text not null,
  phone_digits text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  birth_year int not null check (birth_year between 1990 and 1999), -- 2026 베타 기준 스냅샷, 연도 지나면 범위 재조정 필요
  nickname text,
  created_at timestamptz not null default now(),
  unique (session_id, nickname) -- Postgres unique는 NULL을 서로 다른 값으로 취급 → 닉네임 미입력자는 제약 예외
);

alter table application_attendees enable row level security;
-- select/insert 정책을 아예 만들지 않음 = anon/authenticated 둘 다 API로 접근 불가
-- (session_venues와 동일 패턴). 생성은 submit_application(), 조회는
-- lookup_application()을 통해서만 — 둘 다 SECURITY DEFINER로 RLS를 우회한다.


-- =========================================================
-- v7-3. submit_application() — 여기 있던 최초 버전은 v8-3에서 완전히
-- 대체됨(암호화 반영 + returns table 대신 composite 타입으로 변경,
-- "실제 겪은 버그" 참고). 같은 세션 안에서 바로 대체된 코드라 두 벌 다
-- 남겨두면 혼동만 줘서 지움 — 실제 정의는 아래 v8-3 섹션 참고.
-- =========================================================
revoke all on function apply_and_recompute(uuid, text, boolean) from public, authenticated;
drop function if exists apply_and_recompute(uuid, text, boolean); -- user_id(로그인) 전제라 되살릴 수 없어 완전 대체


-- =========================================================
-- v7-4. get_session_stats() 재작성 — 신청 건수가 아니라 참여 인원 합계 기준
-- (그룹 신청 도입으로 "신청 1건 = 참여자 1명"이라는 전제가 깨졌기 때문)
-- =========================================================
create or replace function get_session_stats(p_session_id uuid)
returns table (confirmed_count int, waiting_count int)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(case when ap.status = 'confirmed' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' then 1 else 0 end), 0)::int
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where ap.session_id = p_session_id;
$$;
-- 기존 grant(anon, authenticated에 execute)는 함수 시그니처가 그대로라 유지됨, 재부여 불필요.


-- =========================================================
-- v7-5. lookup_application() — 로그인 없이 전화번호+접수번호로 신청 내역 조회
-- (전화번호만으로는 번호를 아는 아무나 남의 신청 정보를 볼 수 있어서
--  접수번호(confirmation_code)까지 같이 요구한다. 둘 중 뭐가 틀렸는지는
--  응답에서 구분하지 않음 — 전화번호 존재 여부 열거 공격 방지)
-- =========================================================
create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, event_date date, slot text,
  status text, payment_status text, confirmation_code text,
  depositor_name text, created_at timestamptz,
  attendees jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select s.title, s.event_date, s.slot,
    ap.status, ap.payment_status, ap.confirmation_code, ap.depositor_name, ap.created_at,
    (select jsonb_agg(jsonb_build_object(
        'name', aa2.name, 'nickname', aa2.nickname, 'is_representative', aa2.is_representative
      ) order by aa2.is_representative desc)
     from application_attendees aa2 where aa2.application_id = ap.id)
  from applications ap
  join sessions s on s.id = ap.session_id
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_digits = p_phone_digits
  limit 1;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;


-- =========================================================
-- v8-1. PII 컬럼 암호화 — application_attendees.name/phone,
-- applications.depositor_name을 평문으로 저장하지 않는다.
-- (전화번호로 중복/조회를 체크하는 구조라 개인정보 보호에 더 신경써야
--  한다는 판단. Supabase는 디스크 암호화를 관리형으로 자동 제공하지만,
--  그건 "테이블을 직접 읽을 수 있는 사람"에게는 방어가 안 됨 — SQL
--  Editor나 service_role 키를 가진 사람이 평문을 그대로 볼 수 있었음.
--  이 섹션은 그 마지막 경로까지 막는다.)
--
-- 키는 Supabase Vault(pgsodium 기반, 이미 활성화돼 있음 확인함)에
-- 저장하고, SECURITY DEFINER 헬퍼 함수로만 꺼내 쓴다 — anon/authenticated
-- 는 vault.decrypted_secrets에 접근 권한이 없어 키 자체를 못 봄.
--
-- 전화번호는 두 가지 형태로 나뉜다:
--  - phone_enc: 복호화 가능한 암호문(pgp_sym_encrypt) — 운영자가 실제
--    연락해야 할 때 decrypt_pii()로 복호화해서 씀.
--  - phone_hash: 복호화 불가능한 HMAC-SHA256 — "같은 번호인지" 매칭
--    (동일 테마 재참여 체크, /lookup 조회)에만 쓰고 원문을 되돌릴 수
--    없음. 매칭 목적이면 애초에 복호화가 필요 없으니 해시가 더 안전함.
--  이름/입금자명은 매칭할 필요가 없어 phone_enc처럼 암호문 하나만 둔다.
-- =========================================================
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_pii_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'app_pii_key',
      '참여자 이름/전화번호/입금자명 암호화 + 전화번호 매칭용 대칭키(v8)'
    );
  end if;
end $$;

create or replace function public.get_pii_key()
returns text
language sql
security definer
set search_path = vault
stable
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'app_pii_key' limit 1;
$$;
revoke all on function public.get_pii_key() from public;

create or replace function public.encrypt_pii(p_plain text)
returns bytea
language sql
security definer
set search_path = public, extensions
stable
as $$
  select case when p_plain is null then null
    else pgp_sym_encrypt(p_plain, public.get_pii_key())
  end;
$$;
revoke all on function public.encrypt_pii(text) from public;

create or replace function public.decrypt_pii(p_cipher bytea)
returns text
language sql
security definer
set search_path = public, extensions
stable
as $$
  select case when p_cipher is null then null
    else pgp_sym_decrypt(p_cipher, public.get_pii_key())
  end;
$$;
revoke all on function public.decrypt_pii(bytea) from public;
-- decrypt_pii는 운영자가 SQL Editor(테이블 소유자 권한)에서 참여자 실명/연락처를
-- 확인해야 할 때 쓰라고 만든 것 — anon/authenticated에는 절대 grant하지 않는다.

create or replace function public.hash_phone(p_phone text)
returns text
language sql
security definer
set search_path = public, extensions
stable
as $$
  select encode(
    hmac(regexp_replace(p_phone, '[^0-9]', '', 'g'), public.get_pii_key(), 'sha256'),
    'hex'
  );
$$;
revoke all on function public.hash_phone(text) from public;


-- =========================================================
-- v8-2. application_attendees / applications 컬럼 교체
-- (테이블이 비어있는 상태에서 실행 — 실제 데이터 있으면 백필 로직 필요)
-- =========================================================
-- phone_digits는 phone에서 파생된 generated column이라 phone을 cascade로
-- 지우면 자동으로 같이 삭제된다(순서 문제로 따로 drop column phone_digits를
-- 명시하면 "다른 객체가 의존한다"는 에러가 남 — 실제로 겪음).
alter table application_attendees
  drop column phone cascade,
  drop column name,
  add column name_enc bytea not null,
  add column phone_enc bytea not null,
  add column phone_hash text not null;

create index if not exists application_attendees_phone_hash_idx
  on application_attendees (phone_hash);

alter table applications
  drop column depositor_name,
  add column depositor_name_enc bytea not null;


-- =========================================================
-- v8-3. submit_application() 재작성 — 암호화/해시 반영
-- 반환 타입을 applications 로우타입에서 별도 composite 타입(application_result)으로
-- 바꿔서 (컬럼이 depositor_name_enc로 바뀌었으니) depositor_name은 방금 입력받은
-- 평문(p_depositor_name)을 그대로 돌려준다 — 어차피 본인이 방금 친 값이라 다시
-- 암호화했다 복호화할 필요가 없고, 덕분에 TS 쪽 Application 타입/actions.ts/
-- ApplyComplete.tsx는 전혀 손댈 필요가 없어졌다.
--
-- 주의: `returns table (id uuid, ...)`로 썼다가 실제로 겪은 버그 — PL/pgSQL은
-- RETURNS TABLE의 컬럼명을 함수 본문 안에 자동으로 변수처럼 주입해버려서,
-- 본문에서 쓰던 `where id = ...`/`where status = ...`같은 바깥 테이블 컬럼
-- 참조가 전부 "column reference is ambiguous" 에러로 깨졌다. composite
-- TYPE은 이 자동 변수 주입이 없어서(SETOF 없이 단일 값 반환) 안전하다.
--
-- 전화번호 충돌 체크는 두 단계다: ①이번에 제출한 attendees 배열 "안에서"
-- 서로 겹치는 번호가 있는지(같은 그룹 자체 중복, v_self_dup_phones) ②DB에
-- 이미 있는 다른 참여자와 겹치는지(동일 테마 재참여, v_dup_phones) — 순서대로
-- 검사해서 둘 다 DETAIL로 충돌 전화번호를 실어 보낸다.
-- =========================================================
drop function if exists public.submit_application(uuid, text, boolean, jsonb);
drop type if exists public.application_result;

create type public.application_result as (
  id uuid,
  session_id uuid,
  depositor_name text,
  agreed_terms boolean,
  confirmation_code text,
  status text,
  payment_status text,
  created_at timestamptz
);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean,
  p_attendees jsonb
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_new_total int;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
begin
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

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 같은 그룹(이번에 제출한 attendees 배열) 안에서 전화번호가 중복되는지도
  -- 체크 — DB에 있는 기존 참여자와의 충돌(아래)과는 별개로, 지금 막 입력한
  -- 대표자/동행자끼리 같은 번호를 실수로 넣은 경우를 잡는다.
  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where s.theme_label = v_session.theme_label
      and ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '이미 같은 테마에 참여하신 분이 포함되어 있어요.' using detail = v_dup_phones;
  end if;

  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
    group by ap.id
  ) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원이 얼마 남지 않았어요. 인원을 줄이거나 다른 회차를 선택해주세요.';
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (session_id, depositor_name_enc, agreed_terms, confirmation_code, status)
  values (
    p_session_id, encrypt_pii(p_depositor_name), p_agreed_terms, v_code,
    case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end
  )
  returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_new_total >= v_session.capacity_max then
    update applications set status = 'confirmed'
    where session_id = p_session_id and status = 'waiting';

    update sessions set status = 'closed' where id = p_session_id;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, v_app.agreed_terms,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, jsonb) from public;
grant execute on function public.submit_application(uuid, text, boolean, jsonb) to anon, authenticated;


-- =========================================================
-- v8-4. lookup_application() 재작성 — 해시 매칭 + 복호화해서 응답
-- =========================================================
create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, event_date date, slot text,
  status text, payment_status text, confirmation_code text,
  depositor_name text, created_at timestamptz,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
begin
  return query
    select s.title, s.event_date, s.slot,
      ap.status, ap.payment_status, ap.confirmation_code,
      decrypt_pii(ap.depositor_name_enc), ap.created_at,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'nickname', aa2.nickname,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;


-- =========================================================
-- v8-5. 운영자용 복호화 뷰 (SQL Editor/Table Editor 전용 — grant 없음)
-- 행사 운영 중 실제 이름/연락처를 확인해야 할 때 이 뷰를 조회한다.
-- 소유자(postgres) 권한으로만 열람 가능 — anon/authenticated는 여전히
-- application_attendees/applications 자체에 접근 불가라 이 뷰도 못 봄.
-- =========================================================
create or replace view public.admin_attendee_view as
select
  aa.id, aa.application_id, aa.session_id, aa.is_representative,
  decrypt_pii(aa.name_enc) as name,
  decrypt_pii(aa.phone_enc) as phone,
  aa.birth_year, aa.nickname, aa.created_at
from application_attendees aa;

create or replace view public.admin_application_view as
select
  ap.id, ap.session_id, decrypt_pii(ap.depositor_name_enc) as depositor_name,
  ap.agreed_terms, ap.confirmation_code, ap.status, ap.payment_status, ap.created_at
from applications ap;


-- =========================================================
-- 시드 데이터: 8/22(토) 오후(비소개팅) · 저녁(소개팅) 2개 회차
-- (베타 상품 정보 & 타임테이블 문서 기준)
-- =========================================================
insert into sessions (
  slug, event_date, slot, title, theme_label,
  start_at, end_at, venue_area,
  price_krw, capacity_min, capacity_confirm_line, capacity_max,
  status, description
) values
(
  '0822-meeting', '2026-08-22', 'afternoon', '8/22(토) 오후 · 비소개팅', '비소개팅',
  '2026-08-22T12:30:00+09:00', '2026-08-22T17:00:00+09:00',
  '서울 신림권',
  69000, 16, 20, 24,
  'open', '방탈출과 미니게임으로 자연스럽게 친해지는 비소개팅 타임. 1부(아이스브레이킹+식사+방탈출) 진행.'
),
(
  '0822-dating', '2026-08-22', 'evening', '8/22(토) 저녁 · 소개팅', '소개팅',
  '2026-08-22T18:30:00+09:00', '2026-08-22T23:45:00+09:00',
  '서울 신림권',
  69000, 16, 20, 24,
  'open', '로테이션 소개팅 + 방탈출을 결합한 저녁 타임. 4인 1조로 랜덤 편성되어 방탈출을 함께 플레이합니다.'
);

-- 상호명은 session_venues에 별도 등록 (event_date로 매칭)
insert into session_venues (session_id, venue_name)
select id, '뮤트스페이스 신림점' from sessions where event_date = '2026-08-22';


-- =========================================================
-- v9-1. sessions/application_attendees — 소개팅 성비 분리 정원
-- (소개팅 회차만 남/여 각각 정원 10명씩 별도로 관리해야 해서 추가.
--  비소개팅 세션은 두 컬럼 다 NULL로 두고 기존 capacity_confirm_line/
--  capacity_max 로직 그대로 사용한다)
-- =========================================================
alter table sessions
  add column capacity_confirm_line_male int,
  add column capacity_confirm_line_female int;

update sessions
  set capacity_confirm_line_male = 10, capacity_confirm_line_female = 10
  where theme_label = '소개팅';

alter table application_attendees
  add column gender text check (gender in ('M', 'F')); -- 비소개팅 참여자는 NULL


-- =========================================================
-- v9-2. submit_application() 재작성 — 소개팅 성비 분리 로직 반영
-- (theme_label = '소개팅'이면: ①그룹 신청 금지, 1인만 ②성별 필수
--  ③확정/대기 판정을 세션 전체 합계가 아니라 해당 성별 합계 vs
--  capacity_confirm_line_male/female로 판정. 전체 정원(capacity_max)
--  도달 시 마감은 비소개팅과 동일하게 적용하되, 대기자 자동 승격은
--  하지 않는다 — 성비가 깨질 수 있는 결정이라 운영자가 SQL Editor에서
--  admin_attendee_view/admin_application_view 보면서 수동으로 판단해
--  확정 처리한다: 예) update applications set status = 'confirmed' where id = '...';
--  비소개팅은 v8-3과 동일하게 그대로 동작한다. 파라미터 시그니처는
--  안 바뀌었으니 create or replace로 충분, 기존 grant도 재부여 불필요.)
-- =========================================================
create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean,
  p_attendees jsonb
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
begin
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

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if v_session.theme_label = '소개팅' then
    if v_group_size <> 1 then
      raise exception '소개팅 회차는 1인 신청만 가능합니다.';
    end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then
      raise exception '성별을 선택해주세요.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 같은 그룹(이번에 제출한 attendees 배열) 안에서 전화번호가 중복되는지도
  -- 체크 — DB에 있는 기존 참여자와의 충돌(아래)과는 별개로, 지금 막 입력한
  -- 대표자/동행자끼리 같은 번호를 실수로 넣은 경우를 잡는다.
  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where s.theme_label = v_session.theme_label
      and ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '이미 같은 테마에 참여하신 분이 포함되어 있어요.' using detail = v_dup_phones;
  end if;

  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
    group by ap.id
  ) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원이 얼마 남지 않았어요. 인원을 줄이거나 다른 회차를 선택해주세요.';
  end if;

  if v_session.theme_label = '소개팅' then
    select coalesce(count(*), 0) into v_gender_total
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id
      and ap.status in ('confirmed', 'waiting')
      and aa.gender = v_gender;

    v_status := case
      when v_gender_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (session_id, depositor_name_enc, agreed_terms, confirmation_code, status)
  values (p_session_id, encrypt_pii(p_depositor_name), p_agreed_terms, v_code, v_status)
  returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_new_total >= v_session.capacity_max then
    if v_session.theme_label <> '소개팅' then
      update applications set status = 'confirmed'
      where session_id = p_session_id and status = 'waiting';
    end if;

    update sessions set status = 'closed' where id = p_session_id;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, v_app.agreed_terms,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;


-- =========================================================
-- v9-3. get_session_stats() 재작성 — 성별 분리 카운트 추가
-- (반환 컬럼이 늘어나 시그니처가 바뀌므로 drop 후 재생성 — application_result
--  때와 동일한 이유로, RETURNS TABLE의 컬럼 구성 변경은 create or replace로 안 됨)
-- =========================================================
drop function if exists get_session_stats(uuid);

create or replace function get_session_stats(p_session_id uuid)
returns table (
  confirmed_count int, waiting_count int,
  male_confirmed_count int, male_waiting_count int,
  female_confirmed_count int, female_waiting_count int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(case when ap.status = 'confirmed' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and aa.gender = 'M' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' and aa.gender = 'M' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and aa.gender = 'F' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' and aa.gender = 'F' then 1 else 0 end), 0)::int
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where ap.session_id = p_session_id;
$$;

revoke all on function get_session_stats(uuid) from public;
grant execute on function get_session_stats(uuid) to anon, authenticated;


-- =========================================================
-- v9-4. lookup_application() 재작성 — 참여내역 조회 화면을 신청 완료 화면과
-- 비슷하게 보여주기 위해 price_krw(무통장입금 안내용)와 참여자별 phone/gender를
-- 추가로 반환. 반환 컬럼이 늘어나 시그니처가 바뀌므로 drop 후 재생성.
-- =========================================================
drop function if exists public.lookup_application(text, text);

create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, event_date date, slot text, price_krw int,
  status text, payment_status text, confirmation_code text,
  depositor_name text, created_at timestamptz,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
begin
  return query
    select s.title, s.event_date, s.slot, s.price_krw,
      ap.status, ap.payment_status, ap.confirmation_code,
      decrypt_pii(ap.depositor_name_enc), ap.created_at,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'phone', decrypt_pii(aa2.phone_enc),
          'nickname', aa2.nickname,
          'gender', aa2.gender,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;


-- =========================================================
-- v10. 테마 리브랜딩("소개팅"/"비소개팅" → "바-ㅇ탈출(ver.소개팅)"/
-- "바-ㅇ탈출(ver.모임)") + 8/29 일정·가격 변경(베타 기준가: 소개팅
-- 55,000원 / 모임 45,000원). theme_label 값 자체가 바뀌므로
-- submit_application() 안의 리터럴 비교(v9-2의 '소개팅' 3곳)도 새
-- 값으로 함께 갱신 — 파라미터 시그니처는 안 바뀌었으니 create or
-- replace로 충분.
-- =========================================================

-- v10-1. submit_application() 재작성 — theme_label 리터럴 비교 값 갱신
create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean,
  p_attendees jsonb
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
begin
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

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then
      raise exception '소개팅 회차는 1인 신청만 가능합니다.';
    end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then
      raise exception '성별을 선택해주세요.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 같은 그룹(이번에 제출한 attendees 배열) 안에서 전화번호가 중복되는지도
  -- 체크 — DB에 있는 기존 참여자와의 충돌(아래)과는 별개로, 지금 막 입력한
  -- 대표자/동행자끼리 같은 번호를 실수로 넣은 경우를 잡는다.
  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where s.theme_label = v_session.theme_label
      and ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '이미 같은 테마에 참여하신 분이 포함되어 있어요.' using detail = v_dup_phones;
  end if;

  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
    group by ap.id
  ) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원이 얼마 남지 않았어요. 인원을 줄이거나 다른 회차를 선택해주세요.';
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_gender_total
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id
      and ap.status in ('confirmed', 'waiting')
      and aa.gender = v_gender;

    v_status := case
      when v_gender_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (session_id, depositor_name_enc, agreed_terms, confirmation_code, status)
  values (p_session_id, encrypt_pii(p_depositor_name), p_agreed_terms, v_code, v_status)
  returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_new_total >= v_session.capacity_max then
    if v_session.theme_label <> '바-ㅇ탈출(ver.소개팅)' then
      update applications set status = 'confirmed'
      where session_id = p_session_id and status = 'waiting';
    end if;

    update sessions set status = 'closed' where id = p_session_id;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, v_app.agreed_terms,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;


-- v10-2. 실제 베타 회차 데이터 갱신 — 8/22 → 8/29, 가격 분리(6.9만원 균일가 →
-- 소개팅 5.5만원/모임 4.5만원), theme_label/title/venue_area 리브랜딩.
-- WHERE절은 변경 전 theme_label 값으로 매칭(딱 2개 행이라 안전).
update sessions
  set event_date = '2026-08-29',
      start_at = '2026-08-29T18:30:00+09:00',
      end_at = '2026-08-29T23:00:00+09:00',
      price_krw = 55000,
      venue_area = '서울 신림역 인근',
      theme_label = '바-ㅇ탈출(ver.소개팅)',
      title = '8/29(토) 저녁 · 바-ㅇ탈출(ver.소개팅)'
  where theme_label = '소개팅';

update sessions
  set event_date = '2026-08-29',
      start_at = '2026-08-29T12:30:00+09:00',
      end_at = '2026-08-29T16:00:00+09:00',
      price_krw = 45000,
      venue_area = '서울 신림역 인근',
      theme_label = '바-ㅇ탈출(ver.모임)',
      title = '8/29(토) 오후 · 바-ㅇ탈출(ver.모임)'
  where theme_label = '비소개팅';


-- v10-3. 베타 가격 최종 확정(2026-08-12) — 정가/할인가 재조정, 할인폭도
-- 2만원 → 2.4만원으로 변경(src/components/home/SessionCard.tsx의
-- BETA_DISCOUNT_KRW도 같이 수정 완료). WHERE절은 v10-2에서 이미 바뀐
-- theme_label 기준으로 매칭.
update sessions set price_krw = 65000 where theme_label = '바-ㅇ탈출(ver.소개팅)';
update sessions set price_krw = 55000 where theme_label = '바-ㅇ탈출(ver.모임)';


-- =========================================================
-- v10-4. sessions.original_price_krw 컬럼 신설(2026-08-12) — 정가를
-- src/components/home/SessionCard.tsx의 BETA_DISCOUNT_KRW 코드 상수로
-- 계산하던 방식(v10-3까지)을 버리고 DB 컬럼으로 이전. 할인폭이 바뀌거나
-- 정가/할인가가 독립적으로 바뀌어도 코드 배포 없이 SQL만으로 반영
-- 가능하도록 하기 위함(v10-3에서 할인폭 자체가 바뀌어 코드까지 다시
-- 배포해야 했던 게 계기). BETA_DISCOUNT_KRW 상수는 코드에서 제거하고
-- SessionCard.tsx가 session.original_price_krw를 그대로 사용하도록 변경.
-- =========================================================
alter table sessions add column original_price_krw int;

update sessions set original_price_krw = 89000 where theme_label = '바-ㅇ탈출(ver.소개팅)';
update sessions set original_price_krw = 79000 where theme_label = '바-ㅇ탈출(ver.모임)';


-- =========================================================
-- v11. 신청 폼 필드 확장 — 성별(전 테마), 경험 횟수, 그룹 비고
-- (2026-08-12 신청 폼 개선 — 사용자 경험/데이터 품질 향상)
-- =========================================================

-- v11-1. application_attendees — 경험 횟수 컬럼 추가
alter table application_attendees
add column if not exists experience_range text check (experience_range is null or experience_range in ('0', '1-50', '50-100', '100-200', '200+'));

-- v11-2. applications — 그룹 비고 컬럼 추가
alter table applications
add column if not exists notes text check (notes is null or char_length(notes) <= 200);

-- v11-3. submit_application() 재작성 — 5-파라미터로 확장
-- 기존 4-파라미터 버전이 오버로드로 남지 않도록 drop 먼저 실행
drop function if exists public.submit_application(uuid, text, boolean, jsonb);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean,
  p_attendees jsonb,
  p_notes text default null
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
begin
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

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then
      raise exception '소개팅 회차는 1인 신청만 가능합니다.';
    end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then
      raise exception '성별을 선택해주세요.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 모든 attendee의 성별 필수 검사 (v11에서 모든 테마로 확대)
  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where a->>'gender' is null or a->>'gender' not in ('M', 'F')
  ) then
    raise exception '모든 참여자의 성별을 선택해주세요.';
  end if;

  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where s.theme_label = v_session.theme_label
      and ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '이미 같은 테마에 참여하신 분이 포함되어 있어요.' using detail = v_dup_phones;
  end if;

  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
    group by ap.id
  ) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원이 얼마 남지 않았어요. 인원을 줄이거나 다른 회차를 선택해주세요.';
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_gender_total
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id
      and ap.status in ('confirmed', 'waiting')
      and aa.gender = v_gender;

    v_status := case
      when v_gender_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (session_id, depositor_name_enc, agreed_terms, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_agreed_terms, v_code, v_status, p_notes)
  returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', ''), nullif(a->>'experience_range', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_new_total >= v_session.capacity_max then
    if v_session.theme_label <> '바-ㅇ탈출(ver.소개팅)' then
      update applications set status = 'confirmed'
      where session_id = p_session_id and status = 'waiting';
    end if;

    update sessions set status = 'closed' where id = p_session_id;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, v_app.agreed_terms,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '닉네임이 이미 사용 중이에요. 다른 닉네임을 선택해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, jsonb, text) from public;
grant execute on function public.submit_application(uuid, text, boolean, jsonb, text) to anon, authenticated;


-- v11-4. lookup_application() 재작성 — experience_range & notes 반환
drop function if exists public.lookup_application(text, text);

create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, event_date date, slot text, price_krw int,
  status text, payment_status text, confirmation_code text,
  depositor_name text, created_at timestamptz, notes text,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
begin
  return query
    select s.title, s.event_date, s.slot, s.price_krw,
      ap.status, ap.payment_status, ap.confirmation_code,
      decrypt_pii(ap.depositor_name_enc), ap.created_at, ap.notes,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'phone', decrypt_pii(aa2.phone_enc),
          'birth_year', aa2.birth_year,
          'nickname', aa2.nickname,
          'gender', aa2.gender,
          'experience_range', aa2.experience_range,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;


-- v11-5. 운영자 뷰 — gender & experience_range & notes 추가
drop view if exists public.admin_attendee_view cascade;

create view public.admin_attendee_view as
select
  aa.id, aa.application_id, aa.session_id, aa.is_representative,
  decrypt_pii(aa.name_enc) as name,
  decrypt_pii(aa.phone_enc) as phone,
  aa.birth_year, aa.nickname, aa.gender, aa.experience_range, aa.created_at
from application_attendees aa;

drop view if exists public.admin_application_view cascade;

create view public.admin_application_view as
select
  ap.id, ap.session_id, decrypt_pii(ap.depositor_name_enc) as depositor_name,
  ap.agreed_terms, ap.confirmation_code, ap.status, ap.payment_status, ap.notes, ap.created_at
from applications ap;

alter table sessions alter column original_price_krw set not null;


-- =========================================================
-- v12. 신청 확정/대기 로직 전면 재설계
-- 모임: 24명 즉시확정, 50명까지 대기, 50명 초과 거부
-- 소개팅: 성별 각 12명 즉시확정, 성별 각 30명까지 대기, 초과 거부
-- 테마 상호배타 체크: 같은 사람 한 테마만 신청 가능
-- 대기번호(waiting_number) 계산 및 노출
-- 3단계 SMS(신청확인/입금확인/참가확정 상기) + 관리자 페이지 준비
-- =========================================================

-- v12-1. sessions 컬럼 조정
-- 모임: capacity_confirm_line 24, capacity_max 50
-- 소개팅: capacity_confirm_line_male/female 12, 새 capacity_max_male/female 30
-- 소개팅 성별 마감: male_closed, female_closed 추가
alter table sessions
  alter column capacity_confirm_line set default 24,
  alter column capacity_max set default 50,
  add column if not exists capacity_max_male int,
  add column if not exists capacity_max_female int,
  add column if not exists male_closed boolean not null default false,
  add column if not exists female_closed boolean not null default false;

-- 기존 시드 데이터(8/22) 업데이트 — 모임만 변경(24→50), 소개팅은 별도 처리
update sessions
  set capacity_confirm_line = 24, capacity_max = 50
  where theme_label = '바-ㅇ탈출(ver.모임)';

update sessions
  set capacity_confirm_line_male = 12, capacity_confirm_line_female = 12,
      capacity_max_male = 30, capacity_max_female = 30
  where theme_label = '바-ㅇ탈출(ver.소개팅)';


-- v12-2. applications 컬럼 추가 (SMS 중복발송 방지 마커)
alter table applications
  add column if not exists confirmation_sms_sent_at timestamptz,
  add column if not exists payment_confirmed_sms_sent_at timestamptz,
  add column if not exists reminder_sms_sent_at timestamptz;


-- v12-3. application_result 타입 갱신
drop type if exists public.application_result cascade;

create type public.application_result as (
  id uuid,
  session_id uuid,
  depositor_name text,
  agreed_terms boolean,
  confirmation_code text,
  status text,
  payment_status text,
  waiting_number int,
  created_at timestamptz
);


-- v12-4. submit_application() 전면 재작성
-- 핵심 변경:
-- - 테마 상호배타: 같은 사람 한 테마만 신청 가능(theme_label 비교 제거)
-- - 사전 마감 체크: 그룹 전체가 못 들어가면 "정원마감:" 에러로 거부
-- - 모임 50명/소개팅 성별 30명 상한 적용
-- - 자동 승격 로직 완전 삭제 (대기자는 영구 대기, 운영자 수동 처리만)
-- - waiting_number 계산(대기자만 계산, 같은 세션/성별 내 순번)
drop function if exists public.submit_application(uuid, text, boolean, jsonb);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_agreed_terms boolean,
  p_attendees jsonb
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
  v_waiting_number int;
begin
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

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  -- 소개팅 조건: 1인 신청, 성별 필수
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then
      raise exception '소개팅 회차는 1인 신청만 가능합니다.';
    end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then
      raise exception '성별을 선택해주세요.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 같은 그룹 내부 전화번호 중복 체크
  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  -- [v12 수정] 테마 상호배타: 테마 불문 활성 신청이 하나라도 있으면 차단
  -- 이전엔 `where s.theme_label = v_session.theme_label`을 비교했지만, 지금은 완전 제거
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones;
  end if;

  -- 현재 인원 계산(소개팅은 해당 성별만)
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_current_total
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id
      and ap.status in ('confirmed', 'waiting')
      and aa.gender = v_gender;
  else
    select coalesce(sum(cnt), 0) into v_current_total
    from (
      select ap.id, count(*) as cnt
      from applications ap
      join application_attendees aa on aa.application_id = ap.id
      where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
      group by ap.id
    ) t;
  end if;

  -- [v12 추가] 사전 마감 체크: 그룹 전체가 못 들어가면 통째로 거부
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_session.male_closed then
      raise exception '정원마감: 남성 참여자의 정원이 마감되었습니다.';
    end if;
    if v_gender = 'F' and v_session.female_closed then
      raise exception '정원마감: 여성 참여자의 정원이 마감되었습니다.';
    end if;
    if v_current_total + 1 > v_session.capacity_max_female then
      raise exception '정원마감: 정원이 모두 찼습니다.';
    end if;
  else
    if v_current_total + v_group_size > v_session.capacity_max then
      raise exception '정원마감: 정원이 모두 찼습니다.';
    end if;
  end if;

  -- 접수번호 생성
  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  -- 확정/대기 판정
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    v_status := case
      when v_current_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

  -- 신청 행 삽입
  insert into applications (session_id, depositor_name_enc, agreed_terms, confirmation_code, status)
  values (p_session_id, encrypt_pii(p_depositor_name), p_agreed_terms, v_code, v_status)
  returning * into v_app;

  -- 참여자 행 삽입
  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  -- [v12 수정] 정원 도달 처리: 자동 승격 로직 없음, 마감 표시만
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then
      update sessions set male_closed = true where id = p_session_id;
    end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then
      update sessions set female_closed = true where id = p_session_id;
    end if;
    -- 양쪽 다 마감되면 세션 전체 마감
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  else
    if v_new_total >= v_session.capacity_max then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  end if;

  -- [v12 추가] waiting_number 계산
  if v_app.status = 'waiting' then
    if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
      select count(*) into v_waiting_number
      from application_attendees aa
      join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id
        and ap.status = 'waiting'
        and aa.gender = v_gender
        and ap.created_at <= v_app.created_at
      group by ap.session_id;
    else
      select count(*) into v_waiting_number
      from applications ap
      where ap.session_id = p_session_id
        and ap.status = 'waiting'
        and ap.created_at <= v_app.created_at;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, v_app.agreed_terms,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, jsonb) from public;
grant execute on function public.submit_application(uuid, text, boolean, jsonb) to anon, authenticated;


-- v12-5. lookup_application() 갱신
-- waiting_number 필드 추가
drop function if exists public.lookup_application(text, text);

create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, event_date date, slot text, price_krw int,
  status text, payment_status text, confirmation_code text,
  depositor_name text, created_at timestamptz,
  waiting_number int,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_session_id uuid;
  v_status text;
  v_theme text;
  v_gender text;
  v_waiting_number int;
begin
  -- 먼저 세션 정보 조회
  select ap.session_id, ap.status, s.theme_label
  into v_session_id, v_status, v_theme
  from applications ap
  join sessions s on s.id = ap.session_id
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  -- waiting_number 계산
  if v_status = 'waiting' then
    if v_theme = '바-ㅇ탈출(ver.소개팅)' then
      select aa2.gender into v_gender
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.confirmation_code = p_confirmation_code
        and aa2.is_representative
      limit 1;

      select count(*) into v_waiting_number
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and aa2.gender = v_gender
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    else
      select count(*) into v_waiting_number
      from applications ap2
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    end if;
  else
    v_waiting_number := null;
  end if;

  return query
    select s.title, s.event_date, s.slot, s.price_krw,
      ap.status, ap.payment_status, ap.confirmation_code,
      decrypt_pii(ap.depositor_name_enc), ap.created_at,
      v_waiting_number,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'phone', decrypt_pii(aa2.phone_enc),
          'nickname', aa2.nickname,
          'gender', aa2.gender,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;


-- v12-6. get_session_stats() — 변화 없음(기존 v9-3 유지)
-- 용도: 비로그인 방문자도 볼 수 있는 "신청 N / 목표 20명" 위젯용
-- 정원/신청 숫자는 더 이상 UI에서 표시하지 않으므로, 이 함수도 내부용으로만 유지


-- v12-7. GRANT 추가 (어드민 페이지 및 외부 크론 용)
grant select on admin_application_view, admin_attendee_view to service_role;
grant select, update on applications to service_role;
grant select on session_venues to service_role;


-- v12-9. submit_application() 파라미터 재정리 (약관 분류)
-- p_agreed_terms를 p_consent_required/p_consent_optional로 분리
-- 필수 약관(이용약관, 개인정보, 등)과 선택 약관(마케팅, 사진 촬영 등)을 분리해서 저장
drop function if exists public.submit_application(uuid, text, boolean, jsonb, text);
drop function if exists public.submit_application(uuid, text, boolean, jsonb);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_consent_required boolean,
  p_consent_optional boolean,
  p_attendees jsonb,
  p_notes text default null
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
  v_waiting_number int;
begin
  if not p_consent_required then
    raise exception '필수 약관에 동의해야 신청할 수 있습니다.';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception '존재하지 않는 회차입니다.';
  end if;
  if v_session.status <> 'open' then
    raise exception '이미 마감된 회차입니다.';
  end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  -- 소개팅 조건: 1인 신청, 성별 필수
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then
      raise exception '소개팅 회차는 1인 신청만 가능합니다.';
    end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then
      raise exception '성별을 선택해주세요.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where (a->>'birth_year')::int not between 1990 and 1999
  ) then
    raise exception '참여자 출생년도는 1990~1999년만 가능합니다.';
  end if;

  -- 같은 그룹 내부 전화번호 중복 체크
  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1
    having count(*) > 1
  ) t;

  if v_self_dup_phones is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones;
  end if;

  -- [v12 수정] 테마 상호배타: 테마 불문 활성 신청이 하나라도 있으면 차단
  -- 이전엔 `where s.theme_label = v_session.theme_label`을 비교했지만, 지금은 완전 제거
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones;
  end if;

  -- 현재 인원 계산(소개팅은 해당 성별만)
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_current_total
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id
      and ap.status in ('confirmed', 'waiting')
      and aa.gender = v_gender;
  else
    select coalesce(sum(cnt), 0) into v_current_total
    from (
      select ap.id, count(*) as cnt
      from applications ap
      join application_attendees aa on aa.application_id = ap.id
      where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting')
      group by ap.id
    ) t;
  end if;

  -- [v12 추가] 사전 마감 체크: 그룹 전체가 못 들어가면 통째로 거부
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_session.male_closed then
      raise exception '정원마감: 남성 참여자의 정원이 마감되었습니다.';
    end if;
    if v_gender = 'F' and v_session.female_closed then
      raise exception '정원마감: 여성 참여자의 정원이 마감되었습니다.';
    end if;
    if v_current_total + 1 > v_session.capacity_max_female then
      raise exception '정원마감: 정원이 모두 찼습니다.';
    end if;
  else
    if v_current_total + v_group_size > v_session.capacity_max then
      raise exception '정원마감: 정원이 모두 찼습니다.';
    end if;
  end if;

  -- 접수번호 생성
  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  -- 확정/대기 판정
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    v_status := case
      when v_current_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

  -- 신청 행 삽입
  insert into applications (session_id, depositor_name_enc, consent_required, consent_optional, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_consent_required, p_consent_optional, v_code, v_status, p_notes)
  returning * into v_app;

  -- 참여자 행 삽입
  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender)
  select
    v_app.id, p_session_id, (ord = 1),
    encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  -- [v12 수정] 정원 도달 처리: 자동 승격 로직 없음, 마감 표시만
  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then
      update sessions set male_closed = true where id = p_session_id;
    end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then
      update sessions set female_closed = true where id = p_session_id;
    end if;
    -- 양쪽 다 마감되면 세션 전체 마감
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  else
    if v_new_total >= v_session.capacity_max then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  end if;

  -- [v12 추가] waiting_number 계산
  if v_app.status = 'waiting' then
    if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
      select count(*) into v_waiting_number
      from application_attendees aa
      join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id
        and ap.status = 'waiting'
        and aa.gender = v_gender
        and ap.created_at <= v_app.created_at
      group by ap.session_id;
    else
      select count(*) into v_waiting_number
      from applications ap
      where ap.session_id = p_session_id
        and ap.status = 'waiting'
        and ap.created_at <= v_app.created_at;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, true,
    v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) from public;
grant execute on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) to anon, authenticated;

-- v12-9. 8/29 회차 시각 변경 — 모임 13:00 / 소개팅 18:00 (2026-08-13)
update sessions
  set start_at = '2026-08-29T18:00:00+09:00',
      end_at = '2026-08-29T22:30:00+09:00'  -- 기존 4.5시간 진행시간 유지
  where theme_label = '바-ㅇ탈출(ver.소개팅)';

update sessions
  set start_at = '2026-08-29T13:00:00+09:00',
      end_at = '2026-08-29T16:30:00+09:00'  -- 기존 3.5시간 진행시간 유지
  where theme_label = '바-ㅇ탈출(ver.모임)';


-- v13. lookup_application 버그 수정(notes/birth_year/experience_range) + cancel_application 신설 (2026-08-14)
-- 배경: v11-4에서 lookup_application이 notes/experience_range를 반환하도록 만들었으나,
--      v12-5에서 함수를 재작성하면서 실수로 이 컬럼들을 빠뜨림.
--      또한 ApplyComplete와 통일하려면 theme_label/venue_area/start_at도 필요.

-- v13-1. lookup_application 수정 (notes/experience_range 복구 + 추가 컬럼)
drop function if exists public.lookup_application(text, text);

create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, theme_label text, venue_area text, start_at timestamptz,
  event_date date, slot text, price_krw int,
  status text, payment_status text, confirmation_code text,
  created_at timestamptz, notes text,
  waiting_number int,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_session_id uuid;
  v_status text;
  v_theme text;
  v_gender text;
  v_waiting_number int;
begin
  -- 먼저 세션 정보 조회
  select ap.session_id, ap.status, s.theme_label
  into v_session_id, v_status, v_theme
  from applications ap
  join sessions s on s.id = ap.session_id
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  -- waiting_number 계산
  if v_status = 'waiting' then
    if v_theme = '바-ㅇ탈출(ver.소개팅)' then
      select aa2.gender into v_gender
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.confirmation_code = p_confirmation_code
        and aa2.is_representative
      limit 1;

      select count(*) into v_waiting_number
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and aa2.gender = v_gender
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    else
      select count(*) into v_waiting_number
      from applications ap2
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    end if;
  else
    v_waiting_number := null;
  end if;

  return query
    select s.title, s.theme_label, s.venue_area, s.start_at,
      s.event_date, s.slot, s.price_krw,
      ap.status, ap.payment_status, ap.confirmation_code,
      ap.created_at, ap.notes,
      v_waiting_number,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'phone', decrypt_pii(aa2.phone_enc),
          'birth_year', aa2.birth_year,
          'nickname', aa2.nickname,
          'gender', aa2.gender,
          'experience_range', aa2.experience_range,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;

-- v14. lookup_application 확대 (end_at/payment_confirmed_sms_sent_at 추가) (2026-08-14)
-- 배경: 신청내역 조회 결과 화면 개편 — 입금확인일 표시 + 참여완료 판별용 행사종료시간 필요

drop function if exists public.lookup_application(text, text);

create or replace function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table (
  session_title text, theme_label text, venue_area text, start_at timestamptz, end_at timestamptz,
  event_date date, slot text, price_krw int,
  status text, payment_status text, confirmation_code text,
  created_at timestamptz, payment_confirmed_sms_sent_at timestamptz, notes text,
  waiting_number int,
  attendees jsonb
)
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_session_id uuid;
  v_status text;
  v_theme text;
  v_gender text;
  v_waiting_number int;
begin
  -- 먼저 세션 정보 조회
  select ap.session_id, ap.status, s.theme_label
  into v_session_id, v_status, v_theme
  from applications ap
  join sessions s on s.id = ap.session_id
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  -- waiting_number 계산
  if v_status = 'waiting' then
    if v_theme = '바-ㅇ탈출(ver.소개팅)' then
      select aa2.gender into v_gender
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.confirmation_code = p_confirmation_code
        and aa2.is_representative
      limit 1;

      select count(*) into v_waiting_number
      from application_attendees aa2
      join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and aa2.gender = v_gender
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    else
      select count(*) into v_waiting_number
      from applications ap2
      where ap2.session_id = v_session_id
        and ap2.status = 'waiting'
        and ap2.created_at <= (
          select ap3.created_at from applications ap3
          where ap3.confirmation_code = p_confirmation_code limit 1
        );
    end if;
  else
    v_waiting_number := null;
  end if;

  return query
    select s.title, s.theme_label, s.venue_area, s.start_at, s.end_at,
      s.event_date, s.slot, s.price_krw,
      ap.status, ap.payment_status, ap.confirmation_code,
      ap.created_at, ap.payment_confirmed_sms_sent_at, ap.notes,
      v_waiting_number,
      (select jsonb_agg(jsonb_build_object(
          'name', decrypt_pii(aa2.name_enc),
          'phone', decrypt_pii(aa2.phone_enc),
          'birth_year', aa2.birth_year,
          'nickname', aa2.nickname,
          'gender', aa2.gender,
          'experience_range', aa2.experience_range,
          'is_representative', aa2.is_representative
        ) order by aa2.is_representative desc)
       from application_attendees aa2 where aa2.application_id = ap.id)
    from applications ap
    join sessions s on s.id = ap.session_id
    join application_attendees aa on aa.application_id = ap.id
    where ap.confirmation_code = p_confirmation_code
      and aa.phone_hash = v_phone_hash
    limit 1;
end;
$$;

revoke all on function public.lookup_application(text, text) from public;
grant execute on function public.lookup_application(text, text) to anon, authenticated;

-- v13-2. cancel_application 신설
create or replace function public.cancel_application(p_phone_digits text, p_confirmation_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_application_id uuid;
begin
  select ap.id into v_application_id
  from applications ap
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
    and ap.status <> 'cancelled'
  limit 1;

  if v_application_id is null then
    raise exception '이미 취소되었거나 일치하는 신청 내역을 찾을 수 없어요.';
  end if;

  update applications set status = 'cancelled', payment_status = 'cancelled'
    where id = v_application_id;

  return true;
end;
$$;

revoke all on function public.cancel_application(text, text) from public;
grant execute on function public.cancel_application(text, text) to anon, authenticated;

-- =========================================================
-- v15. check_active_applications() 신규 — 참가 신청 1단계 사전 중복 체크
-- (submit_application()의 크로스테마 활성 신청 판정 로직과 동일 기준.
--  제출 전에 미리 확인만 하고, 최종 검증은 여전히 submit_application()이 담당)
-- =========================================================
create or replace function public.check_active_applications(p_phones text[])
returns text[]
language sql
security definer
set search_path = public, extensions
stable
as $$
  select coalesce(array_agg(distinct phone), array[]::text[])
  from unnest(p_phones) as phone
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(phone)
  );
$$;

revoke all on function public.check_active_applications(text[]) from public;
grant execute on function public.check_active_applications(text[]) to anon, authenticated;

-- =========================================================
-- v16. decrypt_pii() service_role grant 누락 수정 (2026-08-15)
-- v12-7에서 admin_application_view/admin_attendee_view에 대한 select 권한을
-- service_role에 부여했지만, 뷰가 내부적으로 호출하는 decrypt_pii()에는
-- grant를 빠뜨려 어드민 페이지에서 "permission denied for function
-- decrypt_pii" 에러가 나던 문제 수정. anon/authenticated에는 여전히
-- 미부여(PII 복호화는 서버 사이드 어드민 전용 유지).
-- =========================================================
grant execute on function public.decrypt_pii(bytea) to service_role;

-- v17. applications 테이블 — 환불 계좌 정보 컬럼 (프로덕션 선반영분 문서화, 2026-08-15)
-- 취소 기능에서 환불 금액/계좌를 기록해야 해서 추가된 컬럼들.
-- refund_account_number_enc / refund_account_holder_enc는 PII이므로
-- encrypt_pii() 함수로 암호화되어 저장됨(복호화는 decrypt_pii() 사용).
-- refund_bank_name은 PII가 아니므로 평문 저장.
-- =========================================================
alter table applications
  add column if not exists refund_bank_name text,
  add column if not exists refund_account_number_enc bytea,
  add column if not exists refund_account_holder_enc bytea;

-- v18. cancel_application() 함수 갱신 — 환불 계좌 정보 저장 (2026-08-15)
-- v13-2의 2-param 버전에서 3개 환불 파라미터 추가로 확장.
-- 기존: cancel_application(text, text) — 전화번호 + 접수번호만
-- 현행: cancel_application(text, text, text, text, text) — 위 2개 + 환불계좌 3개
-- 환불 파라미터는 모두 optional(기본값 null), DB 저장 시 account 정보는 encrypt_pii() 암호화.
-- =========================================================
create or replace function public.cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text DEFAULT NULL::text, p_refund_account_number text DEFAULT NULL::text, p_refund_account_holder text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_application_id uuid;
begin
  select ap.id into v_application_id
  from applications ap
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
    and ap.status <> 'cancelled'
  limit 1;

  if v_application_id is null then
    raise exception '이미 취소되었거나 일치하는 신청 내역을 찾을 수 없어요.';
  end if;

  update applications set
    status = 'cancelled',
    payment_status = 'cancelled',
    refund_bank_name = p_refund_bank_name,
    refund_account_number_enc = case when p_refund_account_number is not null then encrypt_pii(p_refund_account_number) else null end,
    refund_account_holder_enc = case when p_refund_account_holder is not null then encrypt_pii(p_refund_account_holder) else null end
  where id = v_application_id;

  return true;
end;
$function$;

-- v19. admin_application_view 갱신 — 환불 정보 컬럼 추가 (2026-08-15)
-- 어드민 페이지에서 취소된 신청의 환불 계좌 정보를 조회할 수 있도록
-- refund_bank_name / refund_account_number / refund_account_holder 컬럼 추가.
-- account 정보는 DB에서 암호화되어 있으므로 복호화(decrypt_pii)해서 노출.
-- =========================================================
create or replace view public.admin_application_view as
select
  ap.id,
  ap.session_id,
  decrypt_pii(ap.depositor_name_enc) as depositor_name,
  ap.agreed_terms,
  ap.confirmation_code,
  ap.status,
  ap.payment_status,
  ap.notes,
  ap.created_at,
  ap.refund_bank_name,
  decrypt_pii(ap.refund_account_number_enc) as refund_account_number,
  decrypt_pii(ap.refund_account_holder_enc) as refund_account_holder
from applications ap;

-- v20. submit_application() 재작성 — p_agreed_terms를 p_consent_required/
-- p_consent_optional로 분리 (2026-08-15)
-- 배경: main의 actions.ts가 이미 p_consent_required/p_consent_optional로 RPC를
-- 호출하도록 배포돼 있었는데(41743a7), 프로덕션 DB 함수는 여전히 p_agreed_terms
-- 1개만 받는 옛 시그니처였음 — 즉 배포 이후 모든 신청이 "Could not find the
-- function" 에러로 100% 실패하고 있었다. 이 마이그레이션으로 복구함.
--
-- 주의: 프로덕션의 실제 함수 정의(pg_get_functiondef로 직접 확인)는 이 파일의
-- v12-9 섹션과 이미 달랐다 — 출생년도 검증이 1987~2006 통합 범위로 바뀌어 있었고,
-- application_attendees에 experience_range를 저장하며, 전원 성별 필수 검증이
-- 추가돼 있었다. 이 변경이 언제 어떻게 반영됐는지는 기록이 없다(ad-hoc 변경 재발
-- 사례). 이번 v20은 그 "실제로 살아있던 로직"을 그대로 보존하면서 파라미터만
-- 교체한 것이다 — 즉 v12-9 섹션은 이미 실제 프로덕션 상태와 다른 죽은 기록이며,
-- v20이 실제로 프로덕션/테스트 양쪽에 적용된 최종 상태다.
--
-- 알려진 잔여 이슈: admin_application_view(v19)가 여전히 ap.agreed_terms를
-- 참조한다. applications.agreed_terms 컬럼은 이제 이 함수에서 채워지지 않아
-- (항상 default false) 어드민 화면의 "동의 여부"가 부정확하게 표시된다.
-- consent_required/consent_optional 기준으로 뷰를 갱신하는 후속 마이그레이션 필요.
alter table public.applications
  add column if not exists consent_required boolean not null default false,
  add column if not exists consent_optional boolean not null default false;

drop function if exists public.submit_application(uuid, text, boolean, jsonb, text);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_consent_required boolean,
  p_consent_optional boolean,
  p_attendees jsonb,
  p_notes text default null
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
  v_waiting_number int;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  select * into v_session from sessions where id = p_session_id for update;
  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then raise exception '소개팅 회차는 1인 신청만 가능합니다.'; end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then raise exception '성별을 선택해주세요.'; end if;
  end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1987 and 2006) then
    raise exception '참여자 출생년도는 1987~2006년 범위만 가능합니다.';
  end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a where a->>'gender' is null or a->>'gender' not in ('M', 'F')) then
    raise exception '모든 참여자의 성별을 선택해주세요.';
  end if;

  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup_phones is not null then raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones; end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones from jsonb_array_elements(p_attendees) a
  where exists (select 1 from application_attendees aa join applications ap on ap.id = aa.application_id where ap.status <> 'cancelled' and aa.phone_hash = hash_phone(a->>'phone'));
  if v_dup_phones is not null then raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones; end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_current_total from application_attendees aa join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') and aa.gender = v_gender;
  else
    select coalesce(sum(cnt), 0) into v_current_total from (select ap.id, count(*) as cnt from applications ap join application_attendees aa on aa.application_id = ap.id where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') group by ap.id) t;
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_session.male_closed then raise exception '정원마감: 남성 참여자의 정원이 마감되었습니다.'; end if;
    if v_gender = 'F' and v_session.female_closed then raise exception '정원마감: 여성 참여자의 정원이 마감되었습니다.'; end if;
    if v_current_total + 1 > v_session.capacity_max_female then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  else
    if v_current_total + v_group_size > v_session.capacity_max then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    v_status := case when v_current_total + 1 <= (case when v_gender = 'M' then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end) then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line then 'confirmed' else 'waiting' end;
  end if;

  insert into applications (session_id, depositor_name_enc, consent_required, consent_optional, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_consent_required, p_consent_optional, v_code, v_status, p_notes) returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1), encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', ''), nullif(a->>'experience_range', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then update sessions set male_closed = true where id = p_session_id; end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then update sessions set female_closed = true where id = p_session_id; end if;
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then update sessions set status = 'closed' where id = p_session_id; end if;
  else
    if v_new_total >= v_session.capacity_max then update sessions set status = 'closed' where id = p_session_id; end if;
  end if;

  if v_app.status = 'waiting' then
    if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
      select count(*) into v_waiting_number from application_attendees aa join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id and ap.status = 'waiting' and aa.gender = v_gender and ap.created_at <= v_app.created_at group by ap.session_id;
    else
      select count(*) into v_waiting_number from applications ap where ap.session_id = p_session_id and ap.status = 'waiting' and ap.created_at <= v_app.created_at;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, true, v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) from public;
grant execute on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) to anon, authenticated;

-- v21. admin_application_view 갱신 — agreed_terms 대신 consent_required/
-- consent_optional 노출 (2026-08-15)
-- v20에서 submit_application()이 더 이상 agreed_terms를 채우지 않게 되면서
-- (해당 컬럼은 not null default false로만 남음) 이 뷰의 agreed_terms가 항상
-- false만 보여주는 죽은 컬럼이 됐다. CREATE OR REPLACE VIEW는 기존 컬럼을
-- 제거할 수 없어(PostgreSQL 제약) DROP 후 재생성함 — 이 뷰에 의존하는 다른
-- 뷰/함수가 없음을 pg_depend로 먼저 확인했다.
drop view if exists public.admin_application_view;

create view public.admin_application_view as
select
  ap.id,
  ap.session_id,
  decrypt_pii(ap.depositor_name_enc) as depositor_name,
  ap.consent_required,
  ap.consent_optional,
  ap.confirmation_code,
  ap.status,
  ap.payment_status,
  ap.notes,
  ap.created_at,
  ap.refund_bank_name,
  decrypt_pii(ap.refund_account_number_enc) as refund_account_number,
  decrypt_pii(ap.refund_account_holder_enc) as refund_account_holder
from applications ap;

grant select on admin_application_view to service_role;

-- v22. sessions 테이블에 service_role SELECT grant 추가 (2026-08-15)
-- 어드민 페이지(createAdminClient, service_role 키 사용)가 sessions 테이블을
-- 조회할 때 "permission denied for table sessions"로 대시보드/세션 상세 페이지가
-- 모두 실패하고 있었음 — v21 검증 중 발견. 언제부터 이 grant가 빠졌는지는
-- 기록이 없다(ad-hoc 변경 추정). sessions는 원래 "조회는 전체 공개" 정책이라
-- service_role에 select를 열어줘도 위험 없음.
grant select on public.sessions to service_role;

-- v23. content_group 신설 + 상호배타 스코프 조정 + 출생년도 테마별 재분리 +
-- sessions.status 'cancelled' 추가 + session_venues.venue_address 신설 (2026-08-15)
-- 배경: WYE-73(참가~종료 프로세스 문서화)에서 크로스테마 배타 로직의 실제
-- 의도가 확인됨 — "테마 전체 불문 차단"이 아니라 "같은 컨텐츠(바-ㅇ탈출)
-- 안에서만 배타"가 맞다. 지금은 컨텐츠가 바-ㅇ탈출(소개팅/그룹) 하나뿐이라
-- 전역 차단과 결과가 우연히 같았지만, 새 컨텐츠가 생기면 잘못 차단하게 되므로
-- content_group 개념을 도입해 지금 바로잡는다. 또한 출생년도 서버 검증이 v20
-- 어딘가에서(기록 없는 ad-hoc 변경) 전 테마 통합 1987~2006으로 바뀌어 있던
-- 드리프트를 소개팅(1990~1999)/그룹(1987~2006) 재분리로 수정하고, 최소인원
-- 미달로 인한 회차 취소를 정원마감('closed')과 구분하기 위해 status에
-- 'cancelled'를 추가하며, 문자3(전날안내) 템플릿에 필요한 정확한 주소를
-- 저장할 컬럼을 session_venues에 추가한다.

alter table sessions add column if not exists content_group text;

-- 지금 존재하는 두 베타 세션(0829-meeting/0829-dating)은 같은 컨텐츠("바탈출")이므로
-- 동일 값으로 시드한다. 앞으로 새 컨텐츠가 생기면 시드 SQL에서 다른 값을 명시할 것.
update sessions set content_group = 'baotalchul' where content_group is null;

alter table sessions alter column content_group set not null;

alter table sessions drop constraint if exists sessions_status_check;
alter table sessions add constraint sessions_status_check check (status in ('open', 'closed', 'cancelled'));

alter table session_venues add column if not exists venue_address text;

drop function if exists public.submit_application(uuid, text, boolean, boolean, jsonb, text);

create or replace function public.submit_application(
  p_session_id uuid,
  p_depositor_name text,
  p_consent_required boolean,
  p_consent_optional boolean,
  p_attendees jsonb,
  p_notes text default null
)
returns public.application_result
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session sessions%rowtype;
  v_group_size int;
  v_current_total int;
  v_gender_total int;
  v_gender text;
  v_new_total int;
  v_status text;
  v_code text;
  v_app applications%rowtype;
  v_dup_phones text;
  v_self_dup_phones text;
  v_waiting_number int;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  select * into v_session from sessions where id = p_session_id for update;
  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_group_size <> 1 then raise exception '소개팅 회차는 1인 신청만 가능합니다.'; end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then raise exception '성별을 선택해주세요.'; end if;
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1990 and 1999) then
      raise exception '참여자 출생년도는 1990~1999년 범위만 가능합니다.';
    end if;
  else
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1987 and 2006) then
      raise exception '참여자 출생년도는 1987~2006년 범위만 가능합니다.';
    end if;
  end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a where a->>'gender' is null or a->>'gender' not in ('M', 'F')) then
    raise exception '모든 참여자의 성별을 선택해주세요.';
  end if;

  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup_phones is not null then raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones; end if;

  -- 크로스테마 배타를 content_group 단위로 스코프 (v23) — 같은 컨텐츠 안에서만
  -- 배타이고, 다른 컨텐츠(향후 신설)는 서로 막지 않는다.
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones from jsonb_array_elements(p_attendees) a
  where exists (
    select 1 from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
      and s.content_group = v_session.content_group
  );
  if v_dup_phones is not null then raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones; end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    select coalesce(count(*), 0) into v_current_total from application_attendees aa join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') and aa.gender = v_gender;
  else
    select coalesce(sum(cnt), 0) into v_current_total from (select ap.id, count(*) as cnt from applications ap join application_attendees aa on aa.application_id = ap.id where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') group by ap.id) t;
  end if;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_session.male_closed then raise exception '정원마감: 남성 참여자의 정원이 마감되었습니다.'; end if;
    if v_gender = 'F' and v_session.female_closed then raise exception '정원마감: 여성 참여자의 정원이 마감되었습니다.'; end if;
    if v_current_total + 1 > v_session.capacity_max_female then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  else
    if v_current_total + v_group_size > v_session.capacity_max then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    v_status := case when v_current_total + 1 <= (case when v_gender = 'M' then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end) then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line then 'confirmed' else 'waiting' end;
  end if;

  insert into applications (session_id, depositor_name_enc, consent_required, consent_optional, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_consent_required, p_consent_optional, v_code, v_status, p_notes) returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1), encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', ''), nullif(a->>'experience_range', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then update sessions set male_closed = true where id = p_session_id; end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then update sessions set female_closed = true where id = p_session_id; end if;
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then update sessions set status = 'closed' where id = p_session_id; end if;
  else
    if v_new_total >= v_session.capacity_max then update sessions set status = 'closed' where id = p_session_id; end if;
  end if;

  if v_app.status = 'waiting' then
    if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
      select count(*) into v_waiting_number from application_attendees aa join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id and ap.status = 'waiting' and aa.gender = v_gender and ap.created_at <= v_app.created_at group by ap.session_id;
    else
      select count(*) into v_waiting_number from applications ap where ap.session_id = p_session_id and ap.status = 'waiting' and ap.created_at <= v_app.created_at;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, true, v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

revoke all on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) from public;
grant execute on function public.submit_application(uuid, text, boolean, boolean, jsonb, text) to anon, authenticated;

-- v24. theme_name/session_type 컬럼 분리 + submit_application()/lookup_application()
-- theme_label 문자열 의존 제거 (2026-08-16)
-- 배경: 세션의 "테마명+타입"이 theme_label 하나의 문자열('바-ㅇ탈출(ver.소개팅)')에
-- 인코딩되어 있고, submit_application()이 이 문자열을 8곳에서 직접 비교하고 있었다
-- (2026-08-14 이 함수의 파라미터 개수를 착각해 프로덕션 버전을 삭제한 사고가 났던
-- 바로 그 함수). theme_name("바-ㅇ탈출")/session_type("그룹"/"소개팅")을 별도
-- 컬럼으로 분리해, 앞으로 세션을 추가할 때 이 두 값 + 날짜만 넣으면 title/theme_label이
-- 자동 생성되도록 하고, submit_application()/lookup_application()의 비교 기준도
-- session_type으로 옮긴다. title/theme_label 컬럼과 기존 포맷(SMS/어드민/공유버튼에서
-- 여전히 사용)은 그대로 유지 — 손으로 안 넣으면 트리거가 자동 채움.
-- 실제 적용 전 wouldyouescape_test(도쿄) 프로젝트에서 더미 신청 2건(그룹/소개팅)으로
-- submit_application()/lookup_application() 회귀 검증 완료 후 프로덕션에 동일 적용.

alter table sessions
  add column theme_name text,
  add column session_type text;

update sessions set
  theme_name = '바-ㅇ탈출',
  session_type = case when theme_label = '바-ㅇ탈출(ver.소개팅)' then '소개팅' else '그룹' end;

alter table sessions
  alter column theme_name set not null,
  alter column session_type set not null,
  add constraint sessions_session_type_check check (session_type in ('그룹', '소개팅'));

create or replace function sessions_generate_labels() returns trigger as $$
declare
  v_weekday text;
  v_slot_label text;
begin
  if new.theme_label is null then
    new.theme_label := new.theme_name || '(ver.' ||
      (case when new.session_type = '소개팅' then '소개팅' else '모임' end) || ')';
  end if;

  if new.title is null then
    v_weekday := (array['일','월','화','수','목','금','토'])[extract(dow from new.event_date)::int + 1];
    v_slot_label := case new.slot when 'afternoon' then '오후' when 'evening' then '저녁' else new.slot end;
    new.title := to_char(new.event_date, 'MM/DD') || '(' || v_weekday || ') ' || v_slot_label || ' · ' || new.theme_label;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_sessions_generate_labels
  before insert on sessions
  for each row execute function sessions_generate_labels();

-- submit_application() 재작성 — v_session.theme_label = '바-ㅇ탈출(ver.소개팅)'
-- 비교 8곳을 v_session.session_type = '소개팅'으로 텍스트만 치환. 시그니처
-- (uuid,text,boolean,boolean,jsonb,text)는 그대로라 CREATE OR REPLACE만으로 충분 —
-- 여러 버전이 공존하는 상황 자체를 안 만듦. 그 외 로직(정원 계산, 대기번호,
-- 출생년도 검증 등)은 한 글자도 안 건드림.
create or replace function public.submit_application(
  p_session_id uuid, p_depositor_name text, p_consent_required boolean,
  p_consent_optional boolean, p_attendees jsonb, p_notes text default null::text
) returns application_result
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_session sessions%rowtype;
  v_group_size int; v_current_total int; v_gender_total int; v_gender text;
  v_new_total int; v_status text; v_code text; v_app applications%rowtype;
  v_dup_phones text; v_self_dup_phones text; v_waiting_number int;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  select * into v_session from sessions where id = p_session_id for update;
  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;

  if v_session.session_type = '소개팅' then
    if v_group_size <> 1 then raise exception '소개팅 회차는 1인 신청만 가능합니다.'; end if;
    v_gender := p_attendees->0->>'gender';
    if v_gender is null or v_gender not in ('M', 'F') then raise exception '성별을 선택해주세요.'; end if;
  end if;

  if v_session.session_type = '소개팅' then
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1990 and 1999) then
      raise exception '참여자 출생년도는 1990~1999년 범위만 가능합니다.';
    end if;
  else
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1987 and 2006) then
      raise exception '참여자 출생년도는 1987~2006년 범위만 가능합니다.';
    end if;
  end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a where a->>'gender' is null or a->>'gender' not in ('M', 'F')) then
    raise exception '모든 참여자의 성별을 선택해주세요.';
  end if;

  select string_agg(distinct phone, ',') into v_self_dup_phones
  from (select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup_phones is not null then raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.' using detail = v_self_dup_phones; end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones from jsonb_array_elements(p_attendees) a
  where exists (
    select 1 from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
      and s.content_group = v_session.content_group
  );
  if v_dup_phones is not null then raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones; end if;

  if v_session.session_type = '소개팅' then
    select coalesce(count(*), 0) into v_current_total from application_attendees aa join applications ap on ap.id = aa.application_id
    where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') and aa.gender = v_gender;
  else
    select coalesce(sum(cnt), 0) into v_current_total from (select ap.id, count(*) as cnt from applications ap join application_attendees aa on aa.application_id = ap.id where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting') group by ap.id) t;
  end if;

  if v_session.session_type = '소개팅' then
    if v_gender = 'M' and v_session.male_closed then raise exception '정원마감: 남성 참여자의 정원이 마감되었습니다.'; end if;
    if v_gender = 'F' and v_session.female_closed then raise exception '정원마감: 여성 참여자의 정원이 마감되었습니다.'; end if;
    if v_current_total + 1 > v_session.capacity_max_female then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  else
    if v_current_total + v_group_size > v_session.capacity_max then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  if v_session.session_type = '소개팅' then
    v_status := case when v_current_total + 1 <= (case when v_gender = 'M' then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end) then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line then 'confirmed' else 'waiting' end;
  end if;

  insert into applications (session_id, depositor_name_enc, consent_required, consent_optional, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_consent_required, p_consent_optional, v_code, v_status, p_notes) returning * into v_app;

  insert into application_attendees (application_id, session_id, is_representative, name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1), encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
    (a->>'birth_year')::int, nullif(a->>'nickname', ''), nullif(a->>'gender', ''), nullif(a->>'experience_range', '')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  v_new_total := v_current_total + v_group_size;

  if v_session.session_type = '소개팅' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then update sessions set male_closed = true where id = p_session_id; end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then update sessions set female_closed = true where id = p_session_id; end if;
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then update sessions set status = 'closed' where id = p_session_id; end if;
  else
    if v_new_total >= v_session.capacity_max then update sessions set status = 'closed' where id = p_session_id; end if;
  end if;

  if v_app.status = 'waiting' then
    if v_session.session_type = '소개팅' then
      select count(*) into v_waiting_number from application_attendees aa join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id and ap.status = 'waiting' and aa.gender = v_gender and ap.created_at <= v_app.created_at group by ap.session_id;
    else
      select count(*) into v_waiting_number from applications ap where ap.session_id = p_session_id and ap.status = 'waiting' and ap.created_at <= v_app.created_at;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, true, v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$function$;

-- lookup_application() 재작성 — 반환 컬럼 구성이 바뀌어(theme_name/session_type
-- 추가) CREATE OR REPLACE로는 안 되고 DROP 후 재생성이 필요했다(에러: "cannot
-- change return type of existing function"). DROP은 grant도 같이 날리므로
-- 트랜잭션 안에서 재생성 직후 grant까지 반드시 같이 실행할 것.
begin;

drop function lookup_application(text, text);

create function public.lookup_application(p_phone_digits text, p_confirmation_code text)
returns table(
  session_title text, theme_label text, theme_name text, session_type text,
  venue_area text, start_at timestamptz, end_at timestamptz, event_date date, slot text,
  price_krw integer, status text, payment_status text, confirmation_code text,
  created_at timestamptz, payment_confirmed_sms_sent_at timestamptz, notes text,
  waiting_number integer, attendees jsonb
)
language plpgsql stable security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_session_id uuid; v_status text; v_session_type text; v_gender text; v_waiting_number int;
begin
  select ap.session_id, ap.status, s.session_type into v_session_id, v_status, v_session_type
  from applications ap join sessions s on s.id = ap.session_id join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code and aa.phone_hash = v_phone_hash limit 1;

  if v_status = 'waiting' then
    if v_session_type = '소개팅' then
      select aa2.gender into v_gender from application_attendees aa2 join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id and ap2.confirmation_code = p_confirmation_code and aa2.is_representative limit 1;
      select count(*) into v_waiting_number from application_attendees aa2 join applications ap2 on ap2.id = aa2.application_id
      where ap2.session_id = v_session_id and ap2.status = 'waiting' and aa2.gender = v_gender and ap2.created_at <= (select ap3.created_at from applications ap3 where ap3.confirmation_code = p_confirmation_code limit 1);
    else
      select count(*) into v_waiting_number from applications ap2 where ap2.session_id = v_session_id and ap2.status = 'waiting' and ap2.created_at <= (select ap3.created_at from applications ap3 where ap3.confirmation_code = p_confirmation_code limit 1);
    end if;
  else
    v_waiting_number := null;
  end if;

  return query
  select s.title, s.theme_label, s.theme_name, s.session_type, s.venue_area, s.start_at, s.end_at, s.event_date, s.slot, s.price_krw, ap.status, ap.payment_status, ap.confirmation_code, ap.created_at, ap.payment_confirmed_sms_sent_at, ap.notes, v_waiting_number,
    (select jsonb_agg(jsonb_build_object('name', decrypt_pii(aa2.name_enc), 'phone', decrypt_pii(aa2.phone_enc), 'birth_year', aa2.birth_year, 'nickname', aa2.nickname, 'gender', aa2.gender, 'experience_range', aa2.experience_range, 'is_representative', aa2.is_representative) order by aa2.is_representative desc)
     from application_attendees aa2 where aa2.application_id = ap.id)
  from applications ap join sessions s on s.id = ap.session_id join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code and aa.phone_hash = v_phone_hash limit 1;
end;
$function$;

grant execute on function public.lookup_application(text, text) to anon, authenticated;

commit;
