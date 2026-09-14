-- p28 : 검증이 끝난 백업 테이블 정리
--
-- 왜
--   되돌리기 어려운 작업을 할 때마다 `_backup_*` 테이블을 떠 왔다. 그 자체는
--   계속 유지할 방침이지만, 지우지 않고 쌓아두면 두 가지 비용이 생긴다.
--     1) 매일 도는 스키마 드리프트 검사(schema-drift-check.yml)가 이 테이블들을
--        "마이그레이션을 거치지 않은 변경"으로 보고 Slack 알림을 울린다.
--     2) 운영 스키마를 읽을 때 실제 테이블과 잔재가 섞여 보인다.
--
-- 지워도 되는 근거 (2026-09-14 확인)
--   · 참조하는 FK 0건, 의존하는 뷰·함수 0건, 애플리케이션 코드 참조 0건
--   · 각 백업이 대상으로 삼았던 작업은 모두 검증이 끝났다
--   · 무엇보다 db-backup.yml 이 매일 public 스키마 전체를 암호화 덤프로 남기고
--     90일간 보관한다. 이 테이블들의 내용도 그 덤프 안에 그대로 들어 있으므로,
--     여기서 지워도 90일 안에는 언제든 복구할 수 있다.
--
-- 남겨두는 것
--   _backup_theme_content_20260913b  — 2026-09-13 테마 콘텐츠 반영 직전 상태.
--   _backup_applications_20260913    — 삭제한 팀 테스트 신청 8건.
--   _backup_application_attendees_20260913
--   아직 하루밖에 안 지났다. 며칠 더 두고 별도로 정리한다.

drop table if exists public._backup_applications_20260815;
drop table if exists public._backup_20260912_applications;
drop table if exists public._backup_20260912_application_attendees;
drop table if exists public._backup_20260912_sessions;
drop table if exists public._backup_20260912_session_venues;
drop table if exists public._backup_20260912_sms_templates;
drop table if exists public._backup_theme_content_20260913;
