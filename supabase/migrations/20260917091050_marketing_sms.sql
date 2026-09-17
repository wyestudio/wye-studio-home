-- 광고 문자 발송 대상 조회 + 수신거부 목록
--
-- 적용: test (2026-09-17 적용·이력 기록) / 운영 (미적용)
-- 되돌리기:
--   drop function if exists marketing_sms_recipients();
--   drop function if exists add_marketing_optout(text, text);
--   drop function if exists remove_marketing_optout(text);
--   drop function if exists list_marketing_optouts();
--   drop table if exists marketing_sms_optouts;
--
-- 어드민 "광고 문자" 화면이 쓴다(src/app/(site)/admin/marketing-sms/).
-- 대상 = 이미 끝난 회차에 실제로 참여했고(확정+입금확인, 취소·환불 아님, 내부 테스트 아님)
--        본인이 마케팅 수신에 동의했으며, 수신거부 목록에 없는 사람.
--
-- ⚠️ 동의는 대표 신청자 본인이 체크한 것만 인정한다. 동행자 대리 동의 항목은
--    약관·개인정보·휴대폰 수거·촬영까지만 다루고 마케팅 수신은 포함하지 않는다.
--    광고성 정보는 수신자 본인의 동의가 필요하다(정보통신망법 제50조).
-- ⚠️ 동의 여부는 그 사람이 대표로 넣은 **가장 최근 신청**의 값을 따른다.
--    예전엔 동의했어도 최근 신청에서 체크를 풀었다면 철회로 본다.
-- ⚠️ 함수 권한을 명시한다 — 개인정보를 복호화해 돌려주므로 service_role 전용.

create table if not exists marketing_sms_optouts (
  phone_hash  text primary key,
  phone_enc   bytea not null,
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now()
);

alter table marketing_sms_optouts enable row level security;
revoke all on table marketing_sms_optouts from anon, authenticated;

comment on table marketing_sms_optouts is
  '광고 문자 수신거부 번호. 여기 있는 번호는 동의 여부와 관계없이 광고 문자 대상에서 빠진다.';

create or replace function public.marketing_sms_recipients()
returns table(
  phone_hash text,
  name text,
  phone text,
  participation_count integer,
  last_session_start timestamptz
)
language sql stable security definer set search_path to 'public', 'extensions'
as $function$
  with participations as (
    select aa.phone_hash, aa.name_enc, aa.phone_enc, s.start_at
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where ap.status = 'confirmed'
      and ap.payment_status = 'confirmed'
      and ap.cancelled_at is null
      and ap.refund_completed_at is null
      and not ap.is_internal
      and s.start_at < now()
  ),
  latest_consent as (
    select distinct on (aa.phone_hash) aa.phone_hash, ap.consent_marketing
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    where aa.is_representative
    order by aa.phone_hash, ap.created_at desc
  ),
  latest_participation as (
    select distinct on (p.phone_hash) p.phone_hash, p.name_enc, p.phone_enc, p.start_at
    from participations p
    order by p.phone_hash, p.start_at desc
  )
  select
    lp.phone_hash,
    decrypt_pii(lp.name_enc)  as name,
    decrypt_pii(lp.phone_enc) as phone,
    (select count(*)::int from participations p where p.phone_hash = lp.phone_hash) as participation_count,
    lp.start_at as last_session_start
  from latest_participation lp
  join latest_consent lc on lc.phone_hash = lp.phone_hash and lc.consent_marketing
  where not exists (select 1 from marketing_sms_optouts o where o.phone_hash = lp.phone_hash)
  order by lp.start_at desc, name;
$function$;

create or replace function public.add_marketing_optout(p_phone text, p_note text default null)
returns void
language sql security definer set search_path to 'public', 'extensions'
as $function$
  insert into marketing_sms_optouts (phone_hash, phone_enc, note)
  values (hash_phone(p_phone), encrypt_pii(regexp_replace(p_phone, '[^0-9]', '', 'g')), p_note)
  on conflict (phone_hash) do update set note = coalesce(excluded.note, marketing_sms_optouts.note);
$function$;

create or replace function public.remove_marketing_optout(p_phone_hash text)
returns void
language sql security definer set search_path to 'public', 'extensions'
as $function$
  delete from marketing_sms_optouts where phone_hash = p_phone_hash;
$function$;

create or replace function public.list_marketing_optouts()
returns table(phone_hash text, phone text, note text, created_at timestamptz)
language sql stable security definer set search_path to 'public', 'extensions'
as $function$
  select o.phone_hash, decrypt_pii(o.phone_enc), o.note, o.created_at
  from marketing_sms_optouts o
  order by o.created_at desc;
$function$;

revoke execute on function public.marketing_sms_recipients() from public, anon, authenticated;
revoke execute on function public.add_marketing_optout(text, text) from public, anon, authenticated;
revoke execute on function public.remove_marketing_optout(text) from public, anon, authenticated;
revoke execute on function public.list_marketing_optouts() from public, anon, authenticated;
grant execute on function public.marketing_sms_recipients() to service_role;
grant execute on function public.add_marketing_optout(text, text) to service_role;
grant execute on function public.remove_marketing_optout(text) to service_role;
grant execute on function public.list_marketing_optouts() to service_role;
