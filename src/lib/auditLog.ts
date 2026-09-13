import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 어드민 감사로그.
 *
 * 왜 필요한가: 되돌릴 수 없는 어드민 액션(입금확인·취소·환불완료·쿠폰 발송·
 * 회차 비활성화 등)이 누가 언제 무엇에 대해 했는지 아무 기록도 남지 않았다.
 * 2026-08-14 프로덕션 함수 오삭제로 서비스가 마비됐을 때도 "무엇이 언제
 * 지워졌는지"를 재구성할 수 없었다. 설계 근거: docs/09-implementation-roadmap.md Phase 7
 *
 * ⚠️ **누가** 는 계정 단위로 알 수 없다.
 *    어드민 인증이 공유 비밀번호 하나(ADMIN_PASSWORD)라 사람을 구분할 계정이
 *    없다. actor_name 은 항상 '어드민' 이고 actor_id 는 null 이다.
 *    대신 IP 와 브라우저를 detail 에 남겨 기기 정도는 구분할 수 있게 한다.
 *    운영자 계정·역할이 생기면(Phase 7) 그때 actor 를 실제 사람으로 바꾼다.
 *
 * ⚠️ 이 함수는 **절대 예외를 던지지 않는다.** 로그를 못 남겼다고 해서
 *    입금확인이나 취소 같은 실제 업무가 실패하면 안 된다. 실패는 콘솔에만 남긴다.
 */

/** 기록 대상 액션. 문자열 오타를 막으려고 유니온으로 고정한다. */
export type AuditAction =
  // 신청 건
  | "application.payment_confirmed"
  | "application.cancelled"
  | "application.cancelled_silent"
  | "application.promoted"
  | "application.refund_completed"
  | "application.manual_created"
  | "application.updated"
  // 회차
  | "session.deactivated"
  | "session.reminder_sent"
  | "session.status_changed"
  | "session.min_age_changed"
  | "session.deleted"
  | "schedule.saved"
  // 쿠폰
  | "coupon.sent"
  | "coupon.issued"
  | "coupon.campaign_saved"
  | "coupon.campaign_deleted"
  | "coupon.deleted"
  // 카탈로그·콘텐츠
  | "theme.saved"
  | "theme.deleted"
  | "venue.saved"
  | "venue.deleted"
  | "notice.saved"
  | "notice.deleted"
  | "faq.saved"
  | "faq.deleted"
  | "sms_template.updated"
  | "slack_template.updated";

export type AuditTargetType =
  | "application"
  | "session"
  | "schedule"
  | "coupon"
  | "coupon_campaign"
  | "theme"
  | "venue"
  | "notice"
  | "faq"
  | "sms_template"
  | "slack_template";

/** 요청한 브라우저의 IP·UA. 공유 계정이라 이거라도 남겨야 구분이 된다. */
async function requestContext(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    // Vercel 뒤에 있으므로 x-forwarded-for 의 **맨 앞** 이 실제 클라이언트다.
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip");
    return { ip: ip || null, ua: h.get("user-agent") };
  } catch {
    return { ip: null, ua: null };
  }
}

export async function writeAuditLog(params: {
  action: AuditAction;
  targetType: AuditTargetType;
  /** 대상 식별자. uuid 가 아니어도 된다(문자 템플릿 key 등). */
  targetId: string;
  /** 목록에 한 줄로 보여줄 설명. 개인정보는 넣지 말 것. */
  summary?: string;
  /** 되짚을 때 필요한 값들. 이름·전화번호 같은 평문 개인정보는 넣지 말 것. */
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { ip, ua } = await requestContext();
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: null,
      actor_name: "어드민",
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      summary: params.summary ?? null,
      detail: { ...(params.detail ?? {}), ip, ua },
    });
    if (error) {
      console.error("[audit] 기록 실패", params.action, error.message);
    }
  } catch (err) {
    console.error("[audit] 기록 실패", params.action, err);
  }
}
