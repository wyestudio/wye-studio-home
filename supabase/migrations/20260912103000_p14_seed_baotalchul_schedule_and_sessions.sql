-- 바-ㅇ탈출 정기 편성 + 회차 생성 (운영 최초 1회)
--
-- 적용: 운영 적용 완료 (2026-09-12) / test 는 어드민 '편성 저장'으로 이미 같은 상태
--
-- 어드민 '편성 저장'(src/app/(site)/admin/sessions/actions.ts 의 saveSchedule)이
-- 하는 일을 SQL 로 그대로 옮긴 것이다. 코드 배포 **전에** 회차가 있어야
-- 사이트가 빈 화면으로 뜨지 않는다. 다음부터는 어드민에서 저장하면 된다.
--
-- 규칙 (test 의 theme_schedules 와 동일):
--   시작일 2026-09-26(토) · 매주 토·일 · 11:30/15:30/19:30 · 회차당 180분
--   공개: 회차일 정확히 3주(21일) 전 00:00 KST (요일 고정 안 함 = open_weekday null)
--   생성 지평: 오늘 + 26주 (saveSchedule 의 HORIZON_WEEKS)
--
-- min_age 는 src/types/catalog.ts 의 defaultMinAge() 와 같은 식이다 —
--   종료 시각이 22:00 전이면 16, 그 이후면 19 (min_age_floor 는 null).
--   → 11:30·15:30 = 만 16세, 19:30 = 만 19세
--
-- 적용 결과 (2026-09-12 기준): 회차 147개 / 49일 / 2026-09-26 ~ 2027-03-13.
--   즉시 공개 9개(9/26·9/27·10/3), 10/4 는 9/13 00:00 에 열린다.
--
-- 되돌리기:
--   delete from sessions where theme_id = (select id from themes where slug='baotalchul')
--     and start_at >= '2026-09-26'
--     and not exists (select 1 from applications a where a.session_id = sessions.id);
--   delete from theme_schedules where theme_id = (select id from themes where slug='baotalchul');

with params as (
  select (select id from themes where slug = 'baotalchul')   as theme_id,
         date '2026-09-26'                                   as start_date,
         (timezone('Asia/Seoul', now()))::date               as today_kst,
         (timezone('Asia/Seoul', now()))::date + 182         as until_date,
         array[6,0]::smallint[]                              as weekdays,
         array['11:30','15:30','19:30']::text[]              as times,
         3::smallint                                         as open_weeks_before,
         180                                                 as duration_minutes
),
days as (
  select g.d::date as d
  from params p, generate_series(greatest(p.start_date, p.today_kst), p.until_date, interval '1 day') g(d)
  where extract(dow from g.d)::int = any (p.weekdays::int[])
),
planned as (
  select p.theme_id,
         ((d.d + t.t::time) at time zone 'Asia/Seoul')                                as start_at,
         ((d.d + t.t::time) at time zone 'Asia/Seoul') + (p.duration_minutes || ' minutes')::interval as end_at,
         case when (extract(hour from t.t::time) * 60 + extract(minute from t.t::time)
                    + p.duration_minutes) < 22 * 60
              then 16 else 19 end                                                     as min_age,
         (((d.d - 7 * p.open_weeks_before) + time '00:00') at time zone 'Asia/Seoul')  as opens_at
  from days d, params p, unnest(p.times) as t(t)
)
insert into public.sessions (theme_id, start_at, end_at, status, min_age, opens_at)
select pl.theme_id, pl.start_at, pl.end_at, 'open', pl.min_age, pl.opens_at
from planned pl
-- 이미 있는 회차는 건드리지 않는다. 신청이 붙어 있을 수 있다.
where not exists (
  select 1 from public.sessions s
  where s.theme_id = pl.theme_id and s.start_at = pl.start_at
);

insert into public.theme_schedules
  (theme_id, start_date, end_date, weekdays, times, open_weeks_before, open_weekday, open_time, generated_until)
select p.theme_id, p.start_date, null, p.weekdays, p.times, p.open_weeks_before, null, time '00:00', p.until_date
from (
  select (select id from themes where slug = 'baotalchul')  as theme_id,
         date '2026-09-26'                                  as start_date,
         (timezone('Asia/Seoul', now()))::date + 182        as until_date,
         array[6,0]::smallint[]                             as weekdays,
         array['11:30','15:30','19:30']::text[]             as times,
         3::smallint                                        as open_weeks_before
) p
on conflict (theme_id) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    weekdays = excluded.weekdays,
    times = excluded.times,
    open_weeks_before = excluded.open_weeks_before,
    open_weekday = excluded.open_weekday,
    open_time = excluded.open_time,
    generated_until = excluded.generated_until,
    updated_at = now();
