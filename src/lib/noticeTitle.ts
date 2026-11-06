/**
 * 공지 제목 형식 — `[분류] 핵심 내용` (2026-11-06 대표님).
 *
 * DB 에는 합친 제목 한 줄로 저장한다(칸을 따로 두지 않는다). 어드민 편집 화면이 분류 · 핵심을
 * 나눠 받아 합치고, 열 때는 다시 나눈다. 저장할 때 서버가 이 형식인지 한 번 더 본다.
 * ⚠️ 분류를 바꾸면 이미 저장된 공지 제목은 그대로 남는다 — 옛 분류로 된 공지는 열면 분류가 빈칸으로 뜬다.
 */
export const NOTICE_CATEGORIES = ["이용안내", "운영안내", "이벤트", "정책안내", "기타"] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

/** 새 공지 본문의 첫 줄 */
export const NOTICE_GREETING = "안녕하세요, 우주이스케이프입니다.";

export function composeNoticeTitle(category: string, headline: string): string {
  return `[${category}] ${headline.trim()}`;
}

/** 분류가 목록에 없는 옛 제목은 분류를 비우고 제목 전체를 핵심 내용으로 돌려준다 */
export function splitNoticeTitle(title: string): { category: NoticeCategory | ""; headline: string } {
  const m = title.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  const cat = m?.[1] as NoticeCategory | undefined;
  if (m && cat && NOTICE_CATEGORIES.includes(cat)) return { category: cat, headline: m[2] };
  return { category: "", headline: title };
}

export function isValidNoticeTitle(title: string): boolean {
  const { category, headline } = splitNoticeTitle(title);
  return category !== "" && headline.trim() !== "";
}
