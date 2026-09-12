"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CompanionPager } from "./CompanionPager";
import { RefundPolicyBox } from "@/components/ui/RefundPolicyBox";
import { RefundInfoDialog } from "./RefundInfoDialog";
import { formatDateTimeFull, formatKrw } from "@/lib/format";
import { calculateRefundAmount } from "@/lib/refundPolicy";
import { formatPhoneDigits } from "@/lib/phone";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import { LIFECYCLE_LABEL, LIFECYCLE_TONE } from "@/lib/lookupStatus";
import { cancelApplicationAction, type LookupState } from "@/app/(site)/lookup/actions";
import type { ApplicationAttendee } from "@/types/domain";

const DEFAULT_ACCENT = "#3dffb0";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/8 py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

/** 흔히 쓰는 두 장 겹친 복사 아이콘. */
function CopyIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * 참여내역 조회 결과.
 *
 * 신청 완료 화면과 같은 언어로 그린다 — 접수번호를 먼저 보여주고, 제출한 내용을
 * 그대로 다시 확인시킨 뒤, 취소는 맨 아래에 둔다.
 *
 * ⚠️ 계좌번호는 여기에도 띄우지 않는다. 입금 안내는 대표 신청자 문자에만 담는다
 *    (신청 완료 화면과 같은 규칙).
 */
export function LookupResult() {
  const router = useRouter();
  const [state, setState] = useState<LookupState | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRefundInfoDialog, setShowRefundInfoDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState<string>("");
  const [confirmationCode, setConfirmationCode] = useState<string>("");
  const [refundBankName, setRefundBankName] = useState<string>("");
  const [refundAccountNumber, setRefundAccountNumber] = useState<string>("");
  const [refundAccountHolder, setRefundAccountHolder] = useState<string>("");
  const [refundFormError, setRefundFormError] = useState<string | null>(null);

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없거나 보안 컨텍스트가 아니면 조용히 넘어간다.
      // 번호는 화면에 그대로 있으므로 직접 적을 수 있다.
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    setCancelError(null);
    try {
      const refundInfo =
        state?.result && state.result.payment_status === "confirmed"
          ? {
              bankName: refundBankName,
              accountNumber: refundAccountNumber,
              accountHolder: refundAccountHolder,
            }
          : undefined;

      const response = await cancelApplicationAction(phone, confirmationCode, refundInfo, state?.result);
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

  function handleCancelClick() {
    if (state?.result?.payment_status === "confirmed") {
      setShowRefundInfoDialog(true);
    } else {
      setShowCancelDialog(true);
    }
  }

  function handleRefundInfoSubmit() {
    if (!refundBankName.trim() || !refundAccountNumber.trim() || !refundAccountHolder.trim()) {
      setRefundFormError("모든 항목을 입력해주세요.");
      return;
    }
    setRefundFormError(null);
    setShowRefundInfoDialog(false);
    setShowCancelDialog(true);
  }

  if (cancelled) {
    return (
      <div className="py-10 text-center">
        <h1 className="text-2xl font-extrabold">취소되었습니다.</h1>
        <p className="mt-1 text-sm text-muted">다음 기회에 뵙겠습니다. (제발)</p>
        <Link
          href="/contents"
          className="mt-6 inline-block rounded-lg px-5 py-3 text-sm font-bold"
          style={{ backgroundColor: DEFAULT_ACCENT, color: "#0a0a12" }}
        >
          다른 컨텐츠 보기
        </Link>
      </div>
    );
  }

  if (!state || !state.result) return null;

  const { result } = state;
  const accent = result.accent_color || DEFAULT_ACCENT;
  const representative = result.attendees[0];
  const companions = result.attendees.slice(1);
  const isGroup = result.attendees.length > 1;
  // 취소·참여완료 건은 더 이상 취소할 게 없다.
  const canCancel = result.status !== "cancelled" && result.lifecycleStatus !== "attended";

  // 입금확인일. paid_at 이 없던 시절 신청은 문자 발송 시각으로 대신한다.
  const paidAt = result.paid_at ?? result.payment_confirmed_sms_sent_at;

  // ⚠️ 환불 금액은 **취소한 시점** 기준으로 계산한다. 지금 시각으로 재면
  //    행사가 지난 뒤 조회했을 때 환불받은 건도 "0원" 으로 보인다.
  //    취소 시각이 없는 옛 건(2026-09-13 이전)은 계산 근거가 없으므로
  //    추측하지 않고 안내를 띄우지 않는다.
  const refundAmount =
    result.status === "cancelled" && paidAt && result.cancelled_at
      ? calculateRefundAmount(result.start_at, result.amount_krw, new Date(result.cancelled_at))
      : 0;

  return (
    <div className="space-y-6">
      {/* ── 접수번호 ── */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Badge tone={LIFECYCLE_TONE[result.lifecycleStatus]}>
            {LIFECYCLE_LABEL[result.lifecycleStatus]}
          </Badge>
        </div>
        <p className="text-xs text-muted">접수번호</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-3xl font-extrabold tracking-wider" style={{ color: accent }}>
            {result.confirmation_code}
          </p>
          <button
            type="button"
            onClick={() => copyCode(result.confirmation_code)}
            aria-label="접수번호 복사"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-white/40 hover:text-foreground"
          >
            {copied ? <>복사됨</> : <CopyIcon />}
          </button>
        </div>

        {result.status === "waiting" && result.waiting_number ? (
          <p className="mt-4 text-sm text-amber-300">
            현재 대기 {result.waiting_number}번입니다. 자리가 나면 개별 연락드립니다.
            <span className="mt-1 block text-xs text-muted">
              앞선 신청이 취소되면 순번은 앞당겨질 수 있습니다.
            </span>
          </p>
        ) : null}
      </div>

      {/* ── 입금 안내: 계좌는 문자로만 ── */}
      {result.lifecycleStatus === "awaiting_payment" && (
        <div className="rounded-xl border-2 p-5" style={{ borderColor: accent }}>
          <h2 className="text-center font-bold">입금 안내를 문자로 보내드렸어요</h2>
          <p className="mt-2 text-center text-sm text-muted">
            <strong className="text-foreground">
              {representative ? formatPhoneDigits(representative.phone) : ""}
            </strong>{" "}
            으로 입금하실 계좌와 금액을 보냈습니다.
          </p>
          <div className="mt-4 rounded-lg bg-white/5 p-4 text-center">
            <p className="text-xs text-muted">입금하실 금액</p>
            <p className="mt-1 text-2xl font-extrabold" style={{ color: accent }}>
              {formatKrw(result.amount_krw)}
            </p>
          </div>
          <div className="mt-4 space-y-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-xs text-amber-200">
            <p>⚠️ 입금자명이 다르면 처리가 늦어질 수 있습니다.</p>
            <p>⏱ 시간 내 미입금 시 자동으로 취소될 수 있습니다.</p>
            <p>💬 문자가 오지 않으면 카카오 채널로 문의해주세요.</p>
          </div>
        </div>
      )}

      {/* ── 신청 내용 ── */}
      <div className="rounded-xl border border-white/15 p-5">
        <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="font-bold">{result.theme_name}</h2>
          {result.category_name && (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
              style={{
                color: accent,
                borderColor: `${accent}59`,
                backgroundColor: `${accent}1f`,
              }}
            >
              {result.category_name}
            </span>
          )}
          {/* 옛 회차만 그룹/소개팅 구분이 있다. 신규 회차는 카테고리로 대신한다. */}
          {result.format_label && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-muted">
              {result.format_label}
            </span>
          )}
        </div>

        <Row label="일시" value={formatDateTimeFull(result.start_at)} />
        <Row label="위치" value={result.venue_area} />
        <Row label="신청일" value={formatDateTimeFull(result.created_at)} />
        <Row label="입금확인일" value={paidAt ? formatDateTimeFull(paidAt) : "-"} />
        {result.status === "cancelled" && (
          <Row
            label="취소일"
            value={result.cancelled_at ? formatDateTimeFull(result.cancelled_at) : "-"}
          />
        )}
        <Row
          label="참가비"
          value={
            result.discount_krw > 0 ? (
              <>
                {formatKrw(result.amount_krw)}
                <span className="ml-1.5 text-xs text-muted">
                  ({result.headcount}명 × {formatKrw(result.unit_price_krw)} ={" "}
                  {formatKrw(result.base_amount_krw)}
                </span>
                <span className="text-xs text-glow"> − 쿠폰 {formatKrw(result.discount_krw)}</span>
                <span className="text-xs text-muted">)</span>
              </>
            ) : (
              <>
                {formatKrw(result.amount_krw)}
                <span className="ml-1.5 text-xs text-muted">
                  ({result.headcount}명 × {formatKrw(result.unit_price_krw)})
                </span>
              </>
            )
          }
        />
        {/* 환불이 끝난 건은 금액을 못 구해도(옛 건은 취소 시각이 없다) 완료 사실은 알린다. */}
        {result.refund_completed_at ? (
          <Row
            label="환불 완료"
            value={
              <>
                {refundAmount > 0 ? formatKrw(refundAmount) : "완료"}
                <span className="ml-1.5 text-xs text-muted">
                  ({formatDateTimeFull(result.refund_completed_at)})
                </span>
              </>
            }
          />
        ) : refundAmount > 0 ? (
          /* 돌려받을 돈이 있을 때만. 취소했어도 환불 금액이 0이면 굳이 알리지 않는다. */
          <Row
            label="환불 예정"
            value={
              <>
                {formatKrw(refundAmount)}
                <span className="ml-1.5 text-xs text-muted">
                  (영업일 기준 3~5일 이내 입금하신 계좌로 처리됩니다)
                </span>
              </>
            }
          />
        ) : null}

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-white/12 bg-white/[0.03] p-4">
            <p className="mb-1 text-xs font-bold text-muted">
              {isGroup ? "대표 신청자 (본인)" : "신청자"}
            </p>
            <AttendeeDisplay attendee={representative} />
          </div>

          {companions.length > 0 && (
            <CompanionPager count={companions.length}>
              {(index) => (
                <div className="rounded-lg border border-white/12 bg-white/[0.03] p-4">
                  <p className="mb-1 text-xs font-bold text-muted">동행자 {index + 1}</p>
                  <AttendeeDisplay attendee={companions[index]} />
                </div>
              )}
            </CompanionPager>
          )}
        </div>

        {/* 요청사항은 더 이상 받지 않지만, 예전 신청에는 남아 있다. */}
        {result.notes && (
          <div className="mt-4 rounded-lg border border-white/12 bg-white/[0.03] p-4">
            <p className="mb-1 text-xs font-bold text-muted">요청사항</p>
            <p className="whitespace-pre-wrap text-sm">{result.notes}</p>
          </div>
        )}
      </div>

      {/* ── 취소·환불 규정 ── */}
      {canCancel && <RefundPolicyBox />}

      {/* ── 버튼 ── */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/lookup"
          className="flex-1 rounded-lg border border-white/25 px-4 py-3 text-center text-sm"
        >
          다시 조회
        </Link>
        {result.theme_slug && (
          <Link
            href={`/themes/${result.theme_slug}`}
            className="flex-1 rounded-lg border border-white/25 px-4 py-3 text-center text-sm"
          >
            테마 보기
          </Link>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={cancelling}
            className="flex-1 rounded-lg border border-red-500/50 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {cancelling ? "처리 중…" : "신청 취소"}
          </button>
        )}
      </div>

      {cancelError ? <p className="text-center text-sm text-danger">{cancelError}</p> : null}

      {state?.result && (
        <RefundInfoDialog
          open={showRefundInfoDialog}
          refundAmount={calculateRefundAmount(state.result.start_at, state.result.amount_krw)}
          bankName={refundBankName}
          accountNumber={refundAccountNumber}
          accountHolder={refundAccountHolder}
          error={refundFormError}
          onBankNameChange={setRefundBankName}
          onAccountNumberChange={setRefundAccountNumber}
          onAccountHolderChange={setRefundAccountHolder}
          onConfirm={handleRefundInfoSubmit}
          onCancel={() => {
            setShowRefundInfoDialog(false);
            setRefundFormError(null);
          }}
        />
      )}

      <ConfirmDialog
        open={showCancelDialog}
        title="정말 취소하시겠어요?"
        message="한 번 취소하면 다시 신청해야 합니다."
        cancelLabel="아니요"
        confirmLabel="네, 취소"
        onCancel={() => setShowCancelDialog(false)}
        onConfirm={handleCancelConfirm}
        danger
        error={cancelError}
        confirmDisabled={cancelling}
      />
    </div>
  );
}

function AttendeeDisplay({ attendee }: { attendee: ApplicationAttendee }) {
  return (
    <>
      <Row
        label="이름"
        value={
          <>
            {attendee.name}
            {attendee.nickname && <span className="ml-1 text-muted">({attendee.nickname})</span>}
          </>
        }
      />
      <Row label="휴대폰" value={formatPhoneDigits(attendee.phone)} />
      <Row label="출생연도" value={`${attendee.birth_year}년생`} />
      <Row
        label="방탈출 경험"
        value={attendee.experience_range ? EXPERIENCE_RANGE_LABELS[attendee.experience_range] : "-"}
      />
      <Row
        label="성별"
        value={attendee.gender === "M" ? "남성" : attendee.gender === "F" ? "여성" : "선택 안 함"}
      />
    </>
  );
}
