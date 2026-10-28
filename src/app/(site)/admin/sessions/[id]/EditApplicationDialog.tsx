"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { maxBirthYearForMinAge } from "@/lib/eligibility";
import type { ExperienceRange } from "@/lib/validation";
import { AttendeeFormFields, attendeeInputClassName, type AttendeeFormValue } from "./AttendeeFormFields";
import { formatSessionDateTime } from "@/lib/format";
import {
  adminUpdateApplication,
  listMoveTargets,
  type EditAttendeeInput,
  type MoveResult,
  type MoveTarget,
} from "./actions";

export type EditableAttendee = {
  id: string;
  is_representative: boolean;
  name: string;
  phone: string;
  /** 노말모드 예약은 비어 있다(null). */
  birth_year: number | null;
  nickname: string | null;
  gender: "M" | "F" | null;
  experience_range: ExperienceRange | null;
};

type AttendeeRow = AttendeeFormValue & { id: string; isRepresentative: boolean };

function toRow(a: EditableAttendee): AttendeeRow {
  return {
    id: a.id,
    isRepresentative: a.is_representative,
    name: a.name,
    phone: a.phone,
    // 노말 예약은 출생연도가 없다 — "null" 글자가 칸에 들어가지 않게 비운다.
    birthYear: a.birth_year ? String(a.birth_year) : "",
    nickname: a.nickname ?? "",
    gender: a.gender ?? "",
    experienceRange: a.experience_range ?? "",
  };
}

export function EditApplicationDialog({
  open,
  onClose,
  applicationId,
  sessionId,
  minAge,
  depositorName: initialDepositorName,
  notes: initialNotes,
  attendees: initialAttendees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  sessionId: string;
  minAge: number;
  depositorName: string;
  notes: string | null;
  attendees: EditableAttendee[];
  onSaved: () => void;
}) {
  const [depositorName, setDepositorName] = useState(initialDepositorName);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [attendees, setAttendees] = useState<AttendeeRow[]>(() =>
    [...initialAttendees].sort((a, b) => (b.is_representative ? 1 : 0) - (a.is_representative ? 1 : 0)).map(toRow)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 회차 변경 — 같은 묶음(파티 ↔ 노말)의 다가오는 열린 회차로 옮긴다(2026-10-28 대표님).
  const [targets, setTargets] = useState<MoveTarget[] | null>(null);
  const [targetId, setTargetId] = useState("");
  const [moved, setMoved] = useState<MoveResult | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open || targets) return;
    listMoveTargets(sessionId)
      .then(setTargets)
      .catch(() => setTargets([]));
  }, [open, targets, sessionId]);

  const target = targets?.find((t) => t.id === targetId) ?? null;

  // 수동 등록·고객 신청과 같은 기준 — 회차의 min_age 로 매번 계산한다. 옮길 때는 옮겨 갈 회차 기준.
  const birthYearMax = maxBirthYearForMinAge(target?.minAge ?? minAge);
  const birthYearOptions = Array.from({ length: 70 }, (_, i) => birthYearMax - i).map((y) => ({
    value: String(y),
    label: `${y}년생`,
  }));

  function updateAttendee(index: number, patch: Partial<AttendeeFormValue>) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);
    try {
      const payload: EditAttendeeInput[] = attendees.map((a) => ({
        id: a.id,
        name: a.name.trim(),
        phone: a.phone.trim(),
        birthYear: Number(a.birthYear),
        nickname: a.nickname.trim() || null,
        gender: a.gender || null,
        experienceRange: (a.experienceRange || null) as EditAttendeeInput["experienceRange"],
      }));
      const response = await adminUpdateApplication(
        applicationId,
        sessionId,
        depositorName,
        notes.trim() || null,
        payload,
        targetId || null
      );
      if ("error" in response) {
        setError(response.error);
      } else if (response.moved) {
        // 옮긴 결과(확정/대기 · 금액)를 보여 준 뒤 닫는다 — 이 회차 목록에서는 빠진다.
        setMoved(response.moved);
      } else {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  if (moved) {
    const statusLabel = (s: string) => (s === "confirmed" ? "확정" : s === "waiting" ? "대기" : s);
    const won = (n: number | null) => (n == null ? "-" : `${n.toLocaleString("ko-KR")}원`);
    const amountChanged = moved.oldAmount !== moved.newAmount;
    return (
      <ConfirmDialog
        open={open}
        title="회차를 옮겼어요"
        message={`${moved.toLabel} 회차로 옮겼습니다. 손님에게 문자는 보내지 않았어요.`}
        cancelLabel="닫기"
        confirmLabel="확인"
        onCancel={() => router.refresh()}
        onConfirm={() => router.refresh()}
      >
        <ul className="mt-4 flex flex-col gap-1.5 text-body-sm">
          <li>
            상태: {statusLabel(moved.oldStatus)}
            {moved.oldStatus !== moved.newStatus && (
              <span className="font-semibold text-amber-400"> → {statusLabel(moved.newStatus)}</span>
            )}
          </li>
          <li>
            금액: {won(moved.oldAmount)}
            {amountChanged && <span className="font-semibold text-amber-400"> → {won(moved.newAmount)}</span>}
          </li>
          {amountChanged && moved.paymentStatus === "confirmed" && (
            <li className="text-amber-400">이미 입금 확인된 신청이에요. 차액은 따로 처리해주세요.</li>
          )}
        </ul>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      wide
      title="신청 정보 수정"
      message="신청확인/입금확인 문자를 보내지 않고 정보만 고칩니다. 출생년도·성별을 바꿔도 확정/대기 상태는 다시 계산되지 않아요."
      cancelLabel="취소"
      confirmLabel={isLoading ? "저장중..." : "저장"}
      onCancel={onClose}
      onConfirm={handleConfirm}
      error={error}
      confirmDisabled={isLoading}
    >
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-session" className="text-body-sm font-semibold text-foreground">
            회차
          </label>
          <select
            id="edit-session"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={!targets}
            className={attendeeInputClassName}
          >
            <option value="">지금 회차 그대로</option>
            {targets?.map((t) => (
              <option key={t.id} value={t.id} disabled={t.remaining < attendees.length}>
                {formatSessionDateTime(t.startAt)}
                {t.mode ? ` · ${t.mode}` : ""} · 남은 자리 {t.remaining}
              </option>
            ))}
          </select>
          {targets && targets.length === 0 && (
            <p className="text-micro text-muted">옮길 수 있는 다가오는 회차가 없어요.</p>
          )}
          {target && (
            <p className="text-micro text-amber-400">
              옮기면 금액과 확정/대기를 새 회차 기준으로 다시 계산해요(얼리버드는 처음 신청한 때 기준). 문자는
              보내지 않아요.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-body-sm font-semibold text-foreground">입금자명</label>
          <input
            type="text"
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            className={attendeeInputClassName}
          />
        </div>

        {attendees.map((attendee, index) => (
          <div key={attendee.id} className="rounded-xl border border-border p-3 flex flex-col gap-3">
            <p className="text-micro font-semibold text-muted">{attendee.isRepresentative ? "대표 신청자" : `동행자 ${index}`}</p>
            <AttendeeFormFields
              value={attendee}
              onChange={(patch) => updateAttendee(index, patch)}
              birthYearOptions={birthYearOptions}
            />
          </div>
        ))}

        {attendees.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-body-sm font-semibold text-foreground">비고</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={attendeeInputClassName} />
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
