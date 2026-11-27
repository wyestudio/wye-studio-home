-- 단체 예약 팀 편성 · 명찰(관리자 개편 6단계, 2026-11-27 대표님).
--
-- 무엇이 생기나
--   group_teams             단체의 팀(최대 6팀) — 팀명 · 구호
--   group_team_members      팀원. 참가자 한 명은 한 팀에만 들어간다
--   group_nametag_states    명찰 제작기에서 고친 내용(단체마다 한 줄). 설문 원본은 바꾸지 않는다
--   group_booking_inquiries.nametag_mode   명찰 색 기준 — beginner(초심자) / experienced(숙련자, 기본)
--   admin_save_group_teams  편성 전체를 한 번에 바꿔 넣는다(팀 · 팀원을 한 묶음으로). null 을 주면 편성을 지운다
--
-- 규칙
--   · group_teams 에 줄이 **하나도 없으면** 「추천 편성」 상태다 — 응답이 올 때마다 화면이 추천을 새로 계산한다.
--     운영자가 한 번이라도 고치면 줄이 생기고, 그 뒤 들어온 응답은 「미배정」 으로 모인다.
--   · 팀명 16자 · 구호 30자. 화면 · PPT 에 그대로 쓰는 값이라 기호를 막지 않는다(제어 문자만 막는다).
--
-- 보안: 새 표는 RLS 를 켜고 정책을 두지 않는다. 어드민 서버(service_role)만 읽고, 쓰기는 함수로만 한다.
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. group_forms 마이그레이션(group_participants)이 먼저 있어야 한다.
--
-- 되돌리기:
--   drop function if exists public.admin_save_group_teams(uuid, jsonb);
--   drop table if exists public.group_nametag_states, public.group_team_members, public.group_teams;
--   alter table public.group_booking_inquiries drop column if exists nametag_mode;

alter table public.group_booking_inquiries
  add column if not exists nametag_mode text not null default 'experienced'
    check (nametag_mode in ('beginner', 'experienced'));
comment on column public.group_booking_inquiries.nametag_mode is
  '명찰 색 기준. experienced: 흰 0~50 · 베이지 51~100 · 갈색 101~200 · 연회색 201~500 · 검회색 501+ / beginner: 흰 0 · 베이지 1~10 · 갈색 11~20 · 연회색 21~50 · 검회색 51+';

create table if not exists public.group_teams (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  idx integer not null check (idx between 0 and 5),
  name text check (name is null or char_length(name) between 1 and 16),
  slogan text check (slogan is null or char_length(slogan) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (inquiry_id, idx)
);
comment on table public.group_teams is '단체의 팀. 줄이 하나도 없으면 추천 편성 상태(화면이 그때그때 계산한다).';

create table if not exists public.group_team_members (
  -- 참가자 한 명은 한 팀에만. 참가자 답이 지워지면 같이 빠진다.
  participant_id uuid primary key references public.group_participants(id) on delete cascade,
  team_id uuid not null references public.group_teams(id) on delete cascade,
  pos integer not null default 0 check (pos between 0 and 999)
);
create index if not exists group_team_members_team_idx on public.group_team_members (team_id, pos);

create table if not exists public.group_nametag_states (
  inquiry_id uuid primary key references public.group_booking_inquiries(id) on delete cascade,
  -- 제작기의 상태(고친 닉네임 · 글자 크기 · 위치 · 에디션 · 기준). 크기를 막는다.
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 300000),
  updated_at timestamptz not null default now()
);
comment on table public.group_nametag_states is '명찰 제작기에서 고친 내용. 닉네임 · 방수만 들어 있다(이름 · 연락처 없음).';

alter table public.group_teams enable row level security;
alter table public.group_team_members enable row level security;
alter table public.group_nametag_states enable row level security;
revoke all on public.group_teams, public.group_team_members, public.group_nametag_states from anon, authenticated;
grant select on public.group_teams, public.group_team_members to service_role;
grant select, insert, update, delete on public.group_nametag_states to service_role;

-- 편성 전체를 바꿔 넣는다. p_teams: [{ "name": "…", "slogan": "…", "members": ["참가자 id", …] }, …] (순서 = 팀 순서)
-- null 이면 편성을 지운다(= 추천 편성 상태로 돌아간다).
create or replace function public.admin_save_group_teams(p_inquiry_id uuid, p_teams jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t jsonb;
  v_idx integer := 0;
  v_team uuid;
  v_name text;
  v_slogan text;
  v_member text;
  v_pos integer;
  v_seen uuid[] := '{}';
  v_pid uuid;
begin
  if not exists (select 1 from public.group_booking_inquiries where id = p_inquiry_id) then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  -- 같은 단체의 편성을 둘이 동시에 고쳐도 섞이지 않게 줄을 잡는다.
  perform 1 from public.group_booking_inquiries where id = p_inquiry_id for update;

  delete from public.group_teams where inquiry_id = p_inquiry_id;
  if p_teams is null then
    return;
  end if;
  if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams) < 1 or jsonb_array_length(p_teams) > 6 then
    raise exception '팀은 1~6팀까지 둘 수 있습니다.';
  end if;

  for t in select * from jsonb_array_elements(p_teams) loop
    v_name := nullif(trim(coalesce(t->>'name', '')), '');
    v_slogan := nullif(trim(coalesce(t->>'slogan', '')), '');
    if v_name is not null and (char_length(v_name) > 16 or v_name ~ '[[:cntrl:]]') then
      raise exception '팀명은 16자까지 쓸 수 있어요.';
    end if;
    if v_slogan is not null and (char_length(v_slogan) > 30 or v_slogan ~ '[[:cntrl:]]') then
      raise exception '팀 구호는 30자까지 쓸 수 있어요.';
    end if;
    insert into public.group_teams (inquiry_id, idx, name, slogan)
    values (p_inquiry_id, v_idx, v_name, v_slogan)
    returning id into v_team;

    v_pos := 0;
    if jsonb_typeof(t->'members') = 'array' then
      for v_member in select jsonb_array_elements_text(t->'members') loop
        if v_member !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          raise exception '참가자를 찾을 수 없습니다.';
        end if;
        v_pid := v_member::uuid;
        if v_pid = any (v_seen) then
          raise exception '한 사람이 두 팀에 들어 있습니다.';
        end if;
        -- 그 단체의 참가자만 넣는다.
        if not exists (select 1 from public.group_participants where id = v_pid and inquiry_id = p_inquiry_id) then
          raise exception '참가자를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 해주세요.';
        end if;
        v_seen := v_seen || v_pid;
        insert into public.group_team_members (participant_id, team_id, pos) values (v_pid, v_team, v_pos);
        v_pos := v_pos + 1;
      end loop;
    end if;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

revoke all on function public.admin_save_group_teams(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_group_teams(uuid, jsonb) to service_role;
