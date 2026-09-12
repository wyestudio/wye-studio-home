-- 참여내역 조회 v3 — 쿠폰 할인 · 테마 정보 추가
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기: drop function if exists public.lookup_application_v3(text, text);
--           (v2 는 그대로 두므로 앱만 되돌리면 된다)
--
-- v2 에 없어서 화면이 못 보여주던 것들:
--   · discount_krw   — 쿠폰을 쓴 신청은 "단가 × 인원" 과 실제 입금액이 다르다.
--                      할인 내역이 없으면 "왜 이 금액이지?" 가 된다.
--   · theme_slug     — 같은 테마 페이지로 돌아가는 링크.
--   · accent_color   — 테마마다 강조색이 다르다. 예전에는 '소개팅' 문자열로
--                      색을 정했는데, 신규 회차는 그 값이 비어 있어 항상 기본색이었다.
--   · category_name  — 상세·신청 화면과 같은 알약 배지.
--
-- ⚠️ v2 를 고치지 않고 새 함수를 만든다. 반환 컬럼이 바뀌는 함수를 replace 하면
--    배포 순서에 따라 옛 화면이 없는 컬럼을 읽어 터진다.

create or replace function public.lookup_application_v3(
  p_phone_digits text,
  p_confirmation_code text
) returns table (
  theme_name text,
  theme_slug text,
  category_name text,
  accent_color text,
  format_label text,
  venue_area text,
  start_at timestamptz,
  end_at timestamptz,
  min_age integer,
  headcount integer,
  unit_price_krw integer,
  base_amount_krw integer,
  discount_krw integer,
  amount_krw integer,
  status text,
  payment_status text,
  confirmation_code text,
  created_at timestamptz,
  payment_confirmed_sms_sent_at timestamptz,
  notes text,
  waiting_number integer,
  attendees jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_phone_hash text := hash_phone(p_phone_digits);
  v_app_id uuid;
  v_session_id uuid;
  v_status text;
  v_created timestamptz;
  v_waiting int;
begin
  select ap.id, ap.session_id, ap.status, ap.created_at
    into v_app_id, v_session_id, v_status, v_created
  from applications ap
  join application_attendees aa on aa.application_id = ap.id
  where ap.confirmation_code = p_confirmation_code
    and aa.phone_hash = v_phone_hash
  limit 1;

  if v_app_id is null then return; end if;

  -- 대기 순번: 성별 분기 없이 같은 회차의 대기 건 중 순서.
  -- 저장하지 않고 조회 시점에 계산하므로 앞선 취소가 있으면 당겨진다.
  if v_status = 'waiting' then
    select count(*) into v_waiting
    from applications ap2
    where ap2.session_id = v_session_id
      and ap2.status = 'waiting'
      and ap2.created_at <= v_created;
  end if;

  return query
  select
    coalesce(t.name, s.theme_name)                                as theme_name,
    t.slug                                                        as theme_slug,
    tc.name                                                       as category_name,
    t.accent_color,
    coalesce(s.legacy_format, s.session_type)                     as format_label,
    coalesce(v.area_label, s.venue_area)                          as venue_area,
    s.start_at,
    s.end_at,
    s.min_age,
    coalesce(ap.headcount, (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as headcount,
    coalesce(ap.unit_price_krw, s.price_krw)                      as unit_price_krw,
    -- 할인 전 금액. 옛 신청은 discount 가 없으므로 amount 와 같다.
    coalesce(ap.amount_krw, 0) + coalesce(ap.discount_krw, 0)     as base_amount_krw,
    coalesce(ap.discount_krw, 0)                                  as discount_krw,
    coalesce(ap.amount_krw,
             s.price_krw * (select count(*)::int from application_attendees x
                            where x.application_id = ap.id))      as amount_krw,
    ap.status,
    ap.payment_status,
    ap.confirmation_code,
    ap.created_at,
    ap.payment_confirmed_sms_sent_at,
    ap.notes,
    v_waiting,
    (select jsonb_agg(jsonb_build_object(
        'name', decrypt_pii(aa2.name_enc),
        'phone', decrypt_pii(aa2.phone_enc),
        'birth_year', aa2.birth_year,
        'nickname', aa2.nickname,
        'gender', aa2.gender,
        'experience_range', aa2.experience_range,
        'is_representative', aa2.is_representative)
      order by aa2.is_representative desc)
     from application_attendees aa2 where aa2.application_id = ap.id)
  from applications ap
  join sessions s on s.id = ap.session_id
  left join themes t on t.id = s.theme_id
  left join theme_categories tc on tc.id = t.category_id
  left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id)
  where ap.id = v_app_id;
end;
$$;

comment on function public.lookup_application_v3(text, text) is
  '전화번호 + 접수번호로 참여내역 조회. v2 에 쿠폰 할인·테마 슬러그/강조색/카테고리를 더했다.';

revoke execute on function public.lookup_application_v3(text, text) from public;
grant execute on function public.lookup_application_v3(text, text) to anon, authenticated, service_role;
