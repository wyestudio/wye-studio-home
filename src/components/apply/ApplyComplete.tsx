"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRefundTierDeadlines, formatSessionDateTime } from "@/lib/format";
import { formatPhoneDigits } from "@/lib/phone";
import { ThemeTag } from "@/components/ui/ThemeTag";
import { getThemeBaseName, isDatingTheme } from "@/lib/theme";
import type { Application } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[slug]/apply/actions";

export function ApplyComplete({
  application,
  attendees,
  themeLabel,
  sessionTitle,
  eventDate,
  startAt,
  endAt,
  venueArea,
}: {
  application: Application;
  attendees: AttendeeInput[];
  themeLabel: string;
  sessionTitle: string;
  eventDate: string;
  startAt: string;
  endAt: string | null;
  venueArea: string;
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
  const accentColor = isDatingTheme(themeLabel) ? "#ff5ec4" : "#3dffb0";

  return (
    <div className="mx-auto max-w-[560px]">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold">신청이 완료되었습니다.</h1>
        <p className="mt-1 text-sm text-muted">신청해주셔서 감사합니다 (__)</p>
      </div>

      <div className="flex flex-col gap-6 rounded-xl glass-panel p-6">
        {/* 접수번호 */}
        <div className="flex items-center justify-center gap-3">
          <p className="text-sm text-muted">접수번호</p>
          <p className="text-3xl font-extrabold">{application.confirmation_code}</p>
          <button
            type="button"
            onClick={handleCopyClick}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            {copied ? "복사됨" : "복사"}
          </button>
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

        {/* 2열: 신청 정보 | 신청자 정보 */}
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="flex flex-col gap-2 pr-6">
            <p className="text-sm font-bold text-muted">신청 정보</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: accentColor }}>
                {getThemeBaseName(themeLabel)}
              </span>
              <ThemeTag themeLabel={themeLabel} />
            </div>
            <p className="text-sm text-foreground">{formatSessionDateTime(startAt)}</p>
            <p className="text-sm text-muted">{venueArea}</p>
          </div>

          <div className="flex flex-col gap-2 pl-6">
            <p className="text-sm font-bold text-muted">신청자 정보</p>
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
        </div>

        {/* 입금 안내 */}
        <p className="text-center text-sm text-muted">
          {smsRecipientLabel} 전화번호({representative ? formatPhoneDigits(representative.phone) : ""})로 입금 안내를 문자로 전송드렸어요.
        </p>

        {/* 환불 기한 */}
        {(() => {
          const refundDeadlines = formatRefundTierDeadlines(startAt);
          return (
            <div className="rounded-lg bg-danger-soft p-4 text-sm text-danger">
              <p className="font-bold">환불 기한</p>
              <div className="mt-1 flex flex-col gap-0.5">
                <p>{refundDeadlines.full}까지 취소 시 <span className="font-semibold">100% 환불</span></p>
                <p>{refundDeadlines.full} ~ {refundDeadlines.half} 취소 시 <span className="font-semibold">50% 환불</span></p>
                <p>{refundDeadlines.half} 이후 취소 시 <span className="font-semibold">환불 불가</span></p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 버튼 행 */}
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
    </div>
  );
}
