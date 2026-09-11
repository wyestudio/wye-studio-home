"use client";

import { Select } from "@/components/ui/Select";
import { EXPERIENCE_RANGES, EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import type { AttendeeInput } from "./actions";

/** 반투명 카드 위에 올리는 입력칸. 카드는 비치고 칸만 불투명하다. */
const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50";
const fieldInvalid =
  "w-full rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger outline-none";
const label = "block text-xs font-medium text-muted mb-1.5";
const hint = "mt-1 text-[11px] text-muted";
const errorText = "mt-1 text-[11px] text-danger";

export type NicknameCheckState = "idle" | "checking" | "available" | "taken" | "error";

export type AttendeeErrors = {
  name?: string;
  phone?: string;
  birthYear?: string;
  nickname?: string;
};

/**
 * 참여자 한 명의 입력칸.
 *
 * 배치는 이름/닉네임 → 휴대폰/출생연도 → 방탈출 경험/성별 2열.
 * 콤보박스는 브라우저 기본 select 가 아니라 공용 Select 를 쓴다 —
 * 출생연도처럼 항목이 70개인 칸은 기본 select 로는 화면을 뒤덮는다.
 */
export function AttendeeFields({
  index,
  attendee,
  attendeeCount,
  birthYears,
  minAge,
  errors,
  isConflict,
  conflictReason,
  nicknameCheckState,
  onChange,
  onNicknameCheck,
}: {
  index: number;
  attendee: AttendeeInput;
  attendeeCount: number;
  birthYears: number[];
  minAge: number;
  errors: AttendeeErrors;
  isConflict: boolean;
  conflictReason: "group" | "theme" | null;
  nicknameCheckState: NicknameCheckState;
  onChange: (patch: Partial<AttendeeInput>) => void;
  onNicknameCheck: () => void;
}) {
  const phoneInvalid = !!errors.phone || isConflict;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isConflict ? "border-danger bg-danger-soft" : "border-white/15"
      }`}
    >
      <p className="mb-3 text-sm font-semibold">
        {index === 0 ? (attendeeCount > 1 ? "대표 신청자 (본인)" : "신청자") : `동행자 ${index}`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* ── 이름 / 닉네임 ── */}
        <div>
          <label className={label} htmlFor={`attendee-${index}-name`}>이름 *</label>
          <input
            id={`attendee-${index}-name`}
            className={errors.name ? fieldInvalid : field}
            value={attendee.name}
            placeholder="홍길동"
            onChange={(e) => onChange({ name: e.target.value })}
          />
          {errors.name && <p className={errorText}>{errors.name}</p>}
        </div>

        <div>
          <label className={label} htmlFor={`attendee-${index}-nickname`}>닉네임 (선택)</label>
          <div className="flex gap-2">
            <input
              id={`attendee-${index}-nickname`}
              className={errors.nickname ? fieldInvalid : field}
              value={attendee.nickname}
              placeholder="현장에서 쓰일 이름"
              onChange={(e) => onChange({ nickname: e.target.value })}
            />
            {attendee.nickname.trim() && (
              <button
                type="button"
                onClick={onNicknameCheck}
                disabled={nicknameCheckState === "checking"}
                className="shrink-0 rounded-lg border border-white/25 px-3 text-xs font-semibold disabled:opacity-50"
              >
                {nicknameCheckState === "checking" ? "확인 중…" : "중복확인"}
              </button>
            )}
          </div>
          {errors.nickname ? (
            <p className={errorText}>{errors.nickname}</p>
          ) : nicknameCheckState === "available" ? (
            <p className="mt-1 text-[11px] text-glow">사용 가능한 닉네임이에요.</p>
          ) : nicknameCheckState === "taken" ? (
            <p className={errorText}>이미 사용 중인 닉네임이에요.</p>
          ) : nicknameCheckState === "error" ? (
            <p className={errorText}>확인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.</p>
          ) : (
            <p className={hint}>비워두면 이름으로 표시돼요.</p>
          )}
        </div>

        {/* ── 휴대폰 / 출생연도 ── */}
        <div>
          <label className={label} htmlFor={`attendee-${index}-phone`}>휴대폰 번호 *</label>
          <input
            id={`attendee-${index}-phone`}
            className={phoneInvalid ? fieldInvalid : field}
            inputMode="numeric"
            placeholder="01012345678"
            value={attendee.phone}
            onChange={(e) => onChange({ phone: e.target.value.replace(/[^0-9]/g, "") })}
          />
          {errors.phone ? (
            <p className={errorText}>{errors.phone}</p>
          ) : isConflict ? (
            <p className={errorText}>
              {conflictReason === "group"
                ? "그룹 안의 다른 참여자와 전화번호가 중복돼요."
                : "이미 같은 테마에 참여하신 신청자예요."}
            </p>
          ) : null}
        </div>

        <div>
          <label className={label} htmlFor={`attendee-${index}-birthYear`}>출생연도 *</label>
          <Select
            id={`attendee-${index}-birthYear`}
            variant="glass"
            value={attendee.birth_year ? String(attendee.birth_year) : ""}
            onChange={(v) => onChange({ birth_year: Number(v) })}
            options={birthYears.map((y) => ({ value: String(y), label: `${y}년생` }))}
            placeholder="선택"
            invalid={!!errors.birthYear}
          />
          {errors.birthYear ? (
            <p className={errorText}>{errors.birthYear}</p>
          ) : (
            <p className={hint}>이 회차는 만 {minAge}세 이상만 참여할 수 있어요.</p>
          )}
        </div>

        {/* ── 방탈출 경험 / 성별 ── */}
        <div>
          <label className={label} htmlFor={`attendee-${index}-experience`}>방탈출 경험</label>
          <Select
            id={`attendee-${index}-experience`}
            variant="glass"
            value={attendee.experience_range}
            onChange={(v) => onChange({ experience_range: v })}
            options={[
              { value: "", label: "선택 안 함" },
              ...EXPERIENCE_RANGES.map((r) => ({ value: r, label: EXPERIENCE_RANGE_LABELS[r] })),
            ]}
            placeholder="선택 안 함"
          />
          <p className={hint}>팀 배정에 참고합니다.</p>
        </div>

        <div>
          <label className={label} htmlFor={`attendee-${index}-gender`}>성별 (선택)</label>
          <Select
            id={`attendee-${index}-gender`}
            variant="glass"
            value={attendee.gender}
            onChange={(v) => onChange({ gender: v })}
            options={[
              { value: "", label: "선택 안 함" },
              { value: "M", label: "남성" },
              { value: "F", label: "여성" },
            ]}
            placeholder="선택 안 함"
          />
        </div>
      </div>
    </div>
  );
}
