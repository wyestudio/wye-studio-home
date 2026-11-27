import "server-only";
import { getSlackTemplateBody } from "@/lib/slackV2";

/**
 * 모임장 신청서 알림 — 슬랙 **새 채널**(`#단체-모임장-신청서`, 2026-11-27 대표님).
 *
 * 언제: 모임장이 신청서를 냈을 때 · 고쳐 냈을 때 · 수정 요청을 남겼을 때.
 * 무엇: 모임명 · 행사일 · 인원 · 팀 편성 · 확인할 내용 요약 + 관리자의 그 단체 주소.
 *
 * ⚠️ **이름 · 연락처를 싣지 않는다**(docs/05). 견적 신청 알림과 달리 이 알림은 관리자 주소로 들어가서 본다.
 * ⚠️ 웹훅은 `SLACK_GROUP_LEADER_FORM_WEBHOOK_URL`. 비어 있으면 단체 견적 채널(`SLACK_GROUP_BOOKING_WEBHOOK_URL`)로,
 *    그것도 없으면 기본 채널로 보낸다 — 알림이 아예 안 가는 쪽이 더 나쁘다. 제목이 달라 견적 신청과 구분된다.
 * ⚠️ 테스트 서버는 운영과 같은 슬랙 웹훅을 쓴다. 테스트에서는 보내지 않는다(단체 견적 알림과 같다, 2026-10-28 대표님).
 * ⚠️ 알림이 실패해도 신청서 제출을 실패로 돌리지 않는다 — 부르는 쪽이 기다리지 않아도 되게 예외를 삼킨다.
 *
 * 문구는 지금 이 파일의 기본값을 쓴다. slack_templates 에 같은 키(group_leader_submitted · group_leader_edit_request)의
 * 줄이 생기면 그 문구가 먼저다(「단체 도구」 화면을 만드는 단계에 편집 화면이 붙는다).
 */

const ENV_NAMES = ["SLACK_GROUP_LEADER_FORM_WEBHOOK_URL", "SLACK_GROUP_BOOKING_WEBHOOK_URL", "SLACK_WEBHOOK_URL"] as const;

/** 슬랙 웹훅 주소로 쓸 수 있는 값만 고른다(값 칸에 변수 이름이 들어간 사고가 있었다 — slack.ts 의 pickSlackWebhook 과 같은 검사). */
function pickWebhook(): string | null {
  for (const name of ENV_NAMES) {
    const raw = process.env[name]?.trim();
    if (!raw) continue;
    if (raw.startsWith("https://hooks.slack.com/")) return raw;
    console.error(`[slack] ${name} 의 값이 슬랙 웹훅 주소가 아니라 무시합니다.`);
  }
  return null;
}

/** 손님이 쓴 글이라 < > & 를 그대로 두면 슬랙이 링크 · 멘션으로 해석한다. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FALLBACK: Record<"submitted" | "edit_request", string> = {
  submitted: `📝 [단체 신청서] {{title}} — {{group_name}}
행사: {{when}}
인원: {{headcount}}명
팀 편성: {{team}}
{{notes}}
{{admin_url}}`,
  edit_request: `✏️ [단체 신청서] 모임장 수정 요청 — {{group_name}}
행사: {{when}}
요청: {{request}}
{{admin_url}}`,
};

export async function sendGroupLeaderFormSlackAlert(p: {
  kind: "submitted" | "resubmitted" | "edit_request";
  inquiryId: string;
  groupName: string;
  /** '12월 5일 (토) 15:30' 또는 '일정 미정'. */
  when: string;
  headcount: number;
  team?: string;
  /** 확인할 내용(견적과 다른 내용 · 상담이 필요한 내용) 한 줄씩. */
  notes?: string[];
  /** 수정 요청 내용. */
  request?: string;
}): Promise<void> {
  try {
    if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") return;
    const url = pickWebhook();
    if (!url) {
      console.warn("[slack] 쓸 수 있는 웹훅이 없어 모임장 신청서 알림을 건너뜁니다.");
      return;
    }
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com").replace(/\/$/, "");
    const key = p.kind === "edit_request" ? "edit_request" : "submitted";
    const body = await getSlackTemplateBody(`group_leader_${key}`, FALLBACK[key]);
    const vars: Record<string, string> = {
      title: p.kind === "resubmitted" ? "신청서 수정 제출" : "신청서 도착",
      group_name: esc(p.groupName),
      when: p.when,
      headcount: String(p.headcount),
      team: esc(p.team || "-"),
      notes: (p.notes ?? []).length ? `확인할 내용:\n${(p.notes ?? []).map((n) => `• ${esc(n)}`).join("\n")}` : "",
      request: esc(p.request ?? ""),
      admin_url: `${site.replace("www.", "admin.")}/group-bookings/${p.inquiryId}`,
    };
    const text = body
      .replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
      // 빈 값으로 생긴 빈 줄을 정리한다.
      .replace(/\n{2,}/g, "\n")
      .trim();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!res.ok) console.error(`[slack] 모임장 신청서 알림 전송 실패: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("[slack] 모임장 신청서 알림 전송 중 에러", err);
  }
}
