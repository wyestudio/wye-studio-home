-- Phase 8 — 테마 상세의 장소 노출 + 장소안내 문자를 이틀 전으로
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기:
--   drop view if exists theme_public_venue;
--   (문구는 어드민 > 문자 템플릿에서 되돌릴 수 있다)
--
-- 1) theme_public_venue
--    테마 상세에서 장소를 보여주기로 했는데, venues 에는 상호명과 정확 주소가
--    같이 들어 있어 anon 에 grant 를 줄 수 없다. 공개해도 되는 칸만 추린 뷰를
--    따로 두고 여기에만 읽기 권한을 준다.
--
--    ⚠️ security_invoker 를 켜면 뷰가 호출자 권한으로 돌아 venues 에서 막힌다.
--       기본값(소유자 권한) 그대로 둬야 한다. session_display 와 같은 방식이다.
--
-- 2) 문자3(장소안내) 를 전날 → 이틀 전 발송으로 바꾸면서 문구도 맞춘다.
--    크론의 조회 구간(48시간)은 코드에서 같이 바뀐다.

create or replace view theme_public_venue as
select
  t.id          as theme_id,
  v.area_label,
  v.parking_note,
  v.map_url
from themes t
join venues v on v.id = t.venue_id;

comment on view theme_public_venue is
  '테마 상세에 노출해도 되는 장소 정보만 추린 뷰. 상호명(name)과 정확 주소(address)는 포함하지 않는다.';

grant select on theme_public_venue to anon, authenticated, service_role;

update sms_templates
set body = replace(
      replace(body, '참여 하루 전 안내입니다.', '참여 이틀 전 안내입니다.'),
      '내일 진행되는 테마 안내드립니다.', '이틀 뒤 진행되는 테마 안내드립니다.'
    )
where key = 'event_reminder_v2';

update sms_templates
set body = replace(body, '정확한 장소는 전날 안내 문자로 다시 보내드립니다.',
                         '정확한 장소는 진행 이틀 전 안내 문자로 보내드립니다.')
where key = 'payment_confirmed_v2';
