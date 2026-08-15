"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deactivateSession } from "./actions";

export function DeactivateSessionButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await deactivateSession(sessionId);
      if (response.error) {
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
      <span className="text-red-500 text-xs font-semibold">
        ✓ 회차 비활성화됨 — 신청 {result.count}/{result.total}건 취소 안내 발송
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs bg-danger text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "회차 비활성화 (최소인원 미달)"}
      </button>
      <ConfirmDialog
        open={open}
        title="이 회차를 비활성화할까요?"
        message="이 회차의 확정·대기 신청 전체가 취소 처리되고, 각 대표 신청자에게 최소인원 미달 취소 안내 문자가 발송됩니다. 되돌릴 수 없습니다."
        cancelLabel="아니요"
        confirmLabel="네, 비활성화"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        danger
        error={error}
      />
    </>
  );
}
