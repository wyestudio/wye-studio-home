-- 참여자 출생연도를 비울 수 있게 한다 (노말모드는 이름·휴대폰만 받는다)
--
-- 적용: test 20261018071002 (적용 완료, 2026-10-18) / 운영 (미적용)
--
-- 왜
--   노말모드(단독 진행 상품) 예약은 이름과 휴대폰만 받는다(2026-10-18 대표님).
--   팀 편성이 없어 성별·방탈출 경험이 필요 없고, 연령은 현장 신분증 확인으로 본다.
--   출생연도를 지어낸 값으로 채워 넣지 않는다 — 고객 기록에 가짜 값이 남는다.
--
-- ⚠️ 함수는 고치지 않는다. 확인한 것(2026-10-18, test):
--   - submit_application_v3 · admin_update_application 의 연령 검사는
--     `not is_eligible_birth_year(birth_year, min_age)` 다. 출생연도가 null 이면
--     null 이 되어 걸리지 않는다 → 노말 예약이 그대로 통과한다.
--   - 그 밖의 함수(lookup_application_v*)는 값을 돌려주기만 한다.
--   - 기대는 뷰는 admin_attendee_view 하나이며 NOT NULL 해제에 영향받지 않는다.
-- ⚠️ 파티(팀 대항) 예약은 여전히 화면·서버(apply/actions.ts)가 출생연도를 필수로 받는다.
--    어느 쪽인지는 브라우저가 아니라 **회차의 테마**(reparticipation_limit 이 null)로 정한다.
--
-- 되돌리기: null 인 행이 없을 때만 `alter column birth_year set not null` 이 된다.

alter table public.application_attendees
  alter column birth_year drop not null;

comment on column public.application_attendees.birth_year is
  '출생연도. 노말모드(단독 진행) 예약은 받지 않아 null 이다.';
