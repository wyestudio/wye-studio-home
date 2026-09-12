-- Phase 10 — 이용약관 v1.2 반영 + 쿠폰 문자 한 통으로 통합
--
-- 적용: test 20260912064240 (적용 완료) / 운영 (미적용)
-- 되돌리기:
--   (문구는 어드민 > 문자 템플릿에서 되돌릴 수 있다)
--   delete from sms_templates where key = 'coupon_preopen';
--   -- coupon_self / coupon_friend 본문은 이 파일 아래 주석에 남겨 둔다.
--
-- 1) 환불 문구를 약관 제8조 제1항과 **같은 문장**으로 맞춘다.
--    v1.2 에서 "4일 전까지" 가 "행사일 4일 전 23:59까지" 로 시각까지 명시됐다.
--    판정 로직(src/lib/refundPolicy.ts)은 원래부터 이 경계와 같아 바뀌지 않는다.
--
-- 2) 쿠폰 문자를 coupon_self / coupon_friend 두 통에서 coupon_preopen 한 통으로.
--    받는 쪽에서 두 문자가 무슨 관계인지 알기 어려웠다.
--
--    ⚠️ 옛 본문 백업 (되돌릴 때 쓸 것)
--    coupon_self:
--      [우주이스케이프] {{name}}님, 프리오픈 참여 감사드립니다.
--      감사의 마음을 담아 {{discount}} 할인 쿠폰을 보내드립니다.
--      · 쿠폰번호: {{code}}  · 사용기한: {{expires_at}}까지
--      ※ 이미 참여하신 테마에는 사용할 수 없어요. …  {{link}}
--    coupon_friend:
--      [우주이스케이프] 방탈출 {{discount}} 할인 쿠폰이에요.
--      이 문자를 그대로 지인에게 전달하시면 됩니다.
--      · 쿠폰번호: {{code}}  · 사용기한: {{expires_at}}까지  …  {{link}}

update sms_templates
set body = replace(
      replace(
        replace(body,
          '· 4일 전까지 취소: 전액 환불', '· 행사일 4일 전 23:59까지 취소: 전액 환불'),
        '· 3일 전 취소: 50% 환불', '· 행사일 3일 전 23:59까지 취소: 50% 환불'),
      '· 2일 전부터: 환불 불가', '· 행사일 2일 전 00:00 이후 취소: 환불 불가'
    )
where body like '%4일 전까지 취소%';

insert into sms_templates (key, label, body, placeholders)
values (
  'coupon_preopen',
  '쿠폰 · 프리오픈 참가 혜택',
  E'[우주이스케이프] 프리오픈 참가 혜택 안내\n\n프리오픈에 참여해 주셔서 감사합니다.\n사전 안내드린 프리오픈 참가 혜택 쿠폰을 전달드립니다.\n\n① 참가자 혜택 쿠폰 | {{self_discount}} 할인\n쿠폰번호: {{self_code}}\n· 본인은 새로운 테마 출시 후 사용 가능합니다.\n· 사용하지 않는 경우 지인에게 양도할 수 있습니다.\n· 유효기간: {{self_expires_at}}까지\n\n② 지인 혜택 쿠폰 | {{friend_discount}} 할인\n쿠폰번호: {{friend_code}}\n· 지인에게 전달하여 사용할 수 있습니다.\n· 유효기간: {{friend_expires_at}}까지\n\n정식 오픈일은 9월 26일이며, 쿠폰은 9월 12일부터 사용 가능합니다.\n※ 두 쿠폰은 한 예약에 중복 사용할 수 없습니다.\n※ 프리오픈 참가자는 참여한 테마에 재참여할 수 없습니다.',
  array['self_discount','self_code','self_expires_at','friend_discount','friend_code','friend_expires_at','name','self_link','friend_link']
)
on conflict (key) do update
set label = excluded.label,
    body = excluded.body,
    placeholders = excluded.placeholders,
    updated_at = now();

-- 두 통짜리 옛 문구는 목록에서 치운다. 발송 화면의 '문자 문구' 선택지가
-- 셋으로 늘면 잘못 고를 수 있다.
delete from sms_templates where key in ('coupon_self', 'coupon_friend');
