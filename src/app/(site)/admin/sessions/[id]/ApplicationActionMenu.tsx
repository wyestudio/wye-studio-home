"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { confirmPayment, cancelApplicationAdmin, promoteWaitlistApplicant } from "./actions";

type ActionKey = "confirm-payment" | "promote" | "cancel";

const ACTIONS: Record<
  ActionKey,
  {
    label: string;
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    doneLabel: string;
    doneClass: string;
    run: (applicationId: string, sessionId: string) => Promise<{ error?: string; success?: boolean }>;
  }
> = {
  "confirm-payment": {
    label: "입금 확인",
    title: "입금을 확인 처리할까요?",
    message: "입금확인 안내 문자가 신청자에게 발송되고, 입금 상태가 확인됨으로 바뀝니다.",
    confirmLabel: "네, 확인",
    danger: false,
    doneLabel: "✓ 입금 확인됨",
    doneClass: "text-green-500",
    run: confirmPayment,
  },
  promote: {
    label: "대기→확정 전환",
    title: "대기자를 확정으로 전환할까요?",
    message: "유선으로 참여 의사를 확인한 대기자에게만 사용하세요. 공석 입금 안내 문자가 즉시 발송됩니다.",
    confirmLabel: "네, 전환",
    danger: false,
    doneLabel: "✓ 확정 전환됨",
    doneClass: "text-green-500",
    run: promoteWaitlistApplicant,
  },
  cancel: {
    label: "신청 취소",
    title: "신청을 취소할까요?",
    message: "미입금취소 안내 문자가 신청자에게 발송되고, 신청/입금 상태가 취소로 바뀝니다.",
    confirmLabel: "네, 취소",
    danger: true,
    doneLabel: "✓ 취소 처리됨",
    doneClass: "text-red-500",
    run: cancelApplicationAdmin,
  },
};

export function ApplicationActionMenu({
  applicationId,
  sessionId,
  status,
  paymentStatus,
}: {
  applicationId: string;
  sessionId: string;
  status: string;
  paymentStatus: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<ActionKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ActionKey | null>(null);

  const availableActions: ActionKey[] = [];
  if (paymentStatus !== "confirmed" && status === "confirmed") availableActions.push("confirm-payment");
  if (status === "waiting") availableActions.push("promote");
  if (status !== "cancelled") availableActions.push("cancel");

  if (done) {
    const action = ACTIONS[done];
    return <span className={`text-xs font-semibold ${action.doneClass}`}>{action.doneLabel}</span>;
  }

  if (availableActions.length === 0) {
    return null;
  }

  async function handleConfirm() {
    if (!selected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await ACTIONS[selected].run(applicationId, sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(selected);
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        disabled={isLoading}
        className="px-3 py-1 text-xs bg-surface border border-glass-border text-foreground rounded hover:bg-white/5 disabled:opacity-50 transition-opacity"
      >
        {isLoading ? "처리중..." : "액션 ▾"}
      </button>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded-lg border border-glass-border bg-surface shadow-lg">
          {availableActions.map((key) => (
            <button
              key={key}
              onClick={() => {
                setSelected(key);
                setMenuOpen(false);
                setError(null);
              }}
              className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors ${
                ACTIONS[key].danger ? "text-danger" : "text-foreground"
              }`}
            >
              {ACTIONS[key].label}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ConfirmDialog
          open
          title={ACTIONS[selected].title}
          message={ACTIONS[selected].message}
          cancelLabel="아니요"
          confirmLabel={ACTIONS[selected].confirmLabel}
          onCancel={() => {
            setSelected(null);
            setError(null);
          }}
          onConfirm={handleConfirm}
          danger={ACTIONS[selected].danger}
          error={error}
        />
      )}
    </div>
  );
}
