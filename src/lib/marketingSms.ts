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

// ─────────────────────────────────────────────────────────────────
// 문자로 못 보내는 글자
//
// 통신사 문자 회선은 한글 인코딩(EUC-KR)만 받는다. 컬러 이모지는 여기에 없어서
// 통신사를 지나며 지워지거나 깨진다(솔라피 FAQ, 2026-09-17 운영 테스트에서 전부 빠짐).
// 그래서 보내기 전에 우리가 먼저 지우고, 미리보기도 지운 결과를 보여준다 —
// 운영자가 본 것과 받는 사람이 보는 것이 같아야 한다.
// ─────────────────────────────────────────────────────────────────

/** 이모지로 분류되지만 EUC-KR 에 있어 그대로 보내지는 글자(파이썬 euc-kr 인코딩으로 확인). */
const DELIVERABLE_PICTOGRAPHS = new Set("®™↔↕↖↗↘↙▶◀☎♀♂♠♣♥♨");

/** EUC-KR 에 없지만 뜻이 같은 글자로 바꿔 보내는 것. 지우면 문장이 어색해지는 것들이다. */
const REPLACEMENTS: Record<string, string> = {
  "✓": "√", "✔": "√", "✅": "√", "☑": "√",
  "–": "-", "—": "-", "−": "-",
  "•": "·", "・": "·",
  "‹": "〈", "›": "〉", "«": "《", "»": "》",
};

/** 이모지 조합에 끼는 보이지 않는 조각(변형 선택자·결합자·피부색·키캡). 조용히 뺀다. */
const EMOJI_JOINERS = /[\u200D\uFE0E\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u;
/** 국기 이모지를 이루는 글자. Extended_Pictographic 에 안 잡혀 따로 본다. */
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;

/**
 * 운영자에게 보여줄, EUC-KR 에 있어 보내지는 기호 예시.
 * ⚠️ ☎ ☞ ♪ 는 보내지긴 하지만 맥에서 컬러 이모지로 그려져 "이모지는 빠진다" 안내와 헷갈려 뺐다.
 *    → 는 어드민 글꼴에서 > 처럼 보여 뺐다.
 */
export const SMS_SAFE_SYMBOLS = "★ ☆ ● ○ ◆ ■ ▶ ♥ ♡ ※ √ 【 】";

export type SmsSanitizeResult = {
  text: string;
  /** 지워진 이모지(중복 없이, 나온 순서대로) */
  removed: string[];
  /** 바뀐 기호 [원래, 바뀐] */
  replaced: [string, string][];
};

export function sanitizeForSms(input: string): SmsSanitizeResult {
  const removed: string[] = [];
  const replaced: [string, string][] = [];
  let out = "";
  // 이모지를 지운 자리에 공백이 겹치거나 줄 앞에 공백이 남지 않도록, 바로 뒤 공백 하나를 같이 뺀다.
  let skipSpace = false;

  for (const ch of input) {
    if (EMOJI_JOINERS.test(ch)) continue;
    if (skipSpace && ch === " ") {
      skipSpace = false;
      continue;
    }
    skipSpace = false;

    const rep = REPLACEMENTS[ch];
    if (rep) {
      if (!replaced.some(([from]) => from === ch)) replaced.push([ch, rep]);
      out += rep;
    } else if (
      REGIONAL_INDICATOR.test(ch) ||
      (/\p{Extended_Pictographic}/u.test(ch) && !DELIVERABLE_PICTOGRAPHS.has(ch))
    ) {
      if (!removed.includes(ch)) removed.push(ch);
      skipSpace = true;
    } else {
      out += ch;
    }
  }

  // 줄 끝 이모지를 지우면 앞 공백이 남는다.
  return { text: out.replace(/[ \t]+$/gm, ""), removed, replaced };
}

export function buildMarketingSms(body: string, name: string): string {
  const filled = sanitizeForSms(body.trim().replaceAll(NAME_PLACEHOLDER, name)).text.trim();
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
