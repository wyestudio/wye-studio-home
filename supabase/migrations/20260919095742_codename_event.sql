-- 코드네임 맞히기 이벤트(/codename) 응모 기록
--
-- 적용: test (2026-09-19 적용·이력 기록) / 운영 (2026-09-19 적용)
-- ⚠️ 운영에는 이 파일과 다른 버전으로 기록돼 있다 —
--    test = 20260919095742 / 운영 = 20260919141116 (둘 다 name 은 codename_event).
--    내용은 같고 전부 if not exists · or replace 라 다시 밀어도 덮어쓰기만 된다.
-- 되돌리기:
--   drop function if exists public.submit_codename(smallint, text, text, text, boolean, boolean, boolean);
--   drop function if exists public.codename_exists(text, smallint);
--   drop table if exists public.codename_submissions;
--
-- 외부 게시물(오방카페 등)에 낸 문제의 정답을 받는 페이지가 쓴다.
-- 화면은 src/app/codename/, 호출은 src/app/codename/actions.ts.
--
-- ⚠️ 연락처는 신청 테이블과 같은 방식으로 다룬다 — 복호화 가능한 phone_enc 와
--    매칭용 HMAC 인 phone_hash 두 벌. 평문 컬럼을 만들지 않는다.
-- ⚠️ 정답 판정은 앱(서버 액션)에서 하고 결과만 p_is_correct 로 받는다.
--    정답 문자열을 DB 에 넣어두면 DB 를 보는 사람 전원에게 답이 새고,
--    문제를 바꿀 때마다 마이그레이션이 필요해진다.
-- ⚠️ 중복 판정 기준은 **연락처(phone_hash)** 다. 닉네임은 보지 않는다 —
--    닉네임 오타로 같은 사람이 두 번 응모되는 걸 막기 위해서다.
-- ⚠️ 회차마다 한 줄이다. unique (phone_hash, round) 로 DB 가 보장한다.
--    "1차 응모 여부" = round = 1 인 줄이 있는가.

create table if not exists public.codename_submissions (
  id                    uuid primary key default gen_random_uuid(),

  -- 1차 / 2차 (2차는 추후 진행 예정)
  round                 smallint not null default 1 check (round in (1, 2)),

  nickname              text not null check (char_length(nickname) between 1 and 30),
  -- 제출한 코드네임. 저장은 항상 대문자 영문.
  codename              text not null check (codename ~ '^[A-Z]{1,32}$'),

  phone_enc             bytea not null,
  phone_hash            text not null,

  -- 개인정보 수집·이용 동의 여부
  consent_personal_info boolean not null default false,

  -- 재참여 여부: 같은 연락처로 이전에 제출한 적이 있는가
  -- (같은 회차를 고쳐 쓴 경우 · 이전 회차에 응모했던 경우 모두 true)
  is_rejoin             boolean not null default false,

  -- 정답 처리 여부. 정답 문자열이 설정돼 있지 않으면 null(미채점)로 남는다.
  is_correct            boolean,

  -- 2인 무료 초청권 당첨자 여부. 추첨 뒤 사람이 채운다.
  is_free_pair_winner   boolean not null default false,

  submitted_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (phone_hash, round)
);

comment on table public.codename_submissions is
  '코드네임 맞히기 이벤트(/codename) 응모 기록. 연락처+회차당 한 줄.';
comment on column public.codename_submissions.is_rejoin is
  '같은 연락처로 이전에 제출한 이력이 있으면 true(답안 교체 · 다음 회차 재응모).';
comment on column public.codename_submissions.is_correct is
  '서버 자동 채점 결과. 정답 문자열 미설정 시 null.';

create index if not exists codename_submissions_phone_hash_idx
  on public.codename_submissions (phone_hash);

alter table public.codename_submissions enable row level security;
revoke all on public.codename_submissions from anon, authenticated;
grant select, insert, update, delete on public.codename_submissions to service_role;


-- "이 번호로 이미 낸 적 있나" 만 본다. 제출한 코드네임은 돌려주지 않는다 —
-- 남의 번호를 넣어보는 것만으로 그 사람의 답안을 알아낼 수 있으면 안 된다.
create or replace function public.codename_exists(
  p_phone text,
  p_round smallint
)
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
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

revoke execute on function public.codename_exists(text, smallint) from public, anon, authenticated;
grant execute on function public.codename_exists(text, smallint) to service_role;


-- 응모 저장. 중복이면 쓰지 않고 기존 기록을 돌려주기만 한다.
--
-- 반환 jsonb
--   { ok: false, status: 'duplicate', previous_at }
--   { ok: true,  status: 'inserted' | 'replaced', is_rejoin }
create or replace function public.submit_codename(
  p_round      smallint,
  p_nickname   text,
  p_codename   text,
  p_phone      text,
  p_consent    boolean,
  p_is_correct boolean,
  p_replace    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
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
    -- ⚠️ 기존에 낸 코드네임은 돌려주지 않는다. 남의 번호를 넣어보는 것만으로
    --    그 사람의 답안을 알아낼 수 있게 된다.
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

  -- 다른 회차에 응모한 적이 있으면 재참여로 본다.
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

revoke execute on function public.submit_codename(smallint, text, text, text, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_codename(smallint, text, text, text, boolean, boolean, boolean)
  to service_role;
