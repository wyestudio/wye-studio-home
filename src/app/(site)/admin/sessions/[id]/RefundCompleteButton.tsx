"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { markRefundCompleted } from "./actions";

export function RefundCompleteButton({ applicationId, sessionId }: { applicationId: string; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await markRefundCompleted(applicationId, sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return <span className="text-xs font-semibold text-green-500">✓ 환불 완료 처리됨</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-surface border border-glass-border text-foreground rounded hover:bg-white/5 disabled:opacity-50 transition-opacity"
      >
        {isLoading ? "처리중..." : "환불 완료"}
      </button>
      <ConfirmDialog
        open={open}
        title="환불 완료로 표시할까요?"
        message="실제로 환불 이체가 끝난 뒤에만 눌러주세요. 안내 문자는 발송되지 않습니다."
        cancelLabel="아니요"
        confirmLabel="네, 완료"
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
