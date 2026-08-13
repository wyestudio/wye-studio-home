"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRefundDeadline } from "@/lib/format";
import { formatPhoneDigits } from "@/lib/phone";
import { ThemeTag } from "@/components/ui/ThemeTag";
import type { Application } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[slug]/apply/actions";

export function ApplyComplete({
  application,
  attendees,
  themeLabel,
  sessionTitle,
  eventDate,
  notes,
}: {
  application: Application;
  attendees: AttendeeInput[];
  themeLabel: string;
  sessionTitle: string;
  eventDate: string;
  notes?: string | null;
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
    <>
      <div className="flex flex-col gap-6 rounded-xl glass-panel p-6">
        {/* 완료 메시지 */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold">신청이 완료되었습니다.</h1>
          <p className="mt-1 text-sm text-muted">신청해주셔서 감사합니다 (__)</p>
        </div>

        {/* 테마 알약 */}
        <div className="flex justify-center">
          <ThemeTag themeLabel={themeLabel} />
        </div>

        {/* 대기 상태 안내 */}
        {application.status === "waiting" ? (
          <div className="text-center">
            <p className="text-sm text-muted">
              대기번호 {application.waiting_number}번
            </p>
            <p className="mt-1 text-xs text-muted">
              정원이 마감되었습니다. 취소 발생 시 신청자 전화번호로 연락드리겠습니다.
            </p>
          </div>
        ) : null}

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

        {/* 신청 정보 */}
        <div>
          <p className="mb-2 text-sm font-bold text-muted">신청 정보</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {attendees.map((attendee, i) => (
              <li key={i} className="text-foreground">
                <span className="font-semibold">
                  {attendee.name}
                  {attendee.nickname ? ` (${attendee.nickname})` : ""}
                </span>
                <span className="text-muted">
                  {" "}· {formatPhoneDigits(attendee.phone)} · {attendee.birthYear}년생
                  {attendee.gender ? ` · ${attendee.gender === "M" ? "남성" : "여성"}` : ""}
                  {isGroup && i === 0 ? " · 대표 신청자" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 입금 정보 */}
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="mb-2 font-bold">입금 정보</p>
          <p className="mb-1">입금자명: {application.depositor_name}</p>
          <p className="text-muted">
            {smsRecipientLabel} 전화번호({representative ? formatPhoneDigits(representative.phone) : ""})로 안내 문자를 발송하였습니다. 확인해주세요.
          </p>
        </div>

        {notes ? (
          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="mb-2 font-bold">비고</p>
            <p className="text-muted">{notes}</p>
          </div>
        ) : null}

        {/* 환불 기한 */}
        <div className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
          <p className="font-bold">환불 기한</p>
          <p className="mt-1">
            {formatRefundDeadline(eventDate)}까지 취소 시 환불 가능하며, 이후에는 환불이 불가해요.
          </p>
        </div>
      </div>

      {/* 버튼 행 (카드 밖) */}
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/contents"
          className="inline-flex flex-1 items-center justify-center rounded-full border border-glass-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-all hover:bg-white/5"
        >
          목록으로
        </Link>
        <Link
          href="/lookup"
          className="inline-flex flex-1 items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-[0_0_20px_-4px_var(--glow)] transition-all hover:opacity-95 hover:shadow-[0_0_28px_-2px_var(--glow)]"
        >
          신청내역 조회
        </Link>
      </div>
    </>
  );
}
