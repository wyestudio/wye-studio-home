import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 참여자별 '몇 번째 참여인가' — **운영자 전용**(슬랙 새 예약 알림 · 어드민 회차 화면).
 *
 * 노말모드는 재참여 제한이 없어서, 예약이 들어올 때 처음인지 몇 번째인지를 운영자가
 * 본다(2026-10-18). 판정은 DB 의 admin_participation_history() 한 곳이다 —
 * 같은 휴대폰이 같은 테마 묶음(파티·노말)에서 먼저 접수한, 취소 안 된 신청 수.
 *
 * ⚠️ 고객 화면에 내보내지 않는다. 함수 권한도 service_role 뿐이라 브라우저에서는 못 부른다.
 *    이 파일은 server-only 다 — 클라이언트 컴포넌트가 import 하면 빌드가 깨진다.
 */
export type Participation = {
  attendeeId: string;
  applicationId: string;
  /** 숫자만. 슬랙 알림이 참여자를 번호로 짝짓는다. */
  phone: string;
  /** 이 신청 전의 참여 횟수. 0 이면 첫 참여. */
  priorCount: number;
  /** 이전 참여들의 모드 이름(먼저 것부터). */
  priorLabels: string[];
};

/** 신청 id 들 → 참여자 id 별 이력. 실패하면 빈 Map(표시만 빠지고 화면은 그대로). */
export async function getParticipationHistory(applicationIds: string[]): Promise<Map<string, Participation>> {
  const out = new Map<string, Participation>();
  if (applicationIds.length === 0) return out;
  const { data, error } = await createAdminClient().rpc("admin_participation_history", {
    p_application_ids: applicationIds,
  });
  if (error) {
    console.error("[participation] 이력 조회 실패", error);
    return out;
  }
  for (const r of (data ?? []) as {
    attendee_id: string;
    application_id: string;
    phone: string | null;
    prior_count: number;
    prior_labels: string[] | null;
  }[]) {
    out.set(r.attendee_id, {
      attendeeId: r.attendee_id,
      applicationId: r.application_id,
      phone: (r.phone ?? "").replace(/\D/g, ""),
      priorCount: r.prior_count,
      priorLabels: r.prior_labels ?? [],
    });
  }
  return out;
}

/**
 * 표시용 한 줄. 첫 참여면 null(아무것도 안 붙인다).
 * 예) '재참여 3번째 (노말 2)' · '재참여 2번째 (파티 1)' · '재참여 4번째 (노말 2 · 파티 1)'
 * 모드 이름의 '모드' 는 떼어 짧게 쓴다.
 */
export function revisitLabel(p: Pick<Participation, "priorCount" | "priorLabels"> | undefined): string | null {
  if (!p || p.priorCount <= 0) return null;
  const counts = new Map<string, number>();
  for (const l of p.priorLabels) {
    const k = l.replace(/모드$/, "");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const detail = [...counts].map(([k, n]) => `${k} ${n}`).join(" · ");
  return `재참여 ${p.priorCount + 1}번째${detail ? ` (${detail})` : ""}`;
}
