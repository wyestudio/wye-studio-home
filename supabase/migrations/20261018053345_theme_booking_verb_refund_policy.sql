-- 테마마다 '신청/예약' 동사와 환불 규정을 고른다
--
-- 적용: test 20261018054736 (적용 완료, 2026-10-18) / 운영 (미적용)
--
-- booking_verb
--   노말모드는 우리 팀만 방을 잡는 상품이라 화면의 '신청' 을 '예약' 으로 쓴다
--   (2026-10-18 대표님). 버튼·폼 제목·완료 화면이 이 값을 읽는다.
--   ⚠️ 두 값만 받는다. 화면이 '{verb}하기' · '{verb}을' 처럼 조사를 붙이므로
--      받침 없는 낱말이 들어오면 문장이 깨진다.
--
-- refund_policy
--   노말모드 환불 규정이 파티와 다르다 — 2일 전 취소도 50% 환불(2026-10-18).
--     standard  4일 전까지 100% / 3일 전 50% / 2일 전부터 불가
--     normal    4일 전까지 100% / 3~2일 전 50% / 1일 전부터 불가
--   ⚠️ 판정은 src/lib/refundPolicy.ts 한 곳에만 있다. 여기 값을 늘리면 거기도.
--   ⚠️ 잼핏 정산이 이 값으로 수수료 기준액을 다시 계산한다(settlement.ts).
--
-- ⚠️ 여러 번 돌려도 같은 결과여야 한다. 노말 행은 slug 로 찾는다.

alter table themes
  add column if not exists booking_verb text not null default '신청',
  add column if not exists refund_policy text not null default 'standard';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'themes_booking_verb_chk') then
    alter table themes add constraint themes_booking_verb_chk check (booking_verb in ('신청', '예약'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'themes_refund_policy_chk') then
    alter table themes add constraint themes_refund_policy_chk check (refund_policy in ('standard', 'normal'));
  end if;
end $$;

comment on column themes.booking_verb is '화면 동사. 신청 | 예약 (노말모드).';
comment on column themes.refund_policy is '환불 규정. standard | normal — 판정은 src/lib/refundPolicy.ts.';

update themes
   set booking_verb = '예약', refund_policy = 'normal'
 where slug = 'baotalchul-normal'
   and (booking_verb is distinct from '예약' or refund_policy is distinct from 'normal');

-- 문자 템플릿의 환불 규정 문장을 자리표시자로 바꾼다.
--   {{refund_policy}}   규정 3줄 (smsV2.ts baseVars — refundPolicySms())
--   {{no_refund_from}}  '2일 전' / '1일 전'
-- ⚠️ 문장이 정확히 같을 때만 바뀐다(replace). 어드민에서 이미 고친 템플릿은 그대로
--    남으니, 적용 뒤 아래 확인 쿼리로 남은 문장이 없는지 본다:
--      select key from sms_templates where body like '%행사일 2일 전 00:00 이후%' or body like '%2일 전부터는 환불%';
update sms_templates
   set body = replace(body,
         '· 행사일 4일 전 23:59까지 취소: 전액 환불' || chr(10) ||
         '· 행사일 3일 전 23:59까지 취소: 50% 환불' || chr(10) ||
         '· 행사일 2일 전 00:00 이후 취소: 환불 불가',
         '{{refund_policy}}'),
       updated_at = now()
 where key like '%\_v2' escape '\'
   and body like '%행사일 2일 전 00:00 이후 취소: 환불 불가%';

update sms_templates
   set body = replace(body, '(취소 시 진행일 2일 전부터는 환불이 불가합니다)', '(취소 시 진행일 {{no_refund_from}}부터는 환불이 불가합니다)'),
       updated_at = now()
 where key like '%\_v2' escape '\'
   and body like '%(취소 시 진행일 2일 전부터는 환불이 불가합니다)%';
