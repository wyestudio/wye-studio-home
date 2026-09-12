-- Phase 8 — 테마 상세의 장소 노출 + 장소안내 문자를 이틀 전으로
--
-- 적용: test 20260912052852 (적용 완료) / 운영 (미적용)
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

-- 3) 테마 상세 '참가 전 꼭 확인해주세요' 의 옛 환불 문구 정정.
--    규정이 시간(48시간) 기준에서 날짜(4/3/2일) 기준으로 바뀌었는데 이 블록만
--    남아 있었다. 장소 안내 시점도 이틀 전으로 맞춘다.
--
--    ⚠️ blocks 배열의 인덱스로 찍지 않는다. 어드민에서 블록 순서를 바꾸면
--       엉뚱한 항목을 덮어쓴다. 문구 자체를 찾아 바꾼다.
update themes
set content = replace(
      replace(
        replace(content::text,
          '시작 48시간 이내 환불 불가',
          '진행일 2일 전부터 환불 불가'),
        '테마 시작 48시간 전 이후부터는 환불이 불가합니다. 추가로, 노쇼 및 지각 시 입금액은 환불드리지 않으며 추후 이용이 제한될 수 있습니다.',
        '진행일 4일 전까지는 전액, 3일 전에는 50% 환불되며, 2일 전부터는 환불이 불가합니다. 노쇼 및 지각 시에도 환불드리지 않으며 추후 이용이 제한될 수 있습니다.'),
      '정확한 참여 장소는 참여 확정 후 테마 시작 48시간 전에 문자로 안내드립니다.',
      '정확한 참여 장소는 참여 확정 후 진행 이틀 전에 문자로 안내드립니다.'
    )::jsonb
where content::text like '%시작 48시간%';

-- 4) 문자 템플릿 '이름' 도 같이 바꾼다 (본문만 고치고 label 을 빼먹었었다).
--    어드민 > 문자 포맷 관리 목록에 그대로 보이는 값이다.
update sms_templates
set label = replace(label, '전날안내', '장소안내'), updated_at = now()
where label like '%전날안내%';
