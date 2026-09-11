-- Phase 2 (Migrate) — 옛 회차·신청을 테마 구조에 연결한다.
--
-- 적용: test 적용·검증 완료 (2026-09-10) / ⚠️ 운영 미적용
--       운영은 사용자가 "올리자" 고 할 때 한 번에 반영한다.
--
-- 되돌리기:
--   update sessions set theme_id=null, min_age=null, venue_id_override=null
--     where slug in ('0829-meeting','0829-dating');
--   update applications set headcount=null, unit_price_krw=null,
--          amount_krw=null, depositor_name_hash=null
--     where session_id in (select id from sessions where slug like '0829-%');
--   delete from venues where name='뮤트스페이스 신림점';
--
-- ⚠️ 함정: 대상을 legacy_slug 로 고르면 안 된다. 그 컬럼은 전부 null 이라
--    0건 매칭으로 "성공" 하고 아무것도 바꾸지 않는다. 옛 회차의 식별자는 slug 다.
--    (test 에서 실제로 이렇게 한 번 헛돌았다)
--
-- 기존 값을 덮어쓰지 않는다. 비어 있는 칸만 채운다. 여러 번 실행해도 결과가 같다.
--
-- ── 장소가 회차마다 다른 경우 ──────────────────────────────────
-- 8/29 회차는 신림, 앞으로의 회차는 건대(어바웃모브)다. 테마는 하나다.
-- session_view 가 COALESCE(s.venue_id_override, t.venue_id) 로 풀기 때문에,
-- 테마 기본 장소를 건대로 두고 옛 회차 2건만 override 하면 된다.

insert into venues (name, address, area_label, parking_note)
select '뮤트스페이스 신림점', '서울 신림역 인근 (뮤트스페이스 신림점)', '서울 신림역 인근', null
where not exists (select 1 from venues where name = '뮤트스페이스 신림점');

-- min_age 는 18시 기준 자동 계산에 맡긴다 — 13시→만16, 19시→만19.
update sessions s
set theme_id = (select id from themes where slug = 'baotalchul'),
    min_age  = coalesce(s.min_age, default_min_age(s.start_at, null)),
    venue_id_override = coalesce(
      s.venue_id_override,
      (select id from venues where name = '뮤트스페이스 신림점')
    ),
    updated_at = now()
where s.theme_id is null
  and s.slug in ('0829-meeting', '0829-dating');

-- 인원·단가·금액. 당시에는 '참여자 행 수 × 회차 가격' 으로 매번 역산했다.
-- 그 값을 그대로 저장만 하는 것이라 화면에 보이던 금액이 달라지지 않는다.
update applications a
set headcount      = coalesce(a.headcount,
                       (select count(*)::int from application_attendees aa
                         where aa.application_id = a.id)),
    unit_price_krw = coalesce(a.unit_price_krw, s.price_krw),
    amount_krw     = coalesce(a.amount_krw,
                       s.price_krw * (select count(*)::int from application_attendees aa
                                       where aa.application_id = a.id)),
    updated_at     = now()
from sessions s
where s.id = a.session_id
  and s.slug in ('0829-meeting', '0829-dating')
  and (a.headcount is null or a.unit_price_krw is null or a.amount_krw is null)
  and exists (select 1 from application_attendees aa where aa.application_id = a.id);

-- 입금자명 대조용 해시. 입금 자동 매칭(Phase 5)이 이 값을 쓴다.
-- normalize_depositor_name 은 공백·괄호 안 내용을 제거한다 ('이그룹(카카오)' → '이그룹').
update applications a
set depositor_name_hash = hash_phone(normalize_depositor_name(decrypt_pii(a.depositor_name_enc))),
    updated_at = now()
from sessions s
where s.id = a.session_id
  and s.slug in ('0829-meeting', '0829-dating')
  and a.depositor_name_hash is null
  and a.depositor_name_enc is not null;
