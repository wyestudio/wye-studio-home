"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Input";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { applyAction, type ApplyState } from "@/app/sessions/[id]/apply/actions";
import { ELIGIBLE_BIRTH_YEAR_MAX, ELIGIBLE_BIRTH_YEAR_MIN } from "@/lib/eligibility";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import { pushDataLayerEvent } from "@/lib/analytics";
import { isDatingTheme } from "@/lib/theme";
import {
  isValidKoreanName,
  isValidNickname,
  isValidNotes,
  EXPERIENCE_RANGES,
  EXPERIENCE_RANGE_LABELS,
  getValidationErrorMessage,
} from "@/lib/validation";

const initialState: ApplyState = {};
const MAX_ATTENDEES = 8;
const BIRTH_YEARS = Array.from(
  { length: ELIGIBLE_BIRTH_YEAR_MAX - ELIGIBLE_BIRTH_YEAR_MIN + 1 },
  (_, i) => ELIGIBLE_BIRTH_YEAR_MAX - i
);

const selectClassName =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]";

type AttendeeField = "name" | "phone1" | "phone2" | "phone3" | "birthYear" | "nickname" | "gender" | "experienceRange";
type AttendeeState = {
  name: string;
  phone1: string;
  phone2: string;
  phone3: string;
  birthYear: string;
  nickname: string;
  gender: string;
  experienceRange: string;
};

const emptyAttendee: AttendeeState = {
  name: "",
  phone1: "",
  phone2: "",
  phone3: "",
  birthYear: "",
  nickname: "",
  gender: "F",
  experienceRange: "",
};

type ValidationError = { field: string; message: string };

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

function selectClassNameFn(invalid: boolean) {
  return `w-full rounded-lg border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-shadow ${
    invalid
      ? "border-danger bg-danger-soft text-danger"
      : "border-border focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
  }`;
}

function toggleButtonClassName(active: boolean, invalid: boolean) {
  if (invalid) {
    return "flex-1 rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger transition-all";
  }
  return `flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
    active
      ? "border-brand bg-brand text-brand-foreground"
      : "border-border bg-surface text-foreground hover:border-brand"
  }`;
}

export function ApplyForm({
  sessionId,
  priceKrw,
  sessionTitle,
  eventDate,
  themeLabel,
  maleClosed = false,
  femaleClosed = false,
}: {
  sessionId: string;
  priceKrw: number;
  sessionTitle: string;
  eventDate: string;
  themeLabel: string;
  maleClosed?: boolean;
  femaleClosed?: boolean;
}) {
  const isDatingSession = isDatingTheme(themeLabel);
  const [state, formAction, pending] = useActionState(applyAction, initialState);
  const [attendeeCount, setAttendeeCount] = useState(1);
  // 입력값을 React state로 들고 있어야 서버 액션이 에러를 반환해 다시 렌더링돼도
  // (React가 uncontrolled 폼 필드는 액션 완료 후 리셋시킴) 사용자가 입력한 내용이
  // 사라지지 않는다 — 신청 실패 시 폼을 그대로 두고 수정만 하게 해달라는 요청.
  const [attendees, setAttendees] = useState<AttendeeState[]>([{ ...emptyAttendee }]);
  const [depositorName, setDepositorName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const completeEventSent = useRef(false);

  useEffect(() => {
    pushDataLayerEvent("신청 시작", { sessionId, themeLabel });
  }, [sessionId, themeLabel]);

  useEffect(() => {
    if (state.application && !completeEventSent.current) {
      completeEventSent.current = true;
      // 그룹 신청은 동행자마다 출생년도/성별이 다를 수 있어 대표 신청자(0번) 값만 보낸다.
      const representative = state.attendees?.[0];
      pushDataLayerEvent("신청 완료", {
        sessionId,
        themeLabel,
        confirmationCode: state.application.confirmation_code,
        birthYear: representative?.birthYear,
        gender: representative?.gender,
      });
    }
  }, [state.application, state.attendees, sessionId, themeLabel]);

  const conflictPhones = new Set(state.conflictPhoneDigits ?? []);

  function updateAttendeeCount(count: number) {
    setAttendeeCount(count);
    setAttendees((prev) => {
      const next = [...prev];
      while (next.length < count) next.push({ ...emptyAttendee });
      next.length = count;
      return next;
    });
  }

  function updateAttendee(index: number, field: AttendeeField, value: string) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  // 세 칸으로 나뉜 전화번호 입력칸 하나를 갱신한다. 숫자만 허용하고 칸별
  // 길이 제한에 맞춰 자르며, 칸이 다 채워지면 다음 칸으로 자동 이동한다.
  function updatePhoneSegment(
    index: number,
    field: "phone1" | "phone2" | "phone3",
    rawValue: string,
    maxLength: number,
    nextId: string | null
  ) {
    const digitsOnly = rawValue.replace(/[^0-9]/g, "").slice(0, maxLength);
    updateAttendee(index, field, digitsOnly);
    if (nextId && digitsOnly.length === maxLength) {
      document.getElementById(nextId)?.focus();
    }
  }

  function handlePhoneBackspace(e: React.KeyboardEvent<HTMLInputElement>, prevId: string | null) {
    if (e.key === "Backspace" && e.currentTarget.value === "" && prevId) {
      document.getElementById(prevId)?.focus();
    }
  }

  function handleSubmitPointerEnter(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
    // 버튼의 대각선 길이 × 2를 --fill-size로 계산해 어떤 지점을 눌러도 원이 버튼 전체를 덮도록 함
    const diagonal = Math.hypot(rect.width, rect.height);
    el.style.setProperty("--fill-size", `${diagonal * 2}px`);
  }

  function validateForm(): ValidationError[] {
    const errors: ValidationError[] = [];

    // 입금자명
    if (!depositorName.trim()) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "required") });
    } else if (!isValidKoreanName(depositorName)) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "invalid") });
    }

    // 약관 동의
    if (!agreedTerms) {
      errors.push({ field: "agreedTerms", message: getValidationErrorMessage("agreedTerms", "required") });
    }

    // 각 참여자
    attendees.forEach((attendee, i) => {
      // 이름
      if (!attendee.name.trim()) {
        errors.push({
          field: `attendee-${i}-name`,
          message: "이름을 입력해주세요.",
        });
      } else if (!isValidKoreanName(attendee.name)) {
        errors.push({
          field: `attendee-${i}-name`,
          message: getValidationErrorMessage("name", "invalid"),
        });
      }

      // 전화번호
      const fullPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
      if (!fullPhone) {
        errors.push({
          field: `attendee-${i}-phone`,
          message: "전화번호를 입력해주세요.",
        });
      } else if (!isValidPhoneDigits(fullPhone)) {
        errors.push({
          field: `attendee-${i}-phone`,
          message: getValidationErrorMessage("phone", "invalid"),
        });
      }

      // 출생년도
      if (!attendee.birthYear) {
        errors.push({
          field: `attendee-${i}-birthYear`,
          message: "출생년도를 선택해주세요.",
        });
      }

      // 성별 (모든 테마에서 필수)
      if (!attendee.gender || (attendee.gender !== "M" && attendee.gender !== "F")) {
        errors.push({
          field: `attendee-${i}-gender`,
          message: "성별을 선택해주세요.",
        });
      }

      // 닉네임 (선택, 입력했을 때만 검사)
      if (attendee.nickname && !isValidNickname(attendee.nickname)) {
        errors.push({
          field: `attendee-${i}-nickname`,
          message: getValidationErrorMessage("nickname", "invalid"),
        });
      }
    });

    // 비고 (그룹 전용, 선택)
    if (attendees.length >= 2 && notes && !isValidNotes(notes)) {
      errors.push({
        field: "notes",
        message: getValidationErrorMessage("notes", "invalid"),
      });
    }

    return errors;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setSubmitAttempted(true);
      return;
    }

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("depositorName", depositorName);
    if (agreedTerms) formData.set("agreedTerms", "on");
    if (attendees.length >= 2 && notes) formData.set("notes", notes);
    attendees.forEach((attendee, i) => {
      formData.set(`attendees[${i}][name]`, attendee.name);
      formData.set(`attendees[${i}][phone]`, `${attendee.phone1}${attendee.phone2}${attendee.phone3}`);
      formData.set(`attendees[${i}][birthYear]`, attendee.birthYear);
      formData.set(`attendees[${i}][nickname]`, attendee.nickname);
      formData.set(`attendees[${i}][gender]`, attendee.gender);
      formData.set(`attendees[${i}][experienceRange]`, attendee.experienceRange);
    });
    formAction(formData);
  }

  if (state.application) {
    return (
      <ApplyComplete
        application={state.application}
        attendees={state.attendees ?? []}
        priceKrw={priceKrw}
        sessionTitle={sessionTitle}
        eventDate={eventDate}
        notes={state.notes}
      />
    );
  }

  if (state.closed) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-glass-border bg-surface p-6 text-center">
        <p className="text-lg font-bold">정원이 다 차서 마감되었습니다.</p>
        <p className="text-sm text-muted">다음 정식 오픈 때 뵙겠습니다.</p>
        <p className="text-sm text-muted">신청해주셔서 감사합니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="rounded-xl bg-brand-soft p-4 text-xs text-muted">
        비슷한 또래끼리 더 즐겁게 즐기실 수 있도록,
        <br />
        {ELIGIBLE_BIRTH_YEAR_MIN}~{ELIGIBLE_BIRTH_YEAR_MAX}년생만 참여하실 수 있어요.
        {isDatingSession
          ? " 소개팅 회차는 성비를 맞추기 위해 남/여 각각 10명까지 즉시 확정되고, 이후에는 대기로 전환돼요."
          : null}
      </div>

      {isDatingSession ? null : (
        <Field label="함께할 인원 (본인 포함)" htmlFor="attendeeCount">
          <select
            id="attendeeCount"
            value={attendeeCount}
            onChange={(e) => updateAttendeeCount(Number(e.target.value))}
            className={selectClassName}
          >
            {Array.from({ length: MAX_ATTENDEES }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}명
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex flex-col gap-4">
        {attendees.map((attendee, i) => {
          const combinedPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
          const isConflict = conflictPhones.has(phoneDigits(combinedPhone));
          const isFormatInvalid = submitAttempted && !isValidPhoneDigits(combinedPhone);
          const phoneInvalid = isConflict || isFormatInvalid;

          const nameError = validationErrors.find((e) => e.field === `attendee-${i}-name`);
          const phoneError = validationErrors.find((e) => e.field === `attendee-${i}-phone`);
          const birthYearError = validationErrors.find((e) => e.field === `attendee-${i}-birthYear`);
          const genderError = validationErrors.find((e) => e.field === `attendee-${i}-gender`);
          const experienceError = validationErrors.find((e) => e.field === `attendee-${i}-experienceRange`);
          const nicknameError = validationErrors.find((e) => e.field === `attendee-${i}-nickname`);

          return (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                isConflict ? "border-danger bg-danger-soft" : "border-border bg-surface"
              }`}
            >
              <p className="mb-3 text-xs font-bold text-muted">
                {i === 0 ? "대표 신청자 (본인)" : `동행자 ${i}`}
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`attendee-${i}-name`} className="text-sm font-semibold text-foreground">
                    이름
                  </label>
                  <input
                    id={`attendee-${i}-name`}
                    type="text"
                    required
                    placeholder="홍길동"
                    value={attendee.name}
                    onChange={(e) => {
                      updateAttendee(i, "name", e.target.value);
                      if (submitAttempted) setValidationErrors(validateForm());
                    }}
                    className={textInputClassName(!!nameError)}
                  />
                  {nameError ? <p className="text-xs text-danger">{nameError.message}</p> : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`attendee-${i}-phone1`} className="text-sm font-semibold text-foreground">
                    전화번호
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`attendee-${i}-phone1`}
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={3}
                      placeholder="010"
                      value={attendee.phone1}
                      onChange={(e) => {
                        updatePhoneSegment(i, "phone1", e.target.value, 3, `attendee-${i}-phone2`);
                        if (submitAttempted) setValidationErrors(validateForm());
                      }}
                      className={phoneInputClassName(phoneInvalid || !!phoneError)}
                    />
                    <span className="text-muted">-</span>
                    <input
                      id={`attendee-${i}-phone2`}
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={4}
                      placeholder="0000"
                      value={attendee.phone2}
                      onKeyDown={(e) => handlePhoneBackspace(e, `attendee-${i}-phone1`)}
                      onChange={(e) => {
                        updatePhoneSegment(i, "phone2", e.target.value, 4, `attendee-${i}-phone3`);
                        if (submitAttempted) setValidationErrors(validateForm());
                      }}
                      className={phoneInputClassName(phoneInvalid || !!phoneError)}
                    />
                    <span className="text-muted">-</span>
                    <input
                      id={`attendee-${i}-phone3`}
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={4}
                      placeholder="0000"
                      value={attendee.phone3}
                      onKeyDown={(e) => handlePhoneBackspace(e, `attendee-${i}-phone2`)}
                      onChange={(e) => {
                        updatePhoneSegment(i, "phone3", e.target.value, 4, null);
                        if (submitAttempted) setValidationErrors(validateForm());
                      }}
                      className={phoneInputClassName(phoneInvalid || !!phoneError)}
                    />
                  </div>
                  {phoneError ? <p className="text-xs text-danger">{phoneError.message}</p> : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`attendee-${i}-birthYear`} className="text-sm font-semibold text-foreground">
                    출생년도
                  </label>
                  <select
                    id={`attendee-${i}-birthYear`}
                    required
                    value={attendee.birthYear}
                    onChange={(e) => {
                      updateAttendee(i, "birthYear", e.target.value);
                      if (submitAttempted) setValidationErrors(validateForm());
                    }}
                    className={selectClassNameFn(!!birthYearError)}
                  >
                    <option value="" disabled>
                      선택
                    </option>
                    {BIRTH_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}년생
                      </option>
                    ))}
                  </select>
                  {birthYearError ? <p className="text-xs text-danger">{birthYearError.message}</p> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground">성별</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isDatingSession && femaleClosed}
                      onClick={() => {
                        updateAttendee(i, "gender", "F");
                        if (submitAttempted) setValidationErrors(validateForm());
                      }}
                      className={`${toggleButtonClassName(attendee.gender === "F", !!genderError)} ${isDatingSession && femaleClosed ? "pointer-events-none opacity-50" : ""}`}
                    >
                      여성{isDatingSession && femaleClosed ? " (마감)" : ""}
                    </button>
                    <button
                      type="button"
                      disabled={isDatingSession && maleClosed}
                      onClick={() => {
                        updateAttendee(i, "gender", "M");
                        if (submitAttempted) setValidationErrors(validateForm());
                      }}
                      className={`${toggleButtonClassName(attendee.gender === "M", !!genderError)} ${isDatingSession && maleClosed ? "pointer-events-none opacity-50" : ""}`}
                    >
                      남성{isDatingSession && maleClosed ? " (마감)" : ""}
                    </button>
                  </div>
                  {genderError ? <p className="text-xs text-danger">{genderError.message}</p> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground">방탈출 경험 횟수 (선택)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPERIENCE_RANGES.map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => {
                          updateAttendee(i, "experienceRange", attendee.experienceRange === range ? "" : range);
                          if (submitAttempted) setValidationErrors(validateForm());
                        }}
                        className={toggleButtonClassName(attendee.experienceRange === range, !!experienceError)}
                      >
                        {EXPERIENCE_RANGE_LABELS[range]}
                      </button>
                    ))}
                  </div>
                  {experienceError ? <p className="text-xs text-danger">{experienceError.message}</p> : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`attendee-${i}-nickname`} className="text-sm font-semibold text-foreground">
                    닉네임 (선택)
                  </label>
                  <input
                    id={`attendee-${i}-nickname`}
                    type="text"
                    placeholder="같은 회차 내에서 다른 참여자와 중복될 수 없어요"
                    value={attendee.nickname}
                    onChange={(e) => {
                      updateAttendee(i, "nickname", e.target.value);
                      if (submitAttempted) setValidationErrors(validateForm());
                    }}
                    className={textInputClassName(!!nicknameError)}
                  />
                  <p className="text-xs text-muted">비워두면 이름으로 표시돼요.</p>
                  {nicknameError ? <p className="text-xs text-danger">{nicknameError.message}</p> : null}
                </div>
              </div>
              {isConflict ? (
                <p className="mt-2 text-xs text-danger">
                  {state.conflictReason === "group"
                    ? "그룹 안의 다른 참여자와 전화번호가 중복돼요."
                    : "이미 같은 테마에 참여하신 신청자예요."}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {attendees.length >= 2 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-semibold text-foreground">
            비고 (선택)
          </label>
          <textarea
            id="notes"
            maxLength={200}
            placeholder="예: 친구들과 같은 조로 배정해주세요."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (submitAttempted) setValidationErrors(validateForm());
            }}
            className={textInputClassName(!!validationErrors.find((e) => e.field === "notes"))}
            rows={3}
          />
          <p className="text-xs text-muted">모든 요청을 반영해드리기는 어려울 수 있어요.</p>
          {validationErrors.find((e) => e.field === "notes") ? (
            <p className="text-xs text-danger">{validationErrors.find((e) => e.field === "notes")!.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="depositorName" className="text-sm font-semibold text-foreground">
          입금 시 사용할 이름 (입금자명)
        </label>
        <input
          id="depositorName"
          type="text"
          required
          value={depositorName}
          onChange={(e) => {
            setDepositorName(e.target.value);
            if (submitAttempted) setValidationErrors(validateForm());
          }}
          className={textInputClassName(!!validationErrors.find((e) => e.field === "depositorName"))}
        />
        {validationErrors.find((e) => e.field === "depositorName") ? (
          <p className="text-xs text-danger">{validationErrors.find((e) => e.field === "depositorName")!.message}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="agreedTerms"
          required
          className="mt-1"
          checked={agreedTerms}
          onChange={(e) => {
            setAgreedTerms(e.target.checked);
            if (submitAttempted) setValidationErrors(validateForm());
          }}
        />
        <span>이용약관, 개인정보처리방침, 환불정책에 모두 동의합니다.</span>
      </label>
      {validationErrors.find((e) => e.field === "agreedTerms") ? (
        <p className="text-xs text-danger">{validationErrors.find((e) => e.field === "agreedTerms")!.message}</p>
      ) : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        onPointerEnter={handleSubmitPointerEnter}
        className="apply-submit-button relative inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        <span aria-hidden className="apply-submit-fill" />
        <span className="apply-submit-label">{pending ? "제출 중..." : "제출하기"}</span>
      </button>
    </form>
  );
}
