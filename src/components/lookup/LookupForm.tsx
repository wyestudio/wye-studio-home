"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSessionDate } from "@/lib/format";
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

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
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

      {state.result ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div>
            <p className="text-sm text-muted">{state.result.session_title}</p>
            <p className="text-xs text-muted">
              {formatSessionDate(state.result.event_date)} · {SLOT_LABEL[state.result.slot]}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={state.result.status === "confirmed" ? "confirm" : "wait"}>
              {STATUS_LABEL[state.result.status]}
            </Badge>
            <Badge tone={state.result.payment_status === "confirmed" ? "confirm" : "neutral"}>
              {PAYMENT_LABEL[state.result.payment_status]}
            </Badge>
          </div>

          <div className="text-sm">
            <p className="text-muted">접수번호</p>
            <p className="font-semibold">{state.result.confirmation_code}</p>
          </div>

          <div className="text-sm">
            <p className="text-muted">입금자명</p>
            <p className="font-semibold">{state.result.depositor_name}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-muted">참여자 명단</p>
            <ul className="flex flex-col gap-1 text-sm">
              {state.result.attendees.map((attendee, i) => (
                <li key={i}>
                  {attendee.name}
                  {attendee.nickname ? ` (${attendee.nickname})` : ""}
                  {attendee.is_representative ? " · 대표 신청자" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
