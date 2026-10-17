-- 2026-10-31(토) 바-ㅇ탈출 할로윈 특별 회차
--
-- 평소 편성은 토·일 11:30 / 15:30 / 19:30 세 회차다. 할로윈만 오후 2시 ·
-- 저녁 7시 두 회차로 운영한다.
--   11:30 → 삭제 (신청 0건인 것을 확인한 뒤에만 지운다)
--   15:30 → 14:00 (~17:00)
--   19:30 → 19:00 (~22:00)
--
-- min_age 는 그대로 둔다 — defaultMinAge 규칙(종료 22시 전이면 16, 아니면 19)으로
-- 다시 계산해도 14:00→16, 19:00→19 로 지금 값과 같다.
--
-- ⚠️ 어드민 '회차 편성' 에서 **10/31 이전에** 다시 저장하면, 편성 규칙(토·일
--    11:30/15:30/19:30)에 10/31 이 다시 걸려 지운 11:30 회차가 되살아나고
--    15:30·19:30 도 새로 끼어든다. 10/31 이 지난 뒤에는 과거 날짜를 만들지 않으므로
--    안전하다. generated_until 이 2027-03-13 이라 그 전에 다시 저장할 일은 없다.

begin;

-- 11:30 회차 삭제. 신청이 붙어 있으면 지우지 않는다(where 절이 0건을 보장).
delete from sessions s
 where s.id in (
   select s2.id from sessions s2
     join themes t on t.id = s2.theme_id
    where t.slug = 'baotalchul'
      and s2.start_at = timestamptz '2026-10-31 11:30+09'
      and not exists (select 1 from applications a where a.session_id = s2.id)
 );

-- 15:30 → 14:00
update sessions s
   set start_at = timestamptz '2026-10-31 14:00+09',
       end_at   = timestamptz '2026-10-31 17:00+09',
       updated_at = now()
 where s.theme_id = (select id from themes where slug = 'baotalchul')
   and s.start_at = timestamptz '2026-10-31 15:30+09';

-- 19:30 → 19:00
update sessions s
   set start_at = timestamptz '2026-10-31 19:00+09',
       end_at   = timestamptz '2026-10-31 22:00+09',
       updated_at = now()
 where s.theme_id = (select id from themes where slug = 'baotalchul')
   and s.start_at = timestamptz '2026-10-31 19:30+09';

commit;
