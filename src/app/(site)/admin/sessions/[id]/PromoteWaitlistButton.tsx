"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { promoteWaitlistApplicant } from "./actions";

export function PromoteWaitlistButton({
  applicationId,
  sessionId,
}: {
  applicationId: string;
  sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPromoted, setIsPromoted] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await promoteWaitlistApplicant(applicationId, sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsPromoted(true);
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isPromoted) {
    return <span className="text-green-500 text-xs font-semibold">✓ 확정 전환됨</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "대기→확정 전환"}
      </button>
      <ConfirmDialog
        open={open}
        title="대기자를 확정으로 전환할까요?"
        message="유선으로 참여 의사를 확인한 대기자에게만 사용하세요. 공석 입금 안내 문자가 즉시 발송됩니다."
        cancelLabel="아니요"
        confirmLabel="네, 전환"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
