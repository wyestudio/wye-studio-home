"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { sendSmsBulk } from "@/lib/smsBulk";
import { fetchMarketingRecipients } from "@/lib/marketingSmsServer";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import {
  AD_SUBJECT,
  LMS_MAX_BYTES,
  SMS_MAX_BYTES,
  buildMarketingSms,
  isQuietHoursKst,
  smsBytes,
} from "@/lib/marketingSms";

/**
 * 광고 문자 발송.
 *
 * 대상은 DB 함수 marketing_sms_recipients() 가 정한다 — 이미 끝난 회차의 실제 참여자 중
 * 본인이 마케팅 수신에 동의했고 수신거부 목록에 없는 사람. 조건은 마이그레이션
 * 20260917091050_marketing_sms.sql 주석 참고.
 */

export type SendResult =
  | { ok: true; sent: number; failures: { name: string; reason: string }[] }
  | { ok: false; error: string };

/** 같은 문구를 이 시간 안에 다시 보내려 하면 막는다(더블클릭·재시도로 중복 발송 방지). */
const RESEND_GUARD_MINUTES = 10;

export async function sendMarketingSms(input: {
  body: string;
  phoneHashes: string[];
}): Promise<SendResult> {
  try {
    const supabase = await requireAdmin();

    // ⚠️ 화면에서도 막지만 서버에서 한 번 더 막는다. 야간 광고는 별도 동의가 필요하다.
    if (isQuietHoursKst()) {
      return { ok: false, error: "밤 9시~아침 8시에는 광고 문자를 보낼 수 없습니다." };
    }
    const body = input.body.trim();
    if (!body) return { ok: false, error: "문구를 입력해주세요." };
    if (input.phoneHashes.length === 0) return { ok: false, error: "보낼 대상을 선택해주세요." };
    if (smsBytes(buildMarketingSms(body, "홍길동")) > LMS_MAX_BYTES) {
      return { ok: false, error: `문구가 너무 깁니다(최대 ${LMS_MAX_BYTES}바이트).` };
    }

    const bodyHash = createHash("sha256").update(body).digest("hex");
    const since = new Date(Date.now() - RESEND_GUARD_MINUTES * 60_000).toISOString();
    const { data: recent } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("action", "marketing_sms.sent")
      .eq("detail->>body_hash", bodyHash)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return {
        ok: false,
        error: `같은 문구를 ${RESEND_GUARD_MINUTES}분 안에 이미 보냈습니다. 중복 발송을 막기 위해 멈췄습니다.`,
      };
    }

    // ⚠️ 화면이 넘겨준 목록을 믿지 않는다. 화면을 연 뒤 수신거부가 등록됐을 수 있어
    //    지금 시점의 대상 목록과 겹치는 사람에게만 보낸다.
    const current = await fetchMarketingRecipients(supabase);
    const wanted = new Set(input.phoneHashes);
    const targets = current.filter((r) => wanted.has(r.phoneHash));
    const dropped = input.phoneHashes.length - targets.length;
    if (targets.length === 0) return { ok: false, error: "보낼 수 있는 대상이 없습니다." };

    const messages = targets.map((r) => {
      const text = buildMarketingSms(body, r.name);
      return {
        key: r.phoneHash,
        to: r.phone,
        text,
        // LMS 는 제목에도 (광고) 를 붙여야 한다. SMS 에는 제목이 없다.
        subject: smsBytes(text) > SMS_MAX_BYTES ? AD_SUBJECT : undefined,
      };
    });

    const { sentKeys, failures } = await sendSmsBulk(messages, "광고 문자");
    const nameByHash = new Map(targets.map((r) => [r.phoneHash, r.name]));

    await writeAuditLog({
      action: "marketing_sms.sent",
      targetType: "marketing_sms",
      targetId: bodyHash.slice(0, 16),
      summary: `광고 문자 발송 — 성공 ${sentKeys.length}/${messages.length}건`,
      detail: {
        body_hash: bodyHash,
        // 문구는 개인정보가 아니다. 무엇을 보냈는지 나중에 확인할 수 있게 남긴다.
        body,
        requested: input.phoneHashes.length,
        dropped_not_eligible: dropped,
        succeeded: sentKeys.length,
        // ⚠️ 이름·전화번호는 넣지 않는다. 해시로만 되짚는다.
        sent_phone_hashes: sentKeys,
      },
    });

    return {
      ok: true,
      sent: sentKeys.length,
      failures: failures.map((f) => ({ name: nameByHash.get(f.key) ?? "", reason: f.reason })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "발송 실패" };
  }
}

export type OptoutResult = { ok: true } | { ok: false; error: string };

export async function addOptout(input: { phone: string; note: string }): Promise<OptoutResult> {
  try {
    const supabase = await requireAdmin();
    const digits = phoneDigits(input.phone);
    if (!isValidPhoneDigits(digits)) return { ok: false, error: "휴대폰 번호 형식이 아닙니다." };
    const note = input.note.trim().slice(0, 200) || null;

    const { error } = await supabase.rpc("add_marketing_optout", { p_phone: digits, p_note: note });
    if (error) throw error;

    await writeAuditLog({
      action: "marketing_optout.added",
      targetType: "marketing_sms",
      targetId: "optout",
      summary: "광고 수신거부 등록",
      detail: { note },
    });
    revalidatePath("/admin/marketing-sms");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "등록 실패" };
  }
}

export async function removeOptout(phoneHash: string): Promise<OptoutResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.rpc("remove_marketing_optout", { p_phone_hash: phoneHash });
    if (error) throw error;

    await writeAuditLog({
      action: "marketing_optout.removed",
      targetType: "marketing_sms",
      targetId: phoneHash.slice(0, 16),
      summary: "광고 수신거부 해제",
    });
    revalidatePath("/admin/marketing-sms");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "해제 실패" };
  }
}
