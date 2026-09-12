"use client";

import { formatKrw } from "@/lib/format";

// 신청 폼과 같은 입력칸 — 반투명 카드 위에 올리는 모양.
const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50";
const label = "block text-xs font-medium text-muted mb-1.5";

export function RefundInfoDialog({
  open,
  refundAmount,
  bankName,
  accountNumber,
  accountHolder,
  error,
  onBankNameChange,
  onAccountNumberChange,
  onAccountHolderChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  refundAmount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  error: string | null;
  onBankNameChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  onAccountHolderChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const isValid = bankName.trim() && accountNumber.trim() && accountHolder.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-xl border border-danger/40 bg-background/95 p-6 shadow-2xl shadow-black/60 animate-scale-in">
        <h2 className="text-lg font-bold text-danger">환불 계좌를 알려주세요</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          입력하신 계좌로 환불해 드립니다. 취소는 되돌릴 수 없습니다.
        </p>

        <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4 text-center">
          <p className="text-xs text-muted">환불 예정 금액</p>
          <p className="mt-1 text-2xl font-extrabold text-foreground">{formatKrw(refundAmount)}</p>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className={label} htmlFor="refundBank">은행명</label>
            <input
              id="refundBank"
              type="text"
              placeholder="예: 국민은행"
              value={bankName}
              onChange={(e) => onBankNameChange(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="refundAccount">계좌번호</label>
            <input
              id="refundAccount"
              type="text"
              inputMode="numeric"
              placeholder="예: 123-456-789012"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="refundHolder">예금주명</label>
            <input
              id="refundHolder"
              type="text"
              placeholder="예: 홍길동"
              value={accountHolder}
              onChange={(e) => onAccountHolderChange(e.target.value)}
              className={field}
            />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted">영업일 기준 3~5일 이내 환불됩니다.</p>

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
            닫기
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-danger px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            취소 및 환불 요청
          </button>
        </div>
      </div>
    </div>
  );
}
