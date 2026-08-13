"use client";

import { type AttendeeState } from "./types";
import { Select } from "@/components/ui/Select";
import { ELIGIBLE_BIRTH_YEAR_MAX, ELIGIBLE_BIRTH_YEAR_MIN } from "@/lib/eligibility";
import { isValidPhoneDigits } from "@/lib/phone";
import { EXPERIENCE_RANGES, EXPERIENCE_RANGE_LABELS } from "@/lib/validation";

const BIRTH_YEARS = Array.from(
  { length: ELIGIBLE_BIRTH_YEAR_MAX - ELIGIBLE_BIRTH_YEAR_MIN + 1 },
  (_, i) => ELIGIBLE_BIRTH_YEAR_MAX - i
);

function phoneInputClassName(invalid: boolean) {
  return `w-full rounded-lg border px-3 py-2.5 text-center text-sm outline-none transition-shadow ${
    invalid
      ? "border-danger bg-danger-soft text-danger"
      : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
  }`;
}

function textInputClassName(invalid: boolean) {
  return `w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-shadow ${
    invalid
      ? "border-danger bg-danger-soft text-danger"
      : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
  }`;
}

function toggleButtonClassName(active: boolean, invalid: boolean, sizeClass: string = "flex-1") {
  if (invalid) {
    return `${sizeClass} rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger transition-all`;
  }
  return `${sizeClass} rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
    active
      ? "border-brand bg-brand text-brand-foreground"
      : "border-border bg-surface text-foreground hover:border-brand"
  }`;
}

export type AttendeeFieldErrors = {
  name?: string;
  phone?: string;
  birthYear?: string;
  gender?: string;
  experienceRange?: string;
  nickname?: string;
};

export function AttendeeCard({
  index,
  attendee,
  isDatingSession,
  maleClosed,
  femaleClosed,
  isConflict,
  conflictReason,
  errors,
  attendeeCount,
  onNameChange,
  onPhoneSegmentChange,
  onPhoneBackspace,
  onBirthYearChange,
  onGenderChange,
  onExperienceChange,
  onNicknameChange,
}: {
  index: number;
  attendee: AttendeeState;
  isDatingSession: boolean;
  maleClosed: boolean;
  femaleClosed: boolean;
  isConflict: boolean;
  conflictReason?: "group" | "theme";
  errors: AttendeeFieldErrors;
  attendeeCount: number;
  onNameChange: (value: string) => void;
  onPhoneSegmentChange: (field: "phone1" | "phone2" | "phone3", rawValue: string, maxLength: number, nextId: string | null) => void;
  onPhoneBackspace: (e: React.KeyboardEvent<HTMLInputElement>, prevId: string | null) => void;
  onBirthYearChange: (value: string) => void;
  onGenderChange: (value: "M" | "F") => void;
  onExperienceChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
}) {
  const combinedPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
  const isFormatInvalid = combinedPhone.length >= 10 && !isValidPhoneDigits(combinedPhone);
  const phoneInvalid = isConflict || isFormatInvalid;

  return (
    <div
      className={`rounded-xl border p-4 ${
        isConflict ? "border-danger bg-danger-soft" : "border-border bg-surface"
      }`}
    >
      <p className="mb-2 text-xs font-bold text-muted">
        {index === 0 ? (attendeeCount > 1 ? "대표 신청자 (본인)" : "신청자") : `동행자 ${index}`}
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`attendee-${index}-name`} className="text-sm font-semibold text-foreground">
            이름
          </label>
          <input
            id={`attendee-${index}-name`}
            type="text"
            required
            placeholder="홍길동"
            value={attendee.name}
            onChange={(e) => onNameChange(e.target.value)}
            className={textInputClassName(!!errors.name)}
          />
          {errors.name ? <p className="text-xs text-danger">{errors.name}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`attendee-${index}-phone1`} className="text-sm font-semibold text-foreground">
            전화번호
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`attendee-${index}-phone1`}
              type="tel"
              inputMode="numeric"
              required
              maxLength={3}
              placeholder="010"
              value={attendee.phone1}
              onChange={(e) => onPhoneSegmentChange("phone1", e.target.value, 3, `attendee-${index}-phone2`)}
              className={phoneInputClassName(phoneInvalid || !!errors.phone)}
            />
            <span className="text-muted">-</span>
            <input
              id={`attendee-${index}-phone2`}
              type="tel"
              inputMode="numeric"
              required
              maxLength={4}
              placeholder="0000"
              value={attendee.phone2}
              onKeyDown={(e) => onPhoneBackspace(e, `attendee-${index}-phone1`)}
              onChange={(e) => onPhoneSegmentChange("phone2", e.target.value, 4, `attendee-${index}-phone3`)}
              className={phoneInputClassName(phoneInvalid || !!errors.phone)}
            />
            <span className="text-muted">-</span>
            <input
              id={`attendee-${index}-phone3`}
              type="tel"
              inputMode="numeric"
              required
              maxLength={4}
              placeholder="0000"
              value={attendee.phone3}
              onKeyDown={(e) => onPhoneBackspace(e, `attendee-${index}-phone2`)}
              onChange={(e) => onPhoneSegmentChange("phone3", e.target.value, 4, null)}
              className={phoneInputClassName(phoneInvalid || !!errors.phone)}
            />
          </div>
          {errors.phone ? <p className="text-xs text-danger">{errors.phone}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`attendee-${index}-birthYear`} className="text-sm font-semibold text-foreground">
            출생년도
          </label>
          <Select
            id={`attendee-${index}-birthYear`}
            value={attendee.birthYear}
            onChange={onBirthYearChange}
            options={BIRTH_YEARS.map((y) => ({
              value: String(y),
              label: `${y}년생`,
            }))}
            placeholder="선택"
            invalid={!!errors.birthYear}
          />
          {errors.birthYear ? <p className="text-xs text-danger">{errors.birthYear}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-foreground">성별</label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isDatingSession && femaleClosed}
              onClick={() => onGenderChange("F")}
              className={`${toggleButtonClassName(attendee.gender === "F", !!errors.gender)} ${isDatingSession && femaleClosed ? "pointer-events-none opacity-50" : ""}`}
            >
              여성{isDatingSession && femaleClosed ? " (마감)" : ""}
            </button>
            <button
              type="button"
              disabled={isDatingSession && maleClosed}
              onClick={() => onGenderChange("M")}
              className={`${toggleButtonClassName(attendee.gender === "M", !!errors.gender)} ${isDatingSession && maleClosed ? "pointer-events-none opacity-50" : ""}`}
            >
              남성{isDatingSession && maleClosed ? " (마감)" : ""}
            </button>
          </div>
          {errors.gender ? <p className="text-xs text-danger">{errors.gender}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-foreground">방탈출 경험 횟수 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => onExperienceChange(attendee.experienceRange === range ? "" : range)}
                className={toggleButtonClassName(attendee.experienceRange === range, !!errors.experienceRange, "grow basis-[calc((100%-16px)/3)]")}
              >
                {range === "0" ? (
                  <>
                    <span className="lg:hidden">0회</span>
                    <span className="hidden lg:inline">0회 (경험 없음)</span>
                  </>
                ) : (
                  EXPERIENCE_RANGE_LABELS[range]
                )}
              </button>
            ))}
          </div>
          {errors.experienceRange ? <p className="text-xs text-danger">{errors.experienceRange}</p> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`attendee-${index}-nickname`} className="text-sm font-semibold text-foreground">
            닉네임 (선택)
          </label>
          <input
            id={`attendee-${index}-nickname`}
            type="text"
            placeholder="같은 회차 내에서 다른 참여자와 중복될 수 없어요"
            value={attendee.nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            className={textInputClassName(!!errors.nickname)}
          />
          <p className="text-xs text-muted">비워두면 이름으로 표시돼요.</p>
          {errors.nickname ? <p className="text-xs text-danger">{errors.nickname}</p> : null}
        </div>
      </div>
      {isConflict ? (
        <p className="mt-2 text-xs text-danger">
          {conflictReason === "group"
            ? "그룹 안의 다른 참여자와 전화번호가 중복돼요."
            : "이미 같은 테마에 참여하신 신청자예요."}
        </p>
      ) : null}
    </div>
  );
}
