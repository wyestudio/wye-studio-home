"use client";

import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  children,
  wide = false,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  error,
  confirmDisabled = false,
}: {
  open: boolean;
  title: string;
  message: string;
  children?: ReactNode;
  wide?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      {/*
        신청 폼·완료 화면과 같은 언어로 그린다 — 반투명 카드 + 흐린 테두리.
        예전에는 glass-panel(유리 네온)이라 그 화면들 위에 뜨면 혼자 튀었다.
      */}
      <div
        className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} max-h-[85vh] overflow-y-auto rounded-xl
                    border ${danger ? "border-danger/40" : "border-white/15"}
                    bg-background/95 p-6 shadow-2xl shadow-black/60 animate-scale-in`}
      >
        <h2 className={`text-lg font-bold ${danger ? "text-danger" : "text-foreground"}`}>{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        {children}
        {error && (
          <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/25 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              danger
                ? "bg-danger text-white"
                : "bg-glow text-glow-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
