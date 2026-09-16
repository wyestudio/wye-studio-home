-- p41: 인스타 이벤트 쿠폰 자동 발급 (ManyChat 연동)
--
-- 왜
--   인스타 댓글 이벤트에서 참여자에게 DM 으로 쿠폰을 자동 발급한다.
--   지금까지는 전화번호(issued_to_phone_hash)로만 배정할 수 있었는데,
--   인스타 자동화는 전화번호를 모른다. 인스타 아이디로 배정할 수 있어야 한다.
--
-- ⚠️ 새 쿠폰 체계를 만들지 않는다. 이미 있는 「인스타 댓글 이벤트」 캠페인과
--    300장의 코드를 그대로 쓴다. 배정 방식만 하나 늘린다.

-- ── 1) 캠페인을 이름이 아니라 키로 찾게 한다 ──────────────────
-- ⚠️ API 가 이름으로 캠페인을 찾으면, 대표님이 어드민에서 이름을 바꾸는 순간
--    발급이 조용히 멈춘다. 바뀌지 않는 키를 따로 둔다.
alter table public.coupon_campaigns
  add column if not exists key text;

create unique index if not exists coupon_campaigns_key_uidx
  on public.coupon_campaigns (key) where key is not null;

comment on column public.coupon_campaigns.key is
  '외부 연동(ManyChat 등)이 캠페인을 찾을 때 쓰는 고정 키. 이름과 달리 바뀌지 않는다.';

-- ── 2) 인스타 아이디로 배정한 기록 ────────────────────────────
alter table public.coupons
  add column if not exists issued_to_handle text;

comment on column public.coupons.issued_to_handle is
  '이 쿠폰을 받아간 외부 계정(인스타 아이디 등). @ 없이 소문자로 저장한다.';

-- ⚠️ **계정당 1장**을 DB 제약으로 보장한다. 애플리케이션 검사만으로는
--    동시 요청 두 건이 같은 계정에 두 장을 배정할 수 있다.
create unique index if not exists coupons_campaign_handle_uidx
  on public.coupons (campaign_id, issued_to_handle)
  where issued_to_handle is not null;

-- ── 3) 인스타 아이디로 쿠폰 배정 ──────────────────────────────
--
-- ⚠️ 기존 assign_coupon(전화번호용)을 **그대로 본떴다.** 로직이 갈라지면
--    한쪽만 고치는 일이 생긴다. 다른 점은 키가 handle 이라는 것뿐이다.
--
-- ⚠️ `for update skip locked` 로 한 장을 잠그고 가져온다. 동시에 100명이
--    요청해도 같은 코드가 두 번 나가지 않는다.
create or replace function public.assign_coupon_to_handle(
  p_campaign_key text, p_handle text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_camp   coupon_campaigns%rowtype;
  v_coupon coupons%rowtype;
  v_handle text;
begin
  -- 아이디 정규화: 앞의 @ 제거, 공백 제거, 소문자.
  -- 대소문자만 다른 같은 계정에 두 장이 나가면 안 된다.
  v_handle := lower(btrim(regexp_replace(coalesce(p_handle, ''), '^@+', '')));
  if v_handle = '' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_HANDLE');
  end if;

  select * into v_camp from coupon_campaigns where key = p_campaign_key;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CAMPAIGN_NOT_FOUND');
  end if;

  -- 이벤트가 끝났거나 중지됐으면 발급하지 않는다.
  -- (잔여석 마감으로 조기 종료할 때는 어드민에서 캠페인을 '사용 중지'로 바꾼다)
  if not v_camp.is_active
     or (v_camp.valid_from  is not null and now() < v_camp.valid_from)
     or (v_camp.valid_until is not null and now() > v_camp.valid_until) then
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
  end if;

  -- 이미 받아간 계정이면 같은 코드를 다시 돌려준다(멱등).
  select * into v_coupon from coupons
   where campaign_id = v_camp.id and issued_to_handle = v_handle
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
  end if;

  -- 아직 아무에게도 안 준 미사용 쿠폰 하나를 잠그고 가져온다.
  select * into v_coupon from coupons
   where campaign_id = v_camp.id
     and issued_to_handle is null
     and issued_to_phone_hash is null
     and used_at is null
   order by code
   limit 1
   for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
  end if;

  update coupons set issued_to_handle = v_handle where id = v_coupon.id;

  return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', false);
exception
  -- 같은 계정이 동시에 두 번 요청해 유니크 제약에 걸린 경우:
  -- 경쟁에서 진 쪽은 이미 배정된 코드를 읽어 돌려준다(멱등 유지).
  when unique_violation then
    select * into v_coupon from coupons
     where campaign_id = v_camp.id and issued_to_handle = v_handle limit 1;
    if found then
      return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'SOLD_OUT_OR_ENDED');
end;
$function$;

revoke execute on function public.assign_coupon_to_handle(text, text) from public, anon, authenticated;
grant execute on function public.assign_coupon_to_handle(text, text) to service_role;

-- ── 4) 이번 이벤트 캠페인에 키를 달아 준다 ────────────────────
update public.coupon_campaigns
   set key = 'instagram_grand_open_202609'
 where name = '인스타 댓글 이벤트' and key is null;
