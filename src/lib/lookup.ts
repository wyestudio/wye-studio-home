import { createClient } from "@/lib/supabase/server";
import type { ApplicationLookupResult } from "@/types/domain";

export async function lookupApplication(
  phone: string,
  confirmationCode: string
): Promise<ApplicationLookupResult | null> {
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("lookup_application", {
      p_phone_digits: phoneDigits,
      p_confirmation_code: confirmationCode.trim(),
    })
    .maybeSingle();

  if (error) {
    console.error(`[lookup] lookup_application failed: ${error.message}`);
    return null;
  }
  return data as ApplicationLookupResult | null;
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
