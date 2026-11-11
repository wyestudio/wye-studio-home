-- 어드민에서 단체 예약 문의의 인원 · 모임 이름 · 담당자 이름 · 구성(options)을 고친다(2026-11-11 대표님).
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 새 코드(group-bookings/actions.ts 의 saveInquiryInfo)가 이 함수를 부른다.
--
-- 담당자 이름은 encrypt_pii() 로만 넣는다 — 그 함수는 service_role 에 열려 있지 않아서
-- 어드민 서버가 표를 직접 update 할 수 없다. 그래서 이 함수가 대신 암호화해 넣는다.
-- 예상 금액(unit_price · estimate_total)은 고치지 않는다 — 접수 시점에 서버가 계산한 기록이다.
-- p_options 가 null 이면 구성은 그대로 둔다(구성 없이 받은 v1 접수분을 기본 구성으로 바꾸지 않게).

create or replace function public.admin_update_group_booking_inquiry(
  p_id uuid,
  p_headcount integer,
  p_group_name text,
  p_organizer_name text,
  p_options jsonb default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_headcount is null or p_headcount < 2 or p_headcount > 200 then
    raise exception '인원은 2~200명 사이로 넣어주세요.';
  end if;
  if p_organizer_name is null or length(trim(p_organizer_name)) = 0 then
    raise exception '담당자 이름을 넣어주세요.';
  end if;
  if p_options is not null and (
       jsonb_typeof(p_options->'icebreaking') is distinct from 'boolean'
    or jsonb_typeof(p_options->'character') is distinct from 'boolean'
    or jsonb_typeof(p_options->'cleanup') is distinct from 'boolean'
    or jsonb_typeof(p_options->'after_party_hours') is distinct from 'number'
    or (p_options->>'after_party_hours')::numeric not in (0, 1, 2, 3, 4)
  ) then
    raise exception '구성을 확인해주세요.';
  end if;

  update public.group_booking_inquiries
     set headcount = p_headcount,
         group_name = nullif(trim(coalesce(p_group_name, '')), ''),
         organizer_name_enc = public.encrypt_pii(trim(p_organizer_name)),
         options = coalesce(p_options, options),
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.admin_update_group_booking_inquiry(uuid, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_group_booking_inquiry(uuid, integer, text, text, jsonb) to service_role;
