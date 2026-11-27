-- 관리자 전용 도구 파일 저장소(관리자 개편 6단계, 2026-11-27 대표님) — 명찰 제작기 · 플레이 리포트 틀.
--
-- 왜 버킷인가
--   명찰 제작기는 45MB 짜리 단일 HTML 이다. 저장소가 공개라 커밋할 수 없고, public/ 에 두면 누구나 받는다.
--   비공개 버킷에 두고, 관리자가 「명찰 만들기」 를 누를 때만 서버가 몇 분짜리 임시 주소를 내준다.
--   파일은 브라우저가 저장소에서 직접 받는다 — Vercel 서버를 지나지 않는다(wye-server-cost).
--
-- ⚠️ public = false 다. 정책을 **하나도 만들지 않는다** — anon · authenticated 는 읽지도 쓰지도 훑지도 못한다.
--    올리기 · 임시 주소 만들기는 RLS 를 타지 않는 service_role 로만 한다
--    (scripts/admin-tools/upload-admin-tool.mjs · 서버 액션 openNametagMaker).
-- ⚠️ 파일은 마이그레이션으로 올라가지 않는다. 버킷을 만든 뒤 스크립트로 따로 올린다(운영도 마찬가지).
--
-- 되돌리기:
--   delete from storage.objects where bucket_id = 'admin-tools';
--   delete from storage.buckets where id = 'admin-tools';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-tools',
  'admin-tools',
  false,
  52428800, -- 50MB
  array['text/html']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
