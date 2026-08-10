-- 우주이스케이프 스키마 v8
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
  depositor_name text not null,
  agreed_terms boolean not null default false,
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
  event_date, slot, title, theme_label,
  start_at, end_at, venue_area,
  price_krw, capacity_min, capacity_confirm_line, capacity_max,
  status, description
) values
(
  '2026-08-22', 'afternoon', '8/22(토) 오후 · 비소개팅', '비소개팅',
  '2026-08-22T12:30:00+09:00', '2026-08-22T17:00:00+09:00',
  '서울 신림권',
  69000, 16, 20, 24,
  'open', '방탈출과 미니게임으로 자연스럽게 친해지는 비소개팅 타임. 1부(아이스브레이킹+식사+방탈출) 진행.'
),
(
  '2026-08-22', 'evening', '8/22(토) 저녁 · 소개팅', '소개팅',
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
