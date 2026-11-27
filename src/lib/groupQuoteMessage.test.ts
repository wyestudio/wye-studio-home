import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { renderTemplate } from "@/lib/messageTemplate";
import { GROUP_MESSAGE_MAX, groupMessageError } from "@/lib/groupToolRules";
import {
  QUOTE_DEFAULT_BODY,
  QUOTE_PLACEHOLDERS,
  dateFull,
  dropBlock,
  isQuoteVariant,
  programHours,
  quoteTemplateKey,
  quoteVariantOf,
  tidyBlankLines,
} from "@/lib/groupQuoteMessage";

// 대표님이 주신 예시(2026-11-15 일 13:30 · 15명 · 645,000원)와 같은 값
const vars = {
  leader_name: "김가짜",
  group_name: "3040 방탈출 패밀리",
  event_date: "11월 15일 (일)",
  event_date_full: "2026년 11월 15일 (일)",
  event_start: "13:30",
  event_time_ko: "오후 1시 30분",
  event_range: "13:30~16:30",
  program_hours: "약 3시간",
  headcount: "15",
  unit_price: "43,000원",
  base_amount: "645,000원",
  total: "645,000원",
  deposit_suggest: "193,500원",
  balance_suggest: "451,500원",
  bank_account: "(입금 계좌 · 예금주)",
  leader_form_url: "https://example.test/f/abc",
  d7_date: "11월 8일 (일)",
};
// 실제 문구 만들기(groupMessages.ts)와 같은 순서 — 옵션 · 조정 줄이 없으면 그 덩어리를 지우고, 채우고, 빈 줄을 정리한다.
const render = (body: string, full: boolean) =>
  tidyBlankLines(renderTemplate(dropBlock(body, "lines"), vars, { lines: [], deposit: full ? [] : [{}], fullpay: full ? [{}] : [] }));

test("양식 고르기 — 회사 워크숍이면 회사용, 그 밖은 일반용", () => {
  assert.equal(quoteVariantOf("company"), "company");
  for (const kind of ["school", "friends", "escape", "boardgame", "church", "etc", null, undefined, ""]) assert.equal(quoteVariantOf(kind), "general");
  assert.equal(quoteTemplateKey("general"), "group_quote");
  assert.equal(quoteTemplateKey("company"), "group_quote_company");
  assert.equal(isQuoteVariant("company"), true);
  assert.equal(isQuoteVariant("vip"), false);
});

test("프로그램 길이 · 연도까지 적은 날짜", () => {
  assert.equal(programHours(180), "약 3시간");
  assert.equal(programHours(210), "약 3시간 30분");
  assert.equal(programHours(300), "약 5시간");
  assert.equal(dateFull("2026-11-15"), "2026년 11월 15일 (일)");
});

test("기본 문구 — 저장 규칙을 통과하고(모르는 치환값 · 짝 안 맞는 덩어리 없음) 치환값 목록과 맞는다", () => {
  for (const body of Object.values(QUOTE_DEFAULT_BODY)) {
    assert.equal(groupMessageError(body), null);
    assert.ok(Array.from(body).length <= GROUP_MESSAGE_MAX);
    const used = new Set([...body.matchAll(/\{\{[#/]?(\w+)\}\}/g)].map((m) => m[1]));
    assert.deepEqual([...used].sort(), [...QUOTE_PLACEHOLDERS].sort());
  }
});

test("회사용 — 예약금 30% 안내. 카드결제 · 세금계산서 두 줄이 들어가고 전액 안내는 안 나온다", () => {
  const text = render(QUOTE_DEFAULT_BODY.company, false);
  assert.match(text, /^안녕하세요, 김가짜님!\n우주이스케이프입니다 🚀/);
  assert.ok(text.includes("• 모임명: 3040 방탈출 패밀리\n• 일시: 2026년 11월 15일 (일) 13:30\n• 인원: 총 15명\n• 프로그램: 약 3시간 (13:30~16:30)\n• 진행 방식: 팀별 경쟁형 방탈출"));
  // 옵션 · 조정 줄이 없으면 그 자리는 빈 줄 없이 붙는다.
  assert.ok(text.includes("• 방탈출: 15명 × 43,000원 = 645,000원\n• 총 이용 금액: 645,000원"));
  assert.ok(text.includes("예약 확정을 위해 총 이용 금액의 30%인 193,500원을 아래 계좌로 입금 부탁드립니다.\n\n• 예약금: 193,500원\n• (입금 계좌 · 예금주)"));
  assert.ok(text.includes("• 잔금: 451,500원\n• 최종 참여 인원은 행사 7일 전인 11월 8일 (일)까지 확정 부탁드립니다."));
  assert.ok(text.includes("• 카드결제 및 세금계산서 발행도 가능합니다.\n• 카드결제를 희망하실 경우, 이용 당일 기존 계좌이체 금액을 환불한 후 카드결제로 변경해드릴 수 있습니다.\n\n입금 후 말씀해주시면"));
  assert.ok(!text.includes("전액 결제 시 확정"));
  assert.ok(text.endsWith("감사합니다! 😊"));
  // 치환 안 된 자리 · 연달아 빈 줄이 남지 않는다.
  assert.ok(!/\{\{/.test(text));
  assert.ok(!/\n{3,}/.test(text));
});

test("일반용 — 회사용에서 카드결제 두 줄만 빠진다", () => {
  const general = render(QUOTE_DEFAULT_BODY.general, false);
  const company = render(QUOTE_DEFAULT_BODY.company, false);
  assert.ok(!general.includes("카드결제"));
  assert.ok(!general.includes("세금계산서"));
  const withoutCard = company
    .split("\n")
    .filter((l) => !l.includes("카드결제"))
    .join("\n");
  assert.equal(general, withoutCard);
});

test("7일 이내 전액 안내 — 예약금 · 잔금 덩어리가 통째로 빠지고 전액 안내만 나온다", () => {
  const text = render(QUOTE_DEFAULT_BODY.general, true);
  assert.ok(text.includes("[결제 안내]\n\n행사 7일 이내 예약은 전액 결제 시 확정됩니다. 총 이용 금액 645,000원을 아래 계좌로 입금 부탁드립니다.\n\n• 입금 금액: 645,000원\n• (입금 계좌 · 예금주)"));
  for (const gone of ["[예약금 안내]", "30%", "• 예약금:", "[잔금 및 결제 안내]", "• 잔금:"]) assert.ok(!text.includes(gone), gone);
  assert.ok(!/\{\{/.test(text));
  assert.ok(!/\n{3,}/.test(text));
});

test("마이그레이션이 넣는 문구가 코드의 기본 문구와 글자까지 같다", () => {
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const file = readdirSync(dir).find((f) => f.endsWith("_group_quote_templates.sql"));
  assert.ok(file, "group_quote_templates 마이그레이션 파일이 있어야 한다");
  const sql = readFileSync(new URL(file!, dir), "utf8");
  assert.ok(sql.includes(`$t$${QUOTE_DEFAULT_BODY.general}$t$`));
  assert.ok(sql.includes(`$t$${QUOTE_DEFAULT_BODY.company}$t$`));
});
