"use client";

import { useState } from "react";
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
    <div>
      <button
        onClick={handleConfirm}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "입금 확인"}
      </button>
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  );
}
