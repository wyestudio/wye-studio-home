import type { BlockHint } from "@/components/admin/MessageTemplateEditor";
import type { TemplateBlocks } from "@/lib/messageTemplate";

/**
 * 슬랙 알림에 쓸 수 있는 변수 설명.
 *
 * 값 자체는 slackV2.ts 가 발송 시점에 만든다 — 이 파일은 **설명과 미리보기용
 * 샘플**만 들고 있다. 두 곳의 변수 이름이 어긋나면 알림에 {{변수}} 가 그대로
 * 찍히므로, slackV2 를 고칠 때 여기도 같이 고쳐야 한다.
 */
export const SLACK_PLACEHOLDER_LABELS: Record<string, string> = {
  theme_name: "테마명",
  session_label: "회차 일시",
  status: "확정/대기",
  status_suffix: "대기일 때만 ' [대기]' (확정이면 빈 값)",
  confirmation_code: "접수번호",
  headcount: "인원 수",
  depositor_name: "입금자명",
  amount: "실제 입금액 (쿠폰 적용 후)",
  base_amount: "할인 전 금액",
  discount: "쿠폰 할인액",
  discount_suffix: "쿠폰 썼을 때만 ' (쿠폰 −5,000원)'",
  created_at: "신청일시",
  payment_deadline: "입금기한 (신청 +30분)",
  confirmed_count: "이 회차 확정 인원",
  waiting_count: "이 회차 대기 인원",
  notes: "요청사항 (지금은 안 받지만 옛 신청에 남아 있음)",
  rep_name: "대표 신청자 이름",
  rep_phone: "대표 신청자 전화번호",
  rep_nickname: "대표 신청자 닉네임",
  rep_birth_year: "대표 신청자 출생연도",
  rep_gender: "대표 신청자 성별",
  rep_experience: "대표 신청자 방탈출 경험",
  cancelled_by: "누가 취소했는지 (고객/어드민)",
  refund_amount: "환불 금액",
  refund_account_block: "환불 계좌 3줄 (미등록이면 안내 문구)",
  refund_bank: "환불 은행",
  refund_account: "환불 계좌번호",
  refund_holder: "환불 예금주",
  count: "환불 대상 건수",
  total_amount: "환불 합계",
};

/** 참여자 반복 블록 안에서 쓸 수 있는 항목들. */
export const ATTENDEE_FIELDS = [
  "index",
  "role",
  "name",
  "nickname",
  "nickname_paren",
  "phone",
  "birth_year",
  "gender",
  "experience",
];

export const BLOCK_HINTS_BY_KEY: Record<string, BlockHint[]> = {
  application_new: [
    { name: "attendees", label: "대표 포함 전원", fields: ATTENDEE_FIELDS },
    { name: "companions", label: "동행자만", fields: ATTENDEE_FIELDS },
  ],
  refund_needed: [
    { name: "attendees", label: "대표 포함 전원", fields: ATTENDEE_FIELDS },
    { name: "companions", label: "동행자만", fields: ATTENDEE_FIELDS },
  ],
  bulk_refund_needed: [
    {
      name: "items",
      label: "취소된 신청 건들",
      fields: ["index", "confirmation_code", "name", "phone", "amount", "account_suffix"],
    },
  ],
};

/**
 * 미리보기용 샘플 참여자.
 *
 * ⚠️ 실제 신청자 정보를 끌어오지 않는다. 포맷을 보려고 여는 화면에서 남의
 *    전화번호·이름이 보일 이유가 없다. 대신 항목이 어떻게 채워지는지는
 *    그대로 드러나도록 3명(대표 1 + 동행 2)을 둔다.
 */
const SAMPLE_ATTENDEES = [
  { name: "홍길동", nickname: "길동", phone: "010-1234-5678", birth_year: "1996", gender: "남", experience: "10~30회" },
  { name: "김영희", nickname: "영희", phone: "010-2345-6789", birth_year: "1999", gender: "여", experience: "1~5회" },
  { name: "이철수", nickname: "", phone: "010-3456-7890", birth_year: "1994", gender: "남", experience: "처음이에요" },
];

export function sampleBlocks(): TemplateBlocks {
  const rows = SAMPLE_ATTENDEES.map((a, i) => ({
    index: String(i + 1),
    role: i === 0 ? "대표" : "동행",
    name: a.name,
    nickname: a.nickname,
    nickname_paren: a.nickname ? `(${a.nickname})` : "",
    phone: a.phone,
    birth_year: a.birth_year,
    gender: a.gender,
    experience: a.experience,
  }));

  return {
    attendees: rows,
    companions: rows.slice(1).map((r, i) => ({ ...r, index: String(i + 1), role: "동행" })),
    items: [
      {
        index: "1",
        confirmation_code: "384920",
        name: "홍길동",
        phone: "010-1234-5678",
        amount: "124,000원",
        account_suffix: "",
      },
      {
        index: "2",
        confirmation_code: "512004",
        name: "김영희",
        phone: "010-2345-6789",
        amount: "62,000원",
        account_suffix: " · 계좌 미등록",
      },
    ],
  };
}
