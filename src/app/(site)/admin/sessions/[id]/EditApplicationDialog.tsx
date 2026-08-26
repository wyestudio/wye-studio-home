"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getEligibleBirthYearRange } from "@/lib/eligibility";
import type { ExperienceRange } from "@/lib/validation";
import { AttendeeFormFields, attendeeInputClassName, type AttendeeFormValue } from "./AttendeeFormFields";
import { adminUpdateApplication, type EditAttendeeInput } from "./actions";

export type EditableAttendee = {
  id: string;
  is_representative: boolean;
  name: string;
  phone: string;
  birth_year: number;
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
    birthYear: String(a.birth_year),
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
  isDatingSession,
  depositorName: initialDepositorName,
  notes: initialNotes,
  attendees: initialAttendees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  sessionId: string;
  isDatingSession: boolean;
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

  const { min: birthYearMin, max: birthYearMax } = getEligibleBirthYearRange(isDatingSession);
  const birthYearOptions = Array.from({ length: birthYearMax - birthYearMin + 1 }, (_, i) => birthYearMax - i).map(
    (y) => ({ value: String(y), label: `${y}년생` })
  );

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
      const response = await adminUpdateApplication(applicationId, sessionId, depositorName, notes.trim() || null, payload);
      if ("error" in response) {
        setError(response.error);
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
          <label className="text-sm font-semibold text-foreground">입금자명</label>
          <input
            type="text"
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            className={attendeeInputClassName}
          />
        </div>

        {attendees.map((attendee, index) => (
          <div key={attendee.id} className="rounded-xl border border-border p-3 flex flex-col gap-3">
            <p className="text-xs font-bold text-muted">{attendee.isRepresentative ? "대표 신청자" : `동행자 ${index}`}</p>
            <AttendeeFormFields
              value={attendee}
              onChange={(patch) => updateAttendee(index, patch)}
              birthYearOptions={birthYearOptions}
            />
          </div>
        ))}

        {attendees.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground">비고</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={attendeeInputClassName} />
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
