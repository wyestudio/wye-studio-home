-- 이달의 랭킹 — 테마 상세의 '랭킹' 블록이 읽는 표
--
-- 적용: test 20261018054749 (적용 완료, 2026-10-18) / 운영 적용 (2026-10-18, 이력 기록함)
--
-- 왜 블록(content JSON)이 아니라 표인가
--   기록은 회차가 끝날 때마다 쌓인다. 현장 시스템(BAR-O)이 결과를 보내 넣고,
--   어드민에서 고치거나 감춘다. 테마 content 에 넣으면 기록 하나 넣을 때마다
--   테마 전체를 다시 저장해야 하고, 어드민 편집과 서로 덮어쓴다.
--
-- 칸
--   played_on    회차 날짜(KST). '이달' 은 이 값으로 자른다.
--   group_size   노말모드 구분 — 2 · 3 · 4(4인 이상). 파티는 null.
--   grade        현장 시스템과 같은 이름(SSS~D). 현장은 등급을 저장하지 않고 그때그때
--                계산하므로(포인트 구간이 회차마다 바뀔 수 있다) **보낼 때 굳혀** 넣는다.
--   hint_free    노힌트 기록인가. 노말모드 랭킹은 노힌트만 싣는다.
--   source       manual(어드민) | baro(현장 연동)
--   external_ref 현장 기록 키(run id + 자리). 같은 기록을 두 번 보내도 한 줄로 남는다.
--   hidden       화면에서만 감춘다(테스트·리허설 기록, 부적절한 팀명).
--
-- ⚠️ 팀명이 공개 화면에 나간다. 현장에서 팀명을 받을 때 공개된다는 걸 알려야 한다.

create table if not exists public.theme_rankings (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  played_on date not null,
  team_name text not null check (char_length(team_name) between 1 and 30),
  points integer not null,
  remaining_sec integer check (remaining_sec is null or remaining_sec >= 0),
  grade text not null check (grade in ('SSS', 'SS', 'S', 'A', 'B', 'C', 'D')),
  group_size smallint check (group_size is null or group_size in (2, 3, 4)),
  hint_free boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'baro')),
  external_ref text unique,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theme_rankings_theme_month_idx
  on public.theme_rankings (theme_id, played_on);

alter table public.theme_rankings enable row level security;

-- 공개 화면은 감추지 않은 줄만 읽는다. 쓰기는 서버(service_role)만.
drop policy if exists theme_rankings_public_read on public.theme_rankings;
create policy theme_rankings_public_read on public.theme_rankings
  for select to anon, authenticated
  using (hidden = false);

grant select on public.theme_rankings to anon, authenticated;
-- ⚠️ RLS 와 별개로 grant 가 있어야 service_role 이 표에 닿는다(새 표에 자동으로 붙지 않는다).
grant select, insert, update, delete on public.theme_rankings to service_role;

comment on table public.theme_rankings is '테마 상세 이달의 랭킹. 어드민 /rankings 에서 고치고 현장 시스템이 쌓는다.';
