-- p31: 인원수에 비례하는 쿠폰 할인(per_head) 추가
--
-- 왜 필요한가
--   잼핏(ZAMFIT) 제휴계약 제6조·제21조 — "참가자 1인당 1,000원 할인".
--   기존 discount_type 은 fixed(예약 1건당 정액)/percent(정률) 뿐이라
--   3인 신청에 3,000원을 깎아주는 방식을 표현할 수 없었다.
--   우리 참가비가 1인 68,000원이라 20만원짜리 3인 예약에 1,000원은
--   마케팅 효과가 없다는 판단에 따라 인당 방식으로 정했다.
--
-- ⚠️ submit_application_v2() 는 건드리지 않는다.
--    그 함수는 할인액을 스스로 계산하지 않고 preview_coupon() 에 실제 인원수를
--    넘겨 그 결과를 그대로 쓴다. 따라서 계산 규칙은 preview_coupon() 한 곳에만
--    있으면 되고, 화면 미리보기와 실제 신청이 어긋날 여지도 없다.
--    (2026-08-14 에 submit_application 시그니처를 잘못 건드려 서비스가 마비된
--     적이 있다. 분석·할인 같은 부가 기능 때문에 신청 경로를 흔들지 않는다.)

alter table public.coupon_campaigns
  drop constraint if exists coupon_campaigns_discount_type_check;

alter table public.coupon_campaigns
  add constraint coupon_campaigns_discount_type_check
  check (discount_type = any (array['fixed'::text, 'percent'::text, 'per_head'::text]));

create or replace function public.preview_coupon(
  p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer,
  p_phone text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_coupon   coupons%rowtype;
  v_camp     coupon_campaigns%rowtype;
  v_discount int;
  v_norm     text;
begin
  v_norm := normalize_coupon_code(p_code);
  if v_norm is null or v_norm = '' then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  select * into v_coupon from coupons where code = v_norm;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '존재하지 않는 쿠폰 코드예요.');
  end if;

  if v_coupon.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', '이미 사용된 쿠폰이에요.');
  end if;

  select * into v_camp from coupon_campaigns where id = v_coupon.campaign_id;

  if not v_camp.is_active then
    return jsonb_build_object('ok', false, 'reason', '지금은 사용할 수 없는 쿠폰이에요.');
  end if;
  if v_camp.valid_from is not null and now() < v_camp.valid_from then
    return jsonb_build_object('ok', false, 'reason', '아직 사용 기간이 아니에요.');
  end if;
  if v_camp.valid_until is not null and now() > v_camp.valid_until then
    return jsonb_build_object('ok', false, 'reason', '사용 기간이 지난 쿠폰이에요.');
  end if;
  if v_camp.theme_id is not null and v_camp.theme_id <> p_theme_id then
    return jsonb_build_object('ok', false, 'reason', '이 테마에는 쓸 수 없는 쿠폰이에요.');
  end if;
  if v_camp.min_headcount is not null and p_headcount < v_camp.min_headcount then
    return jsonb_build_object(
      'ok', false,
      'reason', format('%s명 이상 신청할 때 쓸 수 있는 쿠폰이에요.', v_camp.min_headcount));
  end if;

  if v_camp.restrict_to_issued_phone then
    if v_coupon.issued_to_phone_hash is null then
      return jsonb_build_object('ok', false, 'reason', '이 쿠폰은 사용할 수 없어요.');
    end if;
    if p_phone is null or hash_phone(p_phone) <> v_coupon.issued_to_phone_hash then
      return jsonb_build_object(
        'ok', false,
        'reason', '이 쿠폰은 쿠폰을 받으신 분 번호로만 사용할 수 있어요.');
    end if;
  end if;

  if v_camp.discount_type = 'fixed' then
    v_discount := v_camp.discount_value;
  elsif v_camp.discount_type = 'per_head' then
    -- 신청 인원수만큼 곱한다. 신청 시점의 실제 인원으로 계산되므로
    -- 화면에서 인원을 바꾸면 할인액도 따라 바뀐다.
    v_discount := v_camp.discount_value * p_headcount;
    if v_camp.max_discount_krw is not null then
      v_discount := least(v_discount, v_camp.max_discount_krw);
    end if;
  else
    v_discount := floor(p_base_amount * v_camp.discount_value / 100.0)::int;
    if v_camp.max_discount_krw is not null then
      v_discount := least(v_discount, v_camp.max_discount_krw);
    end if;
  end if;

  v_discount := least(v_discount, p_base_amount);

  return jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'campaign_name', v_camp.name,
    'description', v_camp.description,
    'valid_until', v_camp.valid_until,
    'discount_krw', v_discount,
    'final_amount_krw', p_base_amount - v_discount
  );
end;
$function$;
