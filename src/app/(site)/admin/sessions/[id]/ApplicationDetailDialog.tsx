"use client";

import { useState } from "react";
import { InfoRow } from "@/components/lookup/InfoRow";
import { formatSessionDateTime, formatDateTimeDotted } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS, type ExperienceRange } from "@/lib/validation";

// consent_photo/consent_marketing 컬럼은 not null default false라 값만으로는
// "실제로 미동의"와 "이 컬럼을 채우기 전(과거 접수 건)"을 구분할 수 없다 — 배포
// 시각을 기준으로 신청일시가 이전인 건은 항상 fallback(구간 합산값)으로 보여준다.
// TODO(배포 시): 실제 프로덕션 배포 완료 시각으로 갱신할 것.
const CONSENT_SPLIT_DEPLOYED_AT = "2026-08-21T03:10:00Z";

type AdminApplication = {
  id: string;
  depositor_name: string;
  consent_required: boolean;
  consent_optional: boolean;
  consent_photo: boolean;
  consent_marketing: boolean;
  payment_confirmed_sms_sent_at?: string | null;
  confirmation_code: string;
  status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  refund_bank_name: string | null;
  refund_account_number: string | null;
  refund_account_holder: string | null;
};

type AdminAttendee = {
  id: string;
  is_representative: boolean;
  name: string;
  phone: string;
  birth_year: number;
  nickname: string | null;
  gender: "M" | "F" | null;
  experience_range: ExperienceRange | null;
};

export function ApplicationDetailDialog({
  application,
  attendees,
}: {
  application: AdminApplication;
  attendees: AdminAttendee[];
}) {
  const [open, setOpen] = useState(false);

  const sortedAttendees = [...attendees].sort((a, b) => (b.is_representative ? 1 : 0) - (a.is_representative ? 1 : 0));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-sm text-glow hover:underline"
      >
        {application.confirmation_code}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">신청 상세 · {application.confirmation_code}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <section className="mb-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">신청 정보</h3>
              <div className="rounded-lg border border-border p-3">
                <InfoRow label="입금자명" value={application.depositor_name} />
                <InfoRow label="신청일시" value={formatSessionDateTime(application.created_at)} />
                <InfoRow
                  label="입금기한"
                  value={formatDateTimeDotted(
                    new Date(new Date(application.created_at).getTime() + 30 * 60 * 1000).toISOString()
                  )}
                />
                <InfoRow
                  label="입금확인일시"
                  value={
                    application.payment_confirmed_sms_sent_at
                      ? formatDateTimeDotted(application.payment_confirmed_sms_sent_at)
                      : "-"
                  }
                />
                <InfoRow
                  label="신청 상태"
                  value={application.status === "confirmed" ? "확정" : application.status === "cancelled" ? "취소" : "대기"}
                />
                <InfoRow
                  label="입금 상태"
                  value={
                    application.payment_status === "confirmed"
                      ? "입금 확인"
                      : application.payment_status === "cancelled"
                        ? "취소됨"
                        : "대기중"
                  }
                />
                <InfoRow label="필수 약관 동의" value={application.consent_required ? "동의" : "미동의"} />
                {new Date(application.created_at) >= new Date(CONSENT_SPLIT_DEPLOYED_AT) ? (
                  <>
                    <InfoRow label="사진·영상 촬영 동의" value={application.consent_photo ? "동의" : "미동의"} />
                    <InfoRow label="마케팅 수신 동의" value={application.consent_marketing ? "동의" : "미동의"} />
                  </>
                ) : (
                  <InfoRow label="선택 약관 동의 (구간, 합산값)" value={application.consent_optional ? "동의" : "미동의"} />
                )}
                <InfoRow label="비고" value={application.notes || "-"} />
              </div>
            </section>

            {application.refund_bank_name && (
              <section className="mb-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">환불 계좌</h3>
                <div className="rounded-lg border border-border p-3">
                  <InfoRow label="은행" value={application.refund_bank_name} />
                  <InfoRow label="예금주" value={application.refund_account_holder || "-"} />
                  <InfoRow label="계좌번호" value={application.refund_account_number || "-"} />
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                참여자 ({sortedAttendees.length}명)
              </h3>
              <div className="flex flex-col gap-3">
                {sortedAttendees.map((attendee) => (
                  <div key={attendee.id} className="rounded-lg border border-border p-3">
                    {attendee.is_representative && (
                      <span className="mb-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                        대표 신청자
                      </span>
                    )}
                    <InfoRow
                      label="이름"
                      value={`${attendee.name}${attendee.nickname ? ` (${attendee.nickname})` : ""}`}
                    />
                    <InfoRow label="전화번호" value={attendee.phone} />
                    <InfoRow label="출생년도" value={`${attendee.birth_year}년생`} />
                    <InfoRow label="성별" value={attendee.gender === "M" ? "남성" : attendee.gender === "F" ? "여성" : "-"} />
                    <InfoRow
                      label="방탈출 경험"
                      value={attendee.experience_range ? EXPERIENCE_RANGE_LABELS[attendee.experience_range] : "-"}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
