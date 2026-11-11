"use client";

import { useState } from "react";
import { InfoRow } from "@/components/lookup/InfoRow";
import { formatDateTimeFull } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS, type ExperienceRange } from "@/lib/validation";
import { getAttendeePhones } from "./actions";

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
  paid_at?: string | null;
  confirmation_code: string;
  status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  refund_bank_name: string | null;
  refund_account_number: string | null;
  refund_account_holder: string | null;
};

/** 전화번호는 없다 — 팝업을 열 때 getAttendeePhones() 로 받는다(개인정보). */
type AdminAttendee = {
  id: string;
  is_representative: boolean;
  name: string;
  birth_year: number | null;
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
  // null = 아직 안 받음. 한 번 받으면 다시 열 때는 그대로 쓴다.
  const [phones, setPhones] = useState<Record<string, string> | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const sortedAttendees = [...attendees].sort((a, b) => (b.is_representative ? 1 : 0) - (a.is_representative ? 1 : 0));

  function openDialog() {
    setOpen(true);
    if (phones) return;
    setPhoneError(null);
    getAttendeePhones(application.id)
      .then((r) => ("error" in r ? setPhoneError(r.error) : setPhones(r.phones)))
      .catch(() => setPhoneError("전화번호를 불러오지 못했습니다."));
  }

  function phoneValue(attendeeId: string) {
    if (phoneError) return <span className="text-danger">{phoneError}</span>;
    if (!phones) return <span className="font-normal text-muted">불러오는 중…</span>;
    const phone = phones[attendeeId];
    if (!phone) return "-";
    return (
      <a href={`tel:${phone.replace(/[^\d]/g, "")}`} className="tabular-nums text-glow underline">
        {phone}
      </a>
    );
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="font-mono text-body-sm text-glow hover:underline"
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
              <h2 className="text-h3 font-semibold text-foreground">신청 상세 · {application.confirmation_code}</h2>
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
              <h3 className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted">신청 정보</h3>
              <div className="rounded-lg border border-border p-3">
                <InfoRow label="입금자명" value={application.depositor_name} />
                <InfoRow label="신청일시" value={formatDateTimeFull(application.created_at)} />
                <InfoRow
                  label="입금기한"
                  value={formatDateTimeFull(
                    new Date(new Date(application.created_at).getTime() + 30 * 60 * 1000).toISOString()
                  )}
                />
                <InfoRow
                  label="입금확인일시"
                  value={application.paid_at ? formatDateTimeFull(application.paid_at) : "-"}
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
                <h3 className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted">환불 계좌</h3>
                <div className="rounded-lg border border-border p-3">
                  <InfoRow label="은행" value={application.refund_bank_name} />
                  <InfoRow label="예금주" value={application.refund_account_holder || "-"} />
                  <InfoRow label="계좌번호" value={application.refund_account_number || "-"} />
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-micro font-semibold uppercase tracking-wide text-muted">
                참여자 ({sortedAttendees.length}명)
              </h3>
              <div className="flex flex-col gap-3">
                {sortedAttendees.map((attendee) => (
                  <div key={attendee.id} className="rounded-lg border border-border p-3">
                    {attendee.is_representative && (
                      <span className="mb-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-micro font-semibold text-brand">
                        대표 신청자
                      </span>
                    )}
                    <InfoRow
                      label="이름"
                      value={`${attendee.name}${attendee.nickname ? ` (${attendee.nickname})` : ""}`}
                    />
                    <InfoRow label="전화번호" value={phoneValue(attendee.id)} />
                    <InfoRow label="출생년도" value={attendee.birth_year ? `${attendee.birth_year}년생` : "-"} />
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
