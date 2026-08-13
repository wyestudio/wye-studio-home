"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatRefundDeadline, formatSessionDateTime } from "@/lib/format";
import { formatPhoneDigits, formatPhoneInput, phoneDigits, isValidPhoneDigits } from "@/lib/phone";
import { getThemeBaseName, isDatingTheme } from "@/lib/theme";
import { ThemeTag } from "@/components/ui/ThemeTag";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { EXPERIENCE_RANGE_LABELS, getValidationErrorMessage } from "@/lib/validation";
import { lookupAction, cancelApplicationAction, type LookupState } from "@/app/lookup/actions";
import type { ApplicationStatus, PaymentStatus, SessionSlot } from "@/types/domain";

const initialState: LookupState = {};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  confirmed: "참가확정",
  waiting: "참가대기",
  cancelled: "취소됨",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "입금 확인 전",
  confirmed: "입금 확인됨",
  cancelled: "취소됨",
};

const SLOT_LABEL: Record<SessionSlot, string> = {
  afternoon: "오후",
  evening: "저녁",
};

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookupAction, initialState);
  const [phone, setPhone] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  function validateForm() {
    const errors: { field: string; message: string }[] = [];
    if (!confirmationCode.trim()) {
      errors.push({ field: "confirmationCode", message: getValidationErrorMessage("confirmationCode", "required") });
    } else if (!/^\d{6}$/.test(confirmationCode)) {
      errors.push({ field: "confirmationCode", message: getValidationErrorMessage("confirmationCode", "invalid") });
    }
    if (!phone.trim()) {
      errors.push({ field: "phone", message: getValidationErrorMessage("phone", "required") });
    } else if (!isValidPhoneDigits(phoneDigits(phone))) {
      errors.push({ field: "phone", message: getValidationErrorMessage("phone", "invalid") });
    }
    return errors;
  }

  const validationErrors = submitAttempted ? validateForm() : [];
  const confirmationCodeError = validationErrors.find((e) => e.field === "confirmationCode")?.message;
  const phoneError = validationErrors.find((e) => e.field === "phone")?.message;

  function handleSubmitPointerEnter(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
    const diagonal = Math.hypot(rect.width, rect.height);
    el.style.setProperty("--fill-size", `${diagonal * 2}px`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const errors = validateForm();
    if (errors.length > 0) {
      e.preventDefault();
      setSubmitAttempted(true);
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelApplicationAction(phone, confirmationCode);
      if (result.error) {
        setCancelError(result.error);
      } else {
        setCancelled(true);
        setShowCancelDialog(false);
      }
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setCancelling(false);
    }
  }

  if (cancelled) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">취소되었습니다.</p>
      </div>
    );
  }

  if (state.result) {
    const { result } = state;
    const isGroup = result.attendees.length > 1;
    const representative = result.attendees[0];
    const smsRecipientLabel = isGroup ? "대표 신청자" : "신청자";
    const accentColor = isDatingTheme(result.theme_label) ? "#ff5ec4" : "#3dffb0";

    return (
      <div className="mx-auto max-w-[560px]">
        <div className="flex flex-col gap-6 rounded-xl glass-panel p-6">
          {/* 접수번호 */}
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm text-muted">접수번호</p>
            <p className="text-3xl font-extrabold">{result.confirmation_code}</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.confirmation_code);
                } catch {
                  // no-op
                }
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              복사
            </button>
          </div>

          {/* 상태 뱃지 */}
          <div className="flex items-center gap-2 justify-center">
            <Badge tone={result.status === "confirmed" ? "confirm" : "wait"}>
              {STATUS_LABEL[result.status]}
            </Badge>
            <Badge tone={result.payment_status === "confirmed" ? "confirm" : "neutral"}>
              {PAYMENT_LABEL[result.payment_status]}
            </Badge>
          </div>

          {/* 대기 상태 안내 */}
          {result.status === "waiting" && result.waiting_number ? (
            <div className="text-center">
              <p className="text-sm text-muted">대기번호 {result.waiting_number}번</p>
              <p className="mt-1 text-xs text-muted">
                정원이 마감되었습니다. 취소 발생 시 신청자 전화번호로 연락드리겠습니다.
              </p>
            </div>
          ) : null}

          {/* 2열: 신청 정보 | 신청자 정보 */}
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="flex flex-col gap-2 pr-6">
              <p className="text-sm font-bold text-muted">신청 정보</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: accentColor }}>
                  {getThemeBaseName(result.theme_label)}
                </span>
                <ThemeTag themeLabel={result.theme_label} />
              </div>
              <p className="text-sm text-foreground">{formatSessionDateTime(result.start_at)}</p>
              <p className="text-sm text-muted">{result.venue_area}</p>
            </div>

            <div className="flex flex-col gap-2 pl-6">
              <p className="text-sm font-bold text-muted">신청자 정보</p>
              <ul className="flex flex-col gap-2 text-sm">
                {result.attendees.map((attendee, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <div className="text-foreground">
                      <span className="font-semibold">
                        {attendee.name}
                        {attendee.nickname ? ` (${attendee.nickname})` : ""}
                      </span>
                      <span className="text-muted">
                        {" "}· {formatPhoneDigits(attendee.phone)} · {attendee.birth_year}년생
                        {attendee.gender ? ` · ${attendee.gender === "M" ? "남성" : "여성"}` : ""}
                        {isGroup && attendee.is_representative ? " · 대표 신청자" : ""}
                      </span>
                    </div>
                    {attendee.experience_range ? (
                      <div className="text-xs text-muted">
                        방탈출 경험: {EXPERIENCE_RANGE_LABELS[attendee.experience_range]}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 비고 */}
          {result.notes ? (
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="mb-2 font-bold">비고</p>
              <p className="text-muted">{result.notes}</p>
            </div>
          ) : null}

          {/* 입금 안내 */}
          <p className="text-center text-sm text-muted">
            {smsRecipientLabel} 전화번호({representative ? formatPhoneDigits(representative.phone) : ""})로 입금 안내를 문자로 전송드렸어요.
          </p>

          {/* 환불 기한 */}
          <div className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
            <p className="font-bold">환불 기한</p>
            <p className="mt-1">
              {formatRefundDeadline(result.event_date)}까지 취소 시 환불 가능하며, 이후에는 환불이 불가해요.
            </p>
          </div>
        </div>

        {/* 버튼 행 */}
        <div className="mt-6 flex gap-3">
          <Link
            href="/lookup"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-all hover:bg-white/5"
          >
            돌아가기
          </Link>
          <Button
            variant="danger"
            onClick={() => setShowCancelDialog(true)}
            className="flex-1"
          >
            취소하기
          </Button>
        </div>

        {cancelError ? (
          <p className="mt-4 text-center text-sm text-danger">{cancelError}</p>
        ) : null}

        <ConfirmDialog
          open={showCancelDialog}
          title="정말 취소하시겠어요?"
          message="한 번 취소하면 다시 신청해야 합니다."
          cancelLabel="아니요"
          confirmLabel="네, 취소할게요"
          onCancel={() => setShowCancelDialog(false)}
          onConfirm={handleCancelConfirm}
          danger
        />
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Field label="접수번호" htmlFor="confirmationCode" error={confirmationCodeError}>
        <Input
          id="confirmationCode"
          name="confirmationCode"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          placeholder="12345"
          invalid={!!confirmationCodeError}
          value={confirmationCode}
          onChange={(e) => {
            const filtered = e.target.value.replace(/[^0-9]/g, "");
            setConfirmationCode(filtered);
          }}
        />
      </Field>
      <Field label="신청자 전화번호" htmlFor="phone" error={phoneError}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={13}
          required
          placeholder="010-0000-0000"
          invalid={!!phoneError}
          value={phone}
          onChange={(e) => {
            setPhone(formatPhoneInput(e.target.value));
          }}
        />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        onPointerEnter={handleSubmitPointerEnter}
        className="apply-submit-button relative inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        <span aria-hidden className="apply-submit-fill" />
        <span className="apply-submit-label">{pending ? "조회 중..." : "조회하기"}</span>
      </button>
    </form>
  );
}
