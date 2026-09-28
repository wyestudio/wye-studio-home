-- 어드민 신청 정보 수정에도 같은 규칙 적용 (2026-09-28)
--
-- admin_update_application() 은 검증이 하나도 없었다. 전화번호를 **이미 이 테마에
-- 참여한 번호로 바꿔도** 그대로 저장됐고, 출생연도도 아무 값이나 들어갔다.
-- 수동 등록(submit_application_v3)과 같은 규칙을 적용한다.
--
-- 수정은 신규 신청과 판정 기준이 하나 다르다: **지금 고치고 있는 신청 자신은
-- 참여 횟수에서 빼야 한다.** 빼지 않으면 그 사람의 기존 행이 스스로를 막아서
-- 전화번호를 안 바꾸는 단순 수정(이름 오타 등)까지 전부 거부된다.
-- 그래서 제외할 신청을 받는 3인자 판정을 추가하고, 기존 2인자는 여기에 위임한다
-- ← 규칙이 두 벌이 되면 반드시 갈라진다.

create or replace function public.is_theme_participation_blocked(
  p_phone text,
  p_theme_id uuid,
  p_exclude_application_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
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

comment on function public.is_theme_participation_blocked(text, uuid, uuid) is
  '재참여 차단 판정. p_exclude_application_id 에 준 신청은 참여 횟수에서 뺀다(수정 화면용).';

revoke all on function public.is_theme_participation_blocked(text, uuid, uuid) from public;

-- 기존 2인자는 껍데기로 남기고 판정을 3인자에 위임한다.
-- submit_application_v3 · check_active_applications_v2 는 그대로 2인자를 부른다.
create or replace function public.is_theme_participation_blocked(
  p_phone text,
  p_theme_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select is_theme_participation_blocked(p_phone, p_theme_id, null::uuid);
$$;


-- ── 어드민 신청 정보 수정 ────────────────────────────────────────
--
-- ⚠️ 운영 정의(md5 347c5f8dc734139dc323e97f6af92a97)에 **검증만 앞에 덧붙였다.**
--    update 두 개는 글자 그대로 같다.
create or replace function public.admin_update_application(
  p_application_id uuid,
  p_depositor_name text,
  p_notes text,
  p_attendees jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
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

  -- 연령 — 회차의 min_age 기준(신규 신청과 같다). 옛 회차는 min_age 가 null 이라
  -- is_eligible_birth_year() 가 null 을 돌려주고, 그때는 검사하지 않는다.
  if exists (select 1 from jsonb_array_elements(p_attendees) a
             where not is_eligible_birth_year((a->>'birth_year')::int, v_min_age)) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_min_age;
  end if;

  -- 이번에 넣은 참여자들끼리 번호가 겹치는지
  select string_agg(distinct phone, ',') into v_self_dup from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
      from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.' using detail = v_self_dup;
  end if;

  -- 재참여 차단. 고치고 있는 신청 자신은 빼고 센다.
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
$function$;
