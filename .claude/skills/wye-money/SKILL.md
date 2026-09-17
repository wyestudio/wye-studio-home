---
name: wye-money
description: 금액이 틀리면 되돌릴 수 없는 작업. 쿠폰 발급·할인 계산·중복 적용 규칙, 잼핏 제휴 정산·수수료·환불 금액을 건드릴 때 반드시 먼저 읽는다. src/lib/settlement.ts, src/lib/coupon.ts, src/lib/couponCode.ts, src/app/(site)/admin/coupons/, src/app/(site)/admin/settlement/, DB 의 preview_coupons·submit_application 계열 함수, coupon_campaigns·coupons·application_coupons 테이블이 대상.
---

돈이 틀리면 되돌릴 수 없다. 여기 숫자가 그대로 고객 할인액이 되고, 상대 회사에 지급할 금액이 된다.

## 이 중 하나라도 건드리면 이 문서를 먼저 읽는다

- `src/lib/settlement.ts`
- `src/lib/coupon.ts`, `src/lib/couponCode.ts`
- `src/app/(site)/admin/coupons/`, `src/app/(site)/admin/settlement/`
- DB: `preview_coupons()`, `submit_application*()`, `coupon_campaigns`, `coupons`, `application_coupons`

---

## ⚠️ 쿠폰을 건드릴 때 (2026-09-16)

**접두사에 `I`·`L`·`O`·`U` 를 쓰면 영원히 조회되지 않는 쿠폰이 만들어진다.**
DB 의 `normalize_coupon_code()` 가 혼동 방지로 `I→1, L→1, O→0, U→V` 로 치환한다.
발급된 코드와 조회 키가 어긋나 **대량의 죽은 쿠폰**이 생긴다. 어드민이 막지만,
SQL 로 직접 넣을 때는 알아서 피해야 한다. (현재: 본인 M · 지인 F · 잼핏 Z · 이벤트 E)

**중복 적용 규칙은 캠페인의 `stackable` 하나로 정한다.**
2장 이상 쓰려면 **전부** 켜져 있어야 하고, 같은 캠페인 쿠폰 2장은 언제나 막힌다.
판정은 DB 의 `preview_coupons()` 한 곳에만 있다 — 화면에서 규칙을 흉내 내면 갈라진다.

**`submit_application_v2` 는 건드리지 않는다.** 중복 적용은 `submit_application_v3` 를
새로 만들어 붙였다(p37). v2 는 쿠폰 1장 시절 함수로 그대로 남아 있다.
2026-08-14 에 이 계열 함수를 잘못 고쳐 서비스가 마비된 적이 있다.

**정산의 기준은 `application_coupons` 다.** `applications.coupon_id` 는 더 이상 쓰지
않는다(중복이 되면 어느 쿠폰인지 특정할 수 없다). 새 표는 코드·캠페인명·할인액을
문자열로 박아 두므로 쿠폰이 삭제돼도 근거가 남는다.

**잼핏 비용 분담 50% 는 잼핏 쿠폰 할인액에만 매긴다.** 총 할인액에 매기면
인스타 이벤트 쿠폰까지 잼핏에 청구하게 된다.

**화면에서 쿠폰 추가가 거부돼도 이미 적용된 쿠폰은 유지해야 한다.**
성공 상태(`applied`)와 실패 사유(`couponError`)를 따로 들고 있는 이유다.
하나로 합치면 거부 시 적용분이 사라지고 제출에서도 빠져 **고객이 할인을 잃는다.**

---

## ⚠️ 잼핏 정산을 건드릴 때 (2026-09-15)

**여기 숫자가 그대로 상대 회사에 지급할 금액이 된다.** 규칙을 바꾸기 전에 반드시
계약서(「잼핏 입점 및 성과형 예약연동 제휴계약서」)를 다시 읽을 것.
계약 제16조는 **매출·정산자료를 고의로 누락하면 즉시 해지 + 마케팅비 청구** 다.

**취소됐다고 무조건 빼면 안 된다.** 제7조 8항 — "일부 환불 시 **최종적으로 보유하는
금액** 기준으로 수수료를 재계산". 우리 환불 규정은 날짜 기준 100%/50%/0% 라
3일 전 취소(50% 환불)·2일 전 취소(환불 불가)는 **우리가 돈을 보유하므로 수수료가
발생한다.** `status <> 'cancelled'` 로 거르면 줄 돈을 누락하는 것이다.

**쿠폰 사용 여부는 `applications.coupon_id` 로 본다.** `coupons.used_at` 이 아니다 —
취소하면 쿠폰이 풀리면서(p21) `used_at` 이 null 로 돌아가, 쿠폰 테이블 기준으로 세면
취소 건이 통째로 사라진다.

**조회 실패를 0건으로 보여주면 안 된다.** 정산에서 0건은 "줄 돈이 없다"로 읽힌다.
`getSettlement()` 은 실패 시 throw 하고 화면이 빨간 오류를 띄운다. 이 구조를 깨지 말 것.
(실제로 PostgREST 중첩 임베드가 조용히 실패해 0건으로 보인 적이 있다 —
 `applications` 와 `coupons` 는 관계가 둘이라 FK 이름을 반드시 명시해야 한다:
 `coupons!applications_coupon_id_fkey(...)`)

**개인정보는 넣지 않는다.** 제8조 4항·제14조 3항 — 예약번호·인원·금액·쿠폰 사용
여부까지만. 이름·연락처는 넘기지 않는다.

관련 파일: `src/lib/settlement.ts`, `src/app/(site)/admin/settlement/`
