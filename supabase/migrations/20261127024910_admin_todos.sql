-- 관리자 홈 「오늘 할 일」 저장(2026-11-27 대표님 — 관리자 개편 2단계).
--
-- 홈의 할 일은 대부분 지금 데이터에서 그때그때 계산한다(미매칭 입금 · 입금 확인 전 · 전날/당일 회차 …).
-- 계산으로 알 수 없는 두 가지만 저장한다.
--   admin_todos             운영자가 직접 적은 할 일
--   admin_todo_dismissals   자동으로 생긴 할 일을 「끝냄」 으로 체크한 기록(할 일의 키로 찾는다)
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 새 홈 화면이 이 두 표를 읽는다.
-- ⚠️ 정책을 하나도 두지 않는다 = anon · authenticated 는 닿지 못한다. 읽고 쓰는 길은 어드민 서버(service_role)뿐.
-- ⚠️ 누가 적었는지는 계정 단위로 알 수 없다(어드민 인증이 공유 비밀번호) — audit_logs 와 같이 '어드민' 으로 남긴다.
--
-- 되돌리기:
--   drop table if exists public.admin_todo_dismissals;
--   drop table if exists public.admin_todos;

create table if not exists public.admin_todos (
  id uuid primary key default gen_random_uuid(),
  -- 직접 적은 할 일 한 줄. 길이는 화면 · 서버 액션과 같은 규칙(1~60자)을 DB 에서도 막는다.
  text text not null check (char_length(text) between 1 and 60),
  -- 끝냈으면 그 시각. null 이면 남은 일.
  done_at timestamptz,
  created_by text not null default '어드민' check (char_length(created_by) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.admin_todos is
  '관리자 홈 「오늘 할 일」 에 운영자가 직접 적은 할 일. 어드민 서버(service_role)만 읽고 쓴다.';

create index if not exists admin_todos_created_at_idx on public.admin_todos (created_at desc);

create table if not exists public.admin_todo_dismissals (
  -- 자동 할 일의 키. 예: 'session-prep:<회차 id>:2026-11-28'. 같은 일은 한 번만 체크된다.
  todo_key text primary key check (char_length(todo_key) between 1 and 120),
  done_at timestamptz not null default now(),
  actor text not null default '어드민' check (char_length(actor) between 1 and 40)
);

comment on table public.admin_todo_dismissals is
  '관리자 홈 「오늘 할 일」 중 자동으로 생긴 일을 끝냄으로 체크한 기록. 체크를 풀면 줄을 지운다.';

alter table public.admin_todos enable row level security;
alter table public.admin_todo_dismissals enable row level security;

-- 새 표에는 권한이 자동으로 붙지 않는다. 어드민 서버에만 준다.
revoke all on public.admin_todos from anon, authenticated;
revoke all on public.admin_todo_dismissals from anon, authenticated;
grant select, insert, update, delete on public.admin_todos to service_role;
grant select, insert, delete on public.admin_todo_dismissals to service_role;
