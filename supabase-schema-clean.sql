-- 우주이스케이프 스키마 (정리 완료 버전)
-- 로그인 시스템(v1~v9) 유지 + 비회원 구매 시스템(v10~v19) + 최신 추가사항
-- 함수의 중간 버전 제거 (최종 버전만 유지)
-- 초기 데이터 insert와 후속 update 통합

-- =========================================================
-- 1. profiles (회원 부가정보 — auth.users 확장)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  birth_date date not null,
  gender text not null check (gender in ('M', 'F')),
  created_at timestamptz not null default now(),
  phone_digits text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored
);

alter table profiles enable row level security;

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

grant select, insert, update on profiles to authenticated;

create unique index profiles_phone_digits_key on profiles (phone_digits);


-- =========================================================
-- 2. sessions (회차 — 방탈출 테마 목록이 아니라 날짜+타임 단위 상품)
-- =========================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  event_date date not null,
  slot text not null check (slot in ('afternoon', 'evening')),
  title text not null,
  theme_label text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  venue_area text not null,
  price_krw int not null,
  original_price_krw int not null,
  capacity_min int not null default 16,
  capacity_confirm_line int not null default 24,
  capacity_max int not null default 50,
  capacity_confirm_line_male int,
  capacity_confirm_line_female int,
  capacity_max_male int,
  capacity_max_female int,
  male_closed boolean not null default false,
  female_closed boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed')),
  description text,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "sessions_select_public"
  on sessions for select
  using (true);

grant select on sessions to anon, authenticated;


-- =========================================================
-- 2b. session_venues (상호명 — 의도적으로 비공개)
-- =========================================================
create table session_venues (
  session_id uuid primary key references sessions(id) on delete cascade,
  venue_name text not null,
  created_at timestamptz not null default now()
);

alter table session_venues enable row level security;


-- =========================================================
-- 3. applications (참가 신청 — 그룹 단위의 신청 "건")
-- =========================================================
create table applications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  depositor_name_enc bytea not null,
  agreed_terms boolean not null default false,
  confirmation_code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 200),
  confirmation_sms_sent_at timestamptz,
  payment_confirmed_sms_sent_at timestamptz,
  reminder_sms_sent_at timestamptz,
  consent_no_rebooking boolean not null default false,
  consent_phone_collection boolean not null default false,
  consent_proxy_for_group boolean,
  consent_photo boolean not null default false,
  consent_marketing boolean not null default false,
  refund_bank_name text,
  refund_account_number_enc bytea,
  refund_account_holder_enc bytea,
  created_at timestamptz not null default now()
);

alter table applications enable row level security;

grant select on applications to authenticated;


-- =========================================================
-- 3b. application_attendees (그룹 신청의 참여자 개개인)
-- =========================================================
create table application_attendees (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  is_representative boolean not null default false,
  name_enc bytea not null,
  phone_enc bytea not null,
  phone_hash text not null,
  birth_year int not null check (birth_year between 1987 and 2006),
  nickname text,
  gender text check (gender in ('M', 'F')),
  experience_range text check (experience_range is null or experience_range in ('0', '1-50', '50-100', '100-200', '200+')),
  created_at timestamptz not null default now(),
  unique (session_id, nickname)
);

alter table application_attendees enable row level security;

create index if not exists application_attendees_phone_hash_idx
  on application_attendees (phone_hash);


-- =========================================================
-- 7. naver_links — 네이버 계정 연결 정보
-- =========================================================
create table naver_links (
  naver_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table naver_links enable row level security;

create policy "naver_links_select_own"
  on naver_links for select
  to authenticated
  using (auth.uid() = user_id);

grant select on naver_links to authenticated;
grant select, insert, update on naver_links to service_role;


-- =========================================================
-- 8. kakao_links — 카카오 계정 연결 정보
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
-- 9. 계정 찾기 함수
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
-- Vault: PII 암호화 키
-- =========================================================
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_pii_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'app_pii_key',
      '참여자 이름/전화번호/입금자명 암호화 + 전화번호 매칭용 대칭키'
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
grant execute on function public.decrypt_pii(bytea) to service_role;

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
-- 공개 집계: get_session_stats()
-- =========================================================
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
-- 신청 처리: submit_application() (v12-8 + consent 필드)
-- =========================================================
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
    where (a->>'birth_year')::int not between 1987 and 2006
  ) then
    raise exception '참여자 출생년도는 1987~2006년 범위만 가능합니다.';
  end if;

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
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
  );

  if v_dup_phones is not null then
    raise exception '다른 테마에 이미 신청하신 분이 포함되어 있어요. 한 테마만 신청 가능합니다.' using detail = v_dup_phones;
  end if;

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

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    v_status := case
      when v_current_total + 1 <= (case when v_gender = 'M'
        then v_session.capacity_confirm_line_male else v_session.capacity_confirm_line_female end)
      then 'confirmed' else 'waiting' end;
  else
    v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
      then 'confirmed' else 'waiting' end;
  end if;

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

  if v_session.theme_label = '바-ㅇ탈출(ver.소개팅)' then
    if v_gender = 'M' and v_current_total + 1 >= v_session.capacity_max_male then
      update sessions set male_closed = true where id = p_session_id;
    end if;
    if v_gender = 'F' and v_current_total + 1 >= v_session.capacity_max_female then
      update sessions set female_closed = true where id = p_session_id;
    end if;
    if (select count(*) from sessions where id = p_session_id and male_closed and female_closed) > 0 then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  else
    if v_new_total >= v_session.capacity_max then
      update sessions set status = 'closed' where id = p_session_id;
    end if;
  end if;

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

revoke all on function public.submit_application(uuid, text, boolean, jsonb, text) from public;
grant execute on function public.submit_application(uuid, text, boolean, jsonb, text) to anon, authenticated;


-- =========================================================
-- 참여내역 조회: lookup_application() (v14 최종 + consent 필드)
-- =========================================================
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
  select ap.session_id, ap.status, s.theme_label
  into v_session_id, v_status, v_theme
  from applications ap
  join sessions s on s.id = ap.session_id
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

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


-- =========================================================
-- 신청 취소: cancel_application() (v18 최종)
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

revoke all on function public.cancel_application(text, text, text, text, text) from public;
grant execute on function public.cancel_application(text, text, text, text, text) to anon, authenticated;


-- =========================================================
-- 1인 다중 활성 신청 사전 체크: check_active_applications()
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
-- 닉네임 중복 확인: check_nickname_available()
-- =========================================================
create or replace function public.check_nickname_available(p_session_id uuid, p_nickname text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from application_attendees
    where session_id = p_session_id
      and nickname = p_nickname
      and nickname is not null
  );
$$;

revoke all on function public.check_nickname_available(uuid, text) from public;
grant execute on function public.check_nickname_available(uuid, text) to anon, authenticated;


-- =========================================================
-- RLS 자동 활성화 트리거: rls_auto_enable()
-- =========================================================
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  execute 'alter table ' || quote_ident(pg_event_trigger_table_spec()) || ' enable row level security';
exception when others then
  null;
end;
$$;

revoke all on function public.rls_auto_enable() from public;


-- =========================================================
-- 운영자 뷰
-- =========================================================
create or replace view public.admin_attendee_view as
select
  aa.id, aa.application_id, aa.session_id, aa.is_representative,
  decrypt_pii(aa.name_enc) as name,
  decrypt_pii(aa.phone_enc) as phone,
  aa.birth_year, aa.nickname, aa.gender, aa.experience_range, aa.created_at
from application_attendees aa;

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

grant select on admin_application_view, admin_attendee_view to service_role;
grant select, update on applications to service_role;
grant select on session_venues to service_role;


-- =========================================================
-- 시드 데이터 (8/29 회차, 최종 상태)
-- =========================================================
insert into sessions (
  slug, event_date, slot, title, theme_label,
  start_at, end_at, venue_area,
  price_krw, original_price_krw, capacity_min, capacity_confirm_line, capacity_max,
  capacity_confirm_line_male, capacity_confirm_line_female, capacity_max_male, capacity_max_female,
  status, description
) values
('0829-meeting', '2026-08-29', 'afternoon', '8/29(토) 오후 · 바-ㅇ탈출(ver.모임)', '바-ㅇ탈출(ver.모임)',
  '2026-08-29T13:00:00+09:00', '2026-08-29T16:30:00+09:00',
  '서울 신림역 인근',
  55000, 79000, 16, 24, 50,
  null, null, null, null,
  'open', '방탈출과 미니게임으로 자연스럽게 친해지는 비소개팅 타임. 1부(아이스브레이킹+식사+방탈출) 진행.'),
('0829-dating', '2026-08-29', 'evening', '8/29(토) 저녁 · 바-ㅇ탈출(ver.소개팅)', '바-ㅇ탈출(ver.소개팅)',
  '2026-08-29T18:00:00+09:00', '2026-08-29T22:30:00+09:00',
  '서울 신림역 인근',
  65000, 89000, 16, 12, 60,
  12, 12, 30, 30,
  'open', '로테이션 소개팅 + 방탈출을 결합한 저녁 타임. 4인 1조로 랜덤 편성되어 방탈출을 함께 플레이합니다.');

insert into session_venues (session_id, venue_name)
select id, '뮤트스페이스 신림점' from sessions where event_date = '2026-08-29';
