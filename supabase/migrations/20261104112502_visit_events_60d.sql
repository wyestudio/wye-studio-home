-- 방문 기록(visit_events) 보관 기간을 90일 → 60일로 줄인다(2026-11-04 대표님).
-- 화면별 체류 · 스크롤 · 입력칸 기록이 더해져 방문당 기록이 약 1/3 늘었다. 무료 요금제 DB 500MB 에
-- 여유를 두려고 줄인다. 지우는 방식은 그대로 — track_events 가 가끔(1%) 5,000건씩 지운다.
-- 바뀐 곳은 아래 interval '60 days' 한 곳뿐이다(운영 정의를 받아 그 줄만 고쳤다).
-- 개인정보처리방침 제9조(src/app/(site)/privacy/page.tsx)의 보관 기간과 같아야 한다.
--
-- 되돌리기: 아래 '60 days' 를 '90 days' 로 바꿔 다시 실행한다.

CREATE OR REPLACE FUNCTION public.track_events(p_visitor uuid, p_visit uuid, p_internal boolean, p_events jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_visitor is null or p_visit is null or jsonb_typeof(p_events) <> 'array' then
    return;
  end if;
  if (select count(*) from visit_events where visitor_id = p_visitor and at > now() - interval '1 day') > 3000 then
    return;
  end if;

  insert into visit_events (visitor_id, visit_id, at, kind, name, path, meta, internal)
  select p_visitor, p_visit,
         now() - make_interval(secs => least(greatest(coalesce((e ->> 'ago')::numeric, 0), 0), 600000) / 1000),
         e ->> 'kind',
         left(e ->> 'name', 80),
         left(e ->> 'path', 200),
         case when jsonb_typeof(e -> 'meta') = 'object' and pg_column_size(e -> 'meta') <= 1000 then e -> 'meta' end,
         coalesce(p_internal, false)
  from (select value as e from jsonb_array_elements(p_events) limit 50) x
  where e ->> 'kind' in ('page', 'click', 'event')
    and coalesce(e ->> 'name', '') <> ''
    and (e ->> 'ago') ~ '^[0-9]+(\.[0-9]+)?$';

  if random() < 0.01 then
    delete from visit_events
    where id in (select id from visit_events where at < now() - interval '60 days' order by at limit 5000);
  end if;
end;
$function$;
