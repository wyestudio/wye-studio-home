-- p36: 정산 내역 보관(스냅샷)
--
-- ⚠️ 번호가 p36 인 이유: 처음 p34 로 만들었는데 같은 날 다른 작업의
--    p34_public_venue_address / p35_venue_coordinates 와 겹쳤다.
--    같은 저장소에서 두 작업이 동시에 돌 때는 새 번호를 정하기 전에
--    `ls supabase/migrations/` 로 반드시 확인할 것.
--
-- 왜 필요한가
--   정산 화면은 매번 실시간으로 계산한다. 그래서 나중에 데이터가 바뀌면
--   **과거 달 숫자도 같이 바뀐다.** 잼핏에 "9월은 15,250원" 이라고 보냈는데
--   나중에 화면이 다른 숫자를 보여주면 근거가 없다.
--   보낸 시점의 내역을 그대로 얼려 둔다.
--
-- ⚠️ **이 표는 정산 계산에 절대 영향을 주지 않는다.**
--    보관했다고 해서 그 건이 "정산 완료" 로 분류되거나 다음 달 계산에서
--    빠지거나 하지 않는다. 오직 기록 보관용이다.
--    getSettlement() 은 이 표를 읽지 않는다 — 그 구조를 깨지 말 것.
--
-- ⚠️ 개인정보는 넣지 않는다. 보관하는 내용은 정산 화면에 보이는 것과 같다
--    (예약번호·인원·금액·쿠폰코드). 이름·연락처는 애초에 계산에 없다.
--
-- 지우지 않는 이유: 기록은 덧붙이기만 한다. 잘못 보관했으면 메모를 남기고
--   다시 보관한다 — 지울 수 있으면 기록으로서의 가치가 없다.

create table if not exists public.settlement_snapshots (
  id           uuid primary key default gen_random_uuid(),
  -- 'YYYY-MM'. 어느 달 정산인지.
  month        text not null check (month ~ '^\d{4}-\d{2}$'),
  captured_at  timestamptz not null default now(),
  -- 보관할 때 남기는 한 줄 (예: '잼핏에 메일로 전달').
  note         text,
  -- 저장 시점의 합계와 각 건. 화면·CSV 를 그대로 재현할 수 있어야 한다.
  totals       jsonb not null,
  rows         jsonb not null,
  deductions   jsonb not null default '[]'::jsonb
);

create index if not exists settlement_snapshots_month_idx
  on public.settlement_snapshots (month, captured_at desc);

comment on table public.settlement_snapshots is
  '정산 내역 스냅샷. 보관 전용이며 정산 계산에는 쓰이지 않는다.';

-- 어드민(service_role)만 쓴다. anon/authenticated 에는 권한을 주지 않는다 —
-- 이 프로젝트의 1차 방어선은 테이블 GRANT 다.
alter table public.settlement_snapshots enable row level security;
revoke all on public.settlement_snapshots from anon, authenticated;

-- ⚠️ service_role 에 명시적으로 준다. 새 표는 기본값으로 SELECT/INSERT 가
--    붙지 않아, 안 주면 어드민에서 'permission denied' 가 난다(실제로 겪음).
--
-- ⚠️ UPDATE·DELETE 는 **일부러 주지 않는다.** 보관본은 덧붙이기만 하고
--    나중에 고칠 수 없어야 기록으로서 의미가 있다. 잘못 보관했으면 메모를
--    남기고 다시 보관한다.
grant select, insert on public.settlement_snapshots to service_role;
