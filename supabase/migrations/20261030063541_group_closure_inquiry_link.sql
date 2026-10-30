-- 견적 신청 건을 '예약 확정' 으로 바꾸면 확정 일시로 마감을 자동으로 만든다(2026-10-30 대표님).
-- 확정 일시는 희망 일시와 다를 수 있다(15:30 으로 신청 → 13:30 으로 안내해 확정) — 그래서 신청 건이
-- 아니라 마감 쪽에 확정 일시를 두고, 어느 신청 건에서 왔는지만 잇는다.
--
-- inquiry_id: 이 마감을 만든 견적 신청 건. 직접 막은 마감은 null. 신청 건 하나에 마감 하나.
-- 날짜·시작 시각 유니크는 지운다 — 구간 마감에서는 같은 시각에 시작하는 마감이 둘일 수 있다
-- (직접 막아 둔 15:30 과 15:30 으로 확정된 단체).

alter table public.group_booking_closures
  add column if not exists inquiry_id uuid references public.group_booking_inquiries(id) on delete set null;

create unique index if not exists group_booking_closures_inquiry_idx
  on public.group_booking_closures (inquiry_id) where inquiry_id is not null;

drop index if exists public.group_booking_closures_slot_idx;

grant update on public.group_booking_closures to service_role;

comment on column public.group_booking_closures.inquiry_id is
  '이 마감을 만든 견적 신청 건(예약 확정). 어드민에서 직접 막은 마감은 null.';
