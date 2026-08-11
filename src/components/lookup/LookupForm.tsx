"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatKrw, formatRefundDeadline, formatSessionDate } from "@/lib/format";
import { formatPhoneDigits } from "@/lib/phone";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { lookupAction, type LookupState } from "@/app/lookup/actions";
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

  if (state.result) {
    const { result } = state;
    const isGroup = result.attendees.length > 1;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 rounded-xl glass-panel p-6">
          <div>
            <p className="text-sm text-muted">{result.session_title}</p>
            <p className="text-xs text-muted">
              {formatSessionDate(result.event_date)} · {SLOT_LABEL[result.slot]}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={result.status === "confirmed" ? "confirm" : "wait"}>
              {STATUS_LABEL[result.status]}
            </Badge>
            <Badge tone={result.payment_status === "confirmed" ? "confirm" : "neutral"}>
              {PAYMENT_LABEL[result.payment_status]}
            </Badge>
          </div>

          <div>
            <p className="mb-1 text-sm text-muted">접수번호</p>
            <p className="text-lg font-extrabold">{result.confirmation_code}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-muted">신청 정보</p>
            <p className="mb-2 text-sm">입금자명: {result.depositor_name}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {result.attendees.map((attendee, i) => (
                <li key={i}>
                  {attendee.name}
                  {attendee.nickname ? ` (${attendee.nickname})` : ""} · {formatPhoneDigits(attendee.phone)}
                  {attendee.gender ? ` · ${attendee.gender === "M" ? "남성" : "여성"}` : ""}
                  {isGroup && attendee.is_representative ? " · 대표 신청자" : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-brand-soft p-4 text-sm">
            <p className="mb-1 font-bold">무통장입금 안내</p>
            <p>은행: {BANK_ACCOUNT.bankName}</p>
            <p>계좌번호: {BANK_ACCOUNT.accountNumber}</p>
            <p>예금주: {BANK_ACCOUNT.accountHolder}</p>
            <p>입금액: {formatKrw(result.price_krw)}</p>
          </div>

          <div className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
            <p className="font-bold">환불 기한</p>
            <p className="mt-1">
              {formatRefundDeadline(result.event_date)}까지 취소 시 환불 가능하며, 이후에는 환불이
              불가해요.
            </p>
          </div>
        </div>

        <a href="/lookup" className="text-center text-sm font-semibold text-brand underline">
          다른 접수번호로 다시 조회하기
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-xs text-muted">접수번호는 신청 완료 화면과 문자로 안내드려요.</p>
      <Field label="대표 신청자 전화번호" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" required placeholder="010-0000-0000" />
      </Field>
      <Field label="접수번호" htmlFor="confirmationCode">
        <Input
          id="confirmationCode"
          name="confirmationCode"
          type="text"
          inputMode="numeric"
          required
          placeholder="482913"
        />
      </Field>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "조회 중..." : "조회하기"}
      </Button>
    </form>
  );
}
