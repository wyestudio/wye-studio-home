"use client";

import { Select } from "@/components/ui/Select";
import { EXPERIENCE_RANGES, EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import type { AttendeeForm } from "./ApplyForm";

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
  experienceRange?: string;
};

/**
 * 010-1234-5678 세 칸.
 *
 * ⚠️ 칸마다 값을 따로 들고 있어야 한다. 이어붙인 한 줄을 잘라 쓰면 가운데 칸을
 *    비웠을 때 뒷 칸 숫자가 앞으로 당겨진다(실제로 그랬다).
 */
const PHONE_SEGMENTS = [
  { key: "p1", max: 3, placeholder: "010" },
  { key: "p2", max: 4, placeholder: "0000" },
  { key: "p3", max: 4, placeholder: "0000" },
] as const;

/** 붙여넣은 숫자를 앞에서부터 3-4-4 로 나눈다. */
export function splitPhone(digits: string): string[] {
  const d = digits.replace(/[^0-9]/g, "").slice(0, 11);
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)];
}

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
  attendee: AttendeeForm;
  attendeeCount: number;
  birthYears: number[];
  minAge: number;
  errors: AttendeeErrors;
  isConflict: boolean;
  conflictReason: "group" | "theme" | null;
  nicknameCheckState: NicknameCheckState;
  onChange: (patch: Partial<AttendeeForm>) => void;
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
          <div className="flex items-center gap-2">
            {PHONE_SEGMENTS.map((seg, si) => (
              <div key={seg.key} className="contents">
                {si > 0 && <span className="text-muted">-</span>}
                <input
                  id={si === 0 ? `attendee-${index}-phone` : `attendee-${index}-${seg.key}`}
                  className={`${phoneInvalid ? fieldInvalid : field} text-center`}
                  inputMode="numeric"
                  maxLength={seg.max}
                  placeholder={seg.placeholder}
                  value={attendee.phoneParts[si] ?? ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, seg.max);
                    const next = [...attendee.phoneParts];
                    next[si] = digits;
                    onChange({ phoneParts: next });
                    // 한 칸을 다 채우면 다음 칸으로 넘어간다
                    if (digits.length === seg.max && si < PHONE_SEGMENTS.length - 1) {
                      document.getElementById(`attendee-${index}-${PHONE_SEGMENTS[si + 1].key}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    // 빈 칸에서 지우면 앞 칸으로 돌아간다
                    if (e.key === "Backspace" && e.currentTarget.value === "" && si > 0) {
                      const prev = si - 1;
                      document
                        .getElementById(
                          prev === 0 ? `attendee-${index}-phone` : `attendee-${index}-${PHONE_SEGMENTS[prev].key}`
                        )
                        ?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    // 어느 칸에 붙여넣든 앞에서부터 다시 나눠 담는다
                    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
                    if (!pasted) return;
                    e.preventDefault();
                    onChange({ phoneParts: splitPhone(pasted) });
                  }}
                />
              </div>
            ))}
          </div>
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
          <label className={label} htmlFor={`attendee-${index}-experienceRange`}>방탈출 경험 *</label>
          <Select
            id={`attendee-${index}-experienceRange`}
            variant="glass"
            value={attendee.experience_range}
            onChange={(v) => onChange({ experience_range: v })}
            options={EXPERIENCE_RANGES.map((r) => ({ value: r, label: EXPERIENCE_RANGE_LABELS[r] }))}
            placeholder="선택"
            invalid={!!errors.experienceRange}
          />
          {errors.experienceRange ? (
            <p className={errorText}>{errors.experienceRange}</p>
          ) : (
            <p className={hint}>팀 배정에 참고됩니다.</p>
          )}
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
