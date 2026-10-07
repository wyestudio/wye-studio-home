"use client";

import { Select } from "@/components/ui/Select";
import { formatPhoneInput } from "@/lib/phone";
import { EXPERIENCE_RANGES, EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import type { AttendeeForm } from "./ApplyForm";

/**
 * 반투명 카드 위에 올리는 입력칸. 카드는 비치고 칸만 불투명하다.
 * 넓은 화면에서 칸을 키운다(테마 상세 비율) — ApplyForm 의 칸과 같은 크기여야 한다.
 *
 * ⚠️ 글자는 `text-input`(16px 고정)이다. 14px 이었을 때 아이폰에서 칸을 누를
 *    때마다 화면이 확대됐다(2026-10-04 UX 진단 P0). 16px 아래로 내리지 말 것.
 * ⚠️ 높이 48px(h-12) 은 터치 영역 기준이다(Apple HIG 44pt · Material 48dp).
 */
const field =
  "h-12 w-full rounded-lg border border-line bg-fill px-3 text-input outline-none focus:border-line-strong sm:h-14 text-h3";
const fieldInvalid =
  "h-12 w-full rounded-lg border border-danger bg-danger-soft px-3 text-input text-danger outline-none sm:h-14 text-h3";
const label = "block text-label font-semibold text-muted mb-1.5 lg:mb-2";
const hint = "mt-1 text-body-sm text-muted sm:mt-1.5";
const errorText = "mt-1 text-body-sm text-danger sm:mt-1.5";

/*
  입력칸이 자기 오류 문구를 가리키게 하는 속성 묶음(aria-describedby).
  연결하지 않으면 화면에는 빨간 글씨가 보이는데 스크린리더는 무엇이 잘못됐는지
  읽어주지 못한다 — 2026-10-04 접근성 진단에서 공개 폼에 이 연결이 0건이었다.
  오류 문구 쪽에는 같은 규칙의 id(`<입력칸 id>-error`)를 단다.
*/
function errorProps(id: string, hasError: boolean) {
  return {
    id,
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? `${id}-error` : undefined,
  } as const;
}

export type NicknameCheckState = "idle" | "checking" | "available" | "taken" | "error";

export type AttendeeErrors = {
  name?: string;
  phone?: string;
  birthYear?: string;
  nickname?: string;
  experienceRange?: string;
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
  onTouch,
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
  /**
   * 칸을 떠났을 때(blur) 부른다. 그 칸은 '다음' 을 누르기 전에도 오류를 보여준다
   * (ApplyForm 의 touched 주석 참고). 타이핑 중에는 부르지 않는다.
   */
  onTouch?: (field: string) => void;
  onNicknameCheck: () => void;
}) {
  const phoneInvalid = !!errors.phone || isConflict;

  return (
    <div
      className={`rounded-lg border p-4 sm:p-6 ${
        isConflict ? "border-danger bg-danger-soft" : "border-line"
      }`}
    >
      <p className="mb-3 text-h3 font-semibold sm:mb-4">
        {index === 0 ? (attendeeCount > 1 ? "대표 신청자 (본인)" : "신청자") : `동행자 ${index}`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-5">
        {/* ── 이름 / 닉네임 ── */}
        <div>
          <label className={label} htmlFor={`attendee-${index}-name`}>이름 *</label>
          <input
            {...errorProps(`attendee-${index}-name`, !!errors.name)}
            className={errors.name ? fieldInvalid : field}
            /*
              대표 신청자(본인)만 브라우저 자동완성을 받는다. 동행자 칸에 "name" 을
              주면 브라우저가 **신청자 본인 이름**을 동행자 칸에 채워 넣는다.
            */
            autoComplete={index === 0 ? "name" : "off"}
            value={attendee.name}
            onBlur={() => onTouch?.(`attendee-${index}-name`)}
            placeholder="홍길동"
            onChange={(e) => onChange({ name: e.target.value })}
          />
          {errors.name && (
            <p id={`attendee-${index}-name-error`} role="alert" className={errorText}>{errors.name}</p>
          )}
        </div>

        <div>
          <label className={label} htmlFor={`attendee-${index}-nickname`}>닉네임 (선택)</label>
          <div className="flex gap-2">
            <input
              {...errorProps(`attendee-${index}-nickname`, !!errors.nickname)}
              className={errors.nickname ? fieldInvalid : field}
              autoComplete="off"
              value={attendee.nickname}
              onBlur={() => onTouch?.(`attendee-${index}-nickname`)}
              placeholder="현장에서 쓰일 이름"
              onChange={(e) => onChange({ nickname: e.target.value })}
            />
            {attendee.nickname.trim() && (
              <button
                type="button"
                onClick={onNicknameCheck}
                disabled={nicknameCheckState === "checking"}
                className="h-12 shrink-0 rounded-lg border border-line px-3 text-body-sm font-semibold disabled:opacity-50 sm:h-14 sm:px-4"
              >
                {nicknameCheckState === "checking" ? "확인 중…" : "중복확인"}
              </button>
            )}
          </div>
          {errors.nickname ? (
            <p id={`attendee-${index}-nickname-error`} role="alert" className={errorText}>{errors.nickname}</p>
          ) : nicknameCheckState === "available" ? (
            <p className="mt-1 text-body-sm text-glow sm:mt-1.5">사용 가능한 닉네임이에요.</p>
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
          {/*
            한 칸으로 받고 타이핑 중에 하이픈을 자동으로 붙인다(formatPhoneInput —
            조회 폼과 같은 함수). 세 칸이던 것을 2026-10-04 에 합쳤다:
              · `autocomplete="tel"` 이 제대로 먹는다(세 칸일 때는 각 칸에 전체
                번호가 들어가 버려 아예 끌 수밖에 없었다)
              · 붙여넣기가 그냥 된다 — 칸마다 나눠 담는 처리가 필요 없다
              · 칸 사이 포커스 이동(다 치면 넘어가고, 지우면 돌아오고)이 사라졌다
            ⚠️ maxLength 는 글자 수(하이픈 포함) 13 이다. 숫자 11 자리가 아니다.
          */}
          <input
            {...errorProps(`attendee-${index}-phone`, phoneInvalid)}
            className={phoneInvalid ? fieldInvalid : field}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={13}
            onBlur={() => onTouch?.(`attendee-${index}-phone`)}
            placeholder="010-0000-0000"
            value={attendee.phoneInput}
            onChange={(e) => onChange({ phoneInput: formatPhoneInput(e.target.value) })}
          />
          {errors.phone ? (
            <p id={`attendee-${index}-phone-error`} role="alert" className={errorText}>{errors.phone}</p>
          ) : isConflict ? (
            <p id={`attendee-${index}-phone-error`} role="alert" className={errorText}>
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
            size="lg"
            value={attendee.birth_year ? String(attendee.birth_year) : ""}
            onChange={(v) => onChange({ birth_year: Number(v) })}
            options={birthYears.map((y) => ({ value: String(y), label: `${y}년생` }))}
            placeholder="선택"
            invalid={!!errors.birthYear}
            errorId={`attendee-${index}-birthYear-error`}
          />
          {errors.birthYear ? (
            <p id={`attendee-${index}-birthYear-error`} role="alert" className={errorText}>{errors.birthYear}</p>
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
            size="lg"
            value={attendee.experience_range}
            onChange={(v) => onChange({ experience_range: v })}
            options={EXPERIENCE_RANGES.map((r) => ({ value: r, label: EXPERIENCE_RANGE_LABELS[r] }))}
            placeholder="선택"
            invalid={!!errors.experienceRange}
            errorId={`attendee-${index}-experienceRange-error`}
          />
          {errors.experienceRange ? (
            <p id={`attendee-${index}-experienceRange-error`} role="alert" className={errorText}>{errors.experienceRange}</p>
          ) : (
            <p className={hint}>팀 배정에 참고됩니다.</p>
          )}
        </div>

        <div>
          <label className={label} htmlFor={`attendee-${index}-gender`}>성별 (선택)</label>
          <Select
            id={`attendee-${index}-gender`}
            variant="glass"
            size="lg"
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
