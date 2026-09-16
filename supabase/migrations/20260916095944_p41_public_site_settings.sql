-- Phase 41 — 사이트 설정 중 '공개해도 되는 값'만 고객 화면에서 읽게 하기
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기:
--   drop policy if exists site_settings_public_read on site_settings;
--   revoke select on site_settings from anon, authenticated;
--   delete from site_settings where key = 'public.event_bubble';
--
-- 왜 (2026-09-16)
--   우하단 인스타 버튼 위 이벤트 말풍선을 **어드민에서 켜고 끄고 싶다**는 요청.
--   지금까지 site_settings 는 비어 있었고 anon 읽기 권한도 없었다.
--
-- ⚠️ 테이블 전체를 열지 않는다. 앞으로 여기에 비공개 설정(키·한도 등)이 들어올 수
--    있으므로, **key 가 'public.' 으로 시작하는 행만** 읽히게 막아 둔다.
--    새 공개 설정을 만들 때도 반드시 'public.' 접두사를 붙일 것.

grant select on site_settings to anon, authenticated;

drop policy if exists site_settings_public_read on site_settings;
create policy site_settings_public_read on site_settings
  for select to anon, authenticated
  using (key like 'public.%');

-- 말풍선 기본값. enabled 를 false 로 두고 시작한다 — 어드민에서 켜는 순간 노출된다.
insert into site_settings (key, value, description)
values (
  'public.event_bubble',
  '{"enabled": false, "text": "오픈기념 할인쿠폰 이벤트\n팔로우하고 5,000원 쿠폰 받기"}'::jsonb,
  '우하단 인스타 버튼 위 말풍선. 어드민 > 공지·FAQ 화면에서 켜고 끈다.'
)
on conflict (key) do nothing;
