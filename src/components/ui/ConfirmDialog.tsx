"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`glass-panel mx-4 ${wide ? "max-w-lg" : "max-w-sm"} max-h-[85vh] overflow-y-auto rounded-xl p-6 animate-scale-in`}
      >
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        {children}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
