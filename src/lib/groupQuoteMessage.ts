import { dateLabel } from "@/lib/groupPricing";

/**
 * 단체 견적 안내 문자의 양식 고르기와 기본 문구(2026-11-27 대표님). 순수 함수 · 상수만 둔다.
 *
 * 양식은 둘이다.
 *   일반용 `group_quote`           — 회사가 아닌 단체
 *   회사용 `group_quote_company`   — 회사 워크숍 · 회식. 카드결제 · 세금계산서 안내가 더 들어간다
 * 모임 성격이 회사 워크숍이면 회사용이 자동으로 골라지고, 단체 상세의 문자 탭에서 눌러 바꿀 수 있다.
 * 문구 원본은 sms_templates 에 있고 「단체 도구 › 안내 문자 템플릿」 에서 고친다. 아래 기본 문구는
 * 마이그레이션(group_quote_templates)이 넣는 값과 **글자까지 같다**(테스트가 대조한다).
 */
export const QUOTE_VARIANTS = [
  { key: "general", label: "일반용", templateKey: "group_quote" },
  { key: "company", label: "회사용", templateKey: "group_quote_company" },
] as const;
export type QuoteVariant = (typeof QUOTE_VARIANTS)[number]["key"];

export const isQuoteVariant = (v: unknown): v is QuoteVariant => QUOTE_VARIANTS.some((q) => q.key === v);

/** 회사 워크숍 · 회식인가(모임 성격 코드 `company`). */
export const isCompanyGroup = (groupKind: string | null | undefined): boolean => groupKind === "company";

/** 모임 성격으로 고르는 기본 양식. */
export const quoteVariantOf = (groupKind: string | null | undefined): QuoteVariant => (isCompanyGroup(groupKind) ? "company" : "general");

export const quoteTemplateKey = (variant: QuoteVariant): string => QUOTE_VARIANTS.find((q) => q.key === variant)!.templateKey;

/** 180 → '약 3시간', 210 → '약 3시간 30분'. */
export function programHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `약 ${h > 0 ? `${h}시간` : ""}${h > 0 && m > 0 ? " " : ""}${m > 0 ? `${m}분` : ""}`;
}

/** '2026-11-15' → '2026년 11월 15일 (일)'. */
export const dateFull = (date: string): string => `${date.slice(0, 4)}년 ${dateLabel(date)}`;

/**
 * 줄이 하나도 없는 반복 덩어리(`{{#lines}} … {{/lines}}`)를 줄바꿈까지 같이 지운다 —
 * 그냥 두면 「• 방탈출 …」 과 「• 총 이용 금액 …」 사이에 빈 줄이 남는다.
 */
export const dropBlock = (body: string, name: string): string =>
  body.replace(new RegExp(`\\{\\{#${name}\\}\\}[\\s\\S]*?\\{\\{\\/${name}\\}\\}\\n?`), "");

/** 조건에 따라 통째로 빠지는 덩어리가 남긴 빈 줄을 정리한다 — 빈 줄은 한 줄까지만. */
export const tidyBlankLines = (text: string): string => text.replace(/\n{3,}/g, "\n\n").trim();

const HEAD = `안녕하세요, {{leader_name}}님!
우주이스케이프입니다 🚀

단체 견적 신청해주셔서 감사합니다! 😊💜

신청해주신 {{event_date}} {{event_time_ko}}, 총 {{headcount}}명 일정으로 이용 안내드립니다.

[이용 일정]
• 모임명: {{group_name}}
• 일시: {{event_date_full}} {{event_start}}
• 인원: 총 {{headcount}}명
• 프로그램: {{program_hours}} ({{event_range}})
• 진행 방식: 팀별 경쟁형 방탈출

[이용 금액]
• 방탈출: {{headcount}}명 × {{unit_price}} = {{base_amount}}
{{#lines}}
• {{label}}: {{amount}}
{{/lines}}
• 총 이용 금액: {{total}}

[사전 신청폼 안내]

참여자분들의 특성과 모임 성격에 맞춰 프로그램을 준비하기 위해 사전 신청폼을 받고 있습니다.

아래 폼을 작성해주시면 감사하겠습니다!

📝 신청폼
{{leader_form_url}}

{{#deposit}}
[예약금 안내]

예약 확정을 위해 총 이용 금액의 30%인 {{deposit_suggest}}을 아래 계좌로 입금 부탁드립니다.

• 예약금: {{deposit_suggest}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

[잔금 및 결제 안내]

• 잔금: {{balance_suggest}}
• 최종 참여 인원은 행사 7일 전인 {{d7_date}}까지 확정 부탁드립니다.
• 잔금은 최종 확정 인원을 기준으로 안내드리며, 이후 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.`;

const CARD_LINES = `
• 카드결제 및 세금계산서 발행도 가능합니다.
• 카드결제를 희망하실 경우, 이용 당일 기존 계좌이체 금액을 환불한 후 카드결제로 변경해드릴 수 있습니다.`;

const FULLPAY = `
{{/deposit}}
{{#fullpay}}
[결제 안내]

행사 7일 이내 예약은 전액 결제 시 확정됩니다. 총 이용 금액 {{total}}을 아래 계좌로 입금 부탁드립니다.

• 입금 금액: {{total}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

• 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.`;

const TAIL = `
{{/fullpay}}

입금 후 말씀해주시면 확인 도와드리겠습니다!

추가로 궁금하신 사항이 있으시면 언제든 편하게 문의해 주세요.

감사합니다! 😊`;

/**
 * 기본 문구. `{{#deposit}}` 덩어리는 예약금 30% 로 안내할 때만, `{{#fullpay}}` 덩어리는 전액 입금으로 안내할 때만 나온다
 * (행사 7일 이내 + 계좌이체 + 회사가 아닌 단체 — groupSettlement.ts requiredDeposit).
 */
export const QUOTE_DEFAULT_BODY: Record<QuoteVariant, string> = {
  general: `${HEAD}${FULLPAY}${TAIL}`,
  company: `${HEAD}${CARD_LINES}${FULLPAY}${CARD_LINES.split("\n").slice(0, 2).join("\n")}${TAIL}`,
};

/** 문구가 쓰는 치환값 이름(sms_templates.placeholders 칸) — 덩어리 이름도 같이 적는다. */
export const QUOTE_PLACEHOLDERS = [
  "leader_name", "event_date", "event_time_ko", "headcount", "group_name", "event_date_full", "event_start", "program_hours", "event_range",
  "unit_price", "base_amount", "lines", "label", "amount", "total", "leader_form_url",
  "deposit", "deposit_suggest", "bank_account", "balance_suggest", "d7_date", "fullpay",
] as const;
