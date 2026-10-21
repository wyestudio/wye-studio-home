-- 시즌 스킨(할로윈 등)을 어드민에서 켜고 끈다
--
-- 적용: test 20261021074221 (2026-10-21) / 운영 (미적용)
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 코드는 이 뷰를 읽는데, 뷰가 없으면
--    읽기 실패를 '꺼짐' 으로 보고 넘어가므로 화면이 깨지지는 않는다 — 스킨만 안 켜진다.
--
-- 왜
--   할로윈 장식을 기간 동안만 씌웠다 벗길 수 있어야 한다(2026-10-21 대표님).
--   배포 없이 어드민에서 바로 켜고 끈다. 끝나는 날짜는 정하지 않는다 — 운영자가 끈다.
--
-- 어떻게
--   값은 site_settings 의 'site.season' 한 줄에 둔다: {"skin": "halloween"} 이면 켜짐,
--   줄이 없거나 skin 이 비어 있으면 꺼짐. 어드민(서비스 롤)만 쓴다.
--   고객 화면은 site_settings 를 직접 못 읽는다(p42 에서 막았다 — 다른 설정까지 드러난다).
--   스킨 이름 하나만 내보내는 뷰를 연다.
--
-- ⚠️ limit 1 은 뷰를 '갱신 불가' 로 만들려는 것이다. 한 테이블짜리 단순 뷰는 자동으로
--    갱신 가능해서, 권한이 새면 뷰를 통해 site_settings 를 지울 수 있다.

create or replace view public.public_site_season as
select nullif(btrim(s.value->>'skin'), '') as skin
from public.site_settings s
where s.key = 'site.season'
limit 1;

comment on view public.public_site_season is
  '고객 화면에 씌울 시즌 스킨 이름(halloween 등). 0행이거나 null 이면 기본 화면.';

revoke all on public.public_site_season from anon, authenticated;
grant select on public.public_site_season to anon, authenticated;
