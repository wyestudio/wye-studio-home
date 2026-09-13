/**
 * 문자 포맷에 쓸 수 있는 변수 설명·기본 예시.
 *
 * 예시값은 **테마와 무관한 변수**(이름·접수번호·계좌 등)를 위한 것이다.
 * 가격·소요시간·일시·장소처럼 테마마다 다른 값은 화면에서 고른 테마의 실제
 * 값으로 덮인다 — src/lib/templatePreview.ts 참고.
 *
 * 표시 컴포넌트는 슬랙과 공용이다: components/admin/PlaceholderHints.tsx
 */
export const PLACEHOLDER_INFO: Record<string, { label: string; example: string }> = {
  name: { label: "신청자 이름", example: "홍길동" },
  theme_name: { label: "테마명", example: "바-ㅇ탈출" },
  product_label: { label: "그룹/소개팅 파티형 방탈출 표기", example: "그룹 파티형 방탈출" },
  event_date: { label: "진행 날짜", example: "8/29(토)" },
  start_time: { label: "시작 시각", example: "13:00" },
  end_time: { label: "종료 시각 (~포함, 없으면 빈 값)", example: "~17:00" },
  duration: { label: "소요 시간", example: "3시간 30분" },
  attendee_count: { label: "참여 인원 수", example: "2" },
  confirmation_code: { label: "접수번호", example: "384920" },
  price: { label: "입금액", example: "69,000원" },
  bank_name: { label: "입금 은행명", example: "카카오뱅크" },
  account_number: { label: "입금 계좌번호", example: "3333-05-2843942" },
  account_holder: { label: "예금주", example: "김시온" },
  depositor_name: { label: "신청 시 입력한 입금자명", example: "홍길동" },
  min_age: { label: "최소 연령", example: "19" },
  parking_note: { label: "주차 안내", example: "인근 유료주차장 이용" },
  venue_name: { label: "장소명", example: "뮤트스페이스 신림점" },
  venue_address_text: { label: "장소 주소 (괄호 포함, 없으면 빈 값)", example: " (서울 관악구 ...)" },
  reapply_url: { label: "재신청 링크", example: "www.wouldyouescape.com/sessions/0829-meeting" },
  refund_amount: { label: "환불 금액", example: "138,000원" },
  refund_notice: { label: "환불 안내 문장 (입금 여부에 따라 자동)", example: "입금하신 금액 124,000원은 …" },
  // 쿠폰 발송용
  code: { label: "쿠폰번호 (하이픈 표기)", example: "M0EH-EVG1" },
  discount: { label: "할인 금액/비율", example: "5,000원" },
  expires_at: { label: "쿠폰 사용기한", example: "2027년 9월 12일" },
  link: { label: "쿠폰이 자동으로 담기는 링크", example: "www.wouldyouescape.com/c/M0EHEVG1" },
};
