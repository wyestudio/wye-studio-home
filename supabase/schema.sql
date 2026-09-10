--
--

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';

--
-- Name: application_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_result AS (
	id uuid,
	session_id uuid,
	depositor_name text,
	agreed_terms boolean,
	confirmation_code text,
	status text,
	payment_status text,
	waiting_number integer,
	created_at timestamp with time zone
);

--
-- Name: admin_update_application(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
begin
  update applications
  set depositor_name_enc = encrypt_pii(p_depositor_name),
      notes = p_notes
  where id = p_application_id;

  update application_attendees aa
  set name_enc = encrypt_pii(a->>'name'),
      phone_enc = encrypt_pii(a->>'phone'),
      phone_hash = hash_phone(a->>'phone'),
      birth_year = (a->>'birth_year')::int,
      gender = nullif(a->>'gender', ''),
      experience_range = nullif(a->>'experience_range', ''),
      nickname = nullif(a->>'nickname', '')
  from jsonb_array_elements(p_attendees) as a
  where aa.id = (a->>'id')::uuid and aa.application_id = p_application_id;
exception
  when unique_violation then raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

--
-- Name: cancel_application(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text DEFAULT NULL::text, p_refund_account_number text DEFAULT NULL::text, p_refund_account_holder text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_phone_hash text := hash_phone(p_phone_digits); v_application_id uuid;
begin
  select ap.id into v_application_id from applications ap join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code and aa.phone_hash = v_phone_hash and ap.status <> 'cancelled' limit 1;
  if v_application_id is null then raise exception '이미 취소되었거나 일치하는 신청 내역을 찾을 수 없어요.'; end if;
  update applications set status = 'cancelled', payment_status = 'cancelled', refund_bank_name = p_refund_bank_name,
    refund_account_number_enc = case when p_refund_account_number is not null then encrypt_pii(p_refund_account_number) else null end,
    refund_account_holder_enc = case when p_refund_account_holder is not null then encrypt_pii(p_refund_account_holder) else null end
  where id = v_application_id;
  return true;
end;
$$;

--
-- Name: check_active_applications(text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_active_applications(p_phones text[], p_session_id uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select coalesce(array_agg(distinct phone), array[]::text[])
  from unnest(p_phones) as phone
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(phone)
      and s.content_group = (select content_group from sessions where id = p_session_id)
  );
$$;

--
-- Name: check_nickname_available(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select not exists (
    select 1 from application_attendees
    where session_id = p_session_id and nickname = p_nickname and nickname is not null
  );
$$;

--
-- Name: decrypt_pii(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_pii(p_ciphertext bytea) RETURNS text
    LANGUAGE sql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
select pgp_sym_decrypt(p_ciphertext, encode(get_pii_key(), 'escape'))::text; $$;

--
-- Name: encrypt_pii(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_pii(p_plaintext text) RETURNS bytea
    LANGUAGE sql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
select pgp_sym_encrypt(p_plaintext, encode(get_pii_key(), 'escape')); $$;

--
-- Name: get_pii_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pii_key() RETURNS bytea
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare v_key bytea;
begin select decrypted_secret into v_key from vault.decrypted_secrets where name = 'app_pii_key' limit 1;
if v_key is null then raise exception 'PII 암호화 키를 찾을 수 없습니다: Vault에 ''app_pii_key''를 생성하세요'; end if;
return v_key; end; $$;

--
-- Name: get_session_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_session_stats(p_session_id uuid) RETURNS TABLE(confirmed_count integer, waiting_count integer, male_confirmed_count integer, male_waiting_count integer, female_confirmed_count integer, female_waiting_count integer, paid_confirmed_count integer, male_paid_confirmed_count integer, female_paid_confirmed_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    coalesce(sum(case when ap.status = 'confirmed' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and aa.gender = 'M' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' and aa.gender = 'M' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and aa.gender = 'F' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'waiting' and aa.gender = 'F' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and ap.payment_status = 'confirmed' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and ap.payment_status = 'confirmed' and aa.gender = 'M' then 1 else 0 end), 0)::int,
    coalesce(sum(case when ap.status = 'confirmed' and ap.payment_status = 'confirmed' and aa.gender = 'F' then 1 else 0 end), 0)::int
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where ap.session_id = p_session_id;
$$;

--
-- Name: hash_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_phone(p_phone text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select encode(
    hmac(regexp_replace(p_phone, '[^0-9]', '', 'g'), encode(public.get_pii_key(), 'escape'), 'sha256'),
    'hex'
  );
$$;

--
-- Name: lookup_application(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) RETURNS TABLE(session_title text, theme_label text, theme_name text, session_type text, venue_area text, start_at timestamp with time zone, end_at timestamp with time zone, event_date date, slot text, price_krw integer, status text, payment_status text, confirmation_code text, created_at timestamp with time zone, payment_confirmed_sms_sent_at timestamp with time zone, notes text, waiting_number integer, attendees jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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
$$;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin execute 'alter table ' || quote_ident(pg_event_trigger_table_spec()) || ' enable row level security'; exception when others then null; end; $$;

--
-- Name: sessions_generate_labels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sessions_generate_labels() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
$$;

--
-- Name: submit_application(uuid, text, boolean, boolean, jsonb, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false) RETURNS public.application_result
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
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
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1990 and 2001) then
      raise exception '참여자 출생년도는 1990~2001년 범위만 가능합니다.';
    end if;
  else
    if exists (select 1 from jsonb_array_elements(p_attendees) a where (a->>'birth_year')::int not between 1987 and 2007) then
      raise exception '참여자 출생년도는 1987~2007년 범위만 가능합니다.';
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
    if v_current_total + 1 > (case when v_gender = 'M' then v_session.capacity_max_male else v_session.capacity_max_female end) then raise exception '정원마감: 정원이 모두 찼습니다.'; end if;
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

  insert into applications (session_id, depositor_name_enc, consent_required, consent_optional, consent_photo, consent_marketing, confirmation_code, status, notes)
  values (p_session_id, encrypt_pii(p_depositor_name), p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing, v_code, v_status, p_notes) returning * into v_app;

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
      select count(*) + 1 into v_waiting_number from application_attendees aa join applications ap on ap.id = aa.application_id
      where ap.session_id = p_session_id and ap.status = 'waiting' and aa.gender = v_gender and ap.id <> v_app.id;
    else
      select count(*) + 1 into v_waiting_number from applications ap where ap.session_id = p_session_id and ap.status = 'waiting' and ap.id <> v_app.id;
    end if;
  else
    v_waiting_number := null;
  end if;

  return (v_app.id, v_app.session_id, p_depositor_name, true, v_app.confirmation_code, v_app.status, v_app.payment_status, v_waiting_number, v_app.created_at)::public.application_result;
exception
  when unique_violation then raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$$;

--
-- Name: submit_review_payback_application(text, text, text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_review_payback_application(p_name text, p_phone text, p_session_slug text, p_channel text, p_post_url text, p_bank_name text, p_account_number text, p_account_holder text, p_agreements jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '이름을 입력해주세요.';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception '전화번호를 입력해주세요.';
  end if;
  if p_session_slug is null or length(trim(p_session_slug)) = 0 then
    raise exception '참가 회차를 선택해주세요.';
  end if;
  if p_channel is null or length(trim(p_channel)) = 0 then
    raise exception '후기 채널을 선택해주세요.';
  end if;
  if p_post_url is null or length(trim(p_post_url)) = 0 then
    raise exception '후기 게시물 링크를 입력해주세요.';
  end if;
  if p_bank_name is null or length(trim(p_bank_name)) = 0 then
    raise exception '은행을 선택해주세요.';
  end if;
  if p_account_number is null or length(trim(p_account_number)) = 0 then
    raise exception '계좌번호를 입력해주세요.';
  end if;
  if p_account_holder is null or length(trim(p_account_holder)) = 0 then
    raise exception '예금주명을 입력해주세요.';
  end if;
  if not (
    coalesce((p_agreements->>'terms')::boolean, false)
    and coalesce((p_agreements->>'privacy')::boolean, false)
  ) then
    raise exception '필수 약관에 모두 동의해야 신청할 수 있습니다.';
  end if;

  insert into public.review_payback_applications (
    name_enc, phone_enc, session_slug, channel, post_url, bank_name,
    account_number_enc, account_holder_enc, agreements
  ) values (
    encrypt_pii(trim(p_name)), encrypt_pii(trim(p_phone)), p_session_slug, p_channel, trim(p_post_url), p_bank_name,
    encrypt_pii(trim(p_account_number)), encrypt_pii(trim(p_account_holder)), p_agreements
  ) returning id into v_id;

  return v_id;
end;
$$;

--
-- Name: submit_sponsorship_dating_application(text, integer, text, text, text, text, text, integer, integer, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_sponsorship_dating_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_note text, p_deliverable text, p_agreements jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '이름을 입력해주세요.';
  end if;
  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from now())::int then
    raise exception '출생연도를 확인해주세요.';
  end if;
  if p_gender is null or p_gender not in ('M', 'F') then
    raise exception '성별을 선택해주세요.';
  end if;
  if p_gender <> 'F' then
    raise exception '이번 협찬은 여성 크리에이터만 신청할 수 있어요.';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception '휴대폰 번호를 입력해주세요.';
  end if;
  if p_handle is null or length(trim(p_handle)) = 0 then
    raise exception '채널명을 입력해주세요.';
  end if;
  if not (
    coalesce((p_agreements->>'eligibility')::boolean, false)
    and coalesce((p_agreements->>'offer')::boolean, false)
    and coalesce((p_agreements->>'content')::boolean, false)
    and coalesce((p_agreements->>'privacyGuests')::boolean, false)
    and coalesce((p_agreements->>'refund')::boolean, false)
    and coalesce((p_agreements->>'privacy')::boolean, false)
  ) then
    raise exception '필수 약관에 모두 동의해야 신청할 수 있습니다.';
  end if;

  insert into public.sponsorship_dating_applications (
    name_enc, birth_year, gender, phone_enc, handle, platform, profile_url, followers, reach,
    portfolio_url, note, deliverable, agreements
  ) values (
    encrypt_pii(trim(p_name)), p_birth_year, p_gender, encrypt_pii(trim(p_phone)), trim(p_handle), p_platform, p_profile_url,
    p_followers, p_reach, nullif(trim(coalesce(p_portfolio_url, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''), p_deliverable, p_agreements
  ) returning id into v_id;

  return v_id;
end;
$$;

--
-- Name: submit_sponsorship_group_application(text, integer, text, text, text, text, text, integer, integer, text, integer, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_sponsorship_group_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_companions integer, p_note text, p_deliverable text, p_agreements jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '이름을 입력해주세요.';
  end if;
  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from now())::int then
    raise exception '출생연도를 확인해주세요.';
  end if;
  if p_gender is null or p_gender not in ('M', 'F') then
    raise exception '성별을 선택해주세요.';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception '휴대폰 번호를 입력해주세요.';
  end if;
  if p_handle is null or length(trim(p_handle)) = 0 then
    raise exception '채널명을 입력해주세요.';
  end if;
  if not (
    coalesce((p_agreements->>'offer')::boolean, false)
    and coalesce((p_agreements->>'companion')::boolean, false)
    and coalesce((p_agreements->>'content')::boolean, false)
    and coalesce((p_agreements->>'refund')::boolean, false)
    and coalesce((p_agreements->>'privacy')::boolean, false)
  ) then
    raise exception '필수 약관에 모두 동의해야 신청할 수 있습니다.';
  end if;

  insert into public.sponsorship_group_applications (
    name_enc, birth_year, gender, phone_enc, handle, platform, profile_url, followers, reach,
    portfolio_url, companions, note, deliverable, agreements
  ) values (
    encrypt_pii(trim(p_name)), p_birth_year, p_gender, encrypt_pii(trim(p_phone)), trim(p_handle), p_platform, p_profile_url,
    p_followers, p_reach, nullif(trim(coalesce(p_portfolio_url, '')), ''), coalesce(p_companions, 0),
    nullif(trim(coalesce(p_note, '')), ''), p_deliverable, p_agreements
  ) returning id into v_id;

  return v_id;
end;
$$;

--
-- Name: _backup_applications_20260815; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_applications_20260815 (
    id uuid,
    session_id uuid,
    agreed_terms boolean,
    confirmation_code text,
    status text,
    payment_status text,
    created_at timestamp with time zone,
    depositor_name_enc bytea,
    notes text,
    confirmation_sms_sent_at timestamp with time zone,
    payment_confirmed_sms_sent_at timestamp with time zone,
    reminder_sms_sent_at timestamp with time zone,
    consent_no_rebooking boolean,
    consent_phone_collection boolean,
    consent_proxy_for_group boolean,
    consent_photo boolean,
    consent_marketing boolean,
    refund_bank_name text,
    refund_account_number_enc bytea,
    refund_account_holder_enc bytea
);

--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    depositor_name_enc bytea NOT NULL,
    agreed_terms boolean DEFAULT false NOT NULL,
    confirmation_code text NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    confirmation_sms_sent_at timestamp with time zone,
    payment_confirmed_sms_sent_at timestamp with time zone,
    reminder_sms_sent_at timestamp with time zone,
    consent_no_rebooking boolean DEFAULT false NOT NULL,
    consent_phone_collection boolean DEFAULT false NOT NULL,
    consent_proxy_for_group boolean,
    consent_photo boolean DEFAULT false NOT NULL,
    consent_marketing boolean DEFAULT false NOT NULL,
    refund_bank_name text,
    refund_account_number_enc bytea,
    refund_account_holder_enc bytea,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consent_required boolean DEFAULT false NOT NULL,
    consent_optional boolean DEFAULT false NOT NULL,
    refund_completed_at timestamp with time zone,
    promoted_from_waiting_at timestamp with time zone,
    CONSTRAINT applications_notes_check CHECK (((notes IS NULL) OR (char_length(notes) <= 200))),
    CONSTRAINT applications_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text]))),
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'confirmed'::text, 'cancelled'::text])))
);

--
-- Name: admin_application_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_application_view AS
 SELECT id,
    session_id,
    public.decrypt_pii(depositor_name_enc) AS depositor_name,
    consent_required,
    consent_optional,
    confirmation_code,
    status,
    payment_status,
    notes,
    created_at,
    refund_bank_name,
    public.decrypt_pii(refund_account_number_enc) AS refund_account_number,
    public.decrypt_pii(refund_account_holder_enc) AS refund_account_holder,
    consent_photo,
    consent_marketing,
    payment_confirmed_sms_sent_at,
    refund_completed_at,
    promoted_from_waiting_at
   FROM public.applications ap;

--
-- Name: application_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    session_id uuid NOT NULL,
    is_representative boolean DEFAULT false NOT NULL,
    name_enc bytea NOT NULL,
    phone_enc bytea NOT NULL,
    phone_hash text NOT NULL,
    birth_year integer NOT NULL,
    nickname text,
    gender text,
    experience_range text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT application_attendees_birth_year_check CHECK (((birth_year >= 1987) AND (birth_year <= 2007))),
    CONSTRAINT application_attendees_experience_range_check CHECK (((experience_range IS NULL) OR (experience_range = ANY (ARRAY['0'::text, '1-50'::text, '50-100'::text, '100-200'::text, '200+'::text])))),
    CONSTRAINT application_attendees_gender_check CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])))
);

--
-- Name: admin_attendee_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_attendee_view AS
 SELECT id,
    application_id,
    session_id,
    is_representative,
    public.decrypt_pii(name_enc) AS name,
    public.decrypt_pii(phone_enc) AS phone,
    birth_year,
    nickname,
    gender,
    experience_range,
    created_at
   FROM public.application_attendees aa;

--
-- Name: review_payback_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_payback_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_enc bytea NOT NULL,
    phone_enc bytea NOT NULL,
    session_slug text NOT NULL,
    channel text NOT NULL,
    post_url text NOT NULL,
    bank_name text NOT NULL,
    account_number_enc bytea NOT NULL,
    account_holder_enc bytea NOT NULL,
    agreements jsonb NOT NULL
);

--
-- Name: admin_review_payback_applications_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_review_payback_applications_view AS
 SELECT id,
    public.decrypt_pii(name_enc) AS name,
    public.decrypt_pii(phone_enc) AS phone,
    session_slug,
    channel,
    post_url,
    bank_name,
    public.decrypt_pii(account_number_enc) AS account_number,
    public.decrypt_pii(account_holder_enc) AS account_holder,
    agreements,
    created_at
   FROM public.review_payback_applications;

--
-- Name: sponsorship_dating_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsorship_dating_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_enc bytea NOT NULL,
    birth_year integer NOT NULL,
    phone_enc bytea NOT NULL,
    handle text NOT NULL,
    platform text NOT NULL,
    profile_url text NOT NULL,
    followers integer NOT NULL,
    reach integer NOT NULL,
    portfolio_url text,
    note text,
    deliverable text NOT NULL,
    agreements jsonb NOT NULL,
    gender text NOT NULL,
    CONSTRAINT sponsorship_dating_applications_gender_check CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])))
);

--
-- Name: admin_sponsorship_dating_applications_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_sponsorship_dating_applications_view AS
 SELECT id,
    public.decrypt_pii(name_enc) AS name,
    birth_year,
    gender,
    public.decrypt_pii(phone_enc) AS phone,
    handle,
    platform,
    profile_url,
    followers,
    reach,
    portfolio_url,
    note,
    deliverable,
    agreements,
    created_at
   FROM public.sponsorship_dating_applications;

--
-- Name: sponsorship_group_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sponsorship_group_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name_enc bytea NOT NULL,
    phone_enc bytea NOT NULL,
    handle text NOT NULL,
    platform text NOT NULL,
    profile_url text NOT NULL,
    followers integer NOT NULL,
    reach integer NOT NULL,
    portfolio_url text,
    companions integer DEFAULT 0 NOT NULL,
    note text,
    deliverable text NOT NULL,
    agreements jsonb NOT NULL,
    birth_year integer NOT NULL,
    gender text NOT NULL,
    CONSTRAINT sponsorship_group_applications_gender_check CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])))
);

--
-- Name: admin_sponsorship_group_applications_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_sponsorship_group_applications_view AS
 SELECT id,
    public.decrypt_pii(name_enc) AS name,
    birth_year,
    gender,
    public.decrypt_pii(phone_enc) AS phone,
    handle,
    platform,
    profile_url,
    followers,
    reach,
    portfolio_url,
    companions,
    note,
    deliverable,
    agreements,
    created_at
   FROM public.sponsorship_group_applications;

--
-- Name: kakao_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kakao_links (
    kakao_id text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: naver_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.naver_links (
    naver_id text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    birth_date date NOT NULL,
    gender text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_digits text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]'::text, ''::text, 'g'::text)) STORED,
    CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])))
);

--
-- Name: session_venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_venues (
    session_id uuid NOT NULL,
    venue_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    venue_address text
);

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    event_date date NOT NULL,
    slot text NOT NULL,
    title text NOT NULL,
    theme_label text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    venue_area text NOT NULL,
    price_krw integer NOT NULL,
    original_price_krw integer NOT NULL,
    capacity_min integer DEFAULT 16 NOT NULL,
    capacity_confirm_line integer DEFAULT 24 NOT NULL,
    capacity_max integer DEFAULT 50 NOT NULL,
    capacity_confirm_line_male integer,
    capacity_confirm_line_female integer,
    capacity_max_male integer,
    capacity_max_female integer,
    male_closed boolean DEFAULT false NOT NULL,
    female_closed boolean DEFAULT false NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content_group text NOT NULL,
    theme_name text NOT NULL,
    session_type text NOT NULL,
    difficulty smallint DEFAULT 3 NOT NULL,
    CONSTRAINT sessions_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5))),
    CONSTRAINT sessions_session_type_check CHECK ((session_type = ANY (ARRAY['그룹'::text, '소개팅'::text]))),
    CONSTRAINT sessions_slot_check CHECK ((slot = ANY (ARRAY['afternoon'::text, 'evening'::text]))),
    CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'cancelled'::text])))
);

--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    key text NOT NULL,
    label text NOT NULL,
    body text NOT NULL,
    placeholders text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: application_attendees application_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_attendees
    ADD CONSTRAINT application_attendees_pkey PRIMARY KEY (id);

--
-- Name: application_attendees application_attendees_session_id_nickname_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_attendees
    ADD CONSTRAINT application_attendees_session_id_nickname_key UNIQUE (session_id, nickname);

--
-- Name: applications applications_confirmation_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_confirmation_code_key UNIQUE (confirmation_code);

--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);

--
-- Name: kakao_links kakao_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kakao_links
    ADD CONSTRAINT kakao_links_pkey PRIMARY KEY (kakao_id);

--
-- Name: naver_links naver_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.naver_links
    ADD CONSTRAINT naver_links_pkey PRIMARY KEY (naver_id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: review_payback_applications review_payback_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_payback_applications
    ADD CONSTRAINT review_payback_applications_pkey PRIMARY KEY (id);

--
-- Name: session_venues session_venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_venues
    ADD CONSTRAINT session_venues_pkey PRIMARY KEY (session_id);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_slug_key UNIQUE (slug);

--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (key);

--
-- Name: sponsorship_dating_applications sponsorship_dating_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_dating_applications
    ADD CONSTRAINT sponsorship_dating_applications_pkey PRIMARY KEY (id);

--
-- Name: sponsorship_group_applications sponsorship_group_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sponsorship_group_applications
    ADD CONSTRAINT sponsorship_group_applications_pkey PRIMARY KEY (id);

--
-- Name: application_attendees_phone_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_attendees_phone_hash_idx ON public.application_attendees USING btree (phone_hash);

--
-- Name: profiles_phone_digits_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_phone_digits_key ON public.profiles USING btree (phone_digits);

--
-- Name: sessions trg_sessions_generate_labels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_generate_labels BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sessions_generate_labels();

--
-- Name: application_attendees application_attendees_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_attendees
    ADD CONSTRAINT application_attendees_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

--
-- Name: application_attendees application_attendees_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_attendees
    ADD CONSTRAINT application_attendees_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

--
-- Name: applications applications_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

--
-- Name: kakao_links kakao_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kakao_links
    ADD CONSTRAINT kakao_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: naver_links naver_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.naver_links
    ADD CONSTRAINT naver_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: session_venues session_venues_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_venues
    ADD CONSTRAINT session_venues_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

--
-- Name: _backup_applications_20260815; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_applications_20260815 ENABLE ROW LEVEL SECURITY;

--
-- Name: application_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: kakao_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kakao_links ENABLE ROW LEVEL SECURITY;

--
-- Name: kakao_links kakao_links_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kakao_links_select_own ON public.kakao_links FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: naver_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.naver_links ENABLE ROW LEVEL SECURITY;

--
-- Name: naver_links naver_links_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY naver_links_select_own ON public.naver_links FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));

--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));

--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));

--
-- Name: review_payback_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_payback_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: session_venues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_venues ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions sessions_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_select_public ON public.sessions FOR SELECT USING (true);

--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsorship_dating_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsorship_dating_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: sponsorship_group_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sponsorship_group_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb) TO service_role;

--
-- Name: FUNCTION cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text, p_refund_account_number text, p_refund_account_holder text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text, p_refund_account_number text, p_refund_account_holder text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text, p_refund_account_number text, p_refund_account_holder text) TO anon;
GRANT ALL ON FUNCTION public.cancel_application(p_phone_digits text, p_confirmation_code text, p_refund_bank_name text, p_refund_account_number text, p_refund_account_holder text) TO authenticated;

--
-- Name: FUNCTION check_active_applications(p_phones text[], p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_active_applications(p_phones text[], p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_active_applications(p_phones text[], p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_active_applications(p_phones text[], p_session_id uuid) TO authenticated;

--
-- Name: FUNCTION check_nickname_available(p_session_id uuid, p_nickname text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) TO anon;
GRANT ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) TO authenticated;

--
-- Name: FUNCTION decrypt_pii(p_ciphertext bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrypt_pii(p_ciphertext bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrypt_pii(p_ciphertext bytea) TO service_role;

--
-- Name: FUNCTION encrypt_pii(p_plaintext text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.encrypt_pii(p_plaintext text) FROM PUBLIC;

--
-- Name: FUNCTION get_pii_key(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_pii_key() FROM PUBLIC;

--
-- Name: FUNCTION get_session_stats(p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_session_stats(p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_session_stats(p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_session_stats(p_session_id uuid) TO authenticated;

--
-- Name: FUNCTION hash_phone(p_phone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hash_phone(p_phone text) FROM PUBLIC;

--
-- Name: FUNCTION lookup_application(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) TO anon;
GRANT ALL ON FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) TO authenticated;

--
-- Name: FUNCTION submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) TO anon;
GRANT ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) TO authenticated;

--
-- Name: FUNCTION submit_review_payback_application(p_name text, p_phone text, p_session_slug text, p_channel text, p_post_url text, p_bank_name text, p_account_number text, p_account_holder text, p_agreements jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_review_payback_application(p_name text, p_phone text, p_session_slug text, p_channel text, p_post_url text, p_bank_name text, p_account_number text, p_account_holder text, p_agreements jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_review_payback_application(p_name text, p_phone text, p_session_slug text, p_channel text, p_post_url text, p_bank_name text, p_account_number text, p_account_holder text, p_agreements jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_review_payback_application(p_name text, p_phone text, p_session_slug text, p_channel text, p_post_url text, p_bank_name text, p_account_number text, p_account_holder text, p_agreements jsonb) TO authenticated;

--
-- Name: FUNCTION submit_sponsorship_dating_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_note text, p_deliverable text, p_agreements jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_sponsorship_dating_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_note text, p_deliverable text, p_agreements jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_sponsorship_dating_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_note text, p_deliverable text, p_agreements jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_sponsorship_dating_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_note text, p_deliverable text, p_agreements jsonb) TO authenticated;

--
-- Name: FUNCTION submit_sponsorship_group_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_companions integer, p_note text, p_deliverable text, p_agreements jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_sponsorship_group_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_companions integer, p_note text, p_deliverable text, p_agreements jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_sponsorship_group_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_companions integer, p_note text, p_deliverable text, p_agreements jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_sponsorship_group_application(p_name text, p_birth_year integer, p_gender text, p_phone text, p_handle text, p_platform text, p_profile_url text, p_followers integer, p_reach integer, p_portfolio_url text, p_companions integer, p_note text, p_deliverable text, p_agreements jsonb) TO authenticated;

--
-- Name: TABLE _backup_applications_20260815; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260815 TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260815 TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260815 TO service_role;

--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.applications TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.applications TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.applications TO service_role;

--
-- Name: TABLE admin_application_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_application_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_application_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_application_view TO service_role;

--
-- Name: TABLE application_attendees; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.application_attendees TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.application_attendees TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.application_attendees TO service_role;

--
-- Name: TABLE admin_attendee_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_attendee_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_attendee_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_attendee_view TO service_role;

--
-- Name: TABLE review_payback_applications; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.review_payback_applications TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.review_payback_applications TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.review_payback_applications TO service_role;

--
-- Name: TABLE admin_review_payback_applications_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_review_payback_applications_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_review_payback_applications_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_review_payback_applications_view TO service_role;

--
-- Name: TABLE sponsorship_dating_applications; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_dating_applications TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_dating_applications TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_dating_applications TO service_role;

--
-- Name: TABLE admin_sponsorship_dating_applications_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_dating_applications_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_dating_applications_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_dating_applications_view TO service_role;

--
-- Name: TABLE sponsorship_group_applications; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_group_applications TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_group_applications TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sponsorship_group_applications TO service_role;

--
-- Name: TABLE admin_sponsorship_group_applications_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_group_applications_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_group_applications_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_sponsorship_group_applications_view TO service_role;

--
-- Name: TABLE kakao_links; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.kakao_links TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.kakao_links TO authenticated;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.kakao_links TO service_role;

--
-- Name: TABLE naver_links; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.naver_links TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.naver_links TO authenticated;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.naver_links TO service_role;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;

--
-- Name: TABLE session_venues; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO service_role;

--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sessions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sessions TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sessions TO service_role;

--
-- Name: TABLE sms_templates; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sms_templates TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sms_templates TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.sms_templates TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
--

