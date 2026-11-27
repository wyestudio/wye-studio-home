import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_FORM, type Question } from "@/lib/groupForms/schema";
import { choiceBreakdowns, mergedQuestions, ratingSummary, reviewItems, reviewsCsv, type ReviewInput } from "@/lib/groupReviewSummary";

const v1 = REVIEW_FORM.questions as readonly Question[];
// 버전 2 — 「추천 여부」 이름을 바꾸고, 질문 하나를 더하고, 「개선할 점」 을 뺐다.
const v2: Question[] = [
  ...v1.filter((q) => q.id !== "more").map((q) => (q.id === "rec" ? { ...q, label: "추천" } : q)),
  { id: "x1", label: "다시 올 생각", type: "radio", options: ["네", "아니요"] },
];
const byVersion = new Map<number, readonly Question[]>([
  [1, v1],
  [2, v2],
]);

const review = (i: number, over: Partial<ReviewInput> = {}): ReviewInput => ({
  id: `r${i}`,
  rating: 5,
  answers: { age: "만 20~29세", fun: "마지막 문제", rec: "추천해요", why: "팀 대항이라 몰입됐어요" },
  templateVersion: 1,
  submittedAt: `2026-11-2${i}T03:00:00Z`,
  ...over,
});

test("별점 — 건수 · 평균 · 점수별 건수, 답이 없으면 평균은 null", () => {
  const s = ratingSummary([5, 5, 4, 2]);
  assert.equal(s.count, 4);
  assert.equal(s.average, 4);
  assert.deepEqual(s.dist.map((d) => [d.score, d.count]), [[5, 2], [4, 1], [3, 0], [2, 1], [1, 0]]);
  assert.equal(s.dist[0].label, "최고였어요");
  assert.equal(ratingSummary([]).average, null);
  // 범위를 벗어난 값은 세지 않는다(DB 가 막지만 평균을 흐리지 않게).
  assert.equal(ratingSummary([5, 0, 6, 3.5]).count, 1);
});

test("질문 합치기 — 새 버전 순서 먼저, 옛 버전에만 있던 질문은 뒤에, 별점 질문은 뺀다", () => {
  const ids = mergedQuestions(byVersion).map((q) => q.id);
  assert.deepEqual(ids, ["age", "fun", "rec", "why", "x1", "more"]);
  assert.equal(mergedQuestions(byVersion).find((q) => q.id === "rec")?.label, "추천");
});

test("고르는 질문의 분포 — 선택지 순서를 지키고, 답이 없는 질문은 뺀다", () => {
  const list = [review(1), review(2, { answers: { age: "만 30~39세", rec: "잘 모르겠어요" } }), review(3, { templateVersion: 2, answers: { age: "만 20~29세", rec: "추천해요", x1: "네" } })];
  const b = choiceBreakdowns(list, byVersion);
  assert.deepEqual(b.map((x) => x.id), ["age", "rec", "x1"]);
  const rec = b.find((x) => x.id === "rec")!;
  assert.equal(rec.total, 3);
  assert.deepEqual(rec.rows, [
    { option: "추천해요", count: 2 },
    { option: "추천하지 않아요", count: 0 },
    { option: "잘 모르겠어요", count: 1 },
  ]);
  assert.equal(b.find((x) => x.id === "x1")!.total, 1);
  assert.deepEqual(choiceBreakdowns([], byVersion), []);
});

test("답 한 건 — 그 답의 양식 이름으로 읽고 빈 답은 뺀다", () => {
  const [a, b] = reviewItems([review(1, { rating: 2, answers: { age: "만 20~29세", fun: "보물찾기", rec: "추천하지 않아요", why: "설명이 길었어요", more: "" } }), review(2, { templateVersion: 2, answers: { rec: "추천해요", x1: "네" } })], byVersion);
  assert.equal(a.ratingLabel, "그저 그랬어요");
  assert.deepEqual(a.choices, [
    { label: "연령대", value: "만 20~29세" },
    { label: "추천 여부", value: "추천하지 않아요" },
  ]);
  assert.deepEqual(a.texts.map((t) => t.label), ["제일 재밌었던 문제 혹은 순간", "그렇게 답한 이유"]);
  // 버전 2 답은 버전 2 의 이름(「추천」)으로 나온다.
  assert.deepEqual(b.choices, [
    { label: "추천", value: "추천해요" },
    { label: "다시 올 생각", value: "네" },
  ]);
});

test("CSV — 질문마다 한 칸, 그 답의 양식에 없던 질문 칸은 비운다", () => {
  const csv = reviewsCsv([review(1, { answers: { age: "만 20~29세", fun: "a", rec: "추천해요", why: "b", more: "c", x1: "네" } }), review(2, { templateVersion: 2, answers: { age: "만 30~39세", x1: "아니요", more: "옛 칸" } })], byVersion, (iso) => iso.slice(0, 10));
  assert.deepEqual(csv.headers, ["제출 시각", "별점", "연령대", "제일 재밌었던 문제 혹은 순간", "추천", "그렇게 답한 이유", "다시 올 생각", "추가됐으면 하는 콘텐츠나 개선할 점"]);
  // 버전 1 답: 버전 1 양식에 없는 x1 칸은 비고, more 는 채워진다.
  assert.deepEqual(csv.rows[0], ["2026-11-21", 5, "만 20~29세", "a", "추천해요", "b", "", "c"]);
  // 버전 2 답: 버전 2 양식에서 뺀 more 칸은 비운다(값이 남아 있어도 그때 묻지 않은 질문이다).
  assert.deepEqual(csv.rows[1], ["2026-11-22", 5, "만 30~39세", "", "", "", "아니요", ""]);
});
