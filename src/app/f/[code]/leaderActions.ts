"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requestIpHash, resolveForm } from "@/lib/groupFormLinks";
import { leaderFormDef } from "@/lib/groupForms/leaderSchema";
import { flattenTemplate, leaderParts } from "@/lib/groupForms/template";
import { loadTemplate, loadTemplateVersion } from "@/lib/groupFormTemplates";
import { buildPending, consultItems, kindCodeOf, summaryRows, type SummaryRow } from "@/lib/groupForms/leaderForm";
import { OTHER, otherKey, type Question } from "@/lib/groupForms/schema";
import { charLen, cleanMultiline, validateForm, type Answers } from "@/lib/groupForms/validate";
import { loadLeaderAnswers, loadLeaderPrefill, syncEventChecklist } from "@/lib/groupLeader";
import { addDays, dateLabel, kstToday } from "@/lib/groupPricing";
import { sendGroupLeaderFormSlackAlert } from "@/lib/slackGroupLeader";

/**
 * 모임장 신청서의 제출 · 다시 보기 · 수정 요청(로그인 없이 링크로만 들어온다).
 *
 * ⚠️ 누구나 부를 수 있다 — 화면을 거치지 않은 요청도 온다고 보고 만든다.
 *    · 토큰으로 그 단체 · 그 폼인지 다시 확인한다. 단체 id · 금액 · 「확정됐는지」 같은 값은 화면에서 받지 않는다.
 *    · 답은 양식(leaderSchema.ts)으로 다시 정리 · 검증한다. 양식에 없는 열쇠와 조건에 걸려 안 보이는 문항의 값은 버린다.
 *    · 확정된 단체의 일정은 화면이 뭐라고 보내든 바꾸지 않는다.
 * ⚠️ 금액 · 인원 · 일정 · 옵션은 여기서 바꾸지 않는다. 견적과 다르면 「신청서와 다른 내용」 으로 올려 운영자가 반영한다.
 * ⚠️ 낸 답은 휴대폰 번호 끝 4자리가 맞을 때만 돌려준다. 이름 · 휴대폰 번호 전체는 어떤 경우에도 돌려주지 않는다.
 * ⚠️ 문자를 보내지 않는다. 슬랙 알림에는 이름 · 연락처를 싣지 않는다.
 */

type Fail = { error: string; field?: string };

const isBot = (hp: unknown) => typeof hp === "string" && hp.trim() !== "";
const INVALID_LINK = "링크가 만료되었거나 올바르지 않습니다.";
const GENERIC = "처리하지 못했어요. 잠시 후 다시 시도해주세요.";

/** DB 함수의 예외 문구에서 우리 안내 문구만 꺼낸다. 그 밖(내부 오류)은 일반 문구로 바꾼다. */
function friendly(message: string): Fail {
  const known: [RegExp, string | undefined][] = [
    [/이미 제출한 신청서/, undefined],
    [/010으로/, "phone"],
    [/이름은/, "leaderName"],
    [/모임 이름은/, "groupName"],
    [/화면 표시 모임명/, "display"],
    [/환영 문구/, "welcome"],
    [/수정 요청은/, undefined],
    [/링크가 만료/, undefined],
    [/취소된 모임/, undefined],
    [/잠시 후 다시/, undefined],
  ];
  for (const [re, field] of known) if (re.test(message)) return { error: message, field };
  console.error("[group-form] 모임장 신청서 처리 실패", message);
  return { error: GENERIC };
}

const VERIFY_MESSAGE: Record<string, string> = {
  mismatch: "번호 끝 4자리가 맞지 않아요.",
  locked: "여러 번 틀려 잠시 잠겼어요. 15분 뒤에 다시 시도해주세요.",
  none: "아직 제출된 신청서가 없어요.",
};

async function verify(code: string, last4: string): Promise<"ok" | Fail> {
  if (!/^\d{4}$/.test(last4)) return { error: "휴대폰 번호 끝 4자리를 숫자로 입력해주세요." };
  const { data, error } = await createAdminClient().rpc("verify_group_leader_phone", {
    p_token: code,
    p_last4: last4,
    p_ip_hash: await requestIpHash(code),
  });
  if (error) return friendly(error.message);
  return data === "ok" ? "ok" : { error: VERIFY_MESSAGE[String(data)] ?? GENERIC };
}

/** 모임장 신청서 제출. 운영자가 수정을 열어 준 신청서를 고쳐 낼 때는 끝 4자리(last4)가 같이 와야 한다. */
export async function submitLeader(code: string, raw: unknown, hp?: unknown, last4?: string): Promise<{ ok: true } | Fail> {
  try {
    if (isBot(hp)) return { ok: true };
    code = String(code ?? "");
    const form = await resolveForm(code);
    if (!form || form.formKey !== "leader") return { error: INVALID_LINK };
    if (form.cancelled) return { error: "취소된 모임이라 더 받을 수 없습니다." };
    const loaded = await loadLeaderPrefill(form.inquiryId);
    if (!loaded) return { error: INVALID_LINK };
    const { prefill, now } = loaded;
    if (prefill.state === "submitted") return { error: "이미 제출한 신청서예요. 고칠 내용은 수정 요청으로 남겨주세요." };
    if (prefill.state === "reopened") {
      const v = await verify(code, String(last4 ?? ""));
      if (v !== "ok") return v;
    }

    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const tomorrow = addDays(kstToday(), 1);
    const sentName = typeof src.leaderName === "string" && src.leaderName.trim() !== "";
    const sentPhone = typeof src.phone === "string" && src.phone.replace(/\D/g, "") !== "";
    // 휴대폰 번호는 처음 내는데 단체 연락처가 휴대폰 번호가 아닐 때 반드시 받는다.
    const needPhone = prefill.state === "new" && !prefill.phoneMasked;

    const sameSchedule = String(src.date ?? "") === now.date && String(src.time ?? "") === now.time;
    // 지금 쓰는 양식(운영자가 고친 버전)으로 정리 · 검증한다.
    const tpl = await loadTemplate("leader");
    const parts = leaderParts(tpl.template);
    const base: Question[] = parts.base.flatMap((q): Question[] => {
      // 확정된 단체의 일정은 받지 않는다.
      // 견적 때의 일시를 그대로 둔 경우에는 날짜 · 회차 규칙을 다시 따지지 않는다(운영자가 넣은 예외 시간일 수 있다).
      if (q.id === "date") return now.fixed ? [] : [{ ...q, minDate: sameSchedule ? undefined : tomorrow }];
      if (q.id === "time") return now.fixed ? [] : [sameSchedule ? { ...q, dateOf: undefined } : q];
      if (q.id === "leaderName") return sentName ? [q] : [];
      if (q.id === "phone") return needPhone || sentPhone ? [q] : [];
      return [q];
    });
    const second: Question[] = now.fixed ? [] : parts.second.map((q) => (q.type === "date" ? { ...q, minDate: tomorrow } : q));
    const def = leaderFormDef([...base, ...parts.before, ...second, ...parts.after]);

    const { answers, errors } = validateForm(def, src);
    const first = def.questions.find((q) => errors[q.id]);
    if (first) return { error: `${first.label}: ${errors[first.id]}`, field: first.id };

    const headcount = Number(answers.headcount);
    answers.headcount = headcount;
    const kindLabel = String(answers.groupKind ?? "");
    const kind = kindCodeOf(kindLabel);
    if (!kind) return { error: "모임 성격을 다시 골라주세요.", field: "groupKind" };

    // 이름 · 휴대폰 번호는 답(jsonb)에 두지 않는다 — 암호화 칸으로만 간다.
    const leaderName = sentName ? String(answers.leaderName) : "";
    const phone = needPhone || sentPhone ? String(answers.phone) : "";
    const stored: Answers = { ...answers };
    delete stored.leaderName;
    delete stored.phone;
    if (now.fixed) {
      delete stored.date;
      delete stored.time;
    }
    // 건너뛴 선택 문항(빈 글)은 저장하지 않는다.
    for (const k of Object.keys(stored)) if (stored[k] === "") delete stored[k];

    const pending = buildPending(stored, now, !!leaderName);
    const { data, error } = await createAdminClient().rpc("submit_group_leader_form", {
      p_token: code,
      p_answers: stored,
      p_phone: phone,
      p_leader_name: leaderName || null,
      p_group_name: String(answers.groupName),
      p_group_kind: kind,
      p_group_kind_note: kindLabel === OTHER ? String(answers[otherKey("groupKind")] ?? "") : null,
      p_display_name: String(answers.display ?? ""),
      p_welcome_text: String(answers.welcome ?? ""),
      p_pending: pending,
      p_template_version: tpl.version,
      p_ip_hash: await requestIpHash(code),
    });
    if (error) return friendly(error.message);

    // 저장은 끝났다. 뒤따르는 일(체크리스트 줄 · 슬랙)이 실패해도 제출을 실패로 돌리지 않는다.
    try {
      await syncEventChecklist(form.inquiryId);
    } catch (err) {
      console.error("[group-form] 이벤트 체크리스트 줄 추가 실패", err);
    }
    const when = now.fixed || !stored.date ? now.date : String(stored.date);
    const whenTime = now.fixed || !stored.time ? now.time : String(stored.time);
    await sendGroupLeaderFormSlackAlert({
      kind: data === "updated" ? "resubmitted" : "submitted",
      inquiryId: form.inquiryId,
      groupName: String(answers.groupName),
      when: when ? `${dateLabel(when)}${whenTime ? ` ${whenTime}` : ""}${now.fixed ? "" : " (희망)"}` : "일정 미정",
      headcount,
      team: [answers.team, answers.teamHow].filter(Boolean).join(" · "),
      notes: [...pending.map((p) => p.label), ...consultItems(stored)],
    });
    return { ok: true };
  } catch (err) {
    console.error("[group-form] 모임장 신청서 제출 오류", err);
    return { error: GENERIC };
  }
}

export type LeaderView = {
  rows: SummaryRow[];
  /** 잠겨 있으면 보기 전용. 풀려 있으면 고쳐서 다시 낼 수 있다. */
  locked: boolean;
  /** 남겨 둔 수정 요청(아직 처리 전). */
  editRequest: string | null;
  /** 풀려 있을 때만 — 폼에 미리 채울 답. */
  answers: Answers | null;
};

/** 낸 신청서 다시 보기 — 휴대폰 번호 끝 4자리가 맞아야 요약을 돌려준다. */
export async function viewLeader(code: string, last4: string): Promise<LeaderView | Fail> {
  try {
    code = String(code ?? "");
    const form = await resolveForm(code);
    if (!form || form.formKey !== "leader") return { error: INVALID_LINK };
    const v = await verify(code, String(last4 ?? ""));
    if (v !== "ok") return v;
    const res = await loadLeaderAnswers(form.inquiryId);
    if (!res) return { error: VERIFY_MESSAGE.none };
    // 낸 답은 **그때의 양식**으로 읽는다 — 양식을 고친 뒤에도 문항 이름이 어긋나지 않게.
    const then = await loadTemplateVersion("leader", res.templateVersion);
    return {
      rows: summaryRows(res.answers, flattenTemplate(then.template)),
      locked: res.locked,
      editRequest: res.editRequest,
      answers: res.locked ? null : res.answers,
    };
  } catch (err) {
    console.error("[group-form] 모임장 신청서 조회 오류", err);
    return { error: GENERIC };
  }
}

/** 수정 요청 — 운영자의 오늘 할 일과 슬랙에 뜬다. 운영자가 직접 고치거나 수정을 열어 준다. */
export async function requestLeaderEdit(code: string, last4: string, text: string): Promise<{ ok: true } | Fail> {
  try {
    code = String(code ?? "");
    const form = await resolveForm(code);
    if (!form || form.formKey !== "leader") return { error: INVALID_LINK };
    if (form.cancelled) return { error: "취소된 모임이라 더 받을 수 없습니다." };
    if (!/^\d{4}$/.test(String(last4 ?? ""))) return { error: "휴대폰 번호 끝 4자리를 숫자로 입력해주세요." };
    const body = cleanMultiline(text);
    if (charLen(body) < 2 || charLen(body) > 300) return { error: "수정 요청은 2~300자로 적어주세요." };
    const { data, error } = await createAdminClient().rpc("request_group_leader_edit", {
      p_token: code,
      p_last4: last4,
      p_text: body,
      p_ip_hash: await requestIpHash(code),
    });
    if (error) return friendly(error.message);
    if (data !== "ok") return { error: VERIFY_MESSAGE[String(data)] ?? GENERIC };
    await sendGroupLeaderFormSlackAlert({
      kind: "edit_request",
      inquiryId: form.inquiryId,
      groupName: form.groupName,
      when: form.date ? `${dateLabel(form.date)}${form.time ? ` ${form.time}` : ""}` : "일정 미정",
      headcount: form.headcount,
      request: body,
    });
    return { ok: true };
  } catch (err) {
    console.error("[group-form] 수정 요청 오류", err);
    return { error: GENERIC };
  }
}
