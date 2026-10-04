-- 지난 회차에는 신청을 받지 않는다 (submit_application_v3)
--
-- 적용: test 20261004101107 (적용 완료, 2026-10-04) / 운영 (미적용)
--
-- ⚠️ 운영에는 아직 안 들어갔다. 그때까지 지난 회차 신청을 막는 건 앱의
--    isBookable() 하나뿐이다(src/lib/themes.ts).
--
-- 왜
--   v3 는 status 만 봤다. 그런데 지나간 회차의 status 를 'closed' 로 내리는 건
--   운영자가 손으로 하는 일이라 실제로는 'open' 이 그대로 남는다
--   (2026-10-04 운영: 지난 회차 13개 중 4개가 'open').
--   지금까지 막아준 건 앱이 지난 회차를 목록에서 빼던 것뿐이었는데, 테마 상세에
--   지난 회차를 '마감' 으로 남기기로 하면서 그 보호가 사라졌다. 앱 쪽에는
--   isBookable() 에 시각 판정을 넣었지만(src/lib/themes.ts), 마지막 방어선은
--   여기여야 한다 — 앱을 고치다 판정이 빠지면 끝난 회차에 신청이 들어간다.
--
-- ⚠️ 어드민 수동 등록(adminManualApply)도 **같은 함수**를 부른다. 즉 이 가드는
--    회차가 시작된 뒤의 운영자 등록도 막는다. 운영 신청 76건 중 회차 시작 이후
--    생성된 건은 0건이라 실제로 쓰이던 길은 아니다(2026-10-04 확인).
--    필요해지면 이 줄만 빼는 마이그레이션으로 되돌린다 — 파라미터를 추가해
--    예외를 두지 않는다(같은 이름 다른 시그니처가 2026-08-14 장애의 모양이다).
--
-- 방법
--   함수 전체를 다시 적지 않고, DB 에 살아 있는 정의를 받아 **그 한 줄 뒤에**
--   새 줄을 끼워 넣는다. 9천 자를 옮겨 적다 오타가 나면 나머지가 같이 바뀐다.
--   원본 전체는 20261001040523_submit_v3_promotion_price.sql 에 있다.

do $migration$
declare
  v_def text;
  v_anchor constant text :=
    '  if v_session.status <> ''open'' then raise exception ''이미 마감된 회차입니다.''; end if;';
  v_guard constant text :=
    '  -- 이미 시작한 회차는 받지 않는다. status 는 손으로 내리는 값이라 지나간 회차에도' || E'\n' ||
    '  -- ''open'' 이 남는다 — 시각으로 끊지 않으면 끝난 회차에 신청이 들어간다.' || E'\n' ||
    '  if v_session.start_at < now() then raise exception ''이미 마감된 회차입니다.''; end if;';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'submit_application_v3';

  if v_def is null then
    raise exception 'submit_application_v3 을 찾지 못했습니다.';
  end if;

  -- 이미 적용돼 있으면 조용히 끝낸다(두 번 돌려도 안전하다).
  if position('v_session.start_at < now()' in v_def) > 0 then
    raise notice '이미 적용돼 있습니다 — 건너뜁니다.';
    return;
  end if;

  -- 기대한 블록이 없으면 **아무것도 하지 않고 멈춘다.** 함수가 그사이 바뀌었다는 뜻이고,
  -- 그 상태로 밀어 넣으면 남의 변경을 덮어쓴다.
  if position(v_anchor in v_def) = 0 then
    raise exception '기대한 status 검사 줄을 찾지 못했습니다. 함수가 바뀌었습니다 — 손으로 확인하세요.';
  end if;

  execute replace(v_def, v_anchor, v_anchor || E'\n' || v_guard);
end
$migration$;
