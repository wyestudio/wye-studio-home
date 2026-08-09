"use server";

import { lookupApplication } from "@/lib/lookup";
import type { ApplicationLookupResult } from "@/types/domain";

export type LookupState = {
  error?: string;
  result?: ApplicationLookupResult;
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

  const result = await lookupApplication(phone, confirmationCode);
  if (!result) {
    return { error: "일치하는 신청 내역을 찾을 수 없어요. 전화번호와 접수번호를 다시 확인해주세요." };
  }

  return { result };
}
