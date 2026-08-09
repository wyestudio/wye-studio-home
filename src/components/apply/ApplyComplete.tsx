"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatKrw } from "@/lib/format";
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
}: {
  application: Application;
  attendees: AttendeeInput[];
  priceKrw: number;
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

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6">
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

      <div className="flex items-center gap-2">
        <Badge tone={application.status === "confirmed" ? "confirm" : "wait"}>
          {STATUS_LABEL[application.status]}
        </Badge>
        <span className="text-sm text-muted">
          {application.status === "confirmed"
            ? "참가가 확정되었습니다. 아래 계좌로 입금해주세요."
            : "정원이 차면 자동으로 참가확정으로 전환됩니다. 확정 여부와 관계없이 아래 계좌로 입금해주세요."}
        </span>
      </div>

      {attendees.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-bold text-muted">참여자 명단</p>
          <ul className="flex flex-col gap-1 text-sm">
            {attendees.map((attendee, i) => (
              <li key={i}>
                {attendee.name}
                {attendee.nickname ? ` (${attendee.nickname})` : ""}
                {i === 0 ? " · 대표 신청자" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg bg-brand-soft p-4 text-sm">
        <p className="mb-1 font-bold">무통장입금 안내 (간이)</p>
        <p>은행: 준비 중</p>
        <p>계좌번호: 준비 중</p>
        <p>예금주: 우주이스케이프</p>
        <p>입금액: {formatKrw(priceKrw)}</p>
        <p>입금자명: {application.depositor_name}</p>
        <p className="mt-2 text-xs text-muted">
          자세한 계좌 정보와 입금 기한은 신청확인 문자로 안내드립니다. 행사 전날부터는 환불이 불가합니다.
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
