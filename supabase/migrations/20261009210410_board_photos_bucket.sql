-- 방탈출 보드판 사진 저장소
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기:
--   delete from storage.objects where bucket_id = 'board-photos';
--   delete from storage.buckets where id = 'board-photos';
--
-- 현장 앱(wye-studio-webapp)이 /api/board-photo 로 올리면 여기에 쌓이고,
-- 참가자는 태블릿에 뜬 QR 로 그 공개 주소를 열어 사진을 저장한다.
--
-- ⚠️ public = true 다. 참가자 휴대폰이 로그인 없이 열어야 하기 때문이다.
--    대신 파일 경로에 UUID 를 넣어 주소를 짐작할 수 없게 한다(route.ts).
--
-- ⚠️ **select 정책을 만들지 않는다.** 공개 버킷의 `/object/public/...` 읽기는
--    RLS 를 타지 않으므로 정책이 없어도 주소만 알면 열린다(2026-10-09 실측).
--    반대로 정책을 만들면 **anon 키로 목록을 훑을 수 있게 되어** 파일 이름이
--    전부 드러난다 — 그러면 UUID 를 넣은 의미가 사라진다. 실제로 그랬다:
--      정책 있음 → /storage/v1/object/list/board-photos 가 파일명을 다 돌려줌
--      정책 없음 → 같은 요청이 [] 를 돌려주고, 공개 주소는 그대로 200
--    anon 키는 브라우저 번들에 실려 나가는 공개 값이라 "아는 사람만" 이 아니다.
--
-- ⚠️ 쓰기 정책도 두지 않는다. 업로드는 RLS 를 통과하지 않는 service_role 로만
--    일어난다(/api/board-photo). anon 에 insert 를 열면 누구나 파일을 쌓을 수 있다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-photos',
  'board-photos',
  true,
  8388608, -- 8MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 이 파일의 옛 판에서 만들었던 정책을 걷어낸다(위 ⚠️ 참고).
drop policy if exists "board photos are publicly readable" on storage.objects;
