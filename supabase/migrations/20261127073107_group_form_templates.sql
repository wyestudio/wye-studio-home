-- 단체 설문 양식의 버전(관리자 개편 7단계, 2026-11-27 대표님) — 「단체 도구 › 설문 양식」 에서 고친 양식을 둔다.
--
-- 무엇이 생기나
--   group_form_templates          양식 3벌(leader / participant / review)의 버전. 고칠 때마다 한 줄이 늘어난다(지우지 않는다)
--   submit_group_participant_v2   참가자 설문 제출 — 양식에 더한 질문의 답(answers)까지 받는다
--
-- 규칙
--   · **버전 1 은 코드에 있는 기본 양식**이다(이 표에 줄이 없다). 운영자가 처음 고치면 버전 2 가 생긴다.
--     가장 큰 버전이 지금 쓰는 양식이다. 예전 버전으로 되돌리면 그 내용으로 새 버전이 하나 더 생긴다.
--   · 받은 답에는 그때의 버전 번호가 같이 저장돼 있다(template_version) — 양식을 고쳐도 예전 답은 그때의 양식으로 읽는다.
--   · 양식의 모양 · 잠긴 질문 규칙은 서버 코드(groupForms/template.ts)가 저장 전에 검사한다. 여기서는 크기와 모양만 막는다.
--
-- 보안: RLS 를 켜고 정책을 두지 않는다. 어드민 서버(service_role)만 읽고 넣는다. 고치거나 지우는 권한은 주지 않는다.
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. group_forms 마이그레이션이 먼저 있어야 한다.
--
-- 되돌리기:
--   drop function if exists public.submit_group_participant_v2(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, jsonb, integer, text);
--   drop table if exists public.group_form_templates;

create table if not exists public.group_form_templates (
  form_key text not null check (form_key in ('leader', 'participant', 'review')),
  version integer not null check (version between 2 and 100000),
  schema jsonb not null check (jsonb_typeof(schema) = 'object' and octet_length(schema::text) <= 120000),
  -- 무엇을 고쳤는지 한 줄(되돌리기 등). 운영자가 적지 않아도 된다.
  note text check (note is null or char_length(note) <= 200),
  created_by text not null default '어드민' check (char_length(created_by) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (form_key, version)
);
comment on table public.group_form_templates is
  '단체 설문 양식의 버전. 버전 1 은 코드의 기본 양식(줄 없음). 가장 큰 버전이 지금 쓰는 양식이다.';

alter table public.group_form_templates enable row level security;
revoke all on public.group_form_templates from anon, authenticated;
grant select, insert on public.group_form_templates to service_role;

-- 참가자 설문 제출(v2) — 이름 · 전화번호 · 닉네임 · 나이대 · 방수 · 약관은 예전 함수가 그대로 검증 · 암호화 · 저장하고,
-- 양식에 더한 질문의 답만 answers 칸에 덧붙인다. 답의 열쇠 · 선택지 · 글자 수는 서버 액션이 양식과 대조해 거른 뒤 넘긴다.
create or replace function public.submit_group_participant_v2(
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
  p_answers jsonb,
  p_template_version integer,
  p_ip_hash text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result text;
  v_inquiry uuid;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
begin
  if jsonb_typeof(v_answers) <> 'object' or octet_length(v_answers::text) > 8000 then
    raise exception '답변을 확인해주세요.';
  end if;
  v_result := public.submit_group_participant(
    p_token, p_name, p_phone, p_nickname, p_age_band, p_room_count,
    p_consent_terms, p_consent_privacy, p_consent_phone_box, p_consent_photo, p_template_version, p_ip_hash
  );
  select inquiry_id into v_inquiry from public.group_form_links
   where token = p_token and form_key = 'participant' and revoked_at is null;
  update public.group_participants
     set answers = v_answers
   where inquiry_id = v_inquiry
     and phone_hash = public.hash_phone(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'));
  return v_result;
end;
$$;

revoke all on function public.submit_group_participant_v2(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.submit_group_participant_v2(text, text, text, text, text, integer, boolean, boolean, boolean, boolean, jsonb, integer, text) to service_role;
