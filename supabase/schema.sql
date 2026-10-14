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
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'early_bird'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    applies_from timestamp with time zone,
    applies_until timestamp with time zone,
    session_from date,
    session_to date,
    days_before integer DEFAULT 7 NOT NULL,
    badge_label text DEFAULT '얼리버드'::text NOT NULL,
    banner_title text,
    banner_body text,
    banner_highlight text,
    banner_note text,
    accent_color text DEFAULT '#ff73b4'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotions_accent_color_check CHECK ((accent_color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT promotions_days_before_check CHECK ((days_before >= 0)),
    CONSTRAINT promotions_kind_check CHECK ((kind = 'early_bird'::text)),
    CONSTRAINT promotions_period_order CHECK (((applies_from IS NULL) OR (applies_until IS NULL) OR (applies_from <= applies_until))),
    CONSTRAINT promotions_session_range_order CHECK (((session_from IS NULL) OR (session_to IS NULL) OR (session_from <= session_to)))
);

--
-- Name: TABLE promotions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.promotions IS '기간 한정 할인(얼리버드 등). 켜진 행은 한 번에 하나. 금액은 promotion_price_tiers 에 인당 고정가로.';

--
-- Name: COLUMN promotions.days_before; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promotions.days_before IS '회차 진행일 기준 며칠 전까지 신청해야 적용되는가. KST 날짜 차이로 판정한다.';

--
-- Name: active_promotion(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.active_promotion(p_start_at timestamp with time zone, p_now timestamp with time zone DEFAULT now()) RETURNS SETOF public.promotions
    LANGUAGE sql STABLE
    AS $$
  select *
    from public.promotions p
   where p.is_active
     and (p.applies_from  is null or p_now >= p.applies_from)
     and (p.applies_until is null or p_now <= p.applies_until)
     and (p.session_from  is null or (p_start_at at time zone 'Asia/Seoul')::date >= p.session_from)
     and (p.session_to    is null or (p_start_at at time zone 'Asia/Seoul')::date <= p.session_to)
     and (p_start_at at time zone 'Asia/Seoul')::date
         - (p_now at time zone 'Asia/Seoul')::date >= p.days_before
   limit 1;
$$;

--
-- Name: add_marketing_optout(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_marketing_optout(p_phone text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  insert into marketing_sms_optouts (phone_hash, phone_enc, note)
  values (hash_phone(p_phone), encrypt_pii(regexp_replace(p_phone, '[^0-9]', '', 'g')), p_note)
  on conflict (phone_hash) do update set note = coalesce(excluded.note, marketing_sms_optouts.note);
$$;

--
-- Name: admin_search_applications(text, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_search_applications(p_query text, p_session_id uuid, p_status text, p_payment text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_offset integer) RETURNS TABLE(id uuid, confirmation_code text, status text, payment_status text, headcount integer, amount_krw integer, discount_krw integer, coupons text, created_at timestamp with time zone, session_id uuid, session_start_at timestamp with time zone, theme_name text, format_label text, representative_name text, representative_phone text, depositor_name text, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
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
      coalesce(ap.discount_krw, 0) as discount_krw,
      (select string_agg(ac.campaign_name || ' ' || ac.code, ', ' order by ac.code)
         from application_coupons ac where ac.application_id = ap.id) as coupons,
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
         f.discount_krw, f.coupons,
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
declare
  v_theme_id uuid;
  v_min_age  int;
  v_self_dup text;
  v_dup      text;
begin
  select s.theme_id, s.min_age into v_theme_id, v_min_age
    from applications ap
    join sessions s on s.id = ap.session_id
   where ap.id = p_application_id;

  if not found then raise exception '존재하지 않는 신청입니다.'; end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a
             where not is_eligible_birth_year((a->>'birth_year')::int, v_min_age)) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_min_age;
  end if;

  select string_agg(distinct phone, ',') into v_self_dup from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
      from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.' using detail = v_self_dup;
  end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',') into v_dup
    from jsonb_array_elements(p_attendees) a
   where is_theme_participation_blocked(a->>'phone', v_theme_id, p_application_id);
  if v_dup is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.' using detail = v_dup;
  end if;

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
-- Name: assign_coupon_to_handle(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_coupon_to_handle(p_campaign_key text, p_handle text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_camp   coupon_campaigns%rowtype;
  v_coupon coupons%rowtype;
  v_handle text;
begin
  v_handle := lower(btrim(regexp_replace(coalesce(p_handle, ''), '^@+', '')));
  if v_handle = '' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_HANDLE');
  end if;

  select * into v_camp from coupon_campaigns where key = p_campaign_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CAMPAIGN_NOT_FOUND');
  end if;

  if not v_camp.is_active
     or (v_camp.valid_from  is not null and now() < v_camp.valid_from)
     or (v_camp.valid_until is not null and now() > v_camp.valid_until) then
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
  end if;

  select * into v_coupon from coupons
   where campaign_id = v_camp.id and issued_to_handle = v_handle
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
  end if;

  select * into v_coupon from coupons
   where campaign_id = v_camp.id
     and issued_to_handle is null
     and issued_to_phone_hash is null
     and used_at is null
   order by code
   limit 1
   for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
  end if;

  update coupons set issued_to_handle = v_handle where id = v_coupon.id;

  return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', false);
exception
  when unique_violation then
    select * into v_coupon from coupons
     where campaign_id = v_camp.id and issued_to_handle = v_handle limit 1;
    if found then
      return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
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
   where is_theme_participation_blocked(
           phone, (select theme_id from sessions where id = p_session_id));
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
      and x.nickname is not null
      and lower(x.nickname) = lower(p_nickname)
      and a.status <> 'cancelled'
  );
$$;

--
-- Name: codename_exists(text, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.codename_exists(p_phone text, p_round smallint) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select coalesce(
    (select jsonb_build_object(
       'exists', true,
       'at', to_char(updated_at at time zone 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS')
     )
     from public.codename_submissions
     where phone_hash = public.hash_phone(p_phone) and round = p_round),
    jsonb_build_object('exists', false)
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
  if new.nickname is null or btrim(new.nickname) = '' then
    return new;
  end if;

  if exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = new.session_id
      and lower(x.nickname) = lower(new.nickname)
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
-- Name: is_theme_participation_blocked(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select is_theme_participation_blocked(p_phone, p_theme_id, null::uuid);
$$;

--
-- Name: FUNCTION is_theme_participation_blocked(p_phone text, p_theme_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid) IS '이 전화번호가 이 테마에 더 신청할 수 없는 상태인지. 기본은 "이미 1번 참여했으면 차단", reparticipation_allowances 에 행이 있으면 그 횟수까지 허용.';

--
-- Name: is_theme_participation_blocked(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid, p_exclude_application_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select p_theme_id is not null
     and (
       select count(*)
         from application_attendees aa
         join applications ap on ap.id = aa.application_id
         join sessions s on s.id = ap.session_id
        where ap.status <> 'cancelled'
          and aa.phone_hash = hash_phone(p_phone)
          and s.theme_id = p_theme_id
          and (p_exclude_application_id is null or ap.id <> p_exclude_application_id)
     ) >= coalesce((
       select r.max_participations
         from reparticipation_allowances r
        where r.phone_hash = hash_phone(p_phone)
          and r.theme_id = p_theme_id
     ), 1);
$$;

--
-- Name: FUNCTION is_theme_participation_blocked(p_phone text, p_theme_id uuid, p_exclude_application_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid, p_exclude_application_id uuid) IS '재참여 차단 판정. p_exclude_application_id 에 준 신청은 참여 횟수에서 뺀다(수정 화면용).';

--
-- Name: list_marketing_optouts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_marketing_optouts() RETURNS TABLE(phone_hash text, phone text, note text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select o.phone_hash, decrypt_pii(o.phone_enc), o.note, o.created_at
  from marketing_sms_optouts o
  order by o.created_at desc;
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
-- Name: lookup_application_v4(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) RETURNS TABLE(theme_name text, theme_slug text, category_name text, accent_color text, format_label text, venue_area text, start_at timestamp with time zone, end_at timestamp with time zone, min_age integer, headcount integer, unit_price_krw integer, base_amount_krw integer, discount_krw integer, amount_krw integer, status text, payment_status text, confirmation_code text, created_at timestamp with time zone, payment_confirmed_sms_sent_at timestamp with time zone, notes text, waiting_number integer, attendees jsonb, paid_at timestamp with time zone, cancelled_at timestamp with time zone, refund_completed_at timestamp with time zone)
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
     from application_attendees aa2 where aa2.application_id = ap.id),
    ap.paid_at,
    ap.cancelled_at,
    ap.refund_completed_at
  from applications ap
  join sessions s on s.id = ap.session_id
  left join themes t on t.id = s.theme_id
  left join theme_categories tc on tc.id = t.category_id
  left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id)
  where ap.id = v_app_id;
end;
$$;

--
-- Name: FUNCTION lookup_application_v4(p_phone_digits text, p_confirmation_code text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) IS '전화번호 + 접수번호로 참여내역 조회. v3 에 입금확인일(paid_at)·취소일·환불완료일을 더했다.';

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
-- Name: mark_attendee_reminder_sent(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_attendee_reminder_sent(p_attendee_ids uuid[]) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with upd as (
    update application_attendees
       set reminder_sms_sent_at = now()
     where id = any(p_attendee_ids)
       and reminder_sms_sent_at is null
    returning 1
  )
  select coalesce(count(*), 0)::int from upd;
$$;

--
-- Name: FUNCTION mark_attendee_reminder_sent(p_attendee_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_attendee_reminder_sent(p_attendee_ids uuid[]) IS '장소안내 문자를 실제로 받은 참여자에게 발송 시각을 남긴다. 어드민 서버 액션·크론 전용.';

--
-- Name: marketing_sms_recipients(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marketing_sms_recipients() RETURNS TABLE(phone_hash text, name text, phone text, participation_count integer, last_session_start timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  with participations as (
    select aa.phone_hash, aa.name_enc, aa.phone_enc, s.start_at
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status = 'confirmed'
      and ap.payment_status = 'confirmed'
      and ap.cancelled_at is null
      and ap.refund_completed_at is null
      and not ap.is_internal
      and s.start_at < now()
  ),
  latest_consent as (
    select distinct on (aa.phone_hash) aa.phone_hash, ap.consent_marketing
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where aa.is_representative
    order by aa.phone_hash, ap.created_at desc
  ),
  latest_participation as (
    select distinct on (p.phone_hash) p.phone_hash, p.name_enc, p.phone_enc, p.start_at
    from participations p
    order by p.phone_hash, p.start_at desc
  )
  select
    lp.phone_hash,
    decrypt_pii(lp.name_enc)  as name,
    decrypt_pii(lp.phone_enc) as phone,
    (select count(*)::int from participations p where p.phone_hash = lp.phone_hash) as participation_count,
    lp.start_at as last_session_start
  from latest_participation lp
  join latest_consent lc on lc.phone_hash = lp.phone_hash and lc.consent_marketing
  where not exists (select 1 from marketing_sms_optouts o where o.phone_hash = lp.phone_hash)
  order by lp.start_at desc, name;
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
  elsif v_camp.discount_type = 'per_head' then
    v_discount := v_camp.discount_value * p_headcount;
    if v_camp.max_discount_krw is not null then
      v_discount := least(v_discount, v_camp.max_discount_krw);
    end if;
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
-- Name: preview_coupons(text[], uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_coupons(p_codes text[], p_theme_id uuid, p_headcount integer, p_base_amount integer, p_phone text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_code text; v_norm text;
  v_seen text[] := '{}';
  v_items jsonb := '[]'::jsonb;
  v_one jsonb;
  v_total int := 0;
  v_coupon coupons%rowtype;
  v_camp coupon_campaigns%rowtype;
  v_camps uuid[] := '{}';
  v_count int := 0;
  v_blocker text;
begin
  if p_codes is null or coalesce(array_length(p_codes, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  foreach v_code in array p_codes loop
    v_norm := normalize_coupon_code(v_code);
    continue when v_norm is null or v_norm = '';

    if v_norm = any(v_seen) then
      return jsonb_build_object('ok', false, 'reason', '같은 쿠폰을 두 번 넣을 수 없어요.');
    end if;
    v_seen := v_seen || v_norm;

    v_one := preview_coupon(v_norm, p_theme_id, p_headcount, p_base_amount, p_phone);
    if not (v_one->>'ok')::boolean then
      return jsonb_build_object('ok', false, 'reason', v_one->>'reason', 'code', v_norm);
    end if;

    select * into v_coupon from coupons where code = v_norm;
    select * into v_camp from coupon_campaigns where id = v_coupon.campaign_id;

    if v_camp.id = any(v_camps) then
      return jsonb_build_object(
        'ok', false,
        'reason', format('%s 쿠폰은 한 장만 쓸 수 있어요.', v_camp.name));
    end if;
    v_camps := v_camps || v_camp.id;

    v_count := v_count + 1;
    v_total := v_total + (v_one->>'discount_krw')::int;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code', v_norm,
      'campaign_id', v_camp.id,
      'campaign_name', v_camp.name,
      'stackable', v_camp.stackable,
      'discount_krw', (v_one->>'discount_krw')::int
    ));
  end loop;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  if v_count > 1 then
    select e->>'campaign_name' into v_blocker
      from jsonb_array_elements(v_items) e
     where not (e->>'stackable')::boolean
     limit 1;
    if v_blocker is not null then
      return jsonb_build_object(
        'ok', false,
        'reason', format('%s 쿠폰은 다른 쿠폰과 함께 쓸 수 없어요.', v_blocker));
    end if;
  end if;

  v_total := least(v_total, p_base_amount);

  return jsonb_build_object(
    'ok', true,
    'items', v_items,
    'discount_krw', v_total,
    'final_amount_krw', p_base_amount - v_total
  );
end;
$$;

--
-- Name: promotion_unit_price(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promotion_unit_price(p_promotion_id uuid, p_theme_id uuid, p_headcount integer) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
  select pt.unit_price_krw
    from public.promotion_price_tiers pt
   where pt.promotion_id = p_promotion_id
     and pt.theme_id = p_theme_id
     and pt.min_headcount <= p_headcount
   order by pt.min_headcount desc
   limit 1;
$$;

--
-- Name: release_coupon_on_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_coupon_on_cancel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    update coupons c
       set used_at = null, used_application_id = null
      from application_coupons ac
     where ac.application_id = new.id
       and c.id = ac.coupon_id
       and c.used_application_id = new.id;

    if new.coupon_id is not null then
      update coupons set used_at = null, used_application_id = null
       where id = new.coupon_id and used_application_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

--
-- Name: FUNCTION release_coupon_on_cancel(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.release_coupon_on_cancel() IS '신청이 취소되면 붙어 있던 쿠폰을 전부 미사용으로 되돌린다. 취소 경로가 여러 개라 트리거로 둔다.';

--
-- Name: remove_marketing_optout(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_marketing_optout(p_phone_hash text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  delete from marketing_sms_optouts where phone_hash = p_phone_hash;
$$;

--
-- Name: resolve_promotion_price(uuid, timestamp with time zone, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone DEFAULT now()) RETURNS TABLE(promotion_id uuid, promotion_name text, unit_price_krw integer)
    LANGUAGE sql STABLE
    AS $$
  select p.id, p.name, public.promotion_unit_price(p.id, p_theme_id, p_headcount)
    from public.active_promotion(p_start_at, p_now) p
   where public.promotion_unit_price(p.id, p_theme_id, p_headcount) is not null;
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
-- Name: set_cancelled_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_cancelled_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;

--
-- Name: FUNCTION set_cancelled_at(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_cancelled_at() IS '신청이 취소로 바뀌는 순간 cancelled_at 을 찍는다. 취소 경로가 여러 개라 트리거로 둔다.';

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
-- Name: submit_application_v2(uuid, text, boolean, boolean, jsonb, text, boolean, boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid, p_coupon_code text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_session record; v_group_size int; v_current_total int; v_status text;
  v_code text; v_app applications%rowtype; v_unit_price int;
  v_base_amount int; v_amount int; v_dup_phones text; v_self_dup text;
  v_waiting_number int; v_coupon coupons%rowtype; v_preview jsonb;
  v_discount int := 0; v_coupon_id uuid := null; v_rep_phone text;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active into v_session
  from session_view sv join themes t on t.id = sv.theme_id where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;
  if v_session.max_group_size is not null and v_group_size > v_session.max_group_size then
    raise exception '한 번에 최대 %명까지 신청할 수 있습니다.', v_session.max_group_size; end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a
             where not is_eligible_birth_year((a->>'birth_year')::int, v_session.min_age)) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_session.min_age; end if;

  select string_agg(distinct phone, ',') into v_self_dup from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.' using detail = v_self_dup; end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',') into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (select 1 from application_attendees aa
                join applications ap on ap.id = aa.application_id
                join sessions s on s.id = ap.session_id
                where ap.status <> 'cancelled' and aa.phone_hash = hash_phone(a->>'phone')
                  and s.theme_id = v_session.theme_id);
  if v_dup_phones is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.' using detail = v_dup_phones; end if;

  select coalesce(sum(cnt), 0) into v_current_total from (
    select ap.id, count(*) as cnt from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed','waiting') group by ap.id) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원마감: 남은 자리가 부족합니다.'; end if;

  v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
                   then 'confirmed' else 'waiting' end;

  v_unit_price := coalesce(v_session.price_krw_override, resolve_unit_price(v_session.theme_id, v_group_size));
  if v_unit_price is null then raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.'; end if;
  v_base_amount := v_unit_price * v_group_size;
  v_amount := v_base_amount;

  if normalize_coupon_code(p_coupon_code) is not null
     and normalize_coupon_code(p_coupon_code) <> '' then
    -- 먼저 잠근다. preview 검사만 믿으면 동시 신청에 같은 코드가 두 번 먹는다.
    select * into v_coupon from coupons
     where code = normalize_coupon_code(p_coupon_code) for update;
    if not found then raise exception '존재하지 않는 쿠폰 코드예요.'; end if;
    if v_coupon.used_at is not null then raise exception '이미 사용된 쿠폰이에요.'; end if;

    v_rep_phone := regexp_replace(p_attendees->0->>'phone', '[^0-9]', '', 'g');
    v_preview := preview_coupon(p_coupon_code, v_session.theme_id, v_group_size, v_base_amount, v_rep_phone);
    if not (v_preview->>'ok')::boolean then raise exception '%', v_preview->>'reason'; end if;

    v_discount := (v_preview->>'discount_krw')::int;
    v_amount := (v_preview->>'final_amount_krw')::int;
    v_coupon_id := v_coupon.id;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes, headcount, unit_price_krw, amount_krw,
    coupon_id, discount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes, v_group_size, v_unit_price, v_amount,
    v_coupon_id, v_discount
  ) returning * into v_app;

  if v_coupon_id is not null then
    update coupons set used_at = now(), used_application_id = v_app.id where id = v_coupon_id;
  end if;

  insert into application_attendees (
    application_id, session_id, is_representative,
    name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1),
         encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
         (a->>'birth_year')::int, nullif(a->>'nickname',''),
         nullif(a->>'gender',''), nullif(a->>'experience_range','')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  if v_current_total + v_group_size >= v_session.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id; end if;

  if v_app.status = 'waiting' then
    select count(*) + 1 into v_waiting_number from applications
     where session_id = p_session_id and status = 'waiting' and id <> v_app.id; end if;

  return jsonb_build_object(
    'id', v_app.id, 'confirmation_code', v_app.confirmation_code,
    'status', v_app.status, 'payment_status', v_app.payment_status,
    'headcount', v_group_size, 'unit_price_krw', v_unit_price,
    'base_amount_krw', v_base_amount, 'discount_krw', v_discount,
    'amount_krw', v_amount, 'waiting_number', v_waiting_number,
    'created_at', v_app.created_at);
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end; $$;

--
-- Name: submit_application_v3(uuid, text, boolean, boolean, jsonb, text, boolean, boolean, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid, p_coupon_codes text[] DEFAULT NULL::text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_session record; v_group_size int; v_current_total int; v_status text;
  v_code text; v_app applications%rowtype; v_unit_price int;
  v_base_amount int; v_amount int; v_dup_phones text; v_self_dup text;
  v_waiting_number int; v_preview jsonb; v_item jsonb;
  v_discount int := 0; v_rep_phone text; v_norm text; v_codes text[] := '{}';
  v_locked coupons%rowtype;
  -- ── 프로모션 (v3 이전과 다른 부분) ──
  v_base_unit_price int; v_promo_discount int := 0;
  v_promo_id uuid; v_promo_name text; v_promo_unit int;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active into v_session
  from session_view sv join themes t on t.id = sv.theme_id where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;
  -- 이미 시작한 회차는 받지 않는다. status 는 손으로 내리는 값이라 지나간 회차에도
  -- 'open' 이 남는다 — 시각으로 끊지 않으면 끝난 회차에 신청이 들어간다.
  if v_session.start_at < now() then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;
  if v_session.max_group_size is not null and v_group_size > v_session.max_group_size then
    raise exception '한 번에 최대 %명까지 신청할 수 있습니다.', v_session.max_group_size; end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a
             where not is_eligible_birth_year((a->>'birth_year')::int, v_session.min_age)) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_session.min_age; end if;

  select string_agg(distinct phone, ',') into v_self_dup from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.' using detail = v_self_dup; end if;

  -- 재참여 차단. 판정은 is_theme_participation_blocked() 한 곳에만 둔다 —
  -- 화면 사전 안내(check_active_applications_v2)와 같은 함수를 쓴다.
  -- 사람 단위 예외는 reparticipation_allowances 표에 적는다.
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',') into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where is_theme_participation_blocked(a->>'phone', v_session.theme_id);
  if v_dup_phones is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.' using detail = v_dup_phones; end if;

  select coalesce(sum(cnt), 0) into v_current_total from (
    select ap.id, count(*) as cnt from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed','waiting') group by ap.id) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원마감: 남은 자리가 부족합니다.'; end if;

  v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
                   then 'confirmed' else 'waiting' end;

  -- ── 인당가 (프로모션 적용) ─────────────────────────────────
  v_base_unit_price := coalesce(v_session.price_krw_override, resolve_unit_price(v_session.theme_id, v_group_size));
  if v_base_unit_price is null then raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.'; end if;
  v_unit_price := v_base_unit_price;

  -- 회차별 금액을 손으로 박아 둔 회차는 프로모션보다 그쪽이 이긴다.
  if v_session.price_krw_override is null then
    select r.promotion_id, r.promotion_name, r.unit_price_krw
      into v_promo_id, v_promo_name, v_promo_unit
      from resolve_promotion_price(v_session.theme_id, v_session.start_at, v_group_size, now()) r;

    -- 프로모션가가 기본가보다 싸지 않으면 적용하지 않는다. 운영자가 숫자를
    -- 잘못 넣어도 고객이 기본가보다 더 내는 일은 없어야 한다.
    if v_promo_unit is not null and v_promo_unit < v_base_unit_price then
      v_unit_price := v_promo_unit;
      v_promo_discount := (v_base_unit_price - v_unit_price) * v_group_size;
    else
      v_promo_id := null; v_promo_name := null;
    end if;
  end if;

  v_base_amount := v_unit_price * v_group_size;
  v_amount := v_base_amount;

  -- ── 쿠폰 (v2 와 다른 부분) ──────────────────────────────────
  if p_coupon_codes is not null then
    -- 빈 값을 걸러 정규화한다.
    foreach v_norm in array p_coupon_codes loop
      v_norm := normalize_coupon_code(v_norm);
      if v_norm is not null and v_norm <> '' and not (v_norm = any(v_codes)) then
        v_codes := v_codes || v_norm;
      end if;
    end loop;
  end if;

  if coalesce(array_length(v_codes, 1), 0) > 0 then
    -- ⚠️ 먼저 **코드 순서대로** 잠근다. 순서를 고정해야 두 신청이 같은 두 장을
    --    반대 순서로 잡아 교착(deadlock)에 빠지지 않는다.
    --    preview 검사만 믿으면 동시 신청에 같은 코드가 두 번 먹는다.
    for v_norm in select unnest(v_codes) order by 1 loop
      select * into v_locked from coupons where code = v_norm for update;
      if not found then raise exception '존재하지 않는 쿠폰 코드예요.'; end if;
      if v_locked.used_at is not null then raise exception '이미 사용된 쿠폰이에요.'; end if;
    end loop;

    v_rep_phone := regexp_replace(p_attendees->0->>'phone', '[^0-9]', '', 'g');
    -- ⚠️ 쿠폰은 **프로모션이 적용된 금액 위에** 얹힌다(중복 적용 가능).
    --    정률 쿠폰도 할인 후 금액을 기준으로 계산된다.
    v_preview := preview_coupons(v_codes, v_session.theme_id, v_group_size, v_base_amount, v_rep_phone);
    if not (v_preview->>'ok')::boolean then raise exception '%', v_preview->>'reason'; end if;

    v_discount := (v_preview->>'discount_krw')::int;
    v_amount := (v_preview->>'final_amount_krw')::int;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes, headcount, unit_price_krw, amount_krw,
    discount_krw,
    promotion_id, promotion_name, base_unit_price_krw, promotion_discount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes, v_group_size, v_unit_price, v_amount,
    v_discount,
    v_promo_id, v_promo_name, v_base_unit_price, v_promo_discount
  ) returning * into v_app;

  -- 쿠폰을 신청에 붙이고 소진 처리한다.
  if v_preview is not null and (v_preview->>'ok')::boolean then
    for v_item in select * from jsonb_array_elements(v_preview->'items') loop
      insert into application_coupons (
        application_id, coupon_id, campaign_id, code, campaign_name, discount_krw)
      select v_app.id, c.id, (v_item->>'campaign_id')::uuid,
             v_item->>'code', v_item->>'campaign_name', (v_item->>'discount_krw')::int
        from coupons c where c.code = v_item->>'code';

      update coupons set used_at = now(), used_application_id = v_app.id
       where code = v_item->>'code';
    end loop;
  end if;

  insert into application_attendees (
    application_id, session_id, is_representative,
    name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1),
         encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
         (a->>'birth_year')::int, nullif(a->>'nickname',''),
         nullif(a->>'gender',''), nullif(a->>'experience_range','')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  if v_current_total + v_group_size >= v_session.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id; end if;

  if v_app.status = 'waiting' then
    select count(*) + 1 into v_waiting_number from applications
     where session_id = p_session_id and status = 'waiting' and id <> v_app.id; end if;

  return jsonb_build_object(
    'id', v_app.id, 'confirmation_code', v_app.confirmation_code,
    'status', v_app.status, 'payment_status', v_app.payment_status,
    'headcount', v_group_size, 'unit_price_krw', v_unit_price,
    'base_amount_krw', v_base_amount, 'discount_krw', v_discount,
    'amount_krw', v_amount, 'waiting_number', v_waiting_number,
    'coupons', coalesce(v_preview->'items', '[]'::jsonb),
    'promotion_id', v_promo_id,
    'promotion_name', v_promo_name,
    'base_unit_price_krw', v_base_unit_price,
    'promotion_discount_krw', v_promo_discount,
    'created_at', v_app.created_at);
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end; $$;

--
-- Name: submit_codename(smallint, text, text, text, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_codename(p_round smallint, p_nickname text, p_codename text, p_phone text, p_consent boolean, p_is_correct boolean, p_replace boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_hash     text := public.hash_phone(p_phone);
  v_code     text := upper(regexp_replace(coalesce(p_codename, ''), '[^A-Za-z]', '', 'g'));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_existing public.codename_submissions%rowtype;
  v_had_any  boolean;
begin
  if v_nickname = '' or v_code = '' then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  select * into v_existing
    from public.codename_submissions
   where phone_hash = v_hash and round = p_round
   for update;

  if found and not coalesce(p_replace, false) then
    return jsonb_build_object(
      'ok', false,
      'status', 'duplicate',
      'previous_at', to_char(v_existing.updated_at at time zone 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS')
    );
  end if;

  if found then
    update public.codename_submissions
       set nickname = v_nickname,
           codename = v_code,
           phone_enc = public.encrypt_pii(p_phone),
           consent_personal_info = coalesce(p_consent, false),
           is_correct = p_is_correct,
           is_rejoin = true,
           updated_at = now()
     where id = v_existing.id;

    return jsonb_build_object('ok', true, 'status', 'replaced', 'is_rejoin', true);
  end if;

  select exists(
    select 1 from public.codename_submissions where phone_hash = v_hash
  ) into v_had_any;

  insert into public.codename_submissions (
    round, nickname, codename, phone_enc, phone_hash,
    consent_personal_info, is_rejoin, is_correct
  ) values (
    p_round, v_nickname, v_code, public.encrypt_pii(p_phone), v_hash,
    coalesce(p_consent, false), v_had_any, p_is_correct
  );

  return jsonb_build_object('ok', true, 'status', 'inserted', 'is_rejoin', v_had_any);
end;
$$;

--
-- Name: submit_group_booking_inquiry(integer, text, text, date, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_group_booking_inquiry(p_headcount integer, p_contact_method text, p_contact text, p_preferred_date date, p_preferred_time text, p_group_kind text, p_note text DEFAULT NULL::text, p_attribution jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_headcount is null or p_headcount < 2 or p_headcount > 200 then
    raise exception '예상 참여 인원을 확인해주세요.';
  end if;
  if p_contact_method is null or p_contact_method not in ('kakao', 'phone', 'sms', 'email') then
    raise exception '연락 수단을 선택해주세요.';
  end if;
  if p_contact is null or length(trim(p_contact)) = 0 then
    raise exception '연락처를 입력해주세요.';
  end if;
  if p_preferred_time is null or length(trim(p_preferred_time)) = 0 then
    raise exception '예상 이용 시간을 선택해주세요.';
  end if;
  if p_group_kind is null or length(trim(p_group_kind)) = 0 then
    raise exception '모임 성격을 선택해주세요.';
  end if;

  insert into public.group_booking_inquiries (
    headcount, contact_method, contact_enc,
    preferred_date, preferred_time, group_kind, note,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path
  ) values (
    p_headcount,
    p_contact_method,
    encrypt_pii(trim(p_contact)),
    p_preferred_date,
    trim(p_preferred_time),
    trim(p_group_kind),
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_source', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_medium', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_campaign', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_content', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_term', '')), ''),
    nullif(trim(coalesce(p_attribution->>'referrer', '')), ''),
    nullif(trim(coalesce(p_attribution->>'landing_path', '')), '')
  ) returning id into v_id;

  return v_id;
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
-- Name: _backup_application_attendees_20260913; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_application_attendees_20260913 (
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
    created_at timestamp with time zone,
    reminder_sms_sent_at timestamp with time zone
);

--
-- Name: _backup_applications_20260913; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_applications_20260913 (
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
    updated_at timestamp with time zone,
    coupon_id uuid,
    discount_krw integer,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone
);

--
-- Name: TABLE _backup_applications_20260913; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public._backup_applications_20260913 IS '2026-09-13 삭제한 팀 테스트 신청 8건의 백업. 분석 숫자 확인 후 drop 할 것.';

--
-- Name: _backup_theme_content_20260913b; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_theme_content_20260913b (
    id uuid,
    slug text,
    content jsonb,
    updated_at timestamp with time zone,
    backed_up_at timestamp with time zone
);

--
-- Name: _backup_theme_content_20260914; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_theme_content_20260914 (
    id uuid,
    slug text,
    content jsonb,
    updated_at timestamp with time zone,
    backed_up_at timestamp with time zone
);

--
-- Name: _backup_theme_content_20260915; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_theme_content_20260915 (
    id uuid,
    slug text,
    content jsonb,
    backed_up_at timestamp with time zone
);

--
-- Name: _backup_theme_content_20260915b; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_theme_content_20260915b (
    id uuid,
    slug text,
    content jsonb,
    description text,
    updated_at timestamp with time zone,
    backed_up_at timestamp with time zone
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
    coupon_id uuid,
    discount_krw integer DEFAULT 0 NOT NULL,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer text,
    landing_path text,
    is_internal boolean DEFAULT false NOT NULL,
    promotion_id uuid,
    promotion_name text,
    base_unit_price_krw integer,
    promotion_discount_krw integer DEFAULT 0 NOT NULL,
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
-- Name: COLUMN applications.coupon_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.coupon_id IS '[사용 안 함] 쿠폰 1장 시절의 칸. 지금은 application_coupons 가 진실이다. 옛 기록 보존용으로만 남긴다.';

--
-- Name: COLUMN applications.discount_krw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.discount_krw IS '쿠폰으로 깎인 금액. amount_krw 는 이미 할인이 반영된 값이다.';

--
-- Name: COLUMN applications.paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.paid_at IS '입금이 확인된 시각. 취소되어 payment_status 가 cancelled 로 덮여도 남는다 — 환불 대상 판별용.';

--
-- Name: COLUMN applications.cancelled_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.cancelled_at IS '신청이 취소된 시각. 환불 비율 계산의 기준 시점이기도 하다. 2026-09-13 이전 취소 건은 null.';

--
-- Name: COLUMN applications.utm_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.utm_source IS '유입경로. 신청 직후 서버 액션이 기록한다(submit_application_v2 와 무관).';

--
-- Name: COLUMN applications.referrer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.referrer IS 'UTM 이 없을 때 출처를 가늠하는 단서. 외부 사이트 주소(origin+path).';

--
-- Name: COLUMN applications.landing_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.landing_path IS '우리 사이트에서 처음 연 경로. 광고가 어느 페이지로 보냈는지 본다.';

--
-- Name: COLUMN applications.is_internal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.is_internal IS '우리 기기(/internal 에서 표시를 켠 브라우저)에서 넣은 신청. 어드민 분석에서 뺀다. 운영 화면에는 그대로 보인다.';

--
-- Name: COLUMN applications.base_unit_price_krw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.base_unit_price_krw IS '할인 전 인당가. unit_price_krw 에는 할인 후 금액이 들어간다.';

--
-- Name: COLUMN applications.promotion_discount_krw; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.applications.promotion_discount_krw IS '프로모션(얼리버드) 할인액. 쿠폰 할인(discount_krw)과 별개로 센다.';

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
    promoted_from_waiting_at,
    paid_at
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
    reminder_sms_sent_at timestamp with time zone,
    CONSTRAINT application_attendees_birth_year_check CHECK (((birth_year >= 1900) AND (birth_year <= 2100))),
    CONSTRAINT application_attendees_experience_range_check CHECK (((experience_range IS NULL) OR (experience_range = ANY (ARRAY['0'::text, '1-50'::text, '50-100'::text, '100-200'::text, '200-500'::text, '500+'::text, '200+'::text])))),
    CONSTRAINT application_attendees_gender_check CHECK ((gender = ANY (ARRAY['M'::text, 'F'::text])))
);

--
-- Name: COLUMN application_attendees.reminder_sms_sent_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.application_attendees.reminder_sms_sent_at IS '장소안내(문자3)를 이 참여자에게 보낸 시각. null 이면 아직 안 보냄.';

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
    created_at,
    reminder_sms_sent_at
   FROM public.application_attendees aa;

--
-- Name: group_booking_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_booking_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    headcount integer NOT NULL,
    contact_method text NOT NULL,
    contact_enc bytea NOT NULL,
    preferred_date date,
    preferred_time text NOT NULL,
    group_kind text NOT NULL,
    note text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_content text,
    utm_term text,
    referrer text,
    landing_path text,
    status text DEFAULT 'new'::text NOT NULL,
    admin_memo text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_booking_inquiries_contact_method_check CHECK ((contact_method = ANY (ARRAY['kakao'::text, 'phone'::text, 'sms'::text, 'email'::text]))),
    CONSTRAINT group_booking_inquiries_headcount_check CHECK (((headcount >= 2) AND (headcount <= 200))),
    CONSTRAINT group_booking_inquiries_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'quoted'::text, 'booked'::text, 'dropped'::text])))
);

--
-- Name: TABLE group_booking_inquiries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.group_booking_inquiries IS '단체 예약 견적 신청 접수함. 예약이 아니라 상담 요청이다 (/group).';

--
-- Name: admin_group_booking_inquiries_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_group_booking_inquiries_view AS
 SELECT id,
    created_at,
    headcount,
    contact_method,
    public.decrypt_pii(contact_enc) AS contact,
    preferred_date,
    preferred_time,
    group_kind,
    note,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    referrer,
    landing_path,
    status,
    admin_memo,
    updated_at
   FROM public.group_booking_inquiries;

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
-- Name: application_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_coupons (
    application_id uuid NOT NULL,
    coupon_id uuid,
    campaign_id uuid,
    code text NOT NULL,
    campaign_name text NOT NULL,
    discount_krw integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT application_coupons_discount_krw_check CHECK ((discount_krw >= 0))
);

--
-- Name: TABLE application_coupons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.application_coupons IS '신청에 적용된 쿠폰들. 신청 1건에 여러 장이 붙을 수 있다(stackable 캠페인끼리만). 정산의 기준.';

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
-- Name: codename_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codename_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    round smallint DEFAULT 1 NOT NULL,
    nickname text NOT NULL,
    codename text NOT NULL,
    phone_enc bytea NOT NULL,
    phone_hash text NOT NULL,
    consent_personal_info boolean DEFAULT false NOT NULL,
    is_rejoin boolean DEFAULT false NOT NULL,
    is_correct boolean,
    is_free_pair_winner boolean DEFAULT false NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT codename_submissions_codename_check CHECK ((codename ~ '^[A-Z]{1,32}$'::text)),
    CONSTRAINT codename_submissions_nickname_check CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 30))),
    CONSTRAINT codename_submissions_round_check CHECK ((round = ANY (ARRAY[1, 2])))
);

--
-- Name: TABLE codename_submissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.codename_submissions IS '코드네임 맞히기 이벤트(/codename) 응모 기록. 연락처+회차당 한 줄.';

--
-- Name: COLUMN codename_submissions.is_rejoin; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codename_submissions.is_rejoin IS '같은 연락처로 이전에 제출한 이력이 있으면 true(답안 교체 · 다음 회차 재응모).';

--
-- Name: COLUMN codename_submissions.is_correct; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codename_submissions.is_correct IS '서버 자동 채점 결과. 정답 문자열 미설정 시 null.';

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
    stackable boolean DEFAULT false NOT NULL,
    show_event_bubble boolean DEFAULT false NOT NULL,
    event_bubble_text text,
    key text,
    event_bubble_url text,
    CONSTRAINT coupon_campaigns_discount_type_check CHECK ((discount_type = ANY (ARRAY['fixed'::text, 'percent'::text, 'per_head'::text]))),
    CONSTRAINT coupon_campaigns_discount_value_check CHECK ((discount_value > 0)),
    CONSTRAINT coupon_campaigns_max_discount_krw_check CHECK (((max_discount_krw IS NULL) OR (max_discount_krw > 0))),
    CONSTRAINT coupon_campaigns_min_headcount_check CHECK (((min_headcount IS NULL) OR (min_headcount > 0))),
    CONSTRAINT percent_range CHECK (((discount_type <> 'percent'::text) OR ((discount_value >= 1) AND (discount_value <= 100))))
);

--
-- Name: COLUMN coupon_campaigns.stackable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_campaigns.stackable IS '다른 쿠폰과 겹쳐 쓸 수 있는지. 2장 이상 적용하려면 전부 true 여야 한다.';

--
-- Name: COLUMN coupon_campaigns.show_event_bubble; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_campaigns.show_event_bubble IS '켜면 사이트 우하단 인스타 버튼 위에 이벤트 말풍선이 뜬다.';

--
-- Name: COLUMN coupon_campaigns.event_bubble_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_campaigns.event_bubble_text IS '말풍선 문구. 줄바꿈하면 두 줄. 비우면 캠페인 이름을 쓴다.';

--
-- Name: COLUMN coupon_campaigns.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_campaigns.key IS '외부 연동(ManyChat 등)이 캠페인을 찾을 때 쓰는 고정 키. 이름과 달리 바뀌지 않는다.';

--
-- Name: COLUMN coupon_campaigns.event_bubble_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupon_campaigns.event_bubble_url IS '말풍선이 켜진 동안 우하단 인스타 버튼·말풍선이 향할 주소(이벤트 게시물). 비우면 계정 홈.';

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_to_handle text
);

--
-- Name: COLUMN coupons.issued_to_handle; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coupons.issued_to_handle IS '이 쿠폰을 받아간 외부 계정(인스타 아이디 등). @ 없이 소문자로 저장한다.';

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
-- Name: marketing_sms_optouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_sms_optouts (
    phone_hash text NOT NULL,
    phone_enc bytea NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_sms_optouts_note_check CHECK (((note IS NULL) OR (char_length(note) <= 200)))
);

--
-- Name: TABLE marketing_sms_optouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.marketing_sms_optouts IS '광고 문자 수신거부 번호. 여기 있는 번호는 동의 여부와 관계없이 광고 문자 대상에서 빠진다.';

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
-- Name: popups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.popups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    image_url text,
    image_alt text,
    body text,
    link_url text,
    link_label text,
    pages text[] DEFAULT '{home,themes,theme_detail}'::text[] NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT false NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT popups_has_content CHECK (((COALESCE(image_url, ''::text) <> ''::text) OR (COALESCE(body, ''::text) <> ''::text))),
    CONSTRAINT popups_link_url_check CHECK (((link_url IS NULL) OR (link_url ~ '^(/|https://)'::text))),
    CONSTRAINT popups_pages_check CHECK ((pages <@ ARRAY['home'::text, 'themes'::text, 'theme_detail'::text])),
    CONSTRAINT popups_period_order CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at <= ends_at)))
);

--
-- Name: TABLE popups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.popups IS '접속 시 뜨는 안내 팝업. 고객 화면은 public_popup 뷰만 읽는다.';

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
-- Name: promotion_price_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_price_tiers (
    promotion_id uuid NOT NULL,
    theme_id uuid NOT NULL,
    min_headcount integer NOT NULL,
    unit_price_krw integer NOT NULL,
    CONSTRAINT promotion_price_tiers_min_headcount_check CHECK ((min_headcount >= 1)),
    CONSTRAINT promotion_price_tiers_unit_price_krw_check CHECK ((unit_price_krw >= 0))
);

--
-- Name: TABLE promotion_price_tiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.promotion_price_tiers IS '프로모션 적용 시의 인당 가격. 구간이 없는 테마는 그 프로모션 대상이 아니다(기본가 유지).';

--
-- Name: public_event_bubble; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_event_bubble AS
 SELECT COALESCE(NULLIF(btrim(event_bubble_text), ''::text), name) AS text,
    NULLIF(btrim(event_bubble_url), ''::text) AS url
   FROM public.coupon_campaigns c
  WHERE (is_active AND show_event_bubble AND ((valid_from IS NULL) OR (valid_from <= now())) AND ((valid_until IS NULL) OR (valid_until >= now())))
  ORDER BY updated_at DESC
 LIMIT 1;

--
-- Name: VIEW public_event_bubble; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.public_event_bubble IS '우하단 이벤트 말풍선 문구. 켜진 캠페인이 없으면 0행.';

--
-- Name: public_popup; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_popup AS
 SELECT id,
    image_url,
    image_alt,
    body,
    link_url,
    link_label,
    pages,
    sort
   FROM public.popups
  WHERE (is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now())));

--
-- Name: public_promotion; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_promotion AS
 SELECT id,
    name,
    kind,
    badge_label,
    banner_title,
    banner_body,
    banner_highlight,
    banner_note,
    accent_color,
    days_before,
    session_from,
    session_to,
    applies_from,
    applies_until
   FROM public.promotions
  WHERE is_active;

--
-- Name: public_promotion_price_tier; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_promotion_price_tier AS
 SELECT pt.promotion_id,
    pt.theme_id,
    pt.min_headcount,
    pt.unit_price_krw
   FROM (public.promotion_price_tiers pt
     JOIN public.promotions p ON ((p.id = pt.promotion_id)))
  WHERE p.is_active;

--
-- Name: utm_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.utm_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    slug text,
    landing_path text NOT NULL,
    utm_source text NOT NULL,
    utm_medium text NOT NULL,
    utm_campaign text NOT NULL,
    utm_content text,
    utm_term text,
    managed_by text DEFAULT 'db'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    note text,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT utm_links_landing_path_check CHECK ((landing_path ~ '^/'::text)),
    CONSTRAINT utm_links_managed_by_check CHECK ((managed_by = ANY (ARRAY['db'::text, 'code'::text]))),
    CONSTRAINT utm_links_medium_rule CHECK (((managed_by = 'code'::text) OR (utm_medium = ANY (ARRAY['social'::text, 'paid_social'::text, 'referral'::text, 'affiliate'::text, 'display'::text])))),
    CONSTRAINT utm_links_slug_shape CHECK (((slug IS NULL) OR (slug ~ '^[a-z0-9][a-z0-9.-]*$'::text))),
    CONSTRAINT utm_links_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text]))),
    CONSTRAINT utm_links_utm_campaign_check CHECK ((utm_campaign ~ '^[a-z0-9_]+$'::text)),
    CONSTRAINT utm_links_utm_source_check CHECK ((utm_source ~ '^[a-z0-9_]+$'::text))
);

--
-- Name: TABLE utm_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.utm_links IS '유입경로(UTM) 링크 목록. 분석·홍보용이며 신청·결제·정산에 영향을 주지 않는다. 규칙은 WYE-89 문서.';

--
-- Name: COLUMN utm_links.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.utm_links.slug IS '짧은 주소 경로(앞의 / 없이). managed_by=db 인 행만 실제로 해석된다.';

--
-- Name: COLUMN utm_links.managed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.utm_links.managed_by IS 'code = next.config/라우트 핸들러에 박혀 있어 이 표를 고쳐도 동작이 바뀌지 않는다(기록용).';

--
-- Name: public_short_link; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_short_link AS
 SELECT slug,
    landing_path,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term
   FROM public.utm_links
  WHERE ((status = 'active'::text) AND (managed_by = 'db'::text) AND (slug IS NOT NULL));

--
-- Name: VIEW public_short_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.public_short_link IS '짧은 주소 해석용. 활성·DB관리 행의 목적지만 공개한다.';

--
-- Name: reparticipation_allowances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reparticipation_allowances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_hash text NOT NULL,
    theme_id uuid NOT NULL,
    max_participations integer DEFAULT 2 NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reparticipation_allowances_max_participations_check CHECK ((max_participations >= 1))
);

--
-- Name: TABLE reparticipation_allowances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reparticipation_allowances IS '같은 테마 1회 제한(D-02)의 사람 단위 예외. phone_hash + theme_id 당 허용 참여 횟수(기본 규칙은 1).';

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
    badge text,
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
-- Name: COLUMN sessions.badge; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.badge IS '회차 시각 옆에 붙는 짧은 표시(예: 인기). 비우면 안 나온다.';

--
-- Name: themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tagline text,
    description text,
    difficulty numeric(2,1) DEFAULT 3 NOT NULL,
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
    is_locked boolean DEFAULT false NOT NULL,
    genres text[] DEFAULT '{}'::text[] NOT NULL,
    intro_notice text,
    CONSTRAINT themes_capacity_confirm_line_check CHECK ((capacity_confirm_line > 0)),
    CONSTRAINT themes_capacity_max_check CHECK ((capacity_max > 0)),
    CONSTRAINT themes_capacity_min_check CHECK (((capacity_min IS NULL) OR (capacity_min > 0))),
    CONSTRAINT themes_capacity_order CHECK ((capacity_confirm_line <= capacity_max)),
    CONSTRAINT themes_difficulty_check CHECK (((difficulty >= (0)::numeric) AND (difficulty <= (5)::numeric) AND ((difficulty * (2)::numeric) = trunc((difficulty * (2)::numeric))))),
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

COMMENT ON COLUMN public.themes.difficulty IS '난이도 1~5, 0.5 단위. 0 은 미정 — 화면에서 감춘다.';

--
-- Name: COLUMN themes.duration_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.duration_minutes IS '소요시간(분). 0 은 미정 — 화면에서 감춘다.';

--
-- Name: COLUMN themes.min_age_floor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.min_age_floor IS '테마 자체의 최소 연령 하한. 종료 시각 규칙(22:00 이전 종료 만 16세 / 이후 만 19세)보다 높으면 이 값이 적용된다.';

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
-- Name: COLUMN themes.is_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.is_locked IS '잠금. 목록에는 나오지만 상세로 들어갈 수 없고(자물쇠) 검색엔진 색인에서도 빠진다. 신청 여부(is_active)와는 별개다.';

--
-- Name: COLUMN themes.intro_notice; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.themes.intro_notice IS '테마 소개(첫 화면) 시놉시스 아래 강조 안내. 비우면 안 나온다. **굵게** 표기 지원.';

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lat double precision,
    lng double precision,
    operating_period text,
    CONSTRAINT venues_lat_lng_pair CHECK ((((lat IS NULL) AND (lng IS NULL)) OR (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)) AND ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)))))
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
-- Name: COLUMN venues.lat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venues.lat IS '위도. 테마 상세 진행 장소 지도의 핀 위치 (lng 와 함께 입력)';

--
-- Name: COLUMN venues.lng; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venues.lng IS '경도. 테마 상세 진행 장소 지도의 핀 위치 (lat 와 함께 입력)';

--
-- Name: COLUMN venues.operating_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.venues.operating_period IS '이 장소에서의 운영기간 표기(예: 2026.09.26 ~ 2027.03.25). 테마 상세 진행 장소에 공개. 비우면 안 보인다. 네이버 스마트플레이스 팝업스토어 등록 요건(종료일 명시)';

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
    s.opens_at,
    s.badge
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
    s.opens_at,
    s.badge
   FROM (public.sessions s
     JOIN public.themes t ON ((t.id = s.theme_id)));

--
-- Name: settlement_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month text NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    totals jsonb NOT NULL,
    rows jsonb NOT NULL,
    deductions jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT settlement_snapshots_month_check CHECK ((month ~ '^\d{4}-\d{2}$'::text))
);

--
-- Name: TABLE settlement_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.settlement_snapshots IS '정산 내역 스냅샷. 보관 전용이며 정산 계산에는 쓰이지 않는다.';

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
-- Name: slack_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slack_templates (
    key text NOT NULL,
    label text NOT NULL,
    body text NOT NULL,
    placeholders text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: TABLE slack_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slack_templates IS '슬랙 알림 본문. 어드민 › 설정 › 슬랙 템플릿에서 고친다. 반복 블록({{#attendees}})을 지원한다.';

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);

--
-- Name: theme_public_venue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.theme_public_venue AS
 SELECT t.id AS theme_id,
    v.area_label,
    v.parking_note,
    v.map_url,
    v.name,
    v.address,
    v.lat,
    v.lng,
    v.operating_period
   FROM (public.themes t
     JOIN public.venues v ON ((v.id = t.venue_id)));

--
-- Name: VIEW theme_public_venue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.theme_public_venue IS '테마 상세에 노출해도 되는 장소 정보. 상호명·정확 주소·좌표·운영기간까지 공개(네이버 플레이스 등록 요건).';

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
-- Name: application_coupons application_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_coupons
    ADD CONSTRAINT application_coupons_pkey PRIMARY KEY (application_id, code);

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
-- Name: codename_submissions codename_submissions_phone_hash_round_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codename_submissions
    ADD CONSTRAINT codename_submissions_phone_hash_round_key UNIQUE (phone_hash, round);

--
-- Name: codename_submissions codename_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codename_submissions
    ADD CONSTRAINT codename_submissions_pkey PRIMARY KEY (id);

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
-- Name: group_booking_inquiries group_booking_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_booking_inquiries
    ADD CONSTRAINT group_booking_inquiries_pkey PRIMARY KEY (id);

--
-- Name: kakao_links kakao_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kakao_links
    ADD CONSTRAINT kakao_links_pkey PRIMARY KEY (kakao_id);

--
-- Name: marketing_sms_optouts marketing_sms_optouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_sms_optouts
    ADD CONSTRAINT marketing_sms_optouts_pkey PRIMARY KEY (phone_hash);

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
-- Name: popups popups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.popups
    ADD CONSTRAINT popups_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: promotion_price_tiers promotion_price_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_price_tiers
    ADD CONSTRAINT promotion_price_tiers_pkey PRIMARY KEY (promotion_id, theme_id, min_headcount);

--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);

--
-- Name: reparticipation_allowances reparticipation_allowances_phone_hash_theme_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reparticipation_allowances
    ADD CONSTRAINT reparticipation_allowances_phone_hash_theme_id_key UNIQUE (phone_hash, theme_id);

--
-- Name: reparticipation_allowances reparticipation_allowances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reparticipation_allowances
    ADD CONSTRAINT reparticipation_allowances_pkey PRIMARY KEY (id);

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
-- Name: settlement_snapshots settlement_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_snapshots
    ADD CONSTRAINT settlement_snapshots_pkey PRIMARY KEY (id);

--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);

--
-- Name: slack_templates slack_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slack_templates
    ADD CONSTRAINT slack_templates_pkey PRIMARY KEY (key);

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
-- Name: utm_links utm_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.utm_links
    ADD CONSTRAINT utm_links_pkey PRIMARY KEY (id);

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
-- Name: application_coupons_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_coupons_campaign_idx ON public.application_coupons USING btree (campaign_id);

--
-- Name: application_coupons_coupon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_coupons_coupon_idx ON public.application_coupons USING btree (coupon_id);

--
-- Name: applications_matching_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_matching_idx ON public.applications USING btree (amount_krw, depositor_name_hash) WHERE ((payment_status = 'pending'::text) AND (status <> 'cancelled'::text));

--
-- Name: applications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_user_idx ON public.applications USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: applications_utm_source_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_utm_source_created_idx ON public.applications USING btree (utm_source, created_at DESC) WHERE (utm_source IS NOT NULL);

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
-- Name: codename_submissions_phone_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX codename_submissions_phone_hash_idx ON public.codename_submissions USING btree (phone_hash);

--
-- Name: coupon_campaigns_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX coupon_campaigns_key_uidx ON public.coupon_campaigns USING btree (key) WHERE (key IS NOT NULL);

--
-- Name: coupons_campaign_handle_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX coupons_campaign_handle_uidx ON public.coupons USING btree (campaign_id, issued_to_handle) WHERE (issued_to_handle IS NOT NULL);

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
-- Name: group_booking_inquiries_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_booking_inquiries_created_at_idx ON public.group_booking_inquiries USING btree (created_at DESC);

--
-- Name: point_ledger_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_ledger_user_idx ON public.point_ledger USING btree (user_id, created_at DESC);

--
-- Name: popups_active_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX popups_active_sort_idx ON public.popups USING btree (is_active, sort, created_at);

--
-- Name: profiles_phone_digits_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_phone_digits_key ON public.profiles USING btree (phone_digits);

--
-- Name: promotions_single_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX promotions_single_active ON public.promotions USING btree ((1)) WHERE is_active;

--
-- Name: sessions_theme_opens_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_theme_opens_idx ON public.sessions USING btree (theme_id, opens_at);

--
-- Name: sessions_theme_starts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_theme_starts_idx ON public.sessions USING btree (theme_id, start_at);

--
-- Name: settlement_snapshots_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX settlement_snapshots_month_idx ON public.settlement_snapshots USING btree (month, captured_at DESC);

--
-- Name: themes_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX themes_category_idx ON public.themes USING btree (category_id);

--
-- Name: themes_listed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX themes_listed_idx ON public.themes USING btree (is_listed, sort_order) WHERE is_active;

--
-- Name: utm_links_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX utm_links_slug_key ON public.utm_links USING btree (slug) WHERE (slug IS NOT NULL);

--
-- Name: utm_links_status_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX utm_links_status_sort_idx ON public.utm_links USING btree (status, sort, created_at);

--
-- Name: application_attendees application_attendees_nickname_unique; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER application_attendees_nickname_unique BEFORE INSERT OR UPDATE OF nickname ON public.application_attendees FOR EACH ROW EXECUTE FUNCTION public.enforce_session_nickname_unique();

--
-- Name: applications applications_release_coupon_on_cancel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER applications_release_coupon_on_cancel AFTER UPDATE OF status ON public.applications FOR EACH ROW EXECUTE FUNCTION public.release_coupon_on_cancel();

--
-- Name: applications applications_set_cancelled_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER applications_set_cancelled_at BEFORE UPDATE OF status ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_cancelled_at();

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
-- Name: application_coupons application_coupons_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_coupons
    ADD CONSTRAINT application_coupons_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;

--
-- Name: application_coupons application_coupons_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_coupons
    ADD CONSTRAINT application_coupons_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.coupon_campaigns(id) ON DELETE SET NULL;

--
-- Name: application_coupons application_coupons_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_coupons
    ADD CONSTRAINT application_coupons_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE SET NULL;

--
-- Name: applications applications_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE SET NULL;

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
-- Name: promotion_price_tiers promotion_price_tiers_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_price_tiers
    ADD CONSTRAINT promotion_price_tiers_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;

--
-- Name: promotion_price_tiers promotion_price_tiers_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_price_tiers
    ADD CONSTRAINT promotion_price_tiers_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;

--
-- Name: reparticipation_allowances reparticipation_allowances_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reparticipation_allowances
    ADD CONSTRAINT reparticipation_allowances_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE CASCADE;

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
-- Name: _backup_application_attendees_20260913; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_application_attendees_20260913 ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_applications_20260913; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_applications_20260913 ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_theme_content_20260913b; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_theme_content_20260913b ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_theme_content_20260914; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_theme_content_20260914 ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_theme_content_20260915; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_theme_content_20260915 ENABLE ROW LEVEL SECURITY;

--
-- Name: _backup_theme_content_20260915b; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._backup_theme_content_20260915b ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: application_attendees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_attendees ENABLE ROW LEVEL SECURITY;

--
-- Name: application_coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_coupons ENABLE ROW LEVEL SECURITY;

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
-- Name: codename_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.codename_submissions ENABLE ROW LEVEL SECURITY;

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
-- Name: group_booking_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_booking_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: kakao_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kakao_links ENABLE ROW LEVEL SECURITY;

--
-- Name: kakao_links kakao_links_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kakao_links_select_own ON public.kakao_links FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: marketing_sms_optouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_sms_optouts ENABLE ROW LEVEL SECURITY;

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
-- Name: popups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.popups ENABLE ROW LEVEL SECURITY;

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
-- Name: promotion_price_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_price_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: reparticipation_allowances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reparticipation_allowances ENABLE ROW LEVEL SECURITY;

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
-- Name: settlement_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settlement_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: slack_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slack_templates ENABLE ROW LEVEL SECURITY;

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
-- Name: utm_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;

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
-- Name: TABLE promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotions TO service_role;

--
-- Name: FUNCTION active_promotion(p_start_at timestamp with time zone, p_now timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.active_promotion(p_start_at timestamp with time zone, p_now timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.active_promotion(p_start_at timestamp with time zone, p_now timestamp with time zone) TO service_role;

--
-- Name: FUNCTION add_marketing_optout(p_phone text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_marketing_optout(p_phone text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_marketing_optout(p_phone text, p_note text) TO service_role;

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
-- Name: FUNCTION assign_coupon_to_handle(p_campaign_key text, p_handle text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_coupon_to_handle(p_campaign_key text, p_handle text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_coupon_to_handle(p_campaign_key text, p_handle text) TO service_role;

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
-- Name: FUNCTION codename_exists(p_phone text, p_round smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.codename_exists(p_phone text, p_round smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.codename_exists(p_phone text, p_round smallint) TO service_role;

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
-- Name: FUNCTION is_theme_participation_blocked(p_phone text, p_theme_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid) FROM PUBLIC;

--
-- Name: FUNCTION is_theme_participation_blocked(p_phone text, p_theme_id uuid, p_exclude_application_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_theme_participation_blocked(p_phone text, p_theme_id uuid, p_exclude_application_id uuid) FROM PUBLIC;

--
-- Name: FUNCTION list_marketing_optouts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_marketing_optouts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_marketing_optouts() TO service_role;

--
-- Name: FUNCTION lookup_application(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;

--
-- Name: FUNCTION lookup_application_v2(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application_v2(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;

--
-- Name: FUNCTION lookup_application_v3(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_application_v3(p_phone_digits text, p_confirmation_code text) TO service_role;

--
-- Name: FUNCTION lookup_application_v4(p_phone_digits text, p_confirmation_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) TO anon;
GRANT ALL ON FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) TO authenticated;
GRANT ALL ON FUNCTION public.lookup_application_v4(p_phone_digits text, p_confirmation_code text) TO service_role;

--
-- Name: FUNCTION lookup_attendee_by_phone_hash(p_phone_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lookup_attendee_by_phone_hash(p_phone_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lookup_attendee_by_phone_hash(p_phone_hash text) TO service_role;

--
-- Name: FUNCTION mark_attendee_reminder_sent(p_attendee_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_attendee_reminder_sent(p_attendee_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_attendee_reminder_sent(p_attendee_ids uuid[]) TO service_role;

--
-- Name: FUNCTION marketing_sms_recipients(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.marketing_sms_recipients() FROM PUBLIC;
GRANT ALL ON FUNCTION public.marketing_sms_recipients() TO service_role;

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
-- Name: FUNCTION promotion_unit_price(p_promotion_id uuid, p_theme_id uuid, p_headcount integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.promotion_unit_price(p_promotion_id uuid, p_theme_id uuid, p_headcount integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.promotion_unit_price(p_promotion_id uuid, p_theme_id uuid, p_headcount integer) TO service_role;

--
-- Name: FUNCTION release_coupon_on_cancel(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_coupon_on_cancel() FROM PUBLIC;

--
-- Name: FUNCTION remove_marketing_optout(p_phone_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_marketing_optout(p_phone_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_marketing_optout(p_phone_hash text) TO service_role;

--
-- Name: FUNCTION resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_promotion_price(p_theme_id uuid, p_start_at timestamp with time zone, p_headcount integer, p_now timestamp with time zone) TO service_role;

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

--
-- Name: FUNCTION submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid) FROM PUBLIC;

--
-- Name: FUNCTION submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_code text) FROM PUBLIC;

--
-- Name: FUNCTION submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_codes text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_codes text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_codes text[]) TO anon;
GRANT ALL ON FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_codes text[]) TO authenticated;
GRANT ALL ON FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text, p_consent_photo boolean, p_consent_marketing boolean, p_user_id uuid, p_coupon_codes text[]) TO service_role;

--
-- Name: FUNCTION submit_codename(p_round smallint, p_nickname text, p_codename text, p_phone text, p_consent boolean, p_is_correct boolean, p_replace boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_codename(p_round smallint, p_nickname text, p_codename text, p_phone text, p_consent boolean, p_is_correct boolean, p_replace boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_codename(p_round smallint, p_nickname text, p_codename text, p_phone text, p_consent boolean, p_is_correct boolean, p_replace boolean) TO service_role;

--
-- Name: FUNCTION submit_group_booking_inquiry(p_headcount integer, p_contact_method text, p_contact text, p_preferred_date date, p_preferred_time text, p_group_kind text, p_note text, p_attribution jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_group_booking_inquiry(p_headcount integer, p_contact_method text, p_contact text, p_preferred_date date, p_preferred_time text, p_group_kind text, p_note text, p_attribution jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_group_booking_inquiry(p_headcount integer, p_contact_method text, p_contact text, p_preferred_date date, p_preferred_time text, p_group_kind text, p_note text, p_attribution jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_group_booking_inquiry(p_headcount integer, p_contact_method text, p_contact text, p_preferred_date date, p_preferred_time text, p_group_kind text, p_note text, p_attribution jsonb) TO authenticated;

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
-- Name: TABLE _backup_application_attendees_20260913; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_application_attendees_20260913 TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_application_attendees_20260913 TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_application_attendees_20260913 TO service_role;

--
-- Name: TABLE _backup_applications_20260913; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260913 TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260913 TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_applications_20260913 TO service_role;

--
-- Name: TABLE _backup_theme_content_20260913b; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260913b TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260913b TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260913b TO service_role;

--
-- Name: TABLE _backup_theme_content_20260914; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260914 TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260914 TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260914 TO service_role;

--
-- Name: TABLE _backup_theme_content_20260915; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915 TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915 TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915 TO service_role;

--
-- Name: TABLE _backup_theme_content_20260915b; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915b TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915b TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public._backup_theme_content_20260915b TO service_role;

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
-- Name: TABLE group_booking_inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_booking_inquiries TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_booking_inquiries TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.group_booking_inquiries TO service_role;

--
-- Name: TABLE admin_group_booking_inquiries_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_group_booking_inquiries_view TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_group_booking_inquiries_view TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.admin_group_booking_inquiries_view TO service_role;

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
-- Name: TABLE application_coupons; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.application_coupons TO service_role;

--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO authenticated;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO service_role;

--
-- Name: SEQUENCE audit_logs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.audit_logs_id_seq TO service_role;

--
-- Name: TABLE bank_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_transactions TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bank_transactions TO authenticated;
GRANT ALL ON TABLE public.bank_transactions TO service_role;

--
-- Name: TABLE codename_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.codename_submissions TO service_role;

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
-- Name: TABLE marketing_sms_optouts; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.marketing_sms_optouts TO service_role;

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
-- Name: TABLE popups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.popups TO service_role;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;

--
-- Name: TABLE promotion_price_tiers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotion_price_tiers TO service_role;

--
-- Name: TABLE public_event_bubble; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_event_bubble TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_event_bubble TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_event_bubble TO service_role;

--
-- Name: TABLE public_popup; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_popup TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_popup TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_popup TO service_role;

--
-- Name: TABLE public_promotion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion TO service_role;

--
-- Name: TABLE public_promotion_price_tier; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion_price_tier TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion_price_tier TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_promotion_price_tier TO service_role;

--
-- Name: TABLE utm_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.utm_links TO service_role;

--
-- Name: TABLE public_short_link; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_short_link TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_short_link TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.public_short_link TO service_role;

--
-- Name: TABLE reparticipation_allowances; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reparticipation_allowances TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reparticipation_allowances TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reparticipation_allowances TO service_role;

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
-- Name: TABLE settlement_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.settlement_snapshots TO service_role;

--
-- Name: TABLE site_settings; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.site_settings TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;

--
-- Name: TABLE slack_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.slack_templates TO service_role;

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

