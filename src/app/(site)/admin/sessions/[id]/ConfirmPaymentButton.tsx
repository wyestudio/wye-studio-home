"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { confirmPayment } from "./actions";

export function ConfirmPaymentButton({
  applicationId,
  sessionId,
  confirmationCode,
}: {
  applicationId: string;
  sessionId: string;
  confirmationCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await confirmPayment(applicationId, sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsConfirmed(true);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isConfirmed) {
    return <span className="text-green-500 text-xs font-semibold">✓ 입금 확인됨</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "입금 확인"}
      </button>
      <ConfirmDialog
        open={open}
        title="입금을 확인 처리할까요?"
        message="입금확인 안내 문자가 신청자에게 발송되고, 입금 상태가 확인됨으로 바뀝니다."
        cancelLabel="아니요"
        confirmLabel="네, 확인"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
