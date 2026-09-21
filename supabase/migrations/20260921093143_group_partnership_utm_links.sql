-- 단체 제휴(소모임 앱·오픈카톡) 홍보 링크 2건을 유입경로 목록에 기록
--
-- 적용: test 20260921093223 (적용 완료, 2026-09-21) / 운영 20260921093237 (적용 완료, 2026-09-21)
--   ⚠️ 파일명 앞자리와 DB 에 기록된 번호가 다르다. 적용 도구가 실행 시각으로 번호를
--      새로 매기기 때문이다.
-- 되돌리기:
--   delete from public.utm_links where slug in ('somoim-group.go', 'okt-group.go');
--
-- 왜 필요한가
--   짧은 주소를 next.config 의 redirects() 에 박아 배포하는데, 표에 없으면
--   어드민 유입경로 화면에서 그 링크의 존재를 알 수 없다. managed_by='code' 로
--   넣어 **목록에만** 싣는다 — 여기 값을 고쳐도 실제 동작은 next.config 이 정한다.
--
-- 값 근거 (WYE-89 1.1)
--   utm_medium=social  : 수수료 없는 커뮤니티 오가닉 공유·홍보다. GA4 기본 채널
--                        그룹은 매체가 social 일 때 '자연 소셜' 로 분류한다.
--                        somoim·openkakao 는 GA4 소셜 사이트 목록에 없는 소스라
--                        매체가 규칙 밖(dm 등)이면 '미분류' 로 빠진다.
--   utm_content=dm     : 전달 방식(단체방·운영자 DM)을 진입 지점 축에 담는다.
--   utm_campaign       : 1.2 방침대로 링크 성격을 이름으로 쓴다(26년 9월 그룹 오픈).

insert into public.utm_links
  (label, slug, landing_path, utm_source, utm_medium, utm_campaign, utm_content, managed_by, sort, note)
values
  ('소모임 앱 단체 제휴 (DM)',  'somoim-group.go', '/themes/baotalchul',
   'somoim',    'social', '2609_group_open', 'dm', 'code', 150, 'next.config.ts 의 redirects()'),
  ('오픈카톡 단체 제휴 (DM)',   'okt-group.go',    '/themes/baotalchul',
   'openkakao', 'social', '2609_group_open', 'dm', 'code', 151, 'next.config.ts 의 redirects()')
-- ⚠️ slug 유니크 인덱스는 부분 인덱스(where slug is not null)라, 조건절을 똑같이
--    적어 줘야 ON CONFLICT 가 그 인덱스를 찾는다. 빼면 42P10 으로 막힌다.
on conflict (slug) where slug is not null do nothing;
