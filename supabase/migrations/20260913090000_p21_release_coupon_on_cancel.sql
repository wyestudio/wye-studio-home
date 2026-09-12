-- 신청을 취소하면 거기 쓰인 쿠폰을 다시 쓸 수 있게 되돌린다
--
-- 적용: test · 운영 (2026-09-13)
-- 되돌리기:
--   drop trigger if exists applications_release_coupon_on_cancel on applications;
--   drop function if exists release_coupon_on_cancel();
--
-- 쿠폰을 쓴 신청을 취소하고 같은 쿠폰으로 다시 신청하면 '이미 사용된 쿠폰이에요'
-- 로 막혔다. 쿠폰은 취소와 함께 풀려야 한다 — 고객은 혜택을 쓰지 못한 채
-- 쿠폰만 잃는다.
--
-- ⚠️ 왜 트리거인가
--    취소가 일어나는 곳이 다섯 군데다:
--      · cancel_application()            셀프 취소(/lookup)
--      · cancelApplicationAdmin          어드민 미입금취소(문자4)
--      · silentCancelApplicationAdmin    어드민 무통보 취소
--      · deactivateSession               회차 비활성화(문자7, 일괄)
--      · (회차 비활성화의 status-only update)
--    애플리케이션 코드에 하나씩 넣으면 언젠가 한 곳이 빠진다.
--    닉네임 반환(p12)과 같은 판단이다.
--
-- ⚠️ 이미 취소된 건을 또 update 해도 두 번 풀리지 않는다.
--    status 가 'cancelled' 로 **바뀌는 순간**만 본다(old.status <> 'cancelled').

create or replace function public.release_coupon_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'cancelled'
     and coalesce(old.status, '') <> 'cancelled'
     and new.coupon_id is not null then
    update coupons
       set used_at = null,
           used_application_id = null
     where id = new.coupon_id
       and used_application_id = new.id;  -- 다른 신청이 쓰고 있으면 건드리지 않는다
  end if;
  return new;
end;
$$;

comment on function public.release_coupon_on_cancel() is
  '신청이 취소되면 사용된 쿠폰을 미사용 상태로 되돌린다. 취소 경로가 여러 개라 트리거로 둔다.';

revoke execute on function public.release_coupon_on_cancel() from public;

drop trigger if exists applications_release_coupon_on_cancel on public.applications;
create trigger applications_release_coupon_on_cancel
  after update of status on public.applications
  for each row execute function public.release_coupon_on_cancel();

-- 이미 취소됐는데 쿠폰이 묶여 있는 건을 푼다(이번 변경 전에 취소된 것들).
update coupons c
   set used_at = null, used_application_id = null
  from applications a
 where a.id = c.used_application_id
   and a.status = 'cancelled';
