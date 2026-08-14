"use server";

import { after } from "next/server";
import { lookupApplication, cancelApplication } from "@/lib/lookup";
import { phoneDigits, isValidPhoneDigits } from "@/lib/phone";
import { deriveLifecycleStatus, type LifecycleStatus } from "@/lib/lookupStatus";
import { sendCancellationSlackAlert } from "@/lib/slack";
import { calculateRefundAmount } from "@/lib/format";
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
  confirmationCode: string,
  refundInfo?: { bankName: string; accountNumber: string; accountHolder: string },
  lookupResult?: ApplicationLookupResult
): Promise<{ success?: boolean; error?: string }> {
  // 형식 검증
  const phoneDigitsOnly = phoneDigits(phone);
  if (!isValidPhoneDigits(phoneDigitsOnly)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  if (!/^\d{6}$/.test(confirmationCode)) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  const success = await cancelApplication(phone, confirmationCode, refundInfo);
  if (!success) {
    return { error: "취소 처리 중 오류가 발생했어요. 다시 시도해주세요." };
  }

  // 환불 필요한 경우만 Slack 알림 발송 (입금 확정 후 취소일 때) (after()로 감싸서 비동기 처리)
  if (lookupResult && lookupResult.payment_status === "confirmed") {
    const refundAmount = calculateRefundAmount(lookupResult.start_at, lookupResult.price_krw * lookupResult.attendees.length);

    after(async () => {
      try {
        await sendCancellationSlackAlert({
          sessionTitle: lookupResult.session_title,
          confirmationCode: lookupResult.confirmation_code,
          representative: lookupResult.attendees[0],
          refundAmount,
          refundBankName: refundInfo?.bankName,
          refundAccountNumber: refundInfo?.accountNumber,
          refundAccountHolder: refundInfo?.accountHolder,
        });
      } catch (err) {
        console.error("[lookup] 환불 알림 발송 중 에러", err);
      }
    });
  }

  return { success: true };
}
