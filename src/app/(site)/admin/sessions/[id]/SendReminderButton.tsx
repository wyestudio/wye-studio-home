"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { sendSessionReminderAdmin, getReminderPreview } from "./actions";
import type { ReminderPreview } from "@/lib/reminderSms";

export function SendReminderButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; total: number } | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setPreview(null);
    setIsPreviewLoading(true);
    try {
      const response = await getReminderPreview(sessionId);
      if ("error" in response) {
        setError(response.error);
      } else {
        setPreview(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

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
        onClick={handleOpen}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isLoading ? "처리중..." : "전날안내 발송"}
      </button>
      <ConfirmDialog
        open={open}
        wide
        title="전날안내 문자를 발송할까요?"
        message={
          isPreviewLoading
            ? "발송 대상을 불러오는 중..."
            : preview
              ? `확정+입금확인된 신청 중 아직 전날안내를 받지 않은 대표 신청자 ${preview.total}명에게 문자가 발송됩니다.`
              : "이 회차의 확정+입금확인된 신청 중 아직 전날안내를 받지 않은 대표 신청자 전원에게 문자가 발송됩니다."
        }
        cancelLabel="아니요"
        confirmLabel="네, 발송"
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        error={error}
        confirmDisabled={isPreviewLoading || isLoading || !!error || (preview?.total ?? 0) === 0}
      >
        {preview && (
          <div className="mt-3 space-y-3">
            {preview.total === 0 ? (
              <p className="text-sm text-muted">발송 대상이 없습니다.</p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">받는 사람 ({preview.total}명)</p>
                <ul className="max-h-32 overflow-y-auto rounded border border-glass-border p-2 text-xs space-y-0.5">
                  {preview.recipients.map((r) => (
                    <li key={r.confirmationCode}>
                      {r.name} [{r.phone}] · 접수번호 {r.confirmationCode}
                    </li>
                  ))}
                </ul>
                {preview.skipped && preview.skipped.length > 0 && (
                  <p className="mt-1 text-xs text-danger">
                    {preview.skipped.length}건은 연락처 없음으로 제외됩니다.
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">발송 내용 (OOO는 받는 사람 이름으로 자동 치환됩니다)</p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-glass-border p-2 text-xs text-muted">
                {preview.messagePreview}
              </pre>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
