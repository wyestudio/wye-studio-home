import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenTemplate } from "@/lib/groupForms/template";
import { loadTemplateVersion } from "@/lib/groupFormTemplates";
import type { Question } from "@/lib/groupForms/schema";
import type { Answers } from "@/lib/groupForms/validate";
import type { ReviewInput } from "@/lib/groupReviewSummary";

/**
 * 단체 모임 후기 설문 답 읽기(단체 상세 › 후기 탭). 읽기만 한다 — 고치거나 지우는 길은 없다.
 * ⚠️ 후기는 익명이다(이름 · 연락처 칸이 없다).
 */

/** 그 단체의 후기 답 — 최신순. */
export async function loadReviews(inquiryId: string): Promise<ReviewInput[]> {
  const { data, error } = await createAdminClient()
    .from("group_reviews")
    .select("id, rating, answers, template_version, submitted_at")
    .eq("inquiry_id", inquiryId)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; rating: number; answers: Answers | null; template_version: number; submitted_at: string }[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    answers: r.answers ?? {},
    templateVersion: r.template_version,
    submittedAt: r.submitted_at,
  }));
}

/** 후기 건수 — 탭의 숫자용. 못 읽으면 null(0 으로 속이지 않는다). */
export async function countReviews(inquiryId: string): Promise<number | null> {
  const { count, error } = await createAdminClient().from("group_reviews").select("id", { count: "exact", head: true }).eq("inquiry_id", inquiryId);
  return error ? null : (count ?? 0);
}

/** 답들이 쓰인 양식 버전마다 그때의 질문 목록. */
export async function loadReviewQuestions(reviews: readonly ReviewInput[]): Promise<Map<number, readonly Question[]>> {
  const versions = [...new Set(reviews.map((r) => r.templateVersion))];
  const loaded = await Promise.all(versions.map(async (v) => [v, flattenTemplate((await loadTemplateVersion("review", v)).template)] as const));
  return new Map(loaded);
}
