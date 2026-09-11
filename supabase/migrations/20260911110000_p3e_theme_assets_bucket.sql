-- 테마 포스터 등 공개 이미지 저장소
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기:
--   delete from storage.objects where bucket_id = 'theme-assets';
--   delete from storage.buckets where id = 'theme-assets';
--
-- 공개 버킷이다. 포스터는 고객 화면에 그대로 보이는 이미지라 숨길 이유가 없고,
-- 공개여야 Next/Image 가 최적화해 가져갈 수 있다.
-- 쓰기는 service_role 만 — 어드민 서버 액션이 그 키로 올린다.
-- anon 에 쓰기를 열면 누구나 우리 저장소에 파일을 쌓을 수 있다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('theme-assets', 'theme-assets', true, 5 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists theme_assets_public_read on storage.objects;
create policy theme_assets_public_read on storage.objects
  for select using (bucket_id = 'theme-assets');
