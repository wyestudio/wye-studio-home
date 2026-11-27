/**
 * 단체 도구(관리자 개편 7단계)의 규칙 — 안내 문자 문구 · 체크리스트 양식 · 리포트 기본값. 전부 순수 함수다.
 * 화면과 서버 액션이 같은 함수를 쓴다(화면의 검증은 안내용이고 서버가 다시 본다).
 */
import { REPORT_DEFAULT_GAMES, REPORT_DEFAULT_TEXTS, REPORT_HOST } from "@/lib/groupReport";

// ── 안내 문자 문구 ───────────────────────────────────────────────

export const GROUP_MESSAGE_MAX = 2000;

/** 단체 안내 문자에 쓸 수 있는 치환값 — 이름 · 설명 · 미리보기 예시. groupMessages.ts 의 renderGroupMessage 가 채우는 값과 같아야 한다. */
export const GROUP_PLACEHOLDERS: Record<string, { label: string; example: string }> = {
  leader_name: { label: "담당자 이름", example: "김서윤" },
  group_name: { label: "모임 이름(화면 표시 모임명이 먼저)", example: "방사모 12월 정모" },
  event_date: { label: "행사 날짜", example: "12월 5일 (토)" },
  event_date_full: { label: "행사 날짜(연도까지)", example: "2026년 12월 5일 (토)" },
  event_start: { label: "시작 시각(15:30)", example: "15:30" },
  program_hours: { label: "프로그램 길이(약 3시간)", example: "약 3시간" },
  event_time_ko: { label: "시작 시각(오후 3시 30분)", example: "오후 3시 30분" },
  event_range: { label: "행사 시간(15:30~18:30)", example: "15:30~18:30" },
  arrive_time_ko: { label: "도착 시각(시작 15분 전)", example: "오후 3시 15분" },
  headcount: { label: "인원(숫자만)", example: "16" },
  unit_price: { label: "1인 요금", example: "43,000원" },
  base_amount: { label: "기본 프로그램 금액", example: "688,000원" },
  total: { label: "총 이용 금액", example: "788,000원" },
  deposit_suggest: { label: "예약금 안내 금액(30%)", example: "236,000원" },
  deposit_paid: { label: "받은 예약금", example: "236,000원" },
  balance: { label: "잔금", example: "552,000원" },
  balance_suggest: { label: "예약금 30% 를 내고 남는 금액(견적 안내용)", example: "552,000원" },
  bank_account: { label: "입금 계좌(예금주 포함) — 문구에 계좌를 직접 적지 말고 이 값을 쓴다", example: "(입금 계좌 · 예금주)" },
  leader_form_url: { label: "모임장 신청서 링크", example: "https://www.wouldyouescape.com/f/…" },
  participant_form_url: { label: "참가자 사전 설문 링크", example: "https://www.wouldyouescape.com/f/…" },
  review_form_url: { label: "모임 후기 설문 링크", example: "https://www.wouldyouescape.com/f/…" },
  d7_date: { label: "행사 7일 전 날짜", example: "11월 28일 (토)" },
  team_count: { label: "예상 팀 수", example: "4" },
  // 반복 블록 {{#lines}} … {{/lines}} 안에서만 쓰는 값
  label: { label: "옵션 · 조정 줄 이름(lines 블록 안)", example: "애프터파티 2시간" },
  amount: { label: "옵션 · 조정 줄 금액(lines 블록 안)", example: "100,000원" },
};
/**
 * 덩어리 `{{#이름}} … {{/이름}}`.
 *   lines   — 옵션 · 조정 줄 수만큼 반복(없으면 통째로 빠진다)
 *   deposit — 예약금 30% 로 안내할 때만 나온다
 *   fullpay — 전액 입금으로 안내할 때만 나온다(행사 7일 이내 + 계좌이체 + 회사가 아닌 단체)
 */
export const GROUP_BLOCKS = ["lines", "deposit", "fullpay"] as const;

/** 문구 저장 전 검사. 괜찮으면 null. 모르는 치환값이 있으면 문자에 {{이름}} 이 그대로 찍히므로 막는다. */
export function groupMessageError(body: string): string | null {
  const text = body.replace(/\r\n?/g, "\n");
  const len = Array.from(text.trim()).length;
  if (len === 0) return "본문은 비워둘 수 없습니다.";
  if (len > GROUP_MESSAGE_MAX) return `본문은 ${GROUP_MESSAGE_MAX}자까지 쓸 수 있어요. (지금 ${len}자)`;
  const unknown = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([#/]?)\s*([^{}\s]*)\s*\}\}/g)) {
    const [, mark, name] = m;
    if (mark) {
      if (!(GROUP_BLOCKS as readonly string[]).includes(name)) unknown.add(`{{${mark}${name}}}`);
    } else if (!Object.prototype.hasOwnProperty.call(GROUP_PLACEHOLDERS, name)) {
      unknown.add(`{{${name}}}`);
    }
  }
  if (unknown.size) return `쓸 수 없는 치환값이 있어요: ${[...unknown].join(", ")}`;
  for (const b of GROUP_BLOCKS) {
    const opens = (text.match(new RegExp(`\\{\\{#${b}\\}\\}`, "g")) ?? []).length;
    const closes = (text.match(new RegExp(`\\{\\{/${b}\\}\\}`, "g")) ?? []).length;
    if (opens !== closes) return `{{#${b}}} 와 {{/${b}}} 의 짝이 맞지 않아요.`;
  }
  return null;
}

// ── 체크리스트 양식 ──────────────────────────────────────────────

export const CHECKLIST_TEMPLATE_MAX = 30;
export type ChecklistTemplateItem = { label: string; owner: string };

const line = (v: unknown) =>
  String(v ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F​‌⁠﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const chars = (s: string) => Array.from(s).length;

/** 양식 전체를 정리 · 검사한다. */
export function cleanChecklistTemplate(raw: unknown): { items: ChecklistTemplateItem[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "항목을 읽지 못했습니다." };
  if (raw.length > CHECKLIST_TEMPLATE_MAX) return { error: `항목은 ${CHECKLIST_TEMPLATE_MAX}개까지 둘 수 있어요.` };
  const items: ChecklistTemplateItem[] = [];
  for (const [i, r] of raw.entries()) {
    const label = line((r as { label?: unknown } | null)?.label);
    const owner = line((r as { owner?: unknown } | null)?.owner);
    if (chars(label) < 1 || chars(label) > 60) return { error: `${i + 1}번째 항목은 1~60자로 적어주세요.` };
    if (chars(owner) > 20) return { error: `${i + 1}번째 항목의 담당자는 20자까지 쓸 수 있어요.` };
    items.push({ label, owner });
  }
  return { items };
}

// ── 리포트 기본값 ────────────────────────────────────────────────

export const REPORT_DEFAULTS_KEY = "group.report_defaults";
export type ReportDefaults = { host: string; kicker: string; sub: string; place: string; msg: string; games: string[] };

export const REPORT_DEFAULTS_BASE: ReportDefaults = {
  host: REPORT_HOST,
  kicker: REPORT_DEFAULT_TEXTS.kicker,
  sub: REPORT_DEFAULT_TEXTS.sub,
  place: REPORT_DEFAULT_TEXTS.v2,
  msg: REPORT_DEFAULT_TEXTS.msg,
  games: [...REPORT_DEFAULT_GAMES],
};
export const REPORT_DEFAULT_LIMITS = { host: 60, kicker: 40, sub: 60, place: 40, msg: 200, game: 20, games: 8 } as const;

/** 저장된 값(또는 화면이 보낸 값)을 정리한다. 빠진 칸은 기본값으로 채운다. */
export function cleanReportDefaults(raw: unknown, strict = false): { value: ReportDefaults } | { error: string } {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: ReportDefaults = { ...REPORT_DEFAULTS_BASE, games: [...REPORT_DEFAULTS_BASE.games] };
  for (const k of ["host", "kicker", "sub", "place", "msg"] as const) {
    if (typeof r[k] !== "string") continue;
    const v = line(r[k]);
    if (chars(v) > REPORT_DEFAULT_LIMITS[k]) {
      if (strict) return { error: `${REPORT_DEFAULT_LIMITS[k]}자까지 쓸 수 있는 칸이 넘쳤어요.` };
      continue;
    }
    out[k] = v;
  }
  if (Array.isArray(r.games)) {
    const games = r.games.map(line).filter(Boolean);
    if (games.length < 1 || games.length > REPORT_DEFAULT_LIMITS.games || games.some((g) => chars(g) > REPORT_DEFAULT_LIMITS.game)) {
      if (strict) return { error: `게임은 1~${REPORT_DEFAULT_LIMITS.games}개, 이름은 ${REPORT_DEFAULT_LIMITS.game}자까지 쓸 수 있어요.` };
    } else out.games = games;
  }
  return { value: out };
}
