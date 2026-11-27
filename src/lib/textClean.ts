/**
 * 저장 전 글 정리 — 화면 · 서버 액션이 같은 함수를 쓴다(관리자 개편 docs/04 「공통 정리」).
 *
 *   - 유니코드 정규화(NFC)
 *   - 제어 문자 · 보이지 않는 문자 제거
 *   - 앞뒤 공백 제거, 연속 공백은 하나로(한 줄 칸은 줄바꿈도 공백으로)
 *
 * ⚠️ HTML 은 여기서 막지 않는다. 저장은 글자 그대로 하고 **보여줄 때** 이스케이프한다(React 가 한다).
 * ⚠️ 이 파일은 "use client" 화면도 import 한다 — 감출 값을 적지 않는다.
 */
// U+0000–0008, 000B, 000C, 000E–001F, 007F, 200B, 200C, 2060, FEFF.
// 200D(이모지를 잇는 글자)는 지우지 않는다 — 지우면 가족 · 직업 이모지가 낱개로 쪼개진다.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌⁠﻿]/g;

/** 한 줄 칸 정리. 줄바꿈 · 탭 · 연속 공백을 공백 하나로. */
export function cleanLine(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 글자 수 — 유니코드 글자 단위(이모지 · 한글 1자 = 1). DB 의 char_length 와 같은 셈이다. */
export function charCount(value: string): number {
  return Array.from(value).length;
}
