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
-- Name: admin_search_applications(text, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_search_applications(p_query text DEFAULT NULL::text, p_session_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_payment text DEFAULT NULL::text, p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, confirmation_code text, status text, payment_status text, headcount integer, amount_krw integer, created_at timestamp with time zone, session_id uuid, session_start_at timestamp with time zone, theme_name text, format_label text, representative_name text, representative_phone text, depositor_name text, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := regexp_replace(coalesce(p_query,''), '[^0-9]', '', 'g');
begin
  return query
  with base as (
    select
      ap.id, ap.confirmation_code, ap.status, ap.payment_status,
      coalesce(ap.headcount, (select count(*)::int from application_attendees x
                              where x.application_id = ap.id)) as headcount,
      coalesce(ap.amount_krw,
               s.price_krw * (select count(*)::int from application_attendees x
                              where x.application_id = ap.id)) as amount_krw,
      ap.created_at,
      s.id as session_id, s.start_at as session_start_at,
      coalesce(t.name, s.theme_name) as theme_name,
      coalesce(s.legacy_format, s.session_type) as format_label,
      decrypt_pii(rep.name_enc)  as representative_name,
      decrypt_pii(rep.phone_enc) as representative_phone,
      decrypt_pii(ap.depositor_name_enc) as depositor_name
    from applications ap
    join sessions s on s.id = ap.session_id
    left join themes t on t.id = s.theme_id
    left join lateral (
      select aa.name_enc, aa.phone_enc
      from application_attendees aa
      where aa.application_id = ap.id
      order by aa.is_representative desc
      limit 1
    ) rep on true
    where (p_session_id is null or ap.session_id = p_session_id)
      and (p_status  is null or ap.status = p_status)
      and (p_payment is null or ap.payment_status = p_payment)
      and (p_from    is null or ap.created_at >= p_from)
      and (p_to      is null or ap.created_at <= p_to)
  ),
  filtered as (
    select * from base b
    where v_q is null
       or b.confirmation_code = v_q
       or b.representative_name ilike '%' || v_q || '%'
       or b.depositor_name      ilike '%' || v_q || '%'
       or (length(v_digits) >= 4 and regexp_replace(b.representative_phone, '[^0-9]', '', 'g') like '%' || v_digits || '%')
  ),
  counted as (select count(*) as n from filtered)
  select f.id, f.confirmation_code, f.status, f.payment_status, f.headcount, f.amount_krw,
         f.created_at, f.session_id, f.session_start_at, f.theme_name, f.format_label,
         f.representative_name, f.representative_phone, f.depositor_name,
         c.n
  from filtered f, counted c
  order by f.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$$;

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
-- Name: assign_coupon(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_coupon(p_campaign_id uuid, p_phone_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_coupon coupons%rowtype;
begin
  -- 이미 배정된 게 있으면 재사용한다.
  select * into v_coupon
  from coupons
  where campaign_id = p_campaign_id
    and issued_to_phone_hash = p_phone_hash
  limit 1;

  if found then
    return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
  end if;

  -- 아직 아무에게도 안 준 미사용 쿠폰 하나를 잠그고 가져온다.
  select * into v_coupon
  from coupons
  where campaign_id = p_campaign_id
    and issued_to_phone_hash is null
    and used_at is null
  order by code
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'reason', '남은 쿠폰이 없습니다.');
  end if;

  update coupons
     set issued_to_phone_hash = p_phone_hash
   where id = v_coupon.id;

  return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', false);
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
-- Name: check_active_applications_v2(text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) RETURNS text[]
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
      and s.theme_id is not null
      and s.theme_id = (select theme_id from sessions where id = p_session_id)
  );
$$;

--
-- Name: FUNCTION check_active_applications_v2(p_phones text[], p_session_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) IS '같은 테마에 이미 신청한 전화번호를 돌려준다. 화면 사전 확인용 — 최종 판정은 submit_application_v2().';

--
-- Name: check_nickname_available(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select not exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = p_session_id
      and x.nickname = p_nickname
      and x.nickname is not null
      and a.status <> 'cancelled'
  );
$$;

--
-- Name: coupon_recipients(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coupon_recipients(p_session_id uuid, p_paid_only boolean DEFAULT true) RETURNS TABLE(phone_hash text, name text, phone text, is_representative boolean, confirmation_code text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select distinct on (aa.phone_hash)
    aa.phone_hash,
    decrypt_pii(aa.name_enc)  as name,
    decrypt_pii(aa.phone_enc) as phone,
    aa.is_representative,
    ap.confirmation_code
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where ap.session_id = p_session_id
    and ap.status <> 'cancelled'
    and (not p_paid_only or (ap.status = 'confirmed' and ap.payment_status = 'confirmed'))
  order by aa.phone_hash, aa.is_representative desc;
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
-- Name: default_min_age(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_min_age(p_starts_at timestamp with time zone, p_theme_floor integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select greatest(
    case when extract(hour from (p_starts_at at time zone 'Asia/Seoul')) < 18 then 16 else 19 end,
    coalesce(p_theme_floor, 0)
  );
$$;

--
-- Name: encrypt_pii(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_pii(p_plaintext text) RETURNS bytea
    LANGUAGE sql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
select pgp_sym_encrypt(p_plaintext, encode(get_pii_key(), 'escape')); $$;

--
-- Name: enforce_session_nickname_unique(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_session_nickname_unique() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.nickname is null or new.nickname = '' then
    return new;
  end if;

  if exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = new.session_id
      and x.nickname = new.nickname
      and x.id <> new.id
      and a.status <> 'cancelled'
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 이름을 적어주세요.';
  end if;

  return new;
end;
$$;

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
-- Name: is_eligible_birth_year(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_eligible_birth_year(p_year integer, p_min_age integer) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select p_year <= extract(year from (now() at time zone 'Asia/Seoul'))::int - (p_min_age + 1);
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
-- Name: lookup_application_v2(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_application_v2(p_phone_digits text, p_confirmation_code text) RETURNS TABLE(theme_name text, format_label text, venue_area text, start_at timestamp with time zone, end_at timestamp with time zone, min_age integer, headcount integer, unit_price_krw integer, amount_krw integer, status text, payment_status text, confirmation_code text, created_at timestamp with time zone, payment_confirmed_sms_sent_at timestamp with time zone, notes text, waiting_number integer, attendees jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_app_id uuid;
  v_session_id uuid;
  v_status text;
  v_created timestamptz;
  v_waiting int;
begin
  select ap.id, ap.session_id, ap.status, ap.created_at
    into v_app_id, v_session_id, v_status, v_created
  from applications ap
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  if v_app_id is null then return; end if;

  if v_status = 'waiting' then
    select count(*) into v_waiting
    from applications ap2
    where ap2.session_id = v_session_id
      and ap2.status = 'waiting'
      and ap2.created_at <= v_created;
  end if;

  return query
  select
    coalesce(t.name, s.theme_name)                                as theme_name,
    coalesce(s.legacy_format, s.session_type)                     as format_label,
    coalesce(v.area_label, s.venue_area)                          as venue_area,
    s.start_at,
    s.end_at,
    s.min_age,
    coalesce(ap.headcount, (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as headcount,
    coalesce(ap.unit_price_krw, s.price_krw)                      as unit_price_krw,
    coalesce(ap.amount_krw,
             s.price_krw * (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as amount_krw,
    ap.status,
    ap.payment_status,
    ap.confirmation_code,
    ap.created_at,
    ap.payment_confirmed_sms_sent_at,
    ap.notes,
    v_waiting,
    (select jsonb_agg(jsonb_build_object(
        'name', decrypt_pii(aa2.name_enc),
        'phone', decrypt_pii(aa2.phone_enc),
        'birth_year', aa2.birth_year,
        'nickname', aa2.nickname,
        'gender', aa2.gender,
        'experience_range', aa2.experience_range,
        'is_representative', aa2.is_representative)
      order by aa2.is_representative desc)
     from application_attendees aa2 where aa2.application_id = ap.id)
  from applications ap
  join sessions s on s.id = ap.session_id
  left join themes t on t.id = s.theme_id
  left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id)
  where ap.id = v_app_id;
end;
$$;

--
-- Name: lookup_application_v3(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) RETURNS TABLE(theme_name text, theme_slug text, category_name text, accent_color text, format_label text, venue_area text, start_at timestamp with time zone, end_at timestamp with time zone, min_age integer, headcount integer, unit_price_krw integer, base_amount_krw integer, discount_krw integer, amount_krw integer, status text, payment_status text, confirmation_code text, created_at timestamp with time zone, payment_confirmed_sms_sent_at timestamp with time zone, notes text, waiting_number integer, attendees jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_app_id uuid;
  v_session_id uuid;
  v_status text;
  v_created timestamptz;
  v_waiting int;
begin
  select ap.id, ap.session_id, ap.status, ap.created_at
    into v_app_id, v_session_id, v_status, v_created
  from applications ap
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  if v_app_id is null then return; end if;

  -- 대기 순번: 성별 분기 없이 같은 회차의 대기 건 중 순서.
  -- 저장하지 않고 조회 시점에 계산하므로 앞선 취소가 있으면 당겨진다.
  if v_status = 'waiting' then
    select count(*) into v_waiting
    from applications ap2
    where ap2.session_id = v_session_id
      and ap2.status = 'waiting'
      and ap2.created_at <= v_created;
  end if;

  return query
  select
    coalesce(t.name, s.theme_name)                                as theme_name,
    t.slug                                                        as theme_slug,
    tc.name                                                       as category_name,
    t.accent_color,
    coalesce(s.legacy_format, s.session_type)                     as format_label,
    coalesce(v.area_label, s.venue_area)                          as venue_area,
    s.start_at,
    s.end_at,
    s.min_age,
    coalesce(ap.headcount, (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as headcount,
    coalesce(ap.unit_price_krw, s.price_krw)                      as unit_price_krw,
    -- 할인 전 금액. 옛 신청은 discount 가 없으므로 amount 와 같다.
    coalesce(ap.amount_krw, 0) + coalesce(ap.discount_krw, 0)     as base_amount_krw,
    coalesce(ap.discount_krw, 0)                                  as discount_krw,
    coalesce(ap.amount_krw,
             s.price_krw * (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as amount_krw,
    ap.status,
    ap.payment_status,
    ap.confirmation_code,
    ap.created_at,
    ap.payment_confirmed_sms_sent_at,
    ap.notes,
    v_waiting,
    (select jsonb_agg(jsonb_build_object(
        'name', decrypt_pii(aa2.name_enc),
        'phone', decrypt_pii(aa2.phone_enc),
        'birth_year', aa2.birth_year,
        'nickname', aa2.nickname,
        'gender', aa2.gender,
        'experience_range', aa2.experience_range,
        'is_representative', aa2.is_representative)
      order by aa2.is_representative desc)
     from application_attendees aa2 where aa2.application_id = ap.id)
  from applications ap
  join sessions s on s.id = ap.session_id
  left join themes t on t.id = s.theme_id
  left join theme_categories tc on tc.id = t.category_id
  left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id)
  where ap.id = v_app_id;
end;
$$;

--
-- Name: FUNCTION lookup_application_v3(p_phone_digits text, p_confirmation_code text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) IS '전화번호 + 접수번호로 참여내역 조회. v2 에 쿠폰 할인·테마 슬러그/강조색/카테고리를 더했다.';

--
-- Name: lookup_attendee_by_phone_hash(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_attendee_by_phone_hash(p_phone_hash text) RETURNS TABLE(name text, phone text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select decrypt_pii(aa.name_enc), decrypt_pii(aa.phone_enc)
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where aa.phone_hash = p_phone_hash
    and ap.status <> 'cancelled'
  order by aa.created_at desc
  limit 1;
$$;

--
-- Name: normalize_coupon_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_coupon_code(p_raw text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case
    when p_raw is null then null
    else translate(
           regexp_replace(upper(btrim(p_raw)), '[^0-9A-Z]', '', 'g'),
           'ILOU', '110V'
         )
  end;
$$;

--
-- Name: normalize_depositor_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_depositor_name(p_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select lower(
    regexp_replace(
      regexp_replace(normalize(coalesce(p_name, ''), NFC), '[\(（].*?[\)）]', '', 'g'),
      '[[:space:][:punct:]]', '', 'g'
    )
  );
$$;

--
-- Name: preview_coupon(text, uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_coupon   coupons%rowtype;
  v_camp     coupon_campaigns%rowtype;
  v_discount int;
  v_norm     text;
begin
  v_norm := normalize_coupon_code(p_code);
  if v_norm is null or v_norm = '' then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  select * into v_coupon from coupons where code = v_norm;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '존재하지 않는 쿠폰 코드예요.');
  end if;

  if v_coupon.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', '이미 사용된 쿠폰이에요.');
  end if;

  select * into v_camp from coupon_campaigns where id = v_coupon.campaign_id;

  if not v_camp.is_active then
    return jsonb_build_object('ok', false, 'reason', '지금은 사용할 수 없는 쿠폰이에요.');
  end if;
  if v_camp.valid_from is not null and now() < v_camp.valid_from then
    return jsonb_build_object('ok', false, 'reason', '아직 사용 기간이 아니에요.');
  end if;
  if v_camp.valid_until is not null and now() > v_camp.valid_until then
    return jsonb_build_object('ok', false, 'reason', '사용 기간이 지난 쿠폰이에요.');
  end if;
  if v_camp.theme_id is not null and v_camp.theme_id <> p_theme_id then
    return jsonb_build_object('ok', false, 'reason', '이 테마에는 쓸 수 없는 쿠폰이에요.');
  end if;
  if v_camp.min_headcount is not null and p_headcount < v_camp.min_headcount then
    return jsonb_build_object(
      'ok', false,
      'reason', format('%s명 이상 신청할 때 쓸 수 있는 쿠폰이에요.', v_camp.min_headcount));
  end if;

  if v_camp.restrict_to_issued_phone then
    if v_coupon.issued_to_phone_hash is null then
      return jsonb_build_object('ok', false, 'reason', '이 쿠폰은 사용할 수 없어요.');
    end if;
    if p_phone is null or hash_phone(p_phone) <> v_coupon.issued_to_phone_hash then
      return jsonb_build_object(
        'ok', false,
        'reason', '이 쿠폰은 쿠폰을 받으신 분 번호로만 사용할 수 있어요.');
    end if;
  end if;

  if v_camp.discount_type = 'fixed' then
    v_discount := v_camp.discount_value;
  else
    v_discount := floor(p_base_amount * v_camp.discount_value / 100.0)::int;
    if v_camp.max_discount_krw is not null then
      v_discount := least(v_discount, v_camp.max_discount_krw);
    end if;
  end if;

  v_discount := least(v_discount, p_base_amount);

  return jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'campaign_name', v_camp.name,
    'description', v_camp.description,
    'valid_until', v_camp.valid_until,
    'discount_krw', v_discount,
    'final_amount_krw', p_base_amount - v_discount
  );
end;
$$;

--
-- Name: resolve_unit_price(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_unit_price(p_theme_id uuid, p_headcount integer) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select unit_price_krw
  from theme_price_tiers
  where theme_id = p_theme_id
    and min_headcount <= p_headcount
  order by min_headcount desc
  limit 1;
$$;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
begin
  for r in
    select object_identity
    from pg_event_trigger_ddl_commands()
    where object_type = 'table'
      and schema_name = 'public'
  loop
    begin
      execute format('alter table %s enable row level security', r.object_identity);
    exception when others then
      raise warning 'rls_auto_enable: % 에 RLS 를 켜지 못했습니다 (%)', r.object_identity, sqlerrm;
    end;
  end loop;
end;
$$;

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
  -- 신규(테마 기반) 회차는 theme_name/session_type 을 쓰지 않는다.
  if new.theme_name is null then
    return new;
  end if;

  if new.theme_label is null then
    new.theme_label := new.theme_name || '(ver.' ||
      (case when new.session_type = '소개팅' then '소개팅' else '모임' end) || ')';
  end if;

  if new.title is null and new.event_date is not null then
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
-- Name: submit_application_v2(uuid, text, boolean, boolean, jsonb, text, boolean, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_session        record;
  v_group_size     int;
  v_current_total  int;
  v_status         text;
  v_code           text;
  v_app            applications%rowtype;
  v_unit_price     int;
  v_amount         int;
  v_dup_phones     text;
  v_self_dup       text;
  v_waiting_number int;
begin
  if not p_consent_required then
    raise exception '필수 약관에 동의해야 신청할 수 있습니다.';
  end if;

  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active
    into v_session
  from session_view sv
  join themes t on t.id = sv.theme_id
  where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if v_session.max_group_size is not null and v_group_size > v_session.max_group_size then
    raise exception '한 번에 최대 %명까지 신청할 수 있습니다.', v_session.max_group_size;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where not is_eligible_birth_year((a->>'birth_year')::int, v_session.min_age)
  ) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_session.min_age;
  end if;

  select string_agg(distinct phone, ',') into v_self_dup
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1 having count(*) > 1
  ) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.'
      using detail = v_self_dup;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s      on s.id  = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
      and s.theme_id = v_session.theme_id
  );
  if v_dup_phones is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.'
      using detail = v_dup_phones;
  end if;

  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed','waiting')
    group by ap.id
  ) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원마감: 남은 자리가 부족합니다.';
  end if;

  v_status := case
    when v_current_total + v_group_size <= v_session.capacity_confirm_line then 'confirmed'
    else 'waiting'
  end;

  v_unit_price := coalesce(v_session.price_krw_override,
                           resolve_unit_price(v_session.theme_id, v_group_size));
  if v_unit_price is null then
    raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.';
  end if;
  v_amount := v_unit_price * v_group_size;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes,
    headcount, unit_price_krw, amount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes,
    v_group_size, v_unit_price, v_amount
  ) returning * into v_app;

  insert into application_attendees (
    application_id, session_id, is_representative,
    name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range
  )
  select v_app.id, p_session_id, (ord = 1),
         encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
         (a->>'birth_year')::int, nullif(a->>'nickname',''),
         nullif(a->>'gender',''), nullif(a->>'experience_range','')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  if v_current_total + v_group_size >= v_session.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id;
  end if;

  if v_app.status = 'waiting' then
    select count(*) + 1 into v_waiting_number
    from applications
    where session_id = p_session_id and status = 'waiting' and id <> v_app.id;
  end if;

  return jsonb_build_object(
    'id', v_app.id,
    'confirmation_code', v_app.confirmation_code,
    'status', v_app.status,
    'payment_status', v_app.payment_status,
    'headcount', v_group_size,
    'unit_price_krw', v_unit_price,
    'amount_krw', v_amount,
    'waiting_number', v_waiting_number,
    'created_at', v_app.created_at
  );
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
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
-- Name: _backup_20260912_application_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_20260912_application_attendees (
    id uuid,
    application_id uuid,
    session_id uuid,
    is_representative boolean,
    name_enc bytea,
    phone_enc bytea,
    phone_hash text,
    birth_year integer,
    nickname text,
    gender text,
    experience_range text,
    created_at timestamp with time zone
);

--
-- Name: _backup_20260912_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_20260912_applications (
    id uuid,
    session_id uuid,
    depositor_name_enc bytea,
    agreed_terms boolean,
    confirmation_code text,
    status text,
    payment_status text,
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
    refund_account_holder_enc bytea,
    created_at timestamp with time zone,
    consent_required boolean,
    consent_optional boolean,
    refund_completed_at timestamp with time zone,
    promoted_from_waiting_at timestamp with time zone,
    user_id uuid,
    headcount integer,
    unit_price_krw integer,
    amount_krw integer,
    depositor_name_hash text,
    updated_at timestamp with time zone
);

--
-- Name: _backup_20260912_session_venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_20260912_session_venues (
    session_id uuid,
    venue_name text,
    created_at timestamp with time zone,
    venue_address text
);

--
-- Name: _backup_20260912_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_20260912_sessions (
    id uuid,
    slug text,
    event_date date,
    slot text,
    title text,
    theme_label text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    venue_area text,
    price_krw integer,
    original_price_krw integer,
    capacity_min integer,
    capacity_confirm_line integer,
    capacity_max integer,
    capacity_confirm_line_male integer,
    capacity_confirm_line_female integer,
    capacity_max_male integer,
    capacity_max_female integer,
    male_closed boolean,
    female_closed boolean,
    status text,
    description text,
    created_at timestamp with time zone,
    content_group text,
    theme_name text,
    session_type text,
    difficulty smallint,
    theme_id uuid,
    min_age integer,
    price_krw_override integer,
    capacity_confirm_line_override integer,
    capacity_max_override integer,
    venue_id_override uuid,
    legacy_format text,
    legacy_slug text,
    admin_note text,
    updated_at timestamp with time zone
);

--
-- Name: _backup_20260912_sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_20260912_sms_templates (
    key text,
    label text,
    body text,
    placeholders text[],
    updated_at timestamp with time zone
);

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
    user_id uuid,
    headcount integer,
    unit_price_krw integer,
    amount_krw integer,
    depositor_name_hash text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT applications_notes_check CHECK (((notes IS NULL) OR (char_length(notes) <= 200))),
    CONSTRAINT applications_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text]))),
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'confirmed'::text, 'cancelled'::text])))
);

--
-- Name: COLUMN applications.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.user_id IS 'nullable = 비회원 신청. 로그인 부활 후에도 비회원 플로우 유지.';

--
-- Name: COLUMN applications.amount_krw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.amount_krw IS 'headcount * unit_price_krw. 입금 매칭의 기준 금액.';

--
-- Name: COLUMN applications.depositor_name_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.depositor_name_hash IS '입금자명 정규화 후 HMAC. 복호화 없이 입금 매칭하기 위함.';

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
    CONSTRAINT application_attendees_birth_year_check CHECK (((birth_year >= 1900) AND (birth_year <= 2100))),
    CONSTRAINT application_attendees_experience_range_check CHECK (((experience_range IS NULL) OR (experience_range = ANY (ARRAY['0'::text, '1-50'::text, '50-100'::text, '100-200'::text, '200-500'::text, '500+'::text, '200+'::text])))),
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
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'staff'::text])))
);

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_id uuid,
    actor_name text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    summary text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS '되돌리기 어려운 액션 기록. 취소·환불·수동등록·회차비활성화·입금확인 등.';

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id text NOT NULL,
    transacted_at timestamp with time zone NOT NULL,
    amount_krw integer NOT NULL,
    depositor_name_enc bytea,
    depositor_name_hash text,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    matched_application_id uuid,
    matched_at timestamp with time zone,
    matched_by text,
    ignored_at timestamp with time zone,
    ignored_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_transactions_matched_by_check CHECK (((matched_by IS NULL) OR (matched_by = ANY (ARRAY['auto'::text, 'manual'::text]))))
);

--
-- Name: TABLE bank_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bank_transactions IS '오픈뱅킹에서 수집한 입금 거래. 금액+입금자명 해시로 신청과 매칭한다.';

--
-- Name: coupon_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value integer NOT NULL,
    max_discount_krw integer,
    min_headcount integer,
    theme_id uuid,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    restrict_to_issued_phone boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupon_campaigns_discount_type_check CHECK ((discount_type = ANY (ARRAY['fixed'::text, 'percent'::text]))),
    CONSTRAINT coupon_campaigns_discount_value_check CHECK ((discount_value > 0)),
    CONSTRAINT coupon_campaigns_max_discount_krw_check CHECK (((max_discount_krw IS NULL) OR (max_discount_krw > 0))),
    CONSTRAINT coupon_campaigns_min_headcount_check CHECK (((min_headcount IS NULL) OR (min_headcount > 0))),
    CONSTRAINT percent_range CHECK (((discount_type <> 'percent'::text) OR ((discount_value >= 1) AND (discount_value <= 100))))
);

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    code text NOT NULL,
    issued_to_phone_hash text,
    issued_label text,
    used_at timestamp with time zone,
    used_application_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    is_visible boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE faqs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.faqs IS 'FaqSection.tsx 하드코딩 대체. 기존 답변에 JSX 가 섞여 있어 서식 표현 방식 확정 후 이관할 것.';

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
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: point_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    application_id uuid,
    expires_at timestamp with time zone,
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
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text,
    event_date date,
    slot text,
    title text,
    theme_label text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    venue_area text,
    price_krw integer,
    original_price_krw integer,
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
    content_group text,
    theme_name text,
    session_type text,
    difficulty smallint DEFAULT 3 NOT NULL,
    theme_id uuid,
    min_age integer,
    price_krw_override integer,
    capacity_confirm_line_override integer,
    capacity_max_override integer,
    venue_id_override uuid,
    legacy_format text,
    legacy_slug text,
    admin_note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    opens_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sessions_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5))),
    CONSTRAINT sessions_session_type_check CHECK ((session_type = ANY (ARRAY['그룹'::text, '소개팅'::text]))),
    CONSTRAINT sessions_slot_check CHECK ((slot = ANY (ARRAY['afternoon'::text, 'evening'::text]))),
    CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'cancelled'::text])))
);

--
-- Name: COLUMN sessions.theme_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.theme_id IS 'Phase 2 에서 채운 뒤 not null 로 조인다.';

--
-- Name: COLUMN sessions.min_age; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.min_age IS '이 회차에 실제 적용된 최소 연령. 시각에서 유도만 하지 않고 저장한다(규칙 변경이 과거를 소급하지 않도록).';

--
-- Name: COLUMN sessions.legacy_format; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.legacy_format IS '과거 회차의 진행 형식(그룹/소개팅). 신규 회차는 null.';

--
-- Name: COLUMN sessions.legacy_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.legacy_slug IS '과거 고객 URL(0829-meeting 등). 리다이렉트용.';

--
-- Name: COLUMN sessions.opens_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.opens_at IS '이 시각부터 고객 화면에 보인다. 롤링 오픈용. 과거면 바로 공개.';

--
-- Name: themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    description text,
    difficulty smallint DEFAULT 3 NOT NULL,
    duration_minutes integer NOT NULL,
    min_age_floor integer,
    capacity_confirm_line integer NOT NULL,
    capacity_max integer NOT NULL,
    capacity_min integer,
    venue_id uuid NOT NULL,
    accent_color text,
    hero_image_path text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_listed boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_group_size integer,
    category_id uuid,
    logo_image_path text,
    title_font text,
    opening_date date,
    CONSTRAINT themes_capacity_confirm_line_check CHECK ((capacity_confirm_line > 0)),
    CONSTRAINT themes_capacity_max_check CHECK ((capacity_max > 0)),
    CONSTRAINT themes_capacity_min_check CHECK (((capacity_min IS NULL) OR (capacity_min > 0))),
    CONSTRAINT themes_capacity_order CHECK ((capacity_confirm_line <= capacity_max)),
    CONSTRAINT themes_difficulty_check CHECK (((difficulty >= 0) AND (difficulty <= 5))),
    CONSTRAINT themes_duration_minutes_check CHECK ((duration_minutes >= 0)),
    CONSTRAINT themes_max_group_size_check CHECK (((max_group_size IS NULL) OR (max_group_size >= 1))),
    CONSTRAINT themes_min_age_floor_check CHECK (((min_age_floor IS NULL) OR ((min_age_floor >= 0) AND (min_age_floor <= 100))))
);

--
-- Name: TABLE themes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.themes IS '테마(상품). 회차가 가격·정원·소요시간·장소를 여기서 물려받는다.';

--
-- Name: COLUMN themes.difficulty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.difficulty IS '난이도 1~5. 0 은 미정 — 화면에서 감춘다.';

--
-- Name: COLUMN themes.duration_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.duration_minutes IS '소요시간(분). 0 은 미정 — 화면에서 감춘다.';

--
-- Name: COLUMN themes.min_age_floor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.min_age_floor IS '테마 자체의 최소 연령 하한. 시각 규칙(18시)보다 우선해 하한으로 작용한다.';

--
-- Name: COLUMN themes.content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.content IS 'for_you / steps / timetable / precautions 4개 블록. timetable 은 절대시각이 아니라 offset_min.';

--
-- Name: COLUMN themes.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.is_active IS '신청 받기. false 면 신청 버튼이 비활성화되지만 테마 페이지는 계속 보인다.';

--
-- Name: COLUMN themes.is_listed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.is_listed IS '목록 노출. false 면 /contents 목록과 sitemap 에 안 나오지만 직접 URL 접근은 된다.';

--
-- Name: COLUMN themes.max_group_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.max_group_size IS '한 건에 신청 가능한 최대 인원. null 이면 무제한(정원 범위 내).';

--
-- Name: COLUMN themes.logo_image_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.logo_image_path IS '테마 행성 로고 URL. 컨텐츠 목록·어드민 목록에서 원형으로 노출. 비우면 포스터로 대체.';

--
-- Name: COLUMN themes.title_font; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.title_font IS '컨텐츠 목록 테마명 글꼴 키. THEME_TITLE_FONTS(src/types/catalog.ts) 와 값이 맞아야 한다.';

--
-- Name: COLUMN themes.opening_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.opening_date IS '예약 달력에 ''오픈'' 으로 표시할 날짜. 비우면 표시 안 함.';

--
-- Name: venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    area_label text NOT NULL,
    parking_note text,
    map_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE venues; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.venues IS '대관 장소. 정확 주소는 비공개, area_label 만 공개된다.';

--
-- Name: COLUMN venues.area_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venues.area_label IS '공개용 대략 위치. venue_public 뷰를 통해서만 노출된다.';

--
-- Name: session_display; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.session_display AS
 SELECT s.id,
    s.theme_id,
    s.start_at,
    s.end_at,
    s.status,
    s.min_age,
    COALESCE(t.name, s.theme_name) AS theme_name,
    COALESCE(s.legacy_format, s.session_type) AS format_label,
    COALESCE(v.area_label, s.venue_area) AS venue_area,
    v.address AS venue_address,
    v.parking_note AS venue_parking_note,
    COALESCE(t.slug, s.slug) AS link_slug,
        CASE
            WHEN (s.theme_id IS NOT NULL) THEN ('/themes/'::text || t.slug)
            ELSE ('/sessions/'::text || s.slug)
        END AS public_path,
    (COALESCE(s.legacy_format, s.session_type) IS NOT NULL) AS is_legacy,
        CASE
            WHEN (COALESCE(s.legacy_format, s.session_type) IS NOT NULL) THEN s.capacity_confirm_line
            ELSE COALESCE(s.capacity_confirm_line_override, t.capacity_confirm_line)
        END AS capacity_confirm_line,
        CASE
            WHEN (COALESCE(s.legacy_format, s.session_type) IS NOT NULL) THEN s.capacity_max
            ELSE COALESCE(s.capacity_max_override, t.capacity_max)
        END AS capacity_max,
    s.capacity_max_male,
    s.capacity_max_female,
    s.opens_at
   FROM ((public.sessions s
     LEFT JOIN public.themes t ON ((t.id = s.theme_id)))
     LEFT JOIN public.venues v ON ((v.id = COALESCE(s.venue_id_override, t.venue_id))));

--
-- Name: VIEW session_display; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.session_display IS '옛 회차와 새 회차의 표시값을 통일한 뷰. session_view 와 달리 LEFT JOIN 이라 theme_id 가 없는 과거 회차도 포함한다. 옛 회차 판정은 format_label(legacy_format/session_type) 유무로 한다 — 이관 후에도 안정적이다. 어드민 화면은 sessions 를 직접 읽지 말고 이 뷰를 쓸 것.';

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
-- Name: theme_price_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_price_tiers (
    theme_id uuid NOT NULL,
    min_headcount integer NOT NULL,
    unit_price_krw integer NOT NULL,
    original_unit_price_krw integer,
    CONSTRAINT theme_price_tiers_check CHECK (((original_unit_price_krw IS NULL) OR (original_unit_price_krw >= unit_price_krw))),
    CONSTRAINT theme_price_tiers_min_headcount_check CHECK ((min_headcount >= 1)),
    CONSTRAINT theme_price_tiers_unit_price_krw_check CHECK ((unit_price_krw >= 0))
);

--
-- Name: TABLE theme_price_tiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.theme_price_tiers IS '인원수 구간별 인당 가격. min_headcount 이상일 때 적용되며, 조건을 만족하는 구간 중 가장 큰 것을 쓴다. 예) 1→68000,2→62000,3→56000,4→50000 이면 5인은 4인 구간(50000)이 적용된다.';

--
-- Name: session_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.session_view AS
 SELECT s.id,
    s.theme_id,
    s.start_at,
    s.end_at,
    s.status,
    s.min_age,
    s.legacy_format,
    s.legacy_slug,
    t.slug AS theme_slug,
    t.name AS theme_name,
    t.difficulty,
    t.duration_minutes,
    t.accent_color,
    t.max_group_size,
    s.price_krw_override,
    ( SELECT min(p.unit_price_krw) AS min
           FROM public.theme_price_tiers p
          WHERE (p.theme_id = t.id)) AS min_unit_price_krw,
    ( SELECT max(p.unit_price_krw) AS max
           FROM public.theme_price_tiers p
          WHERE (p.theme_id = t.id)) AS max_unit_price_krw,
    COALESCE(s.capacity_confirm_line_override, t.capacity_confirm_line) AS capacity_confirm_line,
    COALESCE(s.capacity_max_override, t.capacity_max) AS capacity_max,
    COALESCE(s.venue_id_override, t.venue_id) AS venue_id,
    s.opens_at
   FROM (public.sessions s
     JOIN public.themes t ON ((t.id = s.theme_id)));

--
-- Name: VIEW session_view; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.session_view IS '회차 실효값. 가격은 구간 요금(theme_price_tiers)이 기준이며 price_krw_override 가 있으면 인원수 무관 단일가로 덮어쓴다.';

--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE site_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.site_settings IS '입금 계좌·미입금 취소 시간 등 운영자가 바꾸는 값. 현재 코드 하드코딩(bankAccount.ts)을 대체.';

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
-- Name: theme_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: theme_public_venue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.theme_public_venue AS
 SELECT t.id AS theme_id,
    v.area_label,
    v.parking_note,
    v.map_url
   FROM (public.themes t
     JOIN public.venues v ON ((v.id = t.venue_id)));

--
-- Name: VIEW theme_public_venue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.theme_public_venue IS '테마 상세에 노출해도 되는 장소 정보만 추린 뷰. 상호명(name)과 정확 주소(address)는 포함하지 않는다.';

--
-- Name: theme_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_schedules (
    theme_id uuid NOT NULL,
    start_date date NOT NULL,
    weekdays smallint[] DEFAULT '{6,0}'::smallint[] NOT NULL,
    times text[] DEFAULT '{11:30,15:30,19:30}'::text[] NOT NULL,
    open_weeks_before smallint DEFAULT 3 NOT NULL,
    open_weekday smallint DEFAULT 6,
    open_time time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    generated_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    end_date date,
    CONSTRAINT theme_schedules_open_weekday_chk CHECK (((open_weekday >= 0) AND (open_weekday <= 6))),
    CONSTRAINT theme_schedules_open_weeks_chk CHECK (((open_weeks_before >= 0) AND (open_weeks_before <= 52)))
);

--
-- Name: TABLE theme_schedules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.theme_schedules IS '테마별 회차 편성 + 롤링 오픈 규칙. 회차는 이 값으로 생성되고 opens_at 이 계산된다.';

--
-- Name: COLUMN theme_schedules.open_weekday; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.theme_schedules.open_weekday IS '공개를 고정할 요일(0=일 … 6=토). null 이면 고정하지 않고 회차마다 정확히 open_weeks_before 주 전에 연다.';

--
-- Name: COLUMN theme_schedules.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.theme_schedules.end_date IS '이 날짜까지만 회차를 만든다. 비우면 무기한 반복.';

--
-- Name: venue_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.venue_public AS
 SELECT id,
    area_label
   FROM public.venues
  WHERE is_active;

--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);

--
-- Name: application_attendees application_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_attendees
    ADD CONSTRAINT application_attendees_pkey PRIMARY KEY (id);

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
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

--
-- Name: bank_transactions bank_transactions_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_external_id_key UNIQUE (external_id);

--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);

--
-- Name: coupon_campaigns coupon_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_campaigns
    ADD CONSTRAINT coupon_campaigns_pkey PRIMARY KEY (id);

--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);

--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);

--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);

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
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);

--
-- Name: point_ledger point_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_ledger
    ADD CONSTRAINT point_ledger_pkey PRIMARY KEY (id);

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
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);

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
-- Name: theme_categories theme_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_categories
    ADD CONSTRAINT theme_categories_name_key UNIQUE (name);

--
-- Name: theme_categories theme_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_categories
    ADD CONSTRAINT theme_categories_pkey PRIMARY KEY (id);

--
-- Name: theme_price_tiers theme_price_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_price_tiers
    ADD CONSTRAINT theme_price_tiers_pkey PRIMARY KEY (theme_id, min_headcount);

--
-- Name: theme_schedules theme_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_schedules
    ADD CONSTRAINT theme_schedules_pkey PRIMARY KEY (theme_id);

--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);

--
-- Name: themes themes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_slug_key UNIQUE (slug);

--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);

--
-- Name: application_attendees_phone_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_attendees_phone_hash_idx ON public.application_attendees USING btree (phone_hash);

--
-- Name: applications_matching_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_matching_idx ON public.applications USING btree (amount_krw, depositor_name_hash) WHERE ((payment_status = 'pending'::text) AND (status <> 'cancelled'::text));

--
-- Name: applications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_user_idx ON public.applications USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: audit_logs_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_recent_idx ON public.audit_logs USING btree (created_at DESC);

--
-- Name: audit_logs_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_target_idx ON public.audit_logs USING btree (target_type, target_id);

--
-- Name: bank_tx_unmatched_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_tx_unmatched_idx ON public.bank_transactions USING btree (amount_krw, depositor_name_hash) WHERE ((matched_application_id IS NULL) AND (ignored_at IS NULL));

--
-- Name: coupons_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_campaign_idx ON public.coupons USING btree (campaign_id);

--
-- Name: coupons_issued_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_issued_phone_idx ON public.coupons USING btree (issued_to_phone_hash);

--
-- Name: coupons_unused_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_unused_idx ON public.coupons USING btree (code) WHERE (used_at IS NULL);

--
-- Name: point_ledger_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_ledger_user_idx ON public.point_ledger USING btree (user_id, created_at DESC);

--
-- Name: profiles_phone_digits_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_phone_digits_key ON public.profiles USING btree (phone_digits);

--
-- Name: sessions_theme_opens_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_theme_opens_idx ON public.sessions USING btree (theme_id, opens_at);

--
-- Name: sessions_theme_starts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_theme_starts_idx ON public.sessions USING btree (theme_id, start_at);

--
-- Name: themes_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX themes_category_idx ON public.themes USING btree (category_id);

--
-- Name: themes_listed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX themes_listed_idx ON public.themes USING btree (is_listed, sort_order) WHERE is_active;

--
-- Name: application_attendees application_attendees_nickname_unique; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER application_attendees_nickname_unique BEFORE INSERT OR UPDATE OF nickname ON public.application_attendees FOR EACH ROW EXECUTE FUNCTION public.enforce_session_nickname_unique();

--
-- Name: sessions trg_sessions_generate_labels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sessions_generate_labels BEFORE INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.sessions_generate_labels();

--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

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
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);

--
-- Name: bank_transactions bank_transactions_matched_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_application_id_fkey FOREIGN KEY (matched_application_id) REFERENCES public.applications(id);

--
-- Name: coupon_campaigns coupon_campaigns_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_campaigns
    ADD CONSTRAINT coupon_campaigns_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE SET NULL;

--
-- Name: coupons coupons_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.coupon_campaigns(id) ON DELETE CASCADE;

--
-- Name: coupons coupons_used_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_used_application_id_fkey FOREIGN KEY (used_application_id) REFERENCES public.applications(id) ON DELETE SET NULL;

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
-- Name: point_ledger point_ledger_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_ledger
    ADD CONSTRAINT point_ledger_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);

--
-- Name: point_ledger point_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_ledger
    ADD CONSTRAINT point_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

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
-- Name: sessions sessions_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id);

--
-- Name: sessions sessions_venue_id_override_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_venue_id_override_fkey FOREIGN KEY (venue_id_override) REFERENCES public.venues(id);

--
-- Name: theme_price_tiers theme_price_tiers_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_price_tiers
    ADD CONSTRAINT theme_price_tiers_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;

--
-- Name: theme_schedules theme_schedules_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_schedules
    ADD CONSTRAINT theme_schedules_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;

--
-- Name: themes themes_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.theme_categories(id) ON DELETE SET NULL;

--
-- Name: themes themes_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);

--
-- Name: _backup_20260912_application_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_20260912_application_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_20260912_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_20260912_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_20260912_session_venues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_20260912_session_venues ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_20260912_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_20260912_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_20260912_sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_20260912_sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_applications_20260815; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_applications_20260815 ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: application_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: faqs faqs_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faqs_select_visible ON public.faqs FOR SELECT USING (is_visible);

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
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

--
-- Name: notices notices_select_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notices_select_published ON public.notices FOR SELECT USING (((published_at IS NOT NULL) AND (published_at <= now())));

--
-- Name: point_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: point_ledger point_ledger_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY point_ledger_select_own ON public.point_ledger FOR SELECT TO authenticated USING ((auth.uid() = user_id));

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
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

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
-- Name: theme_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_categories theme_categories_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_categories_select_all ON public.theme_categories FOR SELECT USING (true);

--
-- Name: theme_price_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_price_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: theme_price_tiers theme_price_tiers_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY theme_price_tiers_select_public ON public.theme_price_tiers FOR SELECT USING (true);

--
-- Name: theme_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.theme_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

--
-- Name: themes themes_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY themes_select_public ON public.themes FOR SELECT USING (true);

--
-- Name: venues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION admin_search_applications(p_query text, p_session_id uuid, p_status text, p_payment text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_search_applications(p_query text, p_session_id uuid, p_status text, p_payment text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_search_applications(p_query text, p_session_id uuid, p_status text, p_payment text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_offset integer) TO service_role;

--
-- Name: FUNCTION admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_application(p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb) TO service_role;

--
-- Name: FUNCTION assign_coupon(p_campaign_id uuid, p_phone_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_coupon(p_campaign_id uuid, p_phone_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_coupon(p_campaign_id uuid, p_phone_hash text) TO service_role;

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
-- Name: FUNCTION check_active_applications_v2(p_phones text[], p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_active_applications_v2(p_phones text[], p_session_id uuid) TO service_role;

--
-- Name: FUNCTION check_nickname_available(p_session_id uuid, p_nickname text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) TO anon;
GRANT ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) TO authenticated;
GRANT ALL ON FUNCTION public.check_nickname_available(p_session_id uuid, p_nickname text) TO service_role;

--
-- Name: FUNCTION coupon_recipients(p_session_id uuid, p_paid_only boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coupon_recipients(p_session_id uuid, p_paid_only boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coupon_recipients(p_session_id uuid, p_paid_only boolean) TO service_role;

--
-- Name: FUNCTION decrypt_pii(p_ciphertext bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrypt_pii(p_ciphertext bytea) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decrypt_pii(p_ciphertext bytea) TO service_role;

--
-- Name: FUNCTION default_min_age(p_starts_at timestamp with time zone, p_theme_floor integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.default_min_age(p_starts_at timestamp with time zone, p_theme_floor integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.default_min_age(p_starts_at timestamp with time zone, p_theme_floor integer) TO service_role;

--
-- Name: FUNCTION encrypt_pii(p_plaintext text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.encrypt_pii(p_plaintext text) FROM PUBLIC;

--
-- Name: FUNCTION enforce_session_nickname_unique(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_session_nickname_unique() FROM PUBLIC;

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
-- Name: FUNCTION is_eligible_birth_year(p_year integer, p_min_age integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_eligible_birth_year(p_year integer, p_min_age integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_eligible_birth_year(p_year integer, p_min_age integer) TO service_role;

--
-- Name: FUNCTION lookup_application(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) TO anon;
GRANT ALL ON FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) TO authenticated;

--
-- Name: FUNCTION lookup_application_v2(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application_v2(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_application_v2(p_phone_digits text, p_confirmation_code text) TO anon;
GRANT ALL ON FUNCTION public.lookup_application_v2(p_phone_digits text, p_confirmation_code text) TO authenticated;

--
-- Name: FUNCTION lookup_application_v3(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) TO anon;
GRANT ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) TO authenticated;
GRANT ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) TO service_role;

--
-- Name: FUNCTION lookup_attendee_by_phone_hash(p_phone_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_attendee_by_phone_hash(p_phone_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_attendee_by_phone_hash(p_phone_hash text) TO service_role;

--
-- Name: FUNCTION normalize_coupon_code(p_raw text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.normalize_coupon_code(p_raw text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.normalize_coupon_code(p_raw text) TO anon;
GRANT ALL ON FUNCTION public.normalize_coupon_code(p_raw text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_coupon_code(p_raw text) TO service_role;

--
-- Name: FUNCTION normalize_depositor_name(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.normalize_depositor_name(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.normalize_depositor_name(p_name text) TO service_role;

--
-- Name: FUNCTION preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text) TO anon;
GRANT ALL ON FUNCTION public.preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text) TO authenticated;
GRANT ALL ON FUNCTION public.preview_coupon(p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text) TO service_role;

--
-- Name: FUNCTION resolve_unit_price(p_theme_id uuid, p_headcount integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_unit_price(p_theme_id uuid, p_headcount integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_unit_price(p_theme_id uuid, p_headcount integer) TO anon;
GRANT ALL ON FUNCTION public.resolve_unit_price(p_theme_id uuid, p_headcount integer) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_unit_price(p_theme_id uuid, p_headcount integer) TO service_role;

--
-- Name: FUNCTION submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) TO anon;
GRANT ALL ON FUNCTION public.submit_application(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean) TO authenticated;

--
-- Name: FUNCTION submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid) TO authenticated;

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
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_users TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;

--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO service_role;

--
-- Name: TABLE bank_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_transactions TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_transactions TO authenticated;
GRANT ALL ON TABLE public.bank_transactions TO service_role;

--
-- Name: TABLE coupon_campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupon_campaigns TO service_role;

--
-- Name: TABLE coupons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupons TO service_role;

--
-- Name: TABLE faqs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.faqs TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.faqs TO authenticated;
GRANT ALL ON TABLE public.faqs TO service_role;

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
-- Name: TABLE notices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notices TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notices TO authenticated;
GRANT ALL ON TABLE public.notices TO service_role;

--
-- Name: TABLE point_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_ledger TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.point_ledger TO authenticated;
GRANT ALL ON TABLE public.point_ledger TO service_role;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;

--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sessions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;

--
-- Name: TABLE themes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.themes TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.themes TO authenticated;
GRANT ALL ON TABLE public.themes TO service_role;

--
-- Name: TABLE venues; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.venues TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.venues TO authenticated;
GRANT ALL ON TABLE public.venues TO service_role;

--
-- Name: TABLE session_display; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_display TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_display TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_display TO service_role;

--
-- Name: TABLE session_venues; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_venues TO service_role;

--
-- Name: TABLE theme_price_tiers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_price_tiers TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_price_tiers TO authenticated;
GRANT ALL ON TABLE public.theme_price_tiers TO service_role;

--
-- Name: TABLE session_view; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.session_view TO service_role;

--
-- Name: TABLE site_settings; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.site_settings TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;

--
-- Name: TABLE sms_templates; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sms_templates TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.sms_templates TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.sms_templates TO service_role;

--
-- Name: TABLE theme_categories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_categories TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_categories TO authenticated;
GRANT ALL ON TABLE public.theme_categories TO service_role;

--
-- Name: TABLE theme_public_venue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_public_venue TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_public_venue TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_public_venue TO service_role;

--
-- Name: TABLE theme_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_schedules TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.theme_schedules TO authenticated;
GRANT ALL ON TABLE public.theme_schedules TO service_role;

--
-- Name: TABLE venue_public; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.venue_public TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.venue_public TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.venue_public TO service_role;

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

