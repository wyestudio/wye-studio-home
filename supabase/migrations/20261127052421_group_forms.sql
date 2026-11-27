-- 단체 예약 공개 폼(관리자 개편 5단계, 2026-11-27 대표님) — 폼 링크 · 참가자 사전 설문 · 모임 후기 설문.
-- 모임장 신청서 표는 그 폼을 만드는 다음 묶음에 따로 더한다.
--
-- 무엇이 생기나
--   group_form_links       단체마다 폼 링크 3개(leader / participant / review). 주소의 코드는 추측할 수 없는 무작위 값
--   group_participants     참가자 사전 설문 답. 이름 · 전화번호는 암호화, 같은 전화번호는 새 답이 아니라 수정
--   group_reviews          모임 후기 설문 답(익명 — 이름 · 연락처 칸이 없다)
--   group_form_attempts    제출 시도 기록(링크 · IP 해시) — 횟수 제한에만 쓰고 하루 지나면 지운다
--   admin_group_participants_view   어드민 서버 전용. 이름 · 전화번호를 복호화해 보여준다
--   함수(전부 서버 전용 — service_role 만 부른다. 공개 키로는 부를 수 없다)
--     admin_ensure_group_form_links   단체의 링크 3개를 만든다(이미 있으면 그대로)
--     admin_reissue_group_form_link   링크 다시 발급(이전 링크는 무효)
--     submit_group_participant        참가자 답 저장(검증 · 횟수 제한 · 같은 번호면 덮어쓰기)
--     submit_group_review             후기 답 저장(검증 · 횟수 제한)
--
-- 보안
--   · 새 표는 RLS 를 켜고 정책을 두지 않는다 = anon · authenticated 는 닿지 못한다.
--   · 공개 폼 화면은 Next 서버가 서비스 키로 읽고 쓴다. 브라우저에는 가린 이름과 닉네임만 내려간다.
--   · 이름 · 전화번호는 encrypt_pii() 로만 넣고 중복 판정은 hash_phone() 값으로 한다(기존 신청과 같은 방식).
--   · 화면 · 서버 액션에서 거른 규칙을 여기서 한 번 더 막는다(길이 · 범위 · 필수 동의).
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다.
--
-- 되돌리기:
--   drop function if exists public.submit_group_review(text, integer, jsonb, integer, text);
--   drop function if exists public.submit_group_participant(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, integer, text);
--   drop function if exists public.admin_reissue_group_form_link(uuid, text);
--   drop function if exists public.admin_ensure_group_form_links(uuid);
--   drop function if exists public.group_form_guard(text, text, text);
--   drop function if exists public.group_nickname_width(text);
--   drop view if exists public.admin_group_participants_view;
--   drop table if exists public.group_form_attempts, public.group_reviews, public.group_participants, public.group_form_links;

-- ── 1. 폼 링크 ──────────────────────────────────────────────────────
create table if not exists public.group_form_links (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  form_key text not null check (form_key in ('leader', 'participant', 'review')),
  -- 주소(/f/<token>)에 들어가는 값. 무작위 16바이트(128비트)를 URL 에 쓸 수 있는 글자 22자로 적는다.
  -- 순번 · 단체 id · 날짜가 들어가지 않는다 — 주소가 곧 열쇠다.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{22,64}$'),
  -- 다시 발급하면 이전 링크에 시각을 찍어 무효로 만든다(지우지 않는다 — 언제 바뀌었는지 남긴다).
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
-- 살아 있는 링크는 단체 · 폼마다 하나.
create unique index if not exists group_form_links_live_idx
  on public.group_form_links (inquiry_id, form_key) where revoked_at is null;
comment on table public.group_form_links is
  '단체별 공개 폼 링크. token 을 아는 사람만 그 단체의 그 폼 하나를 연다. 어드민 서버만 읽는다.';

-- ── 2. 참가자 사전 설문 ─────────────────────────────────────────────
create table if not exists public.group_participants (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  name_enc bytea not null,
  phone_enc bytea not null,
  phone_hash text not null,
  -- 명찰에 들어가는 값이라 기호를 막지 않는다. 길이는 '폭 12' 규칙(함수가 본다) + 여기서는 넉넉한 상한.
  nickname text not null check (char_length(nickname) between 1 and 12),
  age_band text not null check (char_length(age_band) between 1 and 20),
  -- 방탈출 횟수(방수). 명찰 색을 정한다.
  room_count integer not null check (room_count between 0 and 9999),
  consent_terms boolean not null,
  consent_privacy boolean not null,
  consent_phone_box boolean not null,
  consent_photo boolean not null default false,
  -- 양식을 고쳐 문항이 늘었을 때의 답(지금은 비어 있다). 크기를 막는다.
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 8000),
  template_version integer not null default 1 check (template_version between 1 and 100000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 같은 전화번호로 다시 내서 고친 답인가.
  edited boolean not null default false,
  constraint group_participants_required_consents check (consent_terms and consent_privacy and consent_phone_box),
  -- 한 단체 안에서 전화번호는 한 번만(같은 번호면 새 답이 아니라 수정).
  constraint group_participants_phone_once unique (inquiry_id, phone_hash)
);
-- 한 단체 안에서 닉네임이 겹치면 안 된다(대소문자 구분 없이).
create unique index if not exists group_participants_nickname_idx
  on public.group_participants (inquiry_id, lower(nickname));
comment on table public.group_participants is
  '단체 참가자 사전 설문. 이름 · 전화번호는 암호화. 다른 참가자에게는 가린 이름과 닉네임만 보인다.';

-- ── 3. 모임 후기 설문(익명) ─────────────────────────────────────────
create table if not exists public.group_reviews (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  -- 나머지 답(연령대 · 재밌었던 순간 · 추천 여부 · 이유 · 개선할 점). 아는 칸은 길이를 막는다.
  answers jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(answers) = 'object'
      and octet_length(answers::text) <= 8000
      and char_length(coalesce(answers->>'age', '')) <= 20
      and char_length(coalesce(answers->>'rec', '')) <= 20
      and char_length(coalesce(answers->>'fun', '')) <= 500
      and char_length(coalesce(answers->>'why', '')) <= 500
      and char_length(coalesce(answers->>'more', '')) <= 500
    ),
  template_version integer not null default 1 check (template_version between 1 and 100000),
  submitted_at timestamptz not null default now()
);
create index if not exists group_reviews_inquiry_idx on public.group_reviews (inquiry_id, submitted_at desc);
comment on table public.group_reviews is '단체 모임 후기 설문(익명). 이름 · 연락처를 받지 않는다.';

-- ── 4. 제출 시도 기록(횟수 제한용) ──────────────────────────────────
create table if not exists public.group_form_attempts (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.group_form_links(id) on delete cascade,
  -- IP 를 그대로 두지 않는다. 서버가 해시해서 넘긴다.
  ip_hash text not null check (char_length(ip_hash) between 8 and 128),
  created_at timestamptz not null default now()
);
create index if not exists group_form_attempts_link_idx on public.group_form_attempts (link_id, created_at desc);

alter table public.group_form_links enable row level security;
alter table public.group_participants enable row level security;
alter table public.group_reviews enable row level security;
alter table public.group_form_attempts enable row level security;

revoke all on public.group_form_links, public.group_participants, public.group_reviews, public.group_form_attempts
  from anon, authenticated;
grant select on public.group_form_links to service_role;
-- 참가자: 읽기와 삭제(보관 기간이 지난 개인정보 정리)만. 넣고 고치는 것은 함수가 한다(암호화).
grant select, delete on public.group_participants to service_role;
grant select on public.group_reviews to service_role;

-- 어드민 서버 전용 조회 뷰 — 이름 · 전화번호를 복호화한다(decrypt_pii 는 service_role 에만 열려 있다).
-- 공개 폼에 내려보낼 때는 서버가 이 값을 **가려서**(이*지) 닉네임과 함께만 보낸다.
create or replace view public.admin_group_participants_view as
select
  id,
  inquiry_id,
  public.decrypt_pii(name_enc) as name,
  public.decrypt_pii(phone_enc) as phone,
  nickname,
  age_band,
  room_count,
  consent_photo,
  answers,
  template_version,
  submitted_at,
  updated_at,
  edited
from public.group_participants;
revoke all on public.admin_group_participants_view from anon, authenticated;
grant select on public.admin_group_participants_view to service_role;

-- ── 5. 함수 ─────────────────────────────────────────────────────────

-- 닉네임 폭 — 아스키 글자(영문 · 숫자 · 기본 기호 · 띄어쓰기)는 1, 그 밖(한글 등)은 1.5. 합이 12 이하여야 한다
-- (한글 8자 = 영어 12자). 화면 · 서버 액션의 nicknameWidth() 와 같은 셈이다.
create or replace function public.group_nickname_width(p_nickname text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select coalesce(sum(case when ascii(ch) <= 127 then 1 else 1.5 end), 0)
    from regexp_split_to_table(coalesce(p_nickname, ''), '') as ch
   where ch <> '';
$$;

-- 단체의 폼 링크 3개를 만든다. 이미 살아 있는 링크는 그대로 둔다.
create or replace function public.admin_ensure_group_form_links(p_inquiry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text;
begin
  if not exists (select 1 from public.group_booking_inquiries where id = p_inquiry_id) then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  foreach k in array array['leader', 'participant', 'review'] loop
    if not exists (
      select 1 from public.group_form_links where inquiry_id = p_inquiry_id and form_key = k and revoked_at is null
    ) then
      insert into public.group_form_links (inquiry_id, form_key, token)
      values (p_inquiry_id, k, translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_'));
    end if;
  end loop;
end;
$$;

-- 링크 다시 발급 — 이전 링크는 그 자리에서 무효가 된다. 새 토큰을 돌려준다.
create or replace function public.admin_reissue_group_form_link(p_inquiry_id uuid, p_form_key text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := translate(rtrim(encode(gen_random_bytes(16), 'base64'), '='), '+/', '-_');
begin
  if p_form_key is null or p_form_key not in ('leader', 'participant', 'review') then
    raise exception '알 수 없는 폼입니다.';
  end if;
  if not exists (select 1 from public.group_booking_inquiries where id = p_inquiry_id) then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  update public.group_form_links set revoked_at = now()
   where inquiry_id = p_inquiry_id and form_key = p_form_key and revoked_at is null;
  insert into public.group_form_links (inquiry_id, form_key, token) values (p_inquiry_id, p_form_key, v_token);
  return v_token;
end;
$$;

-- 제출 전 공통 관문 — 링크가 살아 있고 그 폼이 맞는지, 단체가 취소되지 않았는지, 너무 자주 내지 않는지 본다.
-- 통과하면 시도 한 줄을 남기고 링크의 단체 id 를 돌려준다. 아니면 예외.
-- 횟수 제한: 같은 링크 · 같은 IP 로 10분에 10번, 같은 링크로 10분에 60번까지.
create or replace function public.group_form_guard(p_token text, p_form_key text, p_ip_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.group_form_links%rowtype;
  v_cancelled timestamptz;
  v_ip text := coalesce(nullif(trim(coalesce(p_ip_hash, '')), ''), 'unknown-ip');
begin
  select * into v_link from public.group_form_links
   where token = p_token and form_key = p_form_key and revoked_at is null;
  if not found then
    raise exception '링크가 만료되었거나 올바르지 않습니다.';
  end if;
  select cancelled_at into v_cancelled from public.group_booking_inquiries where id = v_link.inquiry_id;
  if v_cancelled is not null then
    raise exception '취소된 모임이라 더 받을 수 없습니다.';
  end if;

  -- 하루 지난 시도 기록은 여기서 지운다(따로 청소 작업을 돌리지 않는다).
  delete from public.group_form_attempts where created_at < now() - interval '1 day';

  if (select count(*) from public.group_form_attempts
       where link_id = v_link.id and ip_hash = v_ip and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.group_form_attempts
          where link_id = v_link.id and created_at > now() - interval '10 minutes') >= 60 then
    raise exception '잠시 후 다시 시도해주세요.';
  end if;
  insert into public.group_form_attempts (link_id, ip_hash) values (v_link.id, v_ip);

  return v_link.inquiry_id;
end;
$$;

-- 참가자 사전 설문 제출. 같은 단체에 같은 전화번호가 이미 있으면 **조용히 덮어쓴다**(수정됨 표시).
-- 돌려주는 값은 서버만 본다 — 화면에는 새로 낸 것인지 고친 것인지 알려주지 않는다(남의 번호로 확인 못 하게).
-- 정원을 넘어도 받는다. 다만 한 단체에 확정 인원의 3배(최소 30 · 최대 200)를 넘으면 막는다.
create or replace function public.submit_group_participant(
  p_token text,
  p_name text,
  p_phone text,
  p_nickname text,
  p_age_band text,
  p_room_count integer,
  p_consent_terms boolean,
  p_consent_privacy boolean,
  p_consent_phone_box boolean,
  p_consent_photo boolean,
  p_template_version integer,
  p_ip_hash text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inquiry uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_nick text := trim(coalesce(p_nickname, ''));
  v_age text := trim(coalesce(p_age_band, ''));
  v_hash text;
  v_existing uuid;
  v_headcount integer;
  v_cap integer;
begin
  v_inquiry := public.group_form_guard(p_token, 'participant', p_ip_hash);

  if char_length(v_name) < 2 or char_length(v_name) > 20 or v_name ~ '[0-9[:cntrl:]]' then
    raise exception '이름은 한글이나 영문으로 입력해주세요.';
  end if;
  if v_phone !~ '^010\d{8}$' then
    raise exception '010으로 시작하는 11자리 번호를 입력해주세요.';
  end if;
  if char_length(v_nick) < 1 or v_nick ~ '[[:cntrl:]]' or public.group_nickname_width(v_nick) > 12 then
    raise exception '조금 길어요. 한글 8자 · 영어 12자까지 쓸 수 있어요.';
  end if;
  if char_length(v_age) < 1 or char_length(v_age) > 20 then
    raise exception '나이대를 골라주세요.';
  end if;
  if p_room_count is null or p_room_count < 0 or p_room_count > 9999 then
    raise exception '0~9999 사이로 입력해주세요.';
  end if;
  if not (coalesce(p_consent_terms, false) and coalesce(p_consent_privacy, false) and coalesce(p_consent_phone_box, false)) then
    raise exception '필수 항목에 동의가 필요해요.';
  end if;

  v_hash := public.hash_phone(v_phone);
  select id into v_existing from public.group_participants where inquiry_id = v_inquiry and phone_hash = v_hash;

  -- 닉네임은 그 단체 안에서 하나뿐이어야 한다(본인의 기존 답은 빼고 본다).
  if exists (
    select 1 from public.group_participants
     where inquiry_id = v_inquiry and lower(nickname) = lower(v_nick) and id is distinct from v_existing
  ) then
    raise exception '이미 다른 분이 쓰는 닉네임이에요.';
  end if;

  if v_existing is not null then
    update public.group_participants
       set name_enc = public.encrypt_pii(v_name),
           phone_enc = public.encrypt_pii(v_phone),
           nickname = v_nick,
           age_band = v_age,
           room_count = p_room_count,
           consent_terms = true,
           consent_privacy = true,
           consent_phone_box = true,
           consent_photo = coalesce(p_consent_photo, false),
           template_version = coalesce(p_template_version, 1),
           updated_at = now(),
           edited = true
     where id = v_existing;
    return 'updated';
  end if;

  select headcount into v_headcount from public.group_booking_inquiries where id = v_inquiry;
  v_cap := least(200, greatest(30, coalesce(v_headcount, 0) * 3));
  if (select count(*) from public.group_participants where inquiry_id = v_inquiry) >= v_cap then
    raise exception '제출이 너무 많아 잠시 닫았어요. 모임장에게 알려주세요.';
  end if;

  insert into public.group_participants (
    inquiry_id, name_enc, phone_enc, phone_hash, nickname, age_band, room_count,
    consent_terms, consent_privacy, consent_phone_box, consent_photo, template_version
  ) values (
    v_inquiry, public.encrypt_pii(v_name), public.encrypt_pii(v_phone), v_hash, v_nick, v_age, p_room_count,
    true, true, true, coalesce(p_consent_photo, false), coalesce(p_template_version, 1)
  );
  return 'created';
end;
$$;

-- 모임 후기 설문 제출(익명). 답의 열쇠 · 선택지는 서버 액션이 양식과 대조해 거른 뒤 넘긴다.
create or replace function public.submit_group_review(
  p_token text,
  p_rating integer,
  p_answers jsonb,
  p_template_version integer,
  p_ip_hash text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inquiry uuid;
  v_headcount integer;
begin
  v_inquiry := public.group_form_guard(p_token, 'review', p_ip_hash);
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception '별점을 골라주세요.';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception '답변을 확인해주세요.';
  end if;
  select headcount into v_headcount from public.group_booking_inquiries where id = v_inquiry;
  if (select count(*) from public.group_reviews where inquiry_id = v_inquiry)
       >= least(200, greatest(30, coalesce(v_headcount, 0) * 3)) then
    raise exception '제출이 너무 많아 잠시 닫았어요.';
  end if;
  insert into public.group_reviews (inquiry_id, rating, answers, template_version)
  values (v_inquiry, p_rating, p_answers, coalesce(p_template_version, 1));
end;
$$;

-- Postgres 는 새 함수를 기본으로 모두에게(PUBLIC) 열어 둔다. 전부 닫고 서버(service_role)에만 준다.
revoke all on function public.group_nickname_width(text) from public, anon, authenticated;
revoke all on function public.admin_ensure_group_form_links(uuid) from public, anon, authenticated;
revoke all on function public.admin_reissue_group_form_link(uuid, text) from public, anon, authenticated;
revoke all on function public.group_form_guard(text, text, text) from public, anon, authenticated;
revoke all on function public.submit_group_participant(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.submit_group_review(text, integer, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.group_nickname_width(text) to service_role;
grant execute on function public.admin_ensure_group_form_links(uuid) to service_role;
grant execute on function public.admin_reissue_group_form_link(uuid, text) to service_role;
grant execute on function public.submit_group_participant(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, integer, text) to service_role;
grant execute on function public.submit_group_review(text, integer, jsonb, integer, text) to service_role;
