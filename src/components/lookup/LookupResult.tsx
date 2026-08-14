"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemeTag } from "@/components/ui/ThemeTag";
import { InfoRow } from "./InfoRow";
import { CompanionPager } from "./CompanionPager";
import { formatSessionDateTime, formatSessionDate, formatSessionTime, formatRefundDeadline, formatKrw } from "@/lib/format";
import { formatPhoneDigits } from "@/lib/phone";
import { getThemeBaseName, isDatingTheme } from "@/lib/theme";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from "@/lib/lookupStatus";
import { cancelApplicationAction, type LookupState } from "@/app/lookup/actions";
import type { ApplicationAttendee } from "@/types/domain";

export function LookupResult() {
  const router = useRouter();
  const [state, setState] = useState<LookupState | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [phone, setPhone] = useState<string>("");
  const [confirmationCode, setConfirmationCode] = useState<string>("");

  useEffect(() => {
    const stored = sessionStorage.getItem("lookup:result");
    if (!stored) {
      router.replace("/lookup");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as {
        result: LookupState["result"];
        phone: string;
        confirmationCode: string;
      };
      setState({ result: parsed.result });
      setPhone(parsed.phone);
      setConfirmationCode(parsed.confirmationCode);
    } catch {
      router.replace("/lookup");
    }
  }, [router]);

  if (!state || !state.result) {
    return null;
  }

  const { result } = state;
  const isGroup = result.attendees.length > 1;
  const representative = result.attendees[0];
  const companions = result.attendees.slice(1);
  const smsRecipientLabel = isGroup ? "대표 신청자" : "신청자";
  const accentColor = isDatingTheme(result.theme_label) ? "#ff5ec4" : "#3dffb0";

  async function handleCancelConfirm() {
    setCancelling(true);
    setCancelError(null);
    try {
      const response = await cancelApplicationAction(phone, confirmationCode);
      if (response.error) {
        setCancelError(response.error);
      } else {
        setCancelled(true);
        setShowCancelDialog(false);
        sessionStorage.removeItem("lookup:result");
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

  return (
    <>
      {/* 접수번호 + 상태 배지 */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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
        <Badge tone={LIFECYCLE_TONE[result.lifecycleStatus]}>
          {LIFECYCLE_LABEL[result.lifecycleStatus]}
        </Badge>
      </div>

      {/* 대기 상태 안내 */}
      {result.status === "waiting" && result.waiting_number ? (
        <div className="mb-6 text-center">
          <p className="text-sm text-muted">대기번호 {result.waiting_number}번</p>
          <p className="mt-1 text-xs text-muted">
            정원이 마감되었습니다. 취소 발생 시 신청자 전화번호로 연락드리겠습니다.
          </p>
        </div>
      ) : null}

      {/* 신청 정보 카드 (헤더 없음) */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: accentColor }}>
            {getThemeBaseName(result.theme_label)}
          </span>
          <ThemeTag themeLabel={result.theme_label} />
        </div>
        <InfoRow label="날짜" value={formatSessionDate(result.start_at)} />
        <InfoRow label="시간" value={formatSessionTime(result.start_at)} />
        <InfoRow label="위치" value={result.venue_area} />
      </div>

      {/* 신청자 정보 */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-bold text-muted">신청자 정보</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <AttendeeDisplay attendee={representative} isDatingSession={isDatingTheme(result.theme_label)} />
        </div>
      </div>

      {/* 동행자 (그룹일 때만) */}
      {companions.length > 0 ? (
        <div className="mb-6">
          <p className="mb-3 text-sm font-bold text-muted">동행자</p>
          <CompanionPager count={companions.length}>
            {(index) => (
              <div className="rounded-xl border border-border bg-surface p-4">
                <AttendeeDisplay attendee={companions[index]} isDatingSession={isDatingTheme(result.theme_label)} />
              </div>
            )}
          </CompanionPager>
        </div>
      ) : null}

      {/* 비고 (그룹이고 notes가 있을 때만) */}
      {isGroup && result.notes ? (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-bold text-muted">비고</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{result.notes}</p>
        </div>
      ) : null}

      {/* 주문 정보 */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-bold text-muted">주문 정보</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <InfoRow label="신청일" value={formatSessionDateTime(result.created_at)} />
          <div className="border-t border-border py-1.5" />
          <InfoRow
            label="입금확인일"
            value={result.payment_confirmed_sms_sent_at ? formatSessionDateTime(result.payment_confirmed_sms_sent_at) : "-"}
          />
          <div className="border-t border-border py-1.5" />
          <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
            <span className="text-muted">참가비</span>
            <div className="text-right">
              <p className="font-semibold text-foreground">
                {formatKrw(result.price_krw)} × {result.attendees.length}명 = {formatKrw(result.price_krw * result.attendees.length)}
              </p>
              <p className="mt-1 text-xs text-muted">
                베타 기간 한정 · 리뷰 작성 시 인당 <span style={{ color: "var(--brand)" }} className="font-semibold">5,000원</span> 페이백
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 입금 안내 */}
      <p className="mb-6 text-center text-sm text-muted">
        {smsRecipientLabel} 전화번호({representative ? formatPhoneDigits(representative.phone) : ""})로 입금 안내를 문자로 전송드렸어요.
      </p>

      {/* 환불 기한 */}
      <div className="mb-6 rounded-lg bg-danger-soft p-4 text-sm text-danger">
        <p className="font-bold">환불 기한</p>
        <p className="mt-1">
          {formatRefundDeadline(result.event_date)}까지 취소 시 환불 가능하며, 이후에는 환불이 불가해요.
        </p>
      </div>

      {/* 버튼 행 */}
      <div className="flex gap-3">
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
    </>
  );
}

function AttendeeDisplay({
  attendee,
  isDatingSession,
}: {
  attendee: ApplicationAttendee;
  isDatingSession: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <InfoRow
        label="이름"
        value={`${attendee.name}${attendee.nickname ? ` (${attendee.nickname})` : ""}`}
      />
      <InfoRow label="전화번호" value={formatPhoneDigits(attendee.phone)} />
      <InfoRow label="출생년도" value={`${attendee.birth_year}년생`} />
      {isDatingSession && attendee.gender ? (
        <InfoRow label="성별" value={attendee.gender === "M" ? "남성" : "여성"} />
      ) : null}
      {attendee.experience_range ? (
        <InfoRow label="방탈출 경험" value={EXPERIENCE_RANGE_LABELS[attendee.experience_range]} />
      ) : null}
    </div>
  );
}
