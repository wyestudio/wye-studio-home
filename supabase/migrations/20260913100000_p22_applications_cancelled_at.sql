-- 취소 시각을 남긴다
--
-- 적용: test · 운영 (2026-09-13)
-- 되돌리기:
--   drop trigger if exists applications_set_cancelled_at on applications;
--   drop function if exists set_cancelled_at();
--   alter table public.applications drop column if exists cancelled_at;
--
-- 참여내역 조회 화면에 '취소일' 을 보여주려는데 언제 취소됐는지를 남기지 않고
-- 있었다. updated_at 은 어떤 수정에도 바뀌어서 취소 시각으로 쓸 수 없다.
--
-- ⚠️ 환불 금액 계산에도 필요하다. 환불 비율은 '행사일까지 며칠 남았나' 로
--    정해지는데(4일 전 100% / 3일 전 50% / 2일 전부터 0%), 기준 시점은
--    **취소한 순간**이어야 한다. 지금 시각으로 계산하면 행사가 지난 뒤에
--    조회했을 때 "환불 0원" 으로 보인다 — 이미 환불받았는데도.
--
-- ⚠️ 취소 경로가 다섯 군데라 트리거로 둔다(p21 쿠폰 반환과 같은 판단).
--    status 가 'cancelled' 로 **바뀌는 순간**만 찍는다.
--
-- ⚠️ 과거 취소 건은 채우지 않는다(null). updated_at 은 오늘 이관 작업으로
--    전부 갱신돼 있어 취소 시각의 근거가 될 수 없다. 추측해서 채우면
--    "언제 취소됐는지" 를 잘못 알려주게 된다. 화면에서는 '-' 로 나온다.

alter table public.applications
  add column if not exists cancelled_at timestamptz;

comment on column public.applications.cancelled_at is
  '신청이 취소된 시각. 환불 비율 계산의 기준 시점이기도 하다. 2026-09-13 이전 취소 건은 null.';

create or replace function public.set_cancelled_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    new.cancelled_at := now();
  end if;
  return new;
end;
$$;

comment on function public.set_cancelled_at() is
  '신청이 취소로 바뀌는 순간 cancelled_at 을 찍는다. 취소 경로가 여러 개라 트리거로 둔다.';

drop trigger if exists applications_set_cancelled_at on public.applications;
create trigger applications_set_cancelled_at
  before update of status on public.applications
  for each row execute function public.set_cancelled_at();
