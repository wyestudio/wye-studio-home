"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getEligibleBirthYearRange } from "@/lib/eligibility";
import { AttendeeFormFields, attendeeInputClassName, type AttendeeFormValue } from "./AttendeeFormFields";
import { adminManualApply, type ManualAttendeeInput } from "./actions";

const DEFAULT_MANUAL_NOTE = "관리자 수동 등록";

function emptyAttendeeRow(): AttendeeFormValue {
  return { name: "", phone: "", birthYear: "", nickname: "", gender: "", experienceRange: "" };
}

export function ManualApplyButton({ sessionId, isDatingSession }: { sessionId: string; isDatingSession: boolean }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ confirmationCode: string; status: string } | null>(null);

  const [depositorName, setDepositorName] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [notes, setNotes] = useState(DEFAULT_MANUAL_NOTE);
  const [attendees, setAttendees] = useState<AttendeeFormValue[]>([emptyAttendeeRow()]);

  const { min: birthYearMin, max: birthYearMax } = getEligibleBirthYearRange(isDatingSession);
  const birthYearOptions = Array.from({ length: birthYearMax - birthYearMin + 1 }, (_, i) => birthYearMax - i).map(
    (y) => ({ value: String(y), label: `${y}년생` })
  );

  function resetForm() {
    setDepositorName("");
    setMarkPaid(true);
    setNotes(DEFAULT_MANUAL_NOTE);
    setAttendees([emptyAttendeeRow()]);
    setError(null);
  }

  function updateAttendee(index: number, patch: Partial<AttendeeFormValue>) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const payload: ManualAttendeeInput[] = attendees.map((a) => ({
        name: a.name.trim(),
        phone: a.phone.trim(),
        birthYear: Number(a.birthYear),
        nickname: a.nickname.trim() || null,
        gender: a.gender || null,
        experienceRange: (a.experienceRange || null) as ManualAttendeeInput["experienceRange"],
      }));
      const response = await adminManualApply(sessionId, depositorName, markPaid, notes.trim() || null, payload);
      if ("error" in response) {
        setError(response.error);
      } else {
        setResult({ confirmationCode: response.confirmationCode, status: response.status });
        setOpen(false);
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          resetForm();
          setResult(null);
          setOpen(true);
        }}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs bg-brand text-brand-foreground rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        수동 등록 (문자 미발송)
      </button>

      {result && (
        <span className="text-xs text-confirm font-semibold">
          ✓ 등록 완료 — 접수번호 {result.confirmationCode} ({result.status === "confirmed" ? "확정" : "대기"})
        </span>
      )}

      <ConfirmDialog
        open={open}
        wide
        title="참여자 수동 등록"
        message="신청확인/입금확인 문자를 보내지 않고 신청을 바로 등록합니다. 정원·출생년도 등 기존 신청 규칙은 동일하게 적용돼요."
        cancelLabel="취소"
        confirmLabel={isLoading ? "등록중..." : "등록"}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
        error={error}
        confirmDisabled={isLoading}
      >
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">입금자명</label>
            <input
              type="text"
              placeholder="홍길동"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              className={attendeeInputClassName}
            />
          </div>

          {attendees.map((attendee, index) => (
            <div key={index} className="rounded-xl border border-border p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted">
                  {index === 0 ? (attendees.length > 1 ? "대표 신청자" : "신청자") : `동행자 ${index}`}
                </p>
                {!isDatingSession && attendees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAttendees((prev) => prev.filter((_, i) => i !== index))}
                    className="text-xs text-danger hover:underline"
                  >
                    삭제
                  </button>
                )}
              </div>

              <AttendeeFormFields
                value={attendee}
                onChange={(patch) => updateAttendee(index, patch)}
                birthYearOptions={birthYearOptions}
              />
            </div>
          ))}

          {!isDatingSession && (
            <button
              type="button"
              onClick={() => setAttendees((prev) => [...prev, emptyAttendeeRow()])}
              className="text-sm text-glow hover:underline self-start"
            >
              + 동행자 추가
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">비고 (선택)</label>
            <input
              type="text"
              placeholder="예: 전화 문의 후 직접 등록"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={attendeeInputClassName}
            />
            <p className="text-xs text-muted">
              어드민 상세 화면에서 수동 등록 여부를 구분하는 용도예요. 그룹(2인 이상) 회차는 신청자도 /lookup 조회 시 이 내용을 볼 수 있으니 필요하면 내용을 바꾸거나 비워두세요.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
            입금 확인 완료 상태로 등록 (체크 해제 시 입금 대기 상태로 등록)
          </label>
        </div>
      </ConfirmDialog>
    </>
  );
}
