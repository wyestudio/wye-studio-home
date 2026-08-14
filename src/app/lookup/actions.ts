"use server";

import { lookupApplication, cancelApplication } from "@/lib/lookup";
import { phoneDigits, isValidPhoneDigits } from "@/lib/phone";
import { deriveLifecycleStatus, type LifecycleStatus } from "@/lib/lookupStatus";
import type { ApplicationLookupResult } from "@/types/domain";

export type LookupState = {
  error?: string;
  result?: ApplicationLookupResult & { lifecycleStatus: LifecycleStatus };
};

export async function lookupAction(
  _prevState: LookupState,
  formData: FormData
): Promise<LookupState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const confirmationCode = String(formData.get("confirmationCode") ?? "").trim();

  if (!phone || !confirmationCode) {
    return { error: "전화번호와 접수번호를 모두 입력해주세요." };
  }

  // 입력값 형식 검증
  const phoneDigitsOnly = phoneDigits(phone);
  if (!isValidPhoneDigits(phoneDigitsOnly)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  if (!/^\d{6}$/.test(confirmationCode)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  const result = await lookupApplication(phone, confirmationCode);
  if (!result) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  const lifecycleStatus = deriveLifecycleStatus({
    status: result.status,
    paymentStatus: result.payment_status,
    startAt: result.start_at,
    endAt: result.end_at,
  });

  return { result: { ...result, lifecycleStatus } };
}

export async function cancelApplicationAction(
  phone: string,
  confirmationCode: string
): Promise<{ success?: boolean; error?: string }> {
  // 형식 검증
  const phoneDigitsOnly = phoneDigits(phone);
  if (!isValidPhoneDigits(phoneDigitsOnly)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  if (!/^\d{6}$/.test(confirmationCode)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  const success = await cancelApplication(phone, confirmationCode);
  if (!success) {
    return { error: "취소 처리 중 오류가 발생했어요. 다시 시도해주세요." };
  }

  return { success: true };
}
