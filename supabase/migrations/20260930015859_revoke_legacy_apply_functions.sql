-- 옛 신청·조회 함수의 anon/authenticated 실행 권한 회수 (2026-09-30)
--
-- anon 키는 클라이언트 번들에 들어 있는 공개값이다. 그런데 아래 옛 함수들이
-- anon 에 열려 있어 **REST 를 직접 때리면 현행 규칙을 우회한 신청을 만들 수 있었다**:
--   · 재참여 배타를 sessions.content_group 으로 판정 → 새 회차는 그 값이 null 이라 안 걸림
--   · 연령을 회차 min_age 가 아니라 옛 출생년도 범위로 판정
--   · headcount·unit_price_krw·amount_krw 를 넣지 않아 금액이 NULL 인 신청이 생김
--
-- 삭제가 아니라 회수다. 2026-08-14 에 이 계열 함수를 잘못 지워 서비스가 마비된 적이
-- 있어(wye-db-release) 되돌릴 수 있는 조치부터 한다. 함수 본체와 service_role 권한은
-- 그대로 두므로, 문제가 생기면 grant 한 줄로 복구된다.
--
-- 호출처 확인 (2026-09-30, src/ 전수 grep):
--   submit_application         ← src/app/(site)/sessions/[slug]/apply/actions.ts:214
--   check_active_applications  ← src/app/(site)/sessions/[slug]/apply/actions.ts:47
--   submit_application_v2      ← 없음
--   lookup_application/_v2/_v3 ← 없음 (현행은 lookup_application_v4)
-- 위 두 호출은 휴면 라우트 `/sessions/[slug]/apply` 의 것이고, 그 라우트는
-- sessions.slug 가 있는 회차에만 닿는데 그게 프리오픈 2건뿐이며 **둘 다 closed** 라
-- 화면이 "정원이 다 차서 마감되었습니다"만 그리고 폼을 렌더하지 않는다(운영에서 확인).
--
-- ⚠️ 현행 경로가 쓰는 함수는 건드리지 않는다:
--   submit_application_v3 · check_active_applications_v2 · lookup_application_v4 ·
--   cancel_application · check_nickname_available · preview_coupons · get_session_stats

-- 오버로드 개수가 운영/테스트에서 다르다(운영은 submit_application_v2 가 2종, 테스트는 1종).
-- 그래서 시그니처를 박지 않고 **이름으로 찾아 도는** 방식으로 회수한다.
-- 여러 번 실행해도 안전하고, 나중에 오버로드가 늘거나 줄어도 그대로 동작한다.

do $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
             'submit_application',        -- v1 (현행은 _v3)
             'submit_application_v2',
             'check_active_applications', -- v1 (현행은 _v2)
             'lookup_application',        -- v1 (현행은 _v4)
             'lookup_application_v2',
             'lookup_application_v3'
           )
  loop
    -- ⚠️ anon/authenticated 만 회수하면 안 되는 경우가 있다.
    --    proacl 이 `{=X/postgres,...}` 처럼 **PUBLIC(=X)** 를 품고 있으면 anon 은
    --    PUBLIC 을 통해 계속 실행할 수 있다 (lookup_application 이 실제로 그랬다).
    --    그래서 public 까지 같이 회수한다. 소유자(postgres)와 명시적 service_role
    --    grant 는 그대로 남는다.
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    v_n := v_n + 1;
  end loop;

  raise notice '옛 함수 %개의 anon/authenticated 실행 권한을 회수했다', v_n;
end $$;
