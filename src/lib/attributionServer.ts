import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeAttribution, type Attribution } from "@/lib/attribution";

/**
 * 신청 건에 유입경로를 붙인다.
 *
 * ⚠️ 신청이 **성공한 뒤** 따로 쓴다. submit_application 계열 함수에 파라미터를
 *    더하지 않는다 — 2026-08-14 에 그 시그니처를 잘못 건드려 서비스가 마비된
 *    적이 있다. 분석용 값 때문에 신청 경로를 다시 흔들 이유가 없다.
 *
 * ⚠️ applications 테이블에는 anon/authenticated 쓰기 권한이 없다.
 *    service_role 로만 쓸 수 있어 createAdminClient() 를 쓴다.
 *
 * ⚠️ 실패해도 조용히 넘어간다. 분석값 때문에 신청이 깨지면 안 된다.
 */
export async function recordAttribution(
  applicationId: string,
  attribution: Attribution | null | undefined
): Promise<void> {
  // 서버 액션 인자든 폼 히든 필드든 사용자가 바꿔 보낼 수 있다. 그대로 쓰지 않는다.
  const row = sanitizeAttribution(attribution);
  if (!row) return; // 전부 비어 있으면(직접 방문) 쓰지 않는다 — 빈 칸이 곧 '직접 방문' 이다.

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("applications").update(row).eq("id", applicationId);
    if (error) console.error("[attribution] 유입경로 기록 실패 (신청 자체는 성공)", error);
  } catch (err) {
    console.error("[attribution] 유입경로 기록 실패 (신청 자체는 성공)", err);
  }
}
