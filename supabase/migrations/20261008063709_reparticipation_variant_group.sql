-- 재참여 판정을 테마 단위에서 **모드 묶음(variant_group) 단위**로
--
-- 적용: test 20261008063709 (적용 완료, 2026-10-08) / 운영 (미적용)
--   변경 전 md5  2인자 f4f20ee61142a84c799ecb916976d33e
--                3인자 b94bd386b3001b777189d80344499710
--   2인자 래퍼는 **건드리지 않는다**(3인자를 그대로 부르기만 한다).
--
-- 왜
--   바-ㅇ탈출이 파티모드·노말모드 두 테마 행으로 나뉜다. 규칙은
--     파티 → 파티 ❌   노말 → 파티 ❌   파티 → 노말 ✅   노말 → 노말 ✅
--   즉 **파티는 묶음을 한 번도 안 해본 사람만**, 노말은 제한 없음이다.
--   테마 단위로 세면 "노말 해본 사람이 파티 신청" 을 못 걸러낸다.
--
--   노말이 무제한인 이유 — 재참여를 막은 건 **팀 대항의 형평성** 때문이었다
--   (D-02). 노말모드는 한 회차에 단일 팀만 진행해 겨룰 상대가 없으므로
--   그 근거가 성립하지 않는다 (2026-10-08 결정).
--
-- ⚠️ **시그니처를 바꾸지 않는다.** 부르는 쪽이 세 군데인데
--      submit_application_v3 · check_active_applications_v2 · admin_update_application
--    전부 (phone, theme_id[, exclude]) 로 부른다. 본문만 바꾸면 그 셋은 한 줄도
--    안 건드려도 된다 — 금액을 계산하는 submit_application_v3 를 피해 가는 게
--    이 설계의 핵심이다.
--
-- ⚠️ 사람별 예외(reparticipation_allowances)는 **신청하려는 테마의 id** 로 찾는다.
--    종전과 같다. 예외가 없으면 그 테마의 reparticipation_limit 이 기준이 된다.
--
-- 되돌리려면 — 아래 블록을 지우고 종전 정의를 그대로 넣으면 md5 가
--   b94bd386b3001b777189d80344499710 으로 돌아온다.

create or replace function public.is_theme_participation_blocked(
  p_phone text,
  p_theme_id uuid,
  p_exclude_application_id uuid
)
returns boolean
language sql
stable security definer
set search_path to 'public', 'extensions'
as $function$
  with target as (
    select t.id, t.variant_group, t.reparticipation_limit
      from themes t
     where t.id = p_theme_id
  )
  select p_theme_id is not null
     -- 한도가 비어 있으면(노말모드) 절대 막지 않는다.
     and (select reparticipation_limit from target) is not null
     and (
       select count(*)
         from application_attendees aa
         join applications ap on ap.id = aa.application_id
         join sessions s      on s.id = ap.session_id
         join themes st       on st.id = s.theme_id
        where ap.status <> 'cancelled'
          and aa.phone_hash = hash_phone(p_phone)
          and (
            -- 같은 테마이거나,
            st.id = p_theme_id
            -- 같은 묶음의 다른 모드이거나.
            or (
              (select variant_group from target) is not null
              and st.variant_group = (select variant_group from target)
            )
          )
          and (p_exclude_application_id is null or ap.id <> p_exclude_application_id)
     ) >= coalesce(
       (select r.max_participations
          from reparticipation_allowances r
         where r.phone_hash = hash_phone(p_phone)
           and r.theme_id = p_theme_id),
       (select reparticipation_limit from target)
     );
$function$;
