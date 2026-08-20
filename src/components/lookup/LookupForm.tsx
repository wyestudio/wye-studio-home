"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import { getValidationErrorMessage } from "@/lib/validation";
import { formatPhoneInput, phoneDigits, isValidPhoneDigits } from "@/lib/phone";
import { lookupAction, type LookupState } from "@/app/(site)/lookup/actions";

const initialState: LookupState = {};

export function LookupForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(lookupAction, initialState);
  const [phone, setPhone] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (state.result) {
      sessionStorage.setItem(
        "lookup:result",
        JSON.stringify({
          result: state.result,
          phone,
          confirmationCode,
        })
      );
      router.push("/lookup/result");
    }
  }, [state.result, phone, confirmationCode, router]);

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

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-4">
          <Field label="접수번호" htmlFor="confirmationCode" error={confirmationCodeError}>
            <Input
              id="confirmationCode"
              name="confirmationCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="123456"
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
        </div>
      </div>

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
