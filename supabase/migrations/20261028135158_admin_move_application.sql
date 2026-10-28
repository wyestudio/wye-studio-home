-- 어드민 신청 정보 수정에서 회차를 옮긴다(2026-10-28 대표님).
--
-- · 같은 묶음(variant_group, 예: 바-ㅇ탈출 파티 ↔ 노말) 안의 다가오는 열린 회차로만 옮긴다.
-- · 판정은 고객 신청(submit_application_v3)과 같은 기준이다 — 팀 수 · 정원 · 한 번에 받는 인원 ·
--   연령(min_age) · 재참여(is_theme_participation_blocked, 이 신청 자신은 뺀다) · 회차 안 닉네임.
-- · 확정/대기는 옮긴 회차 기준으로 다시 정한다.
-- · 금액은 옮긴 회차 가격(회차 고정가 > 프로모션 > 기본가)으로 다시 계산한다. 프로모션은 처음 신청한 때 기준(대표님).
--   쿠폰 할인액은 이미 정해진 금액이라 그대로 뺀다. 입금 상태는 건드리지 않는다 — 차액은 운영자가 처리한다.
-- · 전날 안내 문자 발송 기록은 비운다 — 새 회차 기준으로 다시 나가야 한다. 손님에게 따로 문자를 보내지 않는다.
-- · 떠난 회차가 팀 수 제한으로 닫혀 있었으면 다시 연다(reopen_session_after_cancel 과 같은 규칙).
-- 기존 admin_update_application() 은 건드리지 않는다. 정보 수정과 이동을 한 번에 하려면
-- admin_update_and_move_application() 이 둘을 한 트랜잭션으로 부른다.

create or replace function public.admin_move_application(p_application_id uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_app applications%rowtype;
  v_from record;
  v_to record;
  v_size int;
  v_current_total int;
  v_status text;
  v_dup text;
  v_nick text;
  v_base_unit_price int;
  v_unit_price int;
  v_promo_id uuid;
  v_promo_name text;
  v_promo_unit int;
  v_promo_discount int := 0;
  v_amount int;
  v_limit int;
begin
  select * into v_app from applications where id = p_application_id for update;
  if not found then raise exception '존재하지 않는 신청입니다.'; end if;
  if v_app.status not in ('confirmed', 'waiting') then raise exception '취소된 신청은 옮길 수 없습니다.'; end if;
  if v_app.session_id = p_session_id then raise exception '지금과 같은 회차입니다.'; end if;

  -- 두 회차를 id 순서로 잠근다 — 반대로 옮기는 요청과 교착되지 않게.
  perform 1 from sessions where id in (v_app.session_id, p_session_id) order by id for update;

  select s.id, t.variant_group, s.theme_id into v_from
    from sessions s join themes t on t.id = s.theme_id where s.id = v_app.session_id;

  select sv.*, t.max_group_size, t.is_active as theme_active, t.max_teams_per_session, t.variant_group
    into v_to
    from session_view sv join themes t on t.id = sv.theme_id where sv.id = p_session_id;
  if not found then raise exception '존재하지 않는 회차입니다.'; end if;

  if not (v_to.theme_id = v_from.theme_id
          or (v_to.variant_group is not null and v_to.variant_group = v_from.variant_group)) then
    raise exception '같은 테마의 회차로만 옮길 수 있습니다.';
  end if;
  if not v_to.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_to.status <> 'open' or v_to.start_at < now() then raise exception '마감된 회차로는 옮길 수 없습니다.'; end if;

  if v_to.max_teams_per_session is not null
     and (select count(*) from applications
           where session_id = p_session_id and status in ('confirmed', 'waiting')) >= v_to.max_teams_per_session then
    raise exception '옮길 회차에 이미 다른 팀이 예약되어 있습니다.';
  end if;

  select count(*) into v_size from application_attendees where application_id = p_application_id;
  if v_to.max_group_size is not null and v_size > v_to.max_group_size then
    raise exception '옮길 회차는 한 번에 최대 %명까지 받습니다.', v_to.max_group_size;
  end if;

  if exists (select 1 from application_attendees
              where application_id = p_application_id
                and not is_eligible_birth_year(birth_year, v_to.min_age)) then
    raise exception '옮길 회차는 만 %세 이상만 참여할 수 있습니다.', v_to.min_age;
  end if;

  select string_agg(distinct regexp_replace(decrypt_pii(phone_enc), '[^0-9]', '', 'g'), ',') into v_dup
    from application_attendees
   where application_id = p_application_id
     and is_theme_participation_blocked(decrypt_pii(phone_enc), v_to.theme_id, p_application_id);
  if v_dup is not null then
    raise exception '이미 이 테마에 참여한 분이 포함되어 있어 옮길 수 없습니다.' using detail = v_dup;
  end if;

  -- 닉네임 트리거는 nickname 을 바꿀 때만 돈다 — 회차만 바꾸면 안 걸리므로 여기서 본다.
  select min(mine.nickname) into v_nick
    from application_attendees mine
    join application_attendees x on lower(x.nickname) = lower(mine.nickname) and x.session_id = p_session_id
    join applications a on a.id = x.application_id and a.status <> 'cancelled'
   where mine.application_id = p_application_id
     and mine.nickname is not null and btrim(mine.nickname) <> '';
  if v_nick is not null then
    raise exception '옮길 회차에 같은 닉네임(%)이 있습니다. 닉네임을 바꾼 뒤 옮겨주세요.', v_nick;
  end if;

  select coalesce(count(*), 0) into v_current_total
    from application_attendees aa join applications ap on ap.id = aa.application_id
   where ap.session_id = p_session_id and ap.status in ('confirmed', 'waiting');
  if v_current_total + v_size > v_to.capacity_max then
    raise exception '옮길 회차에 남은 자리가 부족합니다.';
  end if;
  v_status := case when v_current_total + v_size <= v_to.capacity_confirm_line then 'confirmed' else 'waiting' end;

  -- ── 인당가 — submit_application_v3 와 같은 순서 ──
  v_base_unit_price := coalesce(v_to.price_krw_override, resolve_unit_price(v_to.theme_id, v_size));
  -- 요금표에 그 인원 칸이 없으면 받지 않는 인원이다(노말모드는 2명부터).
  if v_base_unit_price is null then raise exception '옮길 회차는 %명 신청을 받지 않습니다.', v_size; end if;
  v_unit_price := v_base_unit_price;
  if v_to.price_krw_override is null then
    select r.promotion_id, r.promotion_name, r.unit_price_krw
      into v_promo_id, v_promo_name, v_promo_unit
      -- 프로모션은 옮기는 지금이 아니라 처음 신청한 때 기준으로 본다 — 얼리버드 기간에 신청한
      -- 손님이 회차를 옮겼다고 얼리버드가 풀리면 안 된다(2026-10-28 대표님).
      from resolve_promotion_price(v_to.theme_id, v_to.start_at, v_size, v_app.created_at) r;
    if v_promo_unit is not null and v_promo_unit < v_base_unit_price then
      v_unit_price := v_promo_unit;
      v_promo_discount := (v_base_unit_price - v_unit_price) * v_size;
    else
      v_promo_id := null; v_promo_name := null;
    end if;
  end if;
  v_amount := greatest(0, v_unit_price * v_size - coalesce(v_app.discount_krw, 0));

  update applications
     set session_id = p_session_id,
         status = v_status,
         headcount = v_size,
         unit_price_krw = v_unit_price,
         amount_krw = v_amount,
         base_unit_price_krw = v_base_unit_price,
         promotion_id = v_promo_id,
         promotion_name = v_promo_name,
         promotion_discount_krw = v_promo_discount,
         reminder_sms_sent_at = null,
         updated_at = now()
   where id = p_application_id;

  update application_attendees
     set session_id = p_session_id, reminder_sms_sent_at = null
   where application_id = p_application_id;

  -- 옮겨 간 회차가 찼으면 닫는다(submit_application_v3 와 같다).
  if v_current_total + v_size >= v_to.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id;
  end if;
  if v_to.max_teams_per_session is not null
     and (select count(*) from applications
           where session_id = p_session_id and status in ('confirmed', 'waiting')) >= v_to.max_teams_per_session then
    update sessions set status = 'closed', closed_by_team_limit = true, updated_at = now() where id = p_session_id;
  end if;

  -- 떠난 회차가 팀 수 제한으로 닫혀 있었으면 다시 연다(reopen_session_after_cancel 과 같다).
  select t.max_teams_per_session into v_limit
    from sessions s join themes t on t.id = s.theme_id
   where s.id = v_app.session_id and s.status = 'closed' and s.closed_by_team_limit and s.start_at > now();
  if v_limit is not null
     and (select count(*) from applications
           where session_id = v_app.session_id and status in ('confirmed', 'waiting')) < v_limit then
    update sessions set status = 'open', closed_by_team_limit = false, updated_at = now() where id = v_app.session_id;
  end if;

  return jsonb_build_object(
    'from_session_id', v_app.session_id,
    'to_session_id', p_session_id,
    'old_status', v_app.status,
    'new_status', v_status,
    'old_amount_krw', v_app.amount_krw,
    'new_amount_krw', v_amount,
    'payment_status', v_app.payment_status
  );
end;
$function$;

-- 정보 수정 + 회차 이동을 한 트랜잭션으로. 수정 내용(출생연도 등)이 반영된 상태로 새 회차 판정을 받는다.
create or replace function public.admin_update_and_move_application(
  p_application_id uuid, p_depositor_name text, p_notes text, p_attendees jsonb, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  perform admin_update_application(p_application_id, p_depositor_name, p_notes, p_attendees);
  return admin_move_application(p_application_id, p_session_id);
end;
$function$;

-- 어드민 서버 액션(service_role)만 부른다.
revoke all on function public.admin_move_application(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_and_move_application(uuid, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.admin_move_application(uuid, uuid) to service_role;
grant execute on function public.admin_update_and_move_application(uuid, text, text, jsonb, uuid) to service_role;
