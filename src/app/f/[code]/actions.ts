"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadParticipantStatus, requestIpHash, resolveForm, type ParticipantStatus } from "@/lib/groupFormLinks";
import type { FormDef } from "@/lib/groupForms/schema";
import { flattenTemplate } from "@/lib/groupForms/template";
import { loadTemplate } from "@/lib/groupFormTemplates";
import { cleanText, nicknameWidth, validateForm } from "@/lib/groupForms/validate";

/**
 * 단체 예약 공개 폼의 제출(로그인 없이 링크로만 들어온다).
 *
 * ⚠️ 누구나 부를 수 있다 — 화면을 거치지 않은 요청도 온다고 보고 만든다.
 *    · 토큰으로 그 단체 · 그 폼인지 다시 확인한다(화면이 보낸 단체 id 같은 값은 받지 않는다).
 *    · 답은 양식(schema.ts)으로 다시 정리 · 검증한다. 양식에 없는 열쇠는 버리고, 선택형은 선택지와 대조한다.
 *    · 저장은 DB 함수가 한다 — 거기서 한 번 더 검증하고, 횟수 제한을 걸고, 이름 · 전화번호를 암호화한다.
 * ⚠️ 응답에는 남의 정보를 싣지 않는다. 전화번호로 기존 답이 있는지도 알려주지 않는다(새로 낸 것이든 고친 것이든 같은 응답).
 * ⚠️ 문자 · 알림을 보내지 않는다.
 */

type Result = { ok: true } | { error: string; field?: string };

/** 참가자 설문에서 전용 칸(암호화 칸 포함)으로 가는 질문들. 나머지는 answers(jsonb)로 간다. */
const PARTICIPANT_COLUMNS = new Set(["name", "phone", "nick", "age", "exp", "terms", "privacy", "phoneBox", "photo"]);

/** 사람이 못 보는 칸(honeypot)에 값이 있으면 봇이다. 성공한 것처럼 답하고 저장하지 않는다. */
const isBot = (hp: unknown) => typeof hp === "string" && hp.trim() !== "";

/** DB 함수의 예외 문구에서 우리 안내 문구만 꺼낸다. 그 밖(내부 오류)은 일반 문구로 바꾼다. */
function friendly(message: string): { error: string; field?: string } {
  const known: [RegExp, string | undefined][] = [
    [/닉네임/, "nick"],
    [/한글 8자/, "nick"],
    [/010으로/, "phone"],
    [/이름은/, "name"],
    [/0~9999/, "exp"],
    [/동의가/, "terms"],
    [/별점/, "sat"],
    [/링크가 만료/, undefined],
    [/취소된 모임/, undefined],
    [/잠시 후 다시/, undefined],
    [/제출이 너무 많아/, undefined],
  ];
  for (const [re, field] of known) if (re.test(message)) return { error: message, field };
  console.error("[group-form] 제출 실패", message);
  return { error: "제출하지 못했어요. 잠시 후 다시 시도해주세요." };
}

/** 참가자 사전 설문 제출. 같은 전화번호면 기존 답을 고친 것으로 저장된다. */
export async function submitParticipant(code: string, raw: unknown, hp?: unknown): Promise<Result> {
  try {
    if (isBot(hp)) return { ok: true };
    const form = await resolveForm(String(code ?? ""));
    if (!form || form.formKey !== "participant") return { error: "링크가 만료되었거나 올바르지 않습니다." };
    if (form.cancelled) return { error: "취소된 모임이라 더 받을 수 없습니다." };

    // 지금 쓰는 양식(운영자가 고친 버전)으로 정리 · 검증한다. 화면이 보낸 양식은 믿지 않는다.
    const loaded = await loadTemplate("participant");
    const def: FormDef = { key: "participant", version: loaded.version, title: loaded.template.title, questions: flattenTemplate(loaded.template) };
    const { answers, errors } = validateForm(def, raw);
    const first = def.questions.find((q) => errors[q.id]);
    if (first) return { error: errors[first.id], field: first.id };

    // 이름 · 전화번호 · 닉네임 · 나이대 · 방수 · 약관은 전용 칸으로, 양식에 더한 질문의 답만 answers 로 보낸다.
    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (PARTICIPANT_COLUMNS.has(k) || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      extras[k] = v;
    }

    const { error } = await createAdminClient().rpc("submit_group_participant_v2", {
      p_token: code,
      p_name: answers.name,
      p_phone: answers.phone,
      p_nickname: answers.nick,
      p_age_band: answers.age,
      p_room_count: Number(answers.exp),
      p_consent_terms: answers.terms === true,
      p_consent_privacy: answers.privacy === true,
      p_consent_phone_box: answers.phoneBox === true,
      p_consent_photo: answers.photo === true,
      p_answers: extras,
      p_template_version: loaded.version,
      p_ip_hash: await requestIpHash(code),
    });
    if (error) return friendly(error.message);
    return { ok: true };
  } catch (err) {
    console.error("[group-form] 참가자 제출 오류", err);
    return { error: "제출하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
}

/**
 * 닉네임을 쓸 수 있나 — "쓸 수 있음 / 없음" 만 답한다(누가 쓰는지는 알려주지 않는다).
 * @param ownNick 이 기기에서 이미 낸 사람의 예전 닉네임 — 본인 것은 겹쳐도 된다. 화면이 보낸 값이라 참고만 한다
 *                (최종 판정은 제출 때 DB 함수가 전화번호로 한다).
 */
export async function checkNickname(code: string, nick: string, ownNick?: string): Promise<{ available: boolean } | { error: string }> {
  try {
    const form = await resolveForm(String(code ?? ""));
    if (!form || form.formKey !== "participant") return { error: "링크가 만료되었거나 올바르지 않습니다." };
    const value = cleanText(nick);
    if (!value || nicknameWidth(value) > 12) return { available: false };
    if (ownNick && cleanText(ownNick).toLowerCase() === value.toLowerCase()) return { available: true };
    const { data, error } = await createAdminClient()
      .from("group_participants")
      .select("nickname")
      .eq("inquiry_id", form.inquiryId);
    if (error) throw new Error(error.message);
    const taken = ((data ?? []) as { nickname: string }[]).some((r) => r.nickname.toLowerCase() === value.toLowerCase());
    return { available: !taken };
  } catch (err) {
    console.error("[group-form] 닉네임 확인 오류", err);
    return { error: "확인하지 못했어요. 그대로 진행해도 제출할 때 다시 확인해요." };
  }
}

/** 신청 현황 다시 읽기(「새로고침」 을 눌렀을 때만 — 주기적으로 부르지 않는다). 가린 이름과 닉네임만 돌려준다. */
export async function refreshStatus(code: string): Promise<ParticipantStatus | { error: string }> {
  try {
    const form = await resolveForm(String(code ?? ""));
    if (!form || form.formKey !== "participant") return { error: "링크가 만료되었거나 올바르지 않습니다." };
    return await loadParticipantStatus(form.inquiryId);
  } catch (err) {
    console.error("[group-form] 현황 조회 오류", err);
    return { error: "현황을 불러오지 못했어요." };
  }
}

/** 모임 후기 설문 제출(익명). */
export async function submitReview(code: string, raw: unknown, hp?: unknown): Promise<Result> {
  try {
    if (isBot(hp)) return { ok: true };
    const form = await resolveForm(String(code ?? ""));
    if (!form || form.formKey !== "review") return { error: "링크가 만료되었거나 올바르지 않습니다." };
    if (form.cancelled) return { error: "취소된 모임이라 더 받을 수 없습니다." };

    const loaded = await loadTemplate("review");
    const def: FormDef = { key: "review", version: loaded.version, title: loaded.template.title, questions: flattenTemplate(loaded.template) };
    const { answers, errors } = validateForm(def, raw);
    const first = def.questions.find((q) => errors[q.id]);
    if (first) return { error: errors[first.id], field: first.id };

    // 별점은 따로 칸에 넣고, 나머지 답은 양식에 있는 열쇠만 모아 넘긴다.
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (k === "sat" || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      rest[k] = v;
    }
    const { error } = await createAdminClient().rpc("submit_group_review", {
      p_token: code,
      p_rating: Number(answers.sat),
      p_answers: rest,
      p_template_version: loaded.version,
      p_ip_hash: await requestIpHash(code),
    });
    if (error) return friendly(error.message);
    return { ok: true };
  } catch (err) {
    console.error("[group-form] 후기 제출 오류", err);
    return { error: "제출하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
}
