-- 쿠폰 캠페인을 같은 묶음의 다른 모드에도 열 수 있게 (preview_coupon)
--
-- 적용: test 20261008071008 (적용 완료, 2026-10-08) / 운영 (미적용)
--   변경 전 md5 23e5ef5541e8926a7aa31900437429f9 (길이 3012)
--   적용 후 md5 1aa2f177214660126cb67dcac92fee2b
--   끼워 넣은 블록만 원래 한 줄로 되돌리면 md5 가 23e5ef55… 로 정확히 복귀함을 확인했다
--   — 나머지는 한 글자도 안 바뀌었다는 뜻이다.
--
-- 왜
--   바-ㅇ탈출이 파티/노말 두 테마 행으로 나뉘면서, 「바-ㅇ탈출용」으로 묶여 있던
--   쿠폰이 노말모드에서 안 먹게 된다 (미사용 797장: 잼핏 498 · 인스타 299).
--
-- ⚠️ 캠페인의 theme_id 를 null 로 바꾸는 방법은 쓰지 않는다. null 은 **앞으로 나올
--    모든 테마**에 열리는데, 잼핏은 바-ㅇ탈출에 한정한 제휴 계약이라 범위를 넘는다.
--    대신 캠페인마다 켜는 스위치(applies_to_variants)를 두고, 켜진 캠페인만
--    같은 variant_group 안에서 통하게 한다. **기본값은 false** 라 지금 있는 캠페인과
--    앞으로 만들 캠페인은 종전과 똑같이 지정한 테마에서만 쓰인다.
--
-- ⚠️ 이 변경은 조건을 **넓히기만** 한다. 지금 쓰이던 쿠폰이 못 쓰이게 되는 경우는
--    없다 (스위치가 꺼져 있으면 기존 조건과 완전히 동일한 식이 된다).
--
-- 어떻게
--   운영에 살아 있는 정의를 pg_get_functiondef 로 받아 **딱 한 줄만** 치환한다.
--   그 줄을 원래대로 되돌리면 md5 가 23e5ef5541e8926a7aa31900437429f9 로 돌아온다
--   — 나머지는 한 글자도 안 바뀌었다는 뜻이다.

do $migration$
declare
  v_def  text;
  v_old  constant text :=
    '  if v_camp.theme_id is not null and v_camp.theme_id <> p_theme_id then';
  v_new  constant text :=
    '  if v_camp.theme_id is not null and v_camp.theme_id <> p_theme_id' || E'\n' ||
    '     and not (' || E'\n' ||
    '       v_camp.applies_to_variants' || E'\n' ||
    '       and exists (' || E'\n' ||
    '         select 1 from themes a join themes b on a.variant_group = b.variant_group' || E'\n' ||
    '          where a.id = v_camp.theme_id and b.id = p_theme_id' || E'\n' ||
    '            and a.variant_group is not null' || E'\n' ||
    '       )' || E'\n' ||
    '     ) then';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'preview_coupon';

  if v_def is null then
    raise exception 'preview_coupon 을 찾지 못했다';
  end if;
  if position(v_old in v_def) = 0 then
    raise exception '바꿀 기준 줄을 찾지 못했다 — 정의가 이미 달라졌다. 손으로 확인할 것';
  end if;

  execute replace(v_def, v_old, v_new);
end
$migration$;
