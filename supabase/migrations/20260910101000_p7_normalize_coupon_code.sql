-- 쿠폰 코드 입력 정규화
--
-- 적용: test 적용 완료 (2026-09-10) / ⚠️ 운영 미적용
-- 되돌리기: drop function normalize_coupon_code(text); 후 preview_coupon /
--           submit_application_v2 의 조회를 upper(btrim(...)) 로 되돌린다.
--
-- 왜 필요한가: 문자·CSV 의 표기는 'M0EH-EVG1' 처럼 4-4 하이픈 형태인데
--   저장은 'M0EHEVG1' 이다. 고객이 문자를 그대로 복사해 붙이면
--   "존재하지 않는 코드" 가 됐다. 테스트에서 실제로 확인한 문제다.
--
-- 혼동 문자 교정: 코드 알파벳이 I·L·O·U 를 제외하고 만들어졌으므로
--   이 글자가 들어왔다면 오독이 확실하다. 1/1/0/V 로 되돌린다.
--
-- ⚠️ translate 는 from/to 자리 대응이다. 'ILOU' → '110V' 순서가 정확해야 한다.
--    처음에 '1100' 으로 써서 U 가 V 가 아니라 0 이 됐다.
-- ⚠️ 클라이언트에만 두면 안 된다. 서버가 최종 판정자다.

create or replace function normalize_coupon_code(p_raw text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when p_raw is null then null
    else translate(
           regexp_replace(upper(btrim(p_raw)), '[^0-9A-Z]', '', 'g'),
           'ILOU', '110V'
         )
  end;
$$;

comment on function normalize_coupon_code(text) is
  '쿠폰 코드 입력 정규화 — 하이픈·공백 제거, 대문자화, 혼동 문자(I·L→1, O→0, U→V) 교정.';

revoke execute on function normalize_coupon_code(text) from public;
grant execute on function normalize_coupon_code(text) to anon, authenticated, service_role;

-- preview_coupon / submit_application_v2 의 코드 조회를 정규화 기준으로 바꾼다.
-- (전체 정의는 Supabase 마이그레이션 p7_use_normalize_in_coupon_lookup 및
--  p7_submit_application_v2_coupon 참고. 여기서는 변경 취지만 남긴다.)
