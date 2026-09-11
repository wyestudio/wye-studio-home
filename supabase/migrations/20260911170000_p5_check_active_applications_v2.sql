-- 같은 테마 중복 신청 사전 확인 (신 구조)
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기: drop function if exists public.check_active_applications_v2(text[], uuid);
--
-- 기존 check_active_applications() 는 sessions.content_group 으로 비교한다.
-- 테마 구조로 넘어오며 새로 만드는 회차는 content_group 이 비어 있어(null),
-- null = null 이 성립하지 않아 **아무 중복도 못 잡는다**. 화면에서 미리 걸러주지
-- 못하고 제출 후 DB 에서야 거부당한다.
--
-- 판정 기준을 submit_application_v2() 와 같은 theme_id 로 맞춘다.
-- ⚠️ 이건 화면용 사전 확인일 뿐이다. 최종 판정은 언제나 submit_application_v2()
--    안에서 행을 잠그고 한다 — 동시 요청은 여기서 막을 수 없다.

create or replace function public.check_active_applications_v2(
  p_phones text[],
  p_session_id uuid
) returns text[]
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select coalesce(array_agg(distinct phone), array[]::text[])
  from unnest(p_phones) as phone
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(phone)
      and s.theme_id is not null
      and s.theme_id = (select theme_id from sessions where id = p_session_id)
  );
$$;

comment on function public.check_active_applications_v2(text[], uuid) is
  '같은 테마에 이미 신청한 전화번호를 돌려준다. 화면 사전 확인용 — 최종 판정은 submit_application_v2().';

revoke execute on function public.check_active_applications_v2(text[], uuid) from public;
grant execute on function public.check_active_applications_v2(text[], uuid) to anon, authenticated, service_role;
