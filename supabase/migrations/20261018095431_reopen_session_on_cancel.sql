-- 팀 수가 차서 자동으로 닫힌 회차는, 예약이 취소되면 자동으로 다시 연다 (노말모드)
--
-- 적용: test 20261018095546 (2026-10-18) / 운영 적용 (2026-10-18, 이력 기록함)
-- ⚠️ 20261018093106_theme_max_teams_per_session 다음에 적용한다(그 함수 본문을 고친다).
--
-- 왜
--   노말모드는 한 회차 한 팀이라 예약이 들어오면 회차가 닫힌다(20261018093106). 그 예약이
--   취소되면 운영자가 손으로 다시 열어야 했는데, 취소된 시간은 바로 다른 팀이 잡을 수
--   있어야 한다(2026-10-18 대표님).
--
-- 어떻게
--   1. sessions.closed_by_team_limit — "팀 수가 차서 시스템이 닫았다" 표시.
--      submit_application_v3 가 팀 수 때문에 닫을 때만 true 로 둔다.
--      ⚠️ 운영자가 손으로 닫은 회차(휴무 등)는 이 표시가 없어서 취소돼도 열리지 않는다.
--         어드민 상태 변경(updateSessionStatus)은 열든 닫든 이 표시를 false 로 되돌린다.
--   2. applications 트리거 — 살아 있던 신청(confirmed/waiting)이 취소·삭제되면, 그 회차가
--      표시가 있는 채로 닫혀 있고 아직 시작 전이며 팀 수에 자리가 났을 때 연다.
--      취소 경로가 고객 셀프 취소(cancel_application)와 어드민 네 곳으로 흩어져 있어서
--      코드가 아니라 DB 한 곳에서 처리한다 — 새 취소 경로가 생겨도 빠지지 않는다.
--
-- 동시성
--   트리거는 회차 행을 먼저 잠그고 나서 건수를 센다. 신청 함수도 같은 행을 먼저 잠그므로
--   취소와 새 예약이 겹쳐도 차례로 판정된다. 잠근 뒤의 문장은 새로 보므로(read committed)
--   방금 들어온 예약을 놓치고 여는 일이 없다.
--
-- ⚠️ 파티는 건드리지 않는다 — max_teams_per_session 이 비어 있는 테마는 트리거가 그냥 지나간다.
-- ⚠️ 회차 자체를 취소(status 'cancelled')한 경우는 'closed' 가 아니라서 열리지 않는다.

alter table public.sessions
  add column if not exists closed_by_team_limit boolean not null default false;

comment on column public.sessions.closed_by_team_limit is
  '팀 수 제한(themes.max_teams_per_session)이 차서 시스템이 닫았으면 true. 예약이 취소되면 자동으로 다시 연다. 운영자가 상태를 바꾸면 false.';

-- 1. submit_application_v3 — 팀 수로 닫는 줄에만 표시를 단다.
--    정의를 통째로 다시 적지 않고, 지금 정의에서 그 한 줄만 바꾼다(정확히 한 번 바뀌는지 확인).
do $$
declare
  v_def text := pg_get_functiondef('public.submit_application_v3'::regproc);
  v_old text := E'           where session_id = p_session_id and status in (''confirmed'',''waiting'')) >= v_session.max_teams_per_session then\n    update sessions set status = ''closed'', updated_at = now() where id = p_session_id; end if;';
  v_new text := E'           where session_id = p_session_id and status in (''confirmed'',''waiting'')) >= v_session.max_teams_per_session then\n    update sessions set status = ''closed'', closed_by_team_limit = true, updated_at = now() where id = p_session_id; end if;';
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'submit_application_v3 에서 바꿀 줄을 정확히 한 번 찾지 못했습니다';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;

-- 2. 취소되면 다시 연다.
create or replace function public.reopen_session_after_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_limit int;
  v_active int;
begin
  -- 살아 있던 신청이 살아 있지 않게 됐을 때만 본다.
  if old.status not in ('confirmed','waiting') then return null; end if;
  if tg_op = 'UPDATE' and new.status in ('confirmed','waiting') then return null; end if;

  -- 회차 행을 먼저 잠근다 — 신청 함수와 같은 순서라 동시에 들어온 예약과 차례로 판정된다.
  perform 1 from sessions where id = old.session_id for update;

  select t.max_teams_per_session into v_limit
    from sessions s join themes t on t.id = s.theme_id
   where s.id = old.session_id
     and s.status = 'closed'
     and s.closed_by_team_limit
     and s.start_at > now();
  if v_limit is null then return null; end if;

  select count(*) into v_active from applications
   where session_id = old.session_id and status in ('confirmed','waiting');

  if v_active < v_limit then
    update sessions set status = 'open', closed_by_team_limit = false, updated_at = now()
     where id = old.session_id;
  end if;
  return null;
end;
$function$;

revoke all on function public.reopen_session_after_cancel() from public, anon, authenticated;

drop trigger if exists trg_reopen_session_after_cancel on public.applications;
create trigger trg_reopen_session_after_cancel
  after update of status or delete on public.applications
  for each row execute function public.reopen_session_after_cancel();
