-- 파티모드 회차에서 「단체 막기」 를 켜면 그 회차 시간으로 단체 마감을 건다(2026-10-30 대표님).
-- 파티는 신청이 있어도 인원 미달로 닫힐 수 있어 단체를 자동으로 막지 않는다 — 회차가 확정되면
-- 운영자가 켠다. 켜고 끄는 대상을 찾으려고 어느 회차에서 걸었는지 잇는다.
--
-- session_id: 이 마감을 건 회차. 회차가 지워지면 마감도 같이 지운다(그 시간을 막을 이유가 없어진다).

alter table public.group_booking_closures
  add column if not exists session_id uuid references public.sessions(id) on delete cascade;

create unique index if not exists group_booking_closures_session_idx
  on public.group_booking_closures (session_id) where session_id is not null;

comment on column public.group_booking_closures.session_id is
  '이 마감을 건 파티모드 회차(단체 막기). 직접 막은 마감 · 예약 확정 마감은 null.';
