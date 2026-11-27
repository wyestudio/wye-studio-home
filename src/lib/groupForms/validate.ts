/**
 * 공개 폼 답의 정리와 검증(관리자 개편 docs/04 6장) — **화면과 서버가 같은 함수**를 쓴다.
 * 화면의 검증은 안내용이고, 서버 액션이 이 함수로 다시 보고, DB 함수 · 제약이 한 번 더 막는다.
 *
 * ⚠️ 이 파일은 "use client" 화면도 import 한다 — 감출 값을 적지 않는다.
 */
import type { FormDef, Question } from "@/lib/groupForms/schema";

// 제어 문자와 보이지 않는 문자. U+200D(이모지를 잇는 글자)는 지우지 않는다 — 지우면 이모지가 쪼개진다.
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌⁠﻿]/g;

/** 한 줄 칸: NFC · 보이지 않는 문자 제거 · 연속 공백 하나로 · 앞뒤 공백 제거. */
export function cleanText(v: unknown): string {
  return String(v ?? "").normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** 여러 줄 칸: 줄바꿈은 유지하되 빈 줄이 3줄 넘게 이어지면 2줄로. */
export function cleanMultiline(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 글자 수 — 유니코드 글자 단위(이모지 · 한글 1자 = 1). DB 의 char_length 와 같은 셈이다. */
export const charLen = (s: string) => Array.from(s).length;

/** 닉네임 폭 — 아스키 글자 1, 그 밖(한글 등) 1.5. DB 의 group_nickname_width() 와 같은 셈이다. */
export function nicknameWidth(s: string): number {
  return Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x7f ? 1.5 : 1), 0);
}

/** 이름: 글자로 시작하고 글자 · 띄어쓰기 · 마침표 · 가운뎃점 · 작은따옴표 · 하이픈만. 숫자 · 이모지 불가. */
const NAME_RE = /^[\p{L}][\p{L} .·'-]*$/u;

export const NICKNAME_TOO_LONG = "조금 길어요. 한글 8자 · 영어 12자까지 쓸 수 있어요.";

export type Answers = Record<string, string | number | boolean | string[]>;

/** 한 문항의 값을 정리한다. */
export function cleanValue(q: Question, raw: unknown): string | number | boolean | string[] {
  switch (q.type) {
    case "agree":
      return raw === true;
    case "checkbox":
      return Array.isArray(raw) ? raw.map((x) => cleanText(x)).filter(Boolean) : [];
    case "tel":
      return String(raw ?? "").replace(/\D/g, "");
    case "textarea":
      return cleanMultiline(raw);
    case "number":
    case "scale":
      return typeof raw === "number" ? raw : cleanText(raw);
    default:
      return cleanText(raw);
  }
}

/** 한 문항의 오류 문구. 괜찮으면 null. 값은 cleanValue 를 거친 것이어야 한다. */
export function questionError(q: Question, v: string | number | boolean | string[] | undefined): string | null {
  if (q.type === "agree") return q.required && v !== true ? "동의가 필요해요." : null;
  if (q.type === "checkbox") {
    const list = Array.isArray(v) ? v : [];
    if (q.required && list.length === 0) return "하나 이상 골라주세요.";
    if (list.some((x) => !(q.options ?? []).includes(x))) return "선택지를 다시 골라주세요.";
    return null;
  }
  const empty = v == null || v === "";
  if (empty) {
    if (!q.required) return null;
    return q.type === "radio" || q.type === "scale" ? "하나를 골라주세요." : "입력해주세요.";
  }
  if (q.type === "radio") return (q.options ?? []).includes(String(v)) ? null : "선택지를 다시 골라주세요.";
  if (q.type === "scale") {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? null : "별점을 골라주세요.";
  }
  if (q.type === "tel") return /^010\d{8}$/.test(String(v)) ? null : "010으로 시작하는 11자리 번호를 입력해주세요.";
  if (q.type === "number") {
    if (!/^\d+$/.test(String(v))) return "숫자만 입력해주세요.";
    const n = Number(v);
    const lo = q.min ?? 0;
    const hi = q.max ?? 1_000_000;
    return n < lo || n > hi ? `${lo}~${hi} 사이로 입력해주세요.` : null;
  }
  const s = String(v);
  if (q.width != null) return nicknameWidth(s) > q.width ? NICKNAME_TOO_LONG : null;
  const max = q.max ?? (q.type === "textarea" ? 1000 : 100);
  const len = charLen(s);
  if (q.kind === "name" && !NAME_RE.test(s)) return "이름은 한글이나 영문으로 입력해주세요.";
  if (q.kind === "url" && !/^https:\/\/[^\s]+\.[^\s]+$/.test(s)) return "https://로 시작하는 링크를 적어주세요.";
  if (!q.free && q.kind !== "url" && !/[\p{L}\p{N}]/u.test(s)) return "글자나 숫자를 넣어주세요.";
  if (q.min && len < q.min) return `${q.min}자 이상 적어주세요.`;
  if (len > max) return `${max}자까지 쓸 수 있어요. (지금 ${len}자)`;
  return null;
}

/**
 * 폼 전체 — 양식에 있는 문항만 받아 정리하고 검증한다. 양식에 없는 열쇠는 버린다.
 * 서버 액션이 브라우저에서 온 값을 그대로 믿지 않고 이 함수를 거친다.
 */
export function validateForm(def: FormDef, raw: unknown): { answers: Answers; errors: Record<string, string> } {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  for (const q of def.questions) {
    const v = cleanValue(q, src[q.id]);
    const err = questionError(q, v);
    if (err) errors[q.id] = err;
    answers[q.id] = v;
  }
  return { answers, errors };
}
