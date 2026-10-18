import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toRefundPolicy, type RefundPolicy } from "@/lib/refundPolicy";
import type { ApplicationLookupResult } from "@/types/domain";

export async function lookupApplication(
  phone: string,
  confirmationCode: string
): Promise<ApplicationLookupResult | null> {
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("lookup_application_v4", {
      p_phone_digits: phoneDigits,
      p_confirmation_code: confirmationCode.trim(),
    })
    .maybeSingle();

  if (error) {
    console.error(`[lookup] lookup_application_v4 failed: ${error.message}`);
    return null;
  }
  if (!data) return null;
  const result = data as ApplicationLookupResult;
  return { ...result, refund_policy: await refundPolicyOfTheme(result.theme_slug) };
}

/**
 * 테마의 환불 규정. 조회 함수(lookup_application_v4)를 고치지 않고 따로 읽는다 —
 * 개인정보를 다루는 함수라 칸 하나 때문에 운영 DB 함수를 교체하지 않는다.
 *
 * ⚠️ 셀프 취소의 환불 금액도 이걸로 다시 구한다. 브라우저가 보낸 조회 결과의
 *    규정 값을 믿지 않는다.
 * ⚠️ 옛 회차(테마 없음)·조회 실패는 standard(파티 규정)다.
 */
export async function refundPolicyOfTheme(slug: string | null): Promise<RefundPolicy> {
  if (!slug) return "standard";
  const { data, error } = await createAdminClient()
    .from("themes")
    .select("refund_policy")
    .eq("slug", slug)
    .maybeSingle();
  if (error) console.error(`[lookup] 테마 환불 규정 조회 실패 (${slug}): ${error.message}`);
  return toRefundPolicy(data?.refund_policy);
}

export async function cancelApplication(
  phone: string,
  confirmationCode: string,
  refundInfo?: { bankName: string; accountNumber: string; accountHolder: string }
): Promise<boolean> {
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_application", {
    p_phone_digits: phoneDigits,
    p_confirmation_code: confirmationCode.trim(),
    p_refund_bank_name: refundInfo?.bankName || null,
    p_refund_account_number: refundInfo?.accountNumber || null,
    p_refund_account_holder: refundInfo?.accountHolder || null,
  });

  if (error) {
    console.error(`[lookup] cancel_application failed: ${error.message}`);
    return false;
  }
  return !!data;
}
