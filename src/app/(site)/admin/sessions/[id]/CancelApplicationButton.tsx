"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cancelApplicationAdmin } from "./actions";

export function CancelApplicationButton({
  applicationId,
  sessionId,
}: {
  applicationId: string;
  sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await cancelApplicationAdmin(applicationId, sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsCancelled(true);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCancelled) {
    return <span className="text-red-500 text-xs font-semibold">✓ 취소 처리됨</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-danger text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "신청 취소"}
      </button>
      <ConfirmDialog
        open={open}
        title="신청을 취소할까요?"
        message="미입금취소 안내 문자가 신청자에게 발송되고, 신청/입금 상태가 취소로 바뀝니다."
        cancelLabel="아니요"
        confirmLabel="네, 취소"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        danger
        error={error}
      />
    </>
  );
}
