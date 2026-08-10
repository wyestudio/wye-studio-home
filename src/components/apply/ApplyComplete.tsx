"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatKrw, formatRefundDeadline } from "@/lib/format";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import type { Application } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[id]/apply/actions";

const STATUS_LABEL: Record<Application["status"], string> = {
  confirmed: "참가확정",
  waiting: "참가대기",
  cancelled: "취소됨",
};

export function ApplyComplete({
  application,
  attendees,
  priceKrw,
  sessionTitle,
  eventDate,
}: {
  application: Application;
  attendees: AttendeeInput[];
  priceKrw: number;
  sessionTitle: string;
  eventDate: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    navigator.clipboard
      ?.writeText(application.confirmation_code)
      .then(() => setCopied(true))
      .catch(() => {
        // 클립보드 권한이 없거나 보안 컨텍스트가 아니면 조용히 무시 —
        // 아래 "복사" 버튼으로 직접 복사할 수 있다.
      });
  }, [application.confirmation_code]);

  async function handleCopyClick() {
    try {
      await navigator.clipboard.writeText(application.confirmation_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  }

  const isGroup = attendees.length > 1;
  const representative = attendees[0];
  const smsRecipientLabel = isGroup ? "대표 신청자" : "신청자";

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={application.status === "confirmed" ? "confirm" : "wait"}>
            {STATUS_LABEL[application.status]}
          </Badge>
          <span className="text-sm text-muted">
            {sessionTitle} 신청이 완료됐어요
            {application.status === "waiting" ? " — 정원이 차면 자동으로 확정돼요" : ""}.
          </span>
        </div>
        {representative ? (
          <p className="text-xs text-muted">
            입금 안내를 {smsRecipientLabel} 전화번호({representative.phone})로도 보내드려요.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-sm text-muted">접수번호</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-extrabold">{application.confirmation_code}</p>
          <button
            type="button"
            onClick={handleCopyClick}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-muted">신청 정보</p>
        <p className="mb-2 text-sm">입금자명: {application.depositor_name}</p>
        {attendees.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {attendees.map((attendee, i) => (
              <li key={i}>
                {attendee.name}
                {attendee.nickname ? ` (${attendee.nickname})` : ""} · {attendee.phone}
                {attendee.gender ? ` · ${attendee.gender === "M" ? "남성" : "여성"}` : ""}
                {isGroup && i === 0 ? " · 대표 신청자" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-lg bg-brand-soft p-4 text-sm">
        <p className="mb-1 font-bold">무통장입금 안내</p>
        <p>은행: {BANK_ACCOUNT.bankName}</p>
        <p>계좌번호: {BANK_ACCOUNT.accountNumber}</p>
        <p>예금주: {BANK_ACCOUNT.accountHolder}</p>
        <p>입금액: {formatKrw(priceKrw)}</p>
      </div>

      <div className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
        <p className="font-bold">환불 기한</p>
        <p className="mt-1">
          {formatRefundDeadline(eventDate)}까지 취소 시 환불 가능하며, 이후에는 환불이 불가해요.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 text-xs text-muted">
        <p className="mb-1 font-semibold text-foreground">
          이 접수번호를 꼭 저장해두세요{copied ? " (클립보드에 복사됐어요)" : ""}.
        </p>
        <p>
          접수번호와 대표 신청자 전화번호로{" "}
          <Link href="/lookup" className="font-semibold text-brand underline">
            참여내역을 조회
          </Link>
          할 수 있어요.
        </p>
      </div>
    </div>
  );
}
