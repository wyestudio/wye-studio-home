-- 감사로그가 한 줄도 안 쌓이던 문제 — 시퀀스 권한 누락
--
-- 적용: test · 운영 (2026-09-13)
-- 되돌리기: revoke usage, select on sequence public.audit_logs_id_seq from service_role;
--
-- audit_logs 테이블에는 service_role 에 insert 권한을 줬는데, id 를 만드는
-- **시퀀스**(audit_logs_id_seq)에는 usage 를 안 줬다. 그래서 insert 가
--   permission denied for sequence audit_logs_id_seq
-- 로 전부 실패하고 있었다.
--
-- ⚠️ 조용히 실패했다. writeAuditLog() 는 감사로그 실패가 본 작업(테마 저장,
--    신청 취소 등)을 망치면 안 되므로 에러를 삼키고 로그만 남기는데, 그 탓에
--    화면에서는 아무 이상이 없어 보였다. 운영 audit_logs 는 도입 이후 지금까지
--    **0행**이었다(2026-09-13 확인).
--
-- 교훈: CLAUDE.md 의 "테이블 GRANT 는 RLS 와 별개" 는 **시퀀스에도 그대로**
--       적용된다. bigserial 컬럼을 쓰는 테이블에 insert 를 허용할 때는 시퀀스
--       usage 도 같이 줘야 한다.

grant usage, select on sequence public.audit_logs_id_seq to service_role;
