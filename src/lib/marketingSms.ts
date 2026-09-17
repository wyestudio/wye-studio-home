/**
 * 광고 문자 — 법적 표기와 발송 시간 제한.
 *
 * 화면(미리보기)과 서버(실제 발송)가 같은 함수로 문구를 만든다. 미리보기와 실물이
 * 다르면 운영자가 확인한 의미가 없다. 그래서 server-only 로 두지 않는다.
 *
 * 정보통신망법 제50조 광고성 정보 전송 규정:
 *   · 맨 앞에 "(광고)" 와 보내는 사람 이름 — 변칙 표기((광/고) 등) 금지
 *   · 무료 수신거부 방법 명시
 *   · 21:00~08:00 발송은 별도 야간 동의가 필요한데 우리는 받지 않았다 → 막는다
 *   · LMS 는 본문뿐 아니라 제목에도 "(광고)" (2026-03 개정)
 */

export const AD_PREFIX = "(광고) 우주이스케이프";
/** 솔라피 무료 080 수신거부 번호. 이 번호로 들어온 거부는 솔라피 쪽에도 남는다. */
export const OPTOUT_FOOTER = "무료수신거부 080-500-4233";
export const AD_SUBJECT = "(광고) 우주이스케이프";

/** 본문 안에서 받는 사람 이름으로 바뀌는 자리 */
export const NAME_PLACEHOLDER = "{{name}}";

/** SMS(90바이트)를 넘으면 LMS 로 나간다. 솔라피 LMS 상한은 2,000바이트. */
export const SMS_MAX_BYTES = 90;
export const LMS_MAX_BYTES = 2000;

export function buildMarketingSms(body: string, name: string): string {
  const filled = body.trim().replaceAll(NAME_PLACEHOLDER, name);
  // 머리말과 본문 첫 줄을 한 줄로 잇는다 — "(광고) 우주이스케이프 🚀 GRAND OPEN EVENT" 처럼
  // 본문 첫 줄이 문자 제목 역할을 하게 쓰는 게 운영 방식이다.
  return `${AD_PREFIX} ${filled}\n\n${OPTOUT_FOOTER}`;
}

/** 통신사 기준 바이트 수 — 한글 등 비ASCII 는 2바이트로 센다. */
export function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) <= 0x7f ? 1 : 2;
  return n;
}

/** 한국 시간 21:00~07:59 이면 true — 야간 광고 발송 금지 시간. */
export function isQuietHoursKst(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return hour >= 21 || hour < 8;
}
