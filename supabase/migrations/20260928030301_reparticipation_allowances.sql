-- 재참여 예외 허용 — 사람 단위로 "같은 테마 1회 제한"을 풀어준다 (2026-09-28)
--
-- 같은 테마 재참여를 막는 이유는 방탈출 문제를 이미 아는 사람이 다시 와서
-- 경쟁적으로 문제를 푸는 것을 막기 위한 것이다(docs/06-decisions.md D-02).
-- 그런데 프리오픈(8/29 소개팅) 참가자 중 컨텐츠 시작 전에 개인사정으로 귀가해
-- 방탈출 문제를 한 문제도 접하지 않은 사람이 있다. 규칙이 막으려던 상황이
-- 아니므로 예외를 허용한다.
--
-- 예외를 "쓰면 사라지는 1회권"이 아니라 **허용 참여 횟수**로 적는다.
-- 쿠폰의 used_at 처럼 소비 처리를 따로 할 필요가 없고, 참여 기록이 허용
-- 횟수에 도달하면 저절로 다시 막힌다.
--   행이 없으면 1 → 지금 동작과 완전히 같다
--   max_participations = 2 → 딱 한 번 더 참여 가능
--
-- 예외를 넣는 방법 (전화번호 평문을 몰라도 된다 — 기존 기록의 해시를 그대로 쓴다):
--   insert into reparticipation_allowances (phone_hash, theme_id, max_participations, reason)
--   select aa.phone_hash, s.theme_id, 2, '사유'
--     from application_attendees aa
--     join applications ap on ap.id = aa.application_id
--     join sessions s on s.id = ap.session_id
--    where aa.nickname = '닉네임'
--   on conflict (phone_hash, theme_id) do update
--      set max_participations = excluded.max_participations, reason = excluded.reason;

create table if not exists public.reparticipation_allowances (
  id                 uuid primary key default gen_random_uuid(),
  phone_hash         text not null,
  theme_id           uuid not null references public.themes(id) on delete cascade,
  max_participations int  not null default 2 check (max_participations >= 1),
  reason             text,
  created_at         timestamptz not null default now(),
  unique (phone_hash, theme_id)
);

comment on table public.reparticipation_allowances is
  '같은 테마 1회 제한(D-02)의 사람 단위 예외. phone_hash + theme_id 당 허용 참여 횟수(기본 규칙은 1).';

-- 정책을 만들지 않는다 = anon/authenticated 는 읽지도 쓰지도 못한다.
-- 판정은 아래 security definer 함수 안에서만 하고, 행 추가는 service_role 로 한다.
alter table public.reparticipation_allowances enable row level security;


-- 재참여 차단 판정을 한 곳으로 모은다.
-- 화면 사전 안내(check_active_applications_v2)와 최종 판정(submit_application_v3)이
-- 서로 다른 규칙을 쓰면 "화면엔 안 된다고 뜨는데 신청은 되는" 식으로 갈린다.
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
  select p_theme_id is not null
     and (
       select count(*)
         from application_attendees aa
         join applications ap on ap.id = aa.application_id
         join sessions s on s.id = ap.session_id
        where ap.status <> 'cancelled'
          and aa.phone_hash = hash_phone(p_phone)
          and s.theme_id = p_theme_id
     ) >= coalesce((
       select r.max_participations
         from reparticipation_allowances r
        where r.phone_hash = hash_phone(p_phone)
          and r.theme_id = p_theme_id
     ), 1);
$$;

comment on function public.is_theme_participation_blocked(text, uuid) is
  '이 전화번호가 이 테마에 더 신청할 수 없는 상태인지. 기본은 "이미 1번 참여했으면 차단", reparticipation_allowances 에 행이 있으면 그 횟수까지 허용.';

-- 내부 헬퍼다. 바깥의 security definer 함수(소유자 postgres) 안에서만 불린다.
revoke all on function public.is_theme_participation_blocked(text, uuid) from public;


-- 화면 사전 안내 — 판정을 헬퍼로 위임. 동작은 예외 행이 없으면 종전과 동일.
create or replace function public.check_active_applications_v2(
  p_phones text[],
  p_session_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(array_agg(distinct phone), array[]::text[])
    from unnest(p_phones) as phone
   where is_theme_participation_blocked(
           phone, (select theme_id from sessions where id = p_session_id));
$$;
