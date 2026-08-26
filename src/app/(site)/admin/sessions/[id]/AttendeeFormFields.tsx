"use client";

import { Select } from "@/components/ui/Select";
import { formatPhoneInput } from "@/lib/phone";
import { EXPERIENCE_RANGES, EXPERIENCE_RANGE_LABELS } from "@/lib/validation";

export type AttendeeFormValue = {
  name: string;
  phone: string;
  birthYear: string;
  nickname: string;
  gender: "M" | "F" | "";
  experienceRange: string;
};

export const attendeeInputClassName =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]";

function genderButtonClassName(active: boolean) {
  return `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
    active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface text-foreground hover:border-brand"
  }`;
}

export function AttendeeFormFields({
  value,
  onChange,
  birthYearOptions,
}: {
  value: AttendeeFormValue;
  onChange: (patch: Partial<AttendeeFormValue>) => void;
  birthYearOptions: { value: string; label: string }[];
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">이름</label>
          <input
            type="text"
            placeholder="홍길동"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={attendeeInputClassName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={value.phone}
            onChange={(e) => onChange({ phone: formatPhoneInput(e.target.value) })}
            className={attendeeInputClassName}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">출생년도</label>
          <Select
            value={value.birthYear}
            onChange={(v) => onChange({ birthYear: v })}
            options={birthYearOptions}
            placeholder="선택"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">성별</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => onChange({ gender: "F" })} className={genderButtonClassName(value.gender === "F")}>
              여성
            </button>
            <button type="button" onClick={() => onChange({ gender: "M" })} className={genderButtonClassName(value.gender === "M")}>
              남성
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">방탈출 경험 횟수</label>
        <Select
          value={value.experienceRange}
          onChange={(v) => onChange({ experienceRange: v })}
          options={EXPERIENCE_RANGES.map((r) => ({ value: r, label: EXPERIENCE_RANGE_LABELS[r] }))}
          placeholder="선택"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">닉네임 (선택)</label>
        <input
          type="text"
          placeholder="비워두면 이름으로 표시돼요"
          value={value.nickname}
          onChange={(e) => onChange({ nickname: e.target.value })}
          className={attendeeInputClassName}
        />
      </div>
    </>
  );
}
