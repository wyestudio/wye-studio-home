import { SCALE_LABELS, type Question } from "@/lib/groupForms/schema";
import { answerText } from "@/lib/groupForms/leaderForm";
import type { Answers } from "@/lib/groupForms/validate";

/**
 * 단체 모임 후기 설문 답을 화면 · CSV 용으로 정리한다(단체 상세 › 후기 탭).
 *
 * 순수 함수만 둔다 — DB 를 읽는 쪽은 groupReviews.ts.
 * ⚠️ 후기는 익명이다. 여기서 다루는 값에 이름 · 연락처는 없다.
 * ⚠️ 답은 **그 답을 낼 때의 양식**으로 읽는다. 양식을 고친 뒤에도 옛 답의 질문 이름 · 선택지가 어긋나지 않게,
 *    버전마다 질문 목록을 받아 쓴다.
 */

/** 별점 질문의 열쇠. 별점은 answers 가 아니라 rating 칸에 따로 들어간다. */
const RATING_ID = "sat";

export type ReviewInput = {
  id: string;
  rating: number;
  answers: Answers;
  templateVersion: number;
  submittedAt: string;
};

/** 버전 → 그 버전의 질문들(묶음을 편 순서). */
export type QuestionsByVersion = ReadonlyMap<number, readonly Question[]>;

/** 건수 · 평균 · 점수별 건수(5점부터). 답이 없으면 평균은 null — 0점으로 보이지 않게. */
export function ratingSummary(ratings: readonly number[]): { count: number; average: number | null; dist: { score: number; label: string; count: number }[] } {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  const dist = [5, 4, 3, 2, 1].map((score) => ({ score, label: SCALE_LABELS[score], count: valid.filter((r) => r === score).length }));
  return { count: valid.length, average: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null, dist };
}

/**
 * 모든 버전의 질문을 한 줄로 — 가장 새 버전의 순서를 먼저 쓰고, 옛 버전에만 있던 질문은 뒤에 붙인다.
 * 같은 열쇠가 여러 버전에 있으면 가장 새 버전의 이름을 쓴다. 별점 질문은 뺀다.
 */
export function mergedQuestions(byVersion: QuestionsByVersion): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const version of [...byVersion.keys()].sort((a, b) => b - a)) {
    for (const q of byVersion.get(version) ?? []) {
      if (q.id === RATING_ID || seen.has(q.id)) continue;
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

const questionsOf = (r: ReviewInput, byVersion: QuestionsByVersion): readonly Question[] =>
  (byVersion.get(r.templateVersion) ?? []).filter((q) => q.id !== RATING_ID);

/** 하나만 고르는 질문(연령대 · 추천 여부 등)마다 선택지별 건수. 답이 한 건도 없는 질문은 뺀다. */
export function choiceBreakdowns(reviews: readonly ReviewInput[], byVersion: QuestionsByVersion): { id: string; label: string; total: number; rows: { option: string; count: number }[] }[] {
  return mergedQuestions(byVersion)
    .filter((q) => q.type === "radio")
    .map((q) => {
      const counts = new Map<string, number>();
      // 선택지 순서를 지킨다. 지금 선택지에 없는 값(옛 양식 · 기타)은 뒤에 붙는다.
      for (const o of q.options ?? []) counts.set(o, 0);
      let total = 0;
      for (const r of reviews) {
        const own = questionsOf(r, byVersion).find((x) => x.id === q.id);
        if (!own) continue;
        const value = answerText(own, r.answers);
        if (value === "-") continue;
        counts.set(value, (counts.get(value) ?? 0) + 1);
        total += 1;
      }
      return { id: q.id, label: q.label, total, rows: [...counts].map(([option, count]) => ({ option, count })) };
    })
    .filter((b) => b.total > 0);
}

export type ReviewItem = {
  id: string;
  rating: number;
  ratingLabel: string;
  submittedAt: string;
  /** 고르는 질문의 답 — 짧아서 배지로 보여준다. */
  choices: { label: string; value: string }[];
  /** 적는 질문의 답. */
  texts: { label: string; value: string }[];
};

/** 답 한 건씩 — 그 답의 양식 순서대로, 비어 있는 답은 뺀다. */
export function reviewItems(reviews: readonly ReviewInput[], byVersion: QuestionsByVersion): ReviewItem[] {
  return reviews.map((r) => {
    const filled = questionsOf(r, byVersion)
      .map((q) => ({ q, value: answerText(q, r.answers) }))
      .filter((x) => x.value !== "-");
    const isChoice = (q: Question) => q.type === "radio" || q.type === "checkbox";
    return {
      id: r.id,
      rating: r.rating,
      ratingLabel: SCALE_LABELS[r.rating] ?? "",
      submittedAt: r.submittedAt,
      choices: filled.filter((x) => isChoice(x.q)).map((x) => ({ label: x.q.label, value: x.value })),
      texts: filled.filter((x) => !isChoice(x.q)).map((x) => ({ label: x.q.label, value: x.value })),
    };
  });
}

/** CSV — 제출 시각 · 별점 · 질문마다 한 칸. 그 답의 양식에 없던 질문 칸은 비운다. */
export function reviewsCsv(
  reviews: readonly ReviewInput[],
  byVersion: QuestionsByVersion,
  formatAt: (iso: string) => string
): { headers: string[]; rows: (string | number)[][] } {
  const columns = mergedQuestions(byVersion);
  return {
    headers: ["제출 시각", "별점", ...columns.map((q) => q.label)],
    rows: reviews.map((r) => {
      const own = questionsOf(r, byVersion);
      return [
        formatAt(r.submittedAt),
        r.rating,
        ...columns.map((c) => {
          const q = own.find((x) => x.id === c.id);
          const value = q ? answerText(q, r.answers) : "-";
          return value === "-" ? "" : value;
        }),
      ];
    }),
  };
}
