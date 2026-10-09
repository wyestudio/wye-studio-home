-- 할로윈 회차 태그 + 11/1 이후 회차 비우기 (재편성 논의 중)
--
-- 앞선 20261009094650 이 10/31 을 14:00 · 19:00 두 회차로 바꿨다. 여기서는
--   1) 그 두 회차에 '할로윈' 태그를 단다
--   2) **11/1 이후 바-ㅇ탈출 회차를 전부 지운다** — 편성을 다시 짜는 중이라,
--      지금 박혀 있는 토·일 11:30/15:30/19:30 이 그대로 공개되면 안 된다
--   3) 편성 규칙의 종료일을 10/30 으로 막는다
--
-- ⚠️ 삭제 대상은 **신청이 0건인 회차뿐**이다. applications.session_id 가
--    ON DELETE CASCADE 라, 가드 없이 지우면 고객 신청이 조용히 같이 사라진다.
--    (어드민 deleteSession 이 코드로 막는 것과 같은 이유)
--
-- ⚠️ 테마를 'baotalchul' 로 한정한다. 테스트 DB 에는 작업 중인 다른 테마
--    (baotalchul-normal)의 회차가 있어 같이 지우면 안 된다.
--
-- 적용 시점 기준 대상: 운영 114건 (2026-11-01 ~ 2027-03-13, 전부 미공개·신청 0건),
-- 테스트 111건. 회차별 장소 지정(session_venues)도 0건이라 함께 잃을 것이 없다.

begin;

-- 1) 10/31 두 회차에 태그
update sessions
   set badge = '할로윈', updated_at = now()
 where theme_id = (select id from themes where slug = 'baotalchul')
   and (start_at at time zone 'Asia/Seoul')::date = date '2026-10-31';

-- 2) 11/1 이후 회차 삭제 (신청 0건인 것만)
delete from sessions
 where id in (
   select s.id from sessions s
     join themes t on t.id = s.theme_id
    where t.slug = 'baotalchul'
      and (s.start_at at time zone 'Asia/Seoul')::date > date '2026-10-31'
      and not exists (select 1 from applications a where a.session_id = s.id)
 );

-- 3) 편성 규칙을 10/30 에서 끊는다.
--    10/31 을 포함시키면 어드민에서 '저장하고 회차 만들기' 를 누를 때 규칙상의
--    11:30/15:30/19:30 이 10/31 에 **되살아난다** — 할로윈 두 회차는 규칙 밖의
--    수동 회차로 남겨야 그 사고가 안 난다.
update theme_schedules
   set end_date = date '2026-10-30',
       generated_until = date '2026-10-30',
       updated_at = now()
 where theme_id = (select id from themes where slug = 'baotalchul');

commit;
