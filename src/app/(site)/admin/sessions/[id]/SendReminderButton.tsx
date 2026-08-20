"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { sendSessionReminderAdmin } from "./actions";

export function SendReminderButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendSessionReminderAdmin(sessionId);
      if ("error" in response) {
        setError(response.error);
      } else {
        setResult({ count: response.count ?? 0, total: response.total ?? 0 });
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (result) {
    return (
      <span className="text-glow text-xs font-semibold">
        ✓ 전날안내 발송됨 — {result.count}/{result.total}건
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "전날안내 발송"}
      </button>
      <ConfirmDialog
        open={open}
        title="전날안내 문자를 발송할까요?"
        message="이 회차의 확정+입금확인된 신청 중 아직 전날안내를 받지 않은 대표 신청자 전원에게 문자가 발송됩니다."
        cancelLabel="아니요"
        confirmLabel="네, 발송"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
