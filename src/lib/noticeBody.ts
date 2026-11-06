/**
 * 공지 본문 형식 (2026-11-06 대표님 — 굵게 · 기울임 · 색 · 목록이 되는 편집기).
 *
 * 새 본문은 어드민 편집기(NoticeBodyEditor)가 만든 HTML 이다. 그 전 본문은 평문
 * (줄바꿈 · `**굵게**` · `[문구](/주소)` · 맨 URL)이라, 화면과 편집기가 열 때 HTML 로 바꿔 읽는다.
 * 옛 공지를 편집기로 한 번 저장하면 그때부터 HTML 로 남는다.
 *
 * ⚠️ 화면에 내보내기 전에는 반드시 noticeSanitize.ts 를 거친다 — 여기서는 모양만 바꾼다.
 * ⚠️ 색은 hex 가 아니라 이름(data-color)으로 저장한다 — 실제 색은 globals.css 의 `.notice-body` 가 정한다.
 */

export const NOTICE_COLORS = [
  { key: "white", label: "흰색" },
  { key: "blue", label: "파랑" },
  { key: "orange", label: "주황" },
  { key: "red", label: "빨강" },
] as const;
export type NoticeColor = (typeof NOTICE_COLORS)[number]["key"];

/** 편집기가 만든 본문인가 — 첫 글자가 편집기가 쓰는 블록 태그다 */
export function isHtmlBody(body: string): boolean {
  return /^\s*<(p|h3|ul|ol)[\s>]/.test(body);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g;
const URL = /(^|[^"=])(https?:\/\/[^\s<>()]+)/g;
const BOLD = /\*\*([^*]+)\*\*/g;

/** 옛 평문 한 줄 → HTML. RichText 와 같은 규칙(링크 · 맨 URL · 굵게) */
function legacyLine(line: string): string {
  const links: string[] = [];
  let s = escapeHtml(line).replace(LINK, (_, label: string, href: string) => {
    links.push(`<a href="${href}">${label}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  s = s.replace(URL, (_, pre: string, url: string) => `${pre}<a href="${url}">${url.replace(/^https?:\/\//, "")}</a>`);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]);
  return s.replace(BOLD, "<strong>$1</strong>");
}

/** 옛 평문 본문 → 편집기 · 화면이 읽는 HTML. 한 줄이 한 문단, 빈 줄은 빈 문단이다 */
export function legacyToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => `<p>${legacyLine(line.trimEnd())}</p>`)
    .join("");
}

export function toNoticeHtml(body: string): string {
  return isHtmlBody(body) ? body : legacyToHtml(body);
}
