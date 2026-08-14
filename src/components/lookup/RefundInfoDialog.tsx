"use client";

import { Button } from "@/components/ui/Button";
import { formatKrw } from "@/lib/format";

function textInputClassName(invalid: boolean) {
  return `w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-shadow ${
    invalid
      ? "border-danger bg-danger-soft text-danger"
      : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
  }`;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel mx-4 max-w-sm rounded-xl p-6 animate-scale-in">
        <h2 className="text-lg font-bold text-foreground">환불 정보</h2>
        <p className="mt-2 text-sm text-muted">환불받을 계좌 정보를 입력해주세요.</p>

        <div className="mt-4 p-3 rounded-lg bg-brand/10 border border-brand/30">
          <p className="text-sm text-muted">환불예정금액</p>
          <p className="mt-1 text-lg font-bold text-foreground">{formatKrw(refundAmount)}</p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground">은행명</label>
            <input
              type="text"
              placeholder="예: 국민은행"
              value={bankName}
              onChange={(e) => onBankNameChange(e.target.value)}
              className={`${textInputClassName(false)} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">계좌번호</label>
            <input
              type="text"
              placeholder="예: 123-456-789012"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              className={`${textInputClassName(false)} mt-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">예금주명</label>
            <input
              type="text"
              placeholder="예: 홍길동"
              value={accountHolder}
              onChange={(e) => onAccountHolderChange(e.target.value)}
              className={`${textInputClassName(false)} mt-1.5`}
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-muted text-center">영업일 기준 2~3일 내 환불처리 됩니다.</p>

        {error && <p className="mt-3 text-xs text-center text-danger">{error}</p>}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            닫기
          </Button>
          <Button
            variant={isValid ? "primary" : "outline"}
            disabled={!isValid}
            onClick={onConfirm}
            className="flex-1"
          >
            취소 및 환불 요청
          </Button>
        </div>
      </div>
    </div>
  );
}
