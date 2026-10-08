-- 한 테마를 여러 모드로 나누기 위한 칸 (바-ㅇ탈출 파티/노말)
--
-- 적용: test 20261008063528 (적용 완료, 2026-10-08) / 운영 (미적용)
--
-- 왜
--   바-ㅇ탈출을 파티모드·노말모드로 나눈다. 모드마다 카테고리·난이도·소요시간·
--   장르·가격표·회차·재참여 규칙이 전부 다른데, 그 값들이 **이미 테마 단위**로
--   달려 있다(themes 칼럼 · theme_price_tiers.theme_id · sessions.theme_id).
--   그래서 모드를 테마 안에 끼워 넣는 대신 **테마 행을 하나 더** 만든다.
--
--   한 테마 안에 모드를 넣으려면 theme_price_tiers 의 기본키를 바꿔야 하고,
--   그러면 resolve_unit_price 의 시그니처가 바뀌어 **모든 신청의 금액을 계산하는
--   submit_application_v3 까지** 고쳐야 한다. 2026-08-14 에 이 계열 함수를 잘못
--   고쳐 서비스가 마비된 적이 있다. 행을 하나 더 만드는 쪽은 그 경로를 안 건드린다.
--
-- 대신 "두 행이 사실 같은 테마" 임을 알려줄 끈이 필요하다 — variant_group.
-- 재참여 판정과 쿠폰 적용 범위가 이 끈을 **같이** 쓴다.
--
-- ⚠️ 이 파일은 칸만 늘린다. 판정 로직은 건드리지 않는다.
--    기본값이 종전 동작과 같아서, 이 마이그레이션만 적용하면 아무것도 안 바뀐다.

alter table themes
  -- 같은 테마의 다른 모드끼리 같은 값을 갖는다. null 이면 묶음 없음(단독 테마).
  add column if not exists variant_group text,
  -- 이 테마에 신청할 때 허용되는 참여 횟수. null 이면 **무제한**.
  --   파티모드 1  — 같은 묶음을 한 번이라도 했으면 못 한다(팀 대항이라 형평성 문제)
  --   노말모드 null — 한 회차에 단일 팀만 진행해 형평성 문제가 없다(2026-10-08 결정)
  add column if not exists reparticipation_limit int,
  -- 신청 가능한 최소 인원. null 이면 1.
  add column if not exists min_group_size int,
  -- 화면에 '권장 인원'으로 보여줄 상한. null 이면 권장 표기를 하지 않는다.
  -- ⚠️ max_group_size(신청 가능 상한)와 다르다. 노말모드는 권장 4인 / 신청 6인까지.
  add column if not exists recommended_group_size int;

comment on column themes.variant_group is
  '같은 테마의 다른 모드를 묶는 끈. 재참여 이력 합산과 쿠폰 적용 범위가 이 값을 쓴다.';
comment on column themes.reparticipation_limit is
  '허용 참여 횟수. null 이면 무제한. 사람별 예외는 reparticipation_allowances 가 덮어쓴다.';
comment on column themes.min_group_size is
  '신청 가능한 최소 인원(null = 1). 가격표에 구간이 없는 인원을 막는다.';
comment on column themes.recommended_group_size is
  '화면에 보여줄 권장 인원 상한. 신청 상한(max_group_size)과 별개다.';

-- 쿠폰 캠페인을 같은 묶음의 다른 모드에도 열지 여부.
-- ⚠️ 기본값 false — 지금 있는 캠페인과 앞으로 만드는 캠페인은 **종전과 동일**하게
--    지정한 테마에서만 쓰인다. 넓히려면 캠페인마다 명시적으로 켠다.
--    (잼핏 같은 제휴 쿠폰은 계약 범위가 있어 일괄로 넓히면 안 된다)
alter table coupon_campaigns
  add column if not exists applies_to_variants boolean not null default false;

comment on column coupon_campaigns.applies_to_variants is
  'true 면 themes.variant_group 이 같은 테마에도 이 캠페인의 쿠폰을 쓸 수 있다.';

-- 기존 테마는 종전 동작 그대로: 재참여 1회, 최소 1인, 묶음 없음.
update themes
   set reparticipation_limit = coalesce(reparticipation_limit, 1),
       min_group_size        = coalesce(min_group_size, 1);
