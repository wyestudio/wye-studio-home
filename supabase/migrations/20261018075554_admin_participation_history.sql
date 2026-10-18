-- 참여자별 '몇 번째 참여인가' — 운영자 전용 (슬랙 새 예약 알림 · 어드민 회차 화면)
--
-- 적용: test 20261018075658 (적용 완료, 2026-10-18 · 템플릿 갱신 update 는 같은 날 따로 실행) / 운영 적용 (2026-10-18, 이력 기록함)
--
-- 왜
--   노말모드는 재참여 제한이 없다(20261008063709). 운영자는 예약이 들어올 때 이 사람이
--   처음인지, 몇 번째인지 알고 싶다(2026-10-18 대표님). 고객에게는 보이면 안 된다.
--
-- 세는 기준
--   같은 휴대폰(phone_hash)이 **같은 테마 묶음**(variant_group — 파티·노말을 함께 센다.
--   묶음이 없는 테마는 그 테마만)에서, 이 신청보다 **먼저 접수된**, 취소되지 않은 신청에
--   참여자로 들어 있는 횟수. 먼저 접수된 것만 세므로 나중에 예약이 늘어도 '몇 번째' 는
--   바뀌지 않는다. 아직 진행 전인 예약도 센다(취소만 뺀다).
--   prior_labels 는 그 이전 참여들의 모드 이름(파티모드/노말모드)이다 — 화면이 모드별로 센다.
--
-- ⚠️ 권한은 service_role 에만 준다. anon/authenticated 에서 부를 수 있으면 남의 번호로
--    참여 이력을 떠볼 수 있다. 화면은 서버(어드민 · 신청 처리 후 알림)에서만 부른다.
-- ⚠️ 휴대폰 평문(decrypt)을 돌려준다 — 슬랙 알림이 참여자를 번호로 짝짓는다. 그래서 더더욱
--    service_role 전용이다.
-- ⚠️ 여러 번 돌려도 같다(create or replace).

create or replace function public.admin_participation_history(p_application_ids uuid[])
returns table (
  attendee_id uuid,
  application_id uuid,
  phone text,
  prior_count integer,
  prior_labels text[]
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  with me as (
    select aa.id as attendee_id,
           aa.application_id,
           aa.phone_hash,
           decrypt_pii(aa.phone_enc) as phone,
           ap.created_at,
           coalesce(t.variant_group, t.id::text) as grp
      from application_attendees aa
      join applications ap on ap.id = aa.application_id
      join sessions s      on s.id = ap.session_id
      join themes t        on t.id = s.theme_id
     where aa.application_id = any(p_application_ids)
  )
  select me.attendee_id,
         me.application_id,
         me.phone,
         count(prev.app_id)::int as prior_count,
         coalesce(array_agg(prev.label order by prev.created_at) filter (where prev.app_id is not null), '{}') as prior_labels
    from me
    left join lateral (
      select ap2.id as app_id,
             ap2.created_at,
             coalesce(t2.variant_label, t2.name) as label
        from application_attendees aa2
        join applications ap2 on ap2.id = aa2.application_id
        join sessions s2      on s2.id = ap2.session_id
        join themes t2        on t2.id = s2.theme_id
       where aa2.phone_hash = me.phone_hash
         and ap2.id <> me.application_id
         and ap2.status <> 'cancelled'
         and ap2.created_at < me.created_at
         and coalesce(t2.variant_group, t2.id::text) = me.grp
    ) prev on true
   group by me.attendee_id, me.application_id, me.phone;
$function$;

revoke all on function public.admin_participation_history(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_participation_history(uuid[]) to service_role;

comment on function public.admin_participation_history(uuid[]) is
  '참여자별 같은 테마 묶음 이전 참여 횟수(운영자 전용, service_role). 슬랙 새 예약 알림·어드민 회차 화면.';

-- 노말 새 예약 슬랙 알림(application_new_solo)에 참여자별 '몇 번째' 를 붙인다.
-- {{visit}} 은 slackV2.ts attendeeRow 가 채운다('첫 참여' / '재참여 3번째 (노말 2)').
-- ⚠️ 줄이 원래 문장 그대로일 때만 바뀐다 — 어드민에서 고친 본문은 그대로 둔다.
update public.slack_templates
   set body = replace(body, '{{index}}. {{role}} {{name}} · {{phone}}' || chr(10), '{{index}}. {{role}} {{name}} · {{phone}} · {{visit}}' || chr(10)),
       placeholders = case when 'visit' = any(placeholders) then placeholders else placeholders || 'visit'::text end,
       updated_at = now()
 where key = 'application_new_solo'
   and body like '%{{index}}. {{role}} {{name}} · {{phone}}' || chr(10) || '%';
