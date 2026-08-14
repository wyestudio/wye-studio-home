"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { ApplySessionSummary } from "@/components/apply/ApplySessionSummary";
import { ApplyStepper } from "@/components/apply/ApplyStepper";
import { ApplyConsent, type ConsentState } from "@/components/apply/ApplyConsent";
import { applyAction, checkNicknameAvailability, checkActiveApplicationConflicts, type ApplyState } from "@/app/sessions/[slug]/apply/actions";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import { formatKrw } from "@/lib/format";
import { pushDataLayerEvent } from "@/lib/analytics";
import { isDatingTheme } from "@/lib/theme";
import { handlePointerFillOrigin } from "@/lib/pointerFillOrigin";
import {
  isValidKoreanName,
  isValidNickname,
  isValidNotes,
  getValidationErrorMessage,
} from "@/lib/validation";
import { isEligibleBirthYear, eligibleBirthYearRangeLabel } from "@/lib/eligibility";
import { AttendeeCard, type NicknameCheckState } from "@/components/apply/AttendeeCard";
import { AttendeeTabs } from "@/components/apply/AttendeeTabs";
import { type AttendeeState, type AttendeeField, type ValidationError } from "@/components/apply/types";

const initialState: ApplyState = {};
const MAX_ATTENDEES = 8;

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

const emptyConsents: ConsentState = {
  ageSelf: false,
  terms: false,
  noRebooking: false,
  pii: false,
  phoneCollection: false,
  privacyPolicy: false,
  proxyForGroup: false,
  photo: false,
  marketing: false,
};

export function ApplyForm({
  sessionId,
  priceKrw,
  originalPriceKrw,
  sessionTitle,
  eventDate,
  themeLabel,
  maleClosed = false,
  femaleClosed = false,
  startAt,
  endAt,
  venueArea,
}: {
  sessionId: string;
  priceKrw: number;
  originalPriceKrw: number;
  sessionTitle: string;
  eventDate: string;
  themeLabel: string;
  maleClosed?: boolean;
  femaleClosed?: boolean;
  startAt: string;
  endAt: string | null;
  venueArea: string;
}) {
  const isDatingSession = isDatingTheme(themeLabel);
  const [state, formAction, pending] = useActionState(applyAction, initialState);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [activeAttendeeIndex, setActiveAttendeeIndex] = useState(0);
  const [attendees, setAttendees] = useState<AttendeeState[]>([{ ...emptyAttendee }]);
  const [depositorName, setDepositorName] = useState("");
  const [consents, setConsents] = useState<ConsentState>({ ...emptyConsents });
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [nicknameCheckState, setNicknameCheckState] = useState<Record<number, NicknameCheckState>>(
    () => {
      const initial: Record<number, NicknameCheckState> = {};
      attendees.forEach((_, i) => {
        initial[i] = "idle";
      });
      return initial;
    }
  );
  const [preCheckConflictPhones, setPreCheckConflictPhones] = useState<Set<string>>(new Set());
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const completeEventSent = useRef(false);

  const conflictPhones = useMemo(
    () => new Set([...(state.conflictPhoneDigits ?? []), ...preCheckConflictPhones]),
    [state.conflictPhoneDigits, preCheckConflictPhones]
  );

  const themeConflictActive = state.conflictReason === "theme" || preCheckConflictPhones.size > 0;
  const displayError = themeConflictActive
    ? "같은 테마에 이미 신청하신 분이 포함되어 있어요. 중복 신청은 불가합니다."
    : state.error;

  const validateStep1 = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!depositorName.trim()) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "required") });
    } else if (!isValidKoreanName(depositorName)) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "invalid") });
    }

    attendees.forEach((attendee, i) => {
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

      if (!attendee.birthYear) {
        errors.push({
          field: `attendee-${i}-birthYear`,
          message: "출생년도를 선택해주세요.",
        });
      } else if (!isEligibleBirthYear(Number(attendee.birthYear), isDatingSession)) {
        errors.push({
          field: `attendee-${i}-birthYear`,
          message: `${eligibleBirthYearRangeLabel(isDatingSession)}만 가능합니다.`,
        });
      }

      if (!attendee.gender || (attendee.gender !== "M" && attendee.gender !== "F")) {
        errors.push({
          field: `attendee-${i}-gender`,
          message: "성별을 선택해주세요.",
        });
      }

      if (attendee.nickname && !isValidNickname(attendee.nickname)) {
        errors.push({
          field: `attendee-${i}-nickname`,
          message: getValidationErrorMessage("nickname", "invalid"),
        });
      }
    });

    if (attendees.length >= 2 && notes && !isValidNotes(notes)) {
      errors.push({
        field: "notes",
        message: getValidationErrorMessage("notes", "invalid"),
      });
    }

    // 그룹 내 전화번호 중복 검사
    const phoneCounts = new Map<string, number>();
    attendees.forEach((attendee) => {
      const fullPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
      if (fullPhone) phoneCounts.set(fullPhone, (phoneCounts.get(fullPhone) ?? 0) + 1);
    });
    attendees.forEach((attendee, i) => {
      const fullPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
      if (fullPhone && (phoneCounts.get(fullPhone) ?? 0) > 1) {
        errors.push({
          field: `attendee-${i}-phone`,
          message: "그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.",
        });
      }
    });

    return errors;
  }, [depositorName, attendees, notes]);

  const validateStep2 = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];
    const requiredItems = [
      consents.ageSelf,
      consents.terms,
      consents.noRebooking,
      consents.pii,
      consents.phoneCollection,
      consents.privacyPolicy,
    ];
    const proxyOk = !attendeeCount || attendeeCount === 1 || consents.proxyForGroup;

    if (!requiredItems.every(Boolean) || !proxyOk) {
      errors.push({
        field: "consents",
        message: "필수 항목에 모두 동의해주세요.",
      });
    }

    return errors;
  }, [consents, attendeeCount]);

  const validationErrors = useMemo(
    () => (submitAttempted ? validateStep1() : []),
    [submitAttempted, validateStep1]
  );

  const errorAttendeeIndexes = useMemo(() => {
    const indexes = new Set<number>();
    for (const err of validationErrors) {
      const match = /^attendee-(\d+)-/.exec(err.field);
      if (match) indexes.add(Number(match[1]));
    }
    attendees.forEach((attendee, i) => {
      const combinedPhone = `${attendee.phone1}${attendee.phone2}${attendee.phone3}`;
      if (conflictPhones.has(phoneDigits(combinedPhone))) indexes.add(i);
    });
    return indexes;
  }, [validationErrors, attendees, conflictPhones]);

  useEffect(() => {
    pushDataLayerEvent("신청 시작", { sessionId, themeLabel });
  }, [sessionId, themeLabel]);

  useEffect(() => {
    if (state.application && !completeEventSent.current) {
      completeEventSent.current = true;
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

  function updateAttendeeCount(count: number) {
    setAttendeeCount(count);
    setActiveAttendeeIndex((prev) => Math.min(prev, count - 1));
    setAttendees((prev) => {
      const next = [...prev];
      while (next.length < count) next.push({ ...emptyAttendee });
      next.length = count;
      return next;
    });
    setNicknameCheckState((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) {
        if (!next[i]) next[i] = "idle";
      }
      return next;
    });
  }

  function updateAttendee(index: number, field: AttendeeField, value: string) {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function updatePhoneSegment(
    index: number,
    field: "phone1" | "phone2" | "phone3",
    rawValue: string,
    maxLength: number,
    nextId: string | null
  ) {
    setPreCheckConflictPhones(new Set());
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

  const handleNicknameCheckStart = useCallback(
    async (attendeeIndex: number) => {
      const nickname = attendees[attendeeIndex].nickname;
      if (!nickname.trim() || !isValidNickname(nickname)) return;

      setNicknameCheckState((prev) => ({ ...prev, [attendeeIndex]: "checking" }));
      const result = await checkNicknameAvailability(sessionId, nickname);

      if ("error" in result) {
        setNicknameCheckState((prev) => ({ ...prev, [attendeeIndex]: "idle" }));
      } else {
        setNicknameCheckState((prev) => ({
          ...prev,
          [attendeeIndex]: result.available ? "available" : "taken",
        }));
      }
    },
    [attendees, sessionId]
  );

  async function handleNextStep() {
    if (currentStep === 0) {
      const errors = validateStep1();
      if (errors.length > 0) {
        setSubmitAttempted(true);
        return;
      }

      setCheckingConflicts(true);
      const phones = attendees.map((a) => `${a.phone1}${a.phone2}${a.phone3}`);
      const result = await checkActiveApplicationConflicts(phones);
      setCheckingConflicts(false);

      if (!("error" in result) && result.conflictPhones.length > 0) {
        setPreCheckConflictPhones(new Set(result.conflictPhones));
        return;
      }

      setPreCheckConflictPhones(new Set());
      setCurrentStep(1);
      setSubmitAttempted(false);
    } else if (currentStep === 1) {
      const errors = validateStep2();
      if (errors.length > 0) {
        setSubmitAttempted(true);
        return;
      }
      setCurrentStep(2);
      setSubmitAttempted(false);
    } else if (currentStep === 2) {
      handleSubmit();
    }
  }

  function handleStepChange(step: number) {
    if (step < currentStep) {
      setCurrentStep(step);
      setSubmitAttempted(false);
    }
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("depositorName", depositorName);
    formData.set("consentAgeSelf", consents.ageSelf ? "on" : "");
    formData.set("consentTerms", consents.terms ? "on" : "");
    formData.set("consentNoRebooking", consents.noRebooking ? "on" : "");
    formData.set("consentPii", consents.pii ? "on" : "");
    formData.set("consentPhoneCollection", consents.phoneCollection ? "on" : "");
    formData.set("consentPrivacyPolicy", consents.privacyPolicy ? "on" : "");
    formData.set("consentProxyForGroup", consents.proxyForGroup ? "on" : "");
    formData.set("consentPhoto", consents.photo ? "on" : "");
    formData.set("consentMarketing", consents.marketing ? "on" : "");
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
        themeLabel={themeLabel}
        sessionTitle={sessionTitle}
        eventDate={eventDate}
        startAt={startAt}
        endAt={endAt}
        venueArea={venueArea}
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
    <>
      <h1 className="mb-6 text-2xl font-extrabold">참가 신청</h1>

      {/* Sticky 진행 표시줄 */}
      <ApplyStepper currentStep={currentStep} onStepChange={handleStepChange} />

      {/* 단계별 콘텐츠 */}
      <div className="mx-auto max-w-xl px-0 py-10">
        {currentStep === 0 && (
          <>
            {/* 단계 1: 정보 입력 */}
            <div className="flex flex-col gap-5 mb-20">
              {!isDatingSession && (
                <Field label="인원" htmlFor="attendeeCount">
                  <Select
                    id="attendeeCount"
                    value={String(attendeeCount)}
                    onChange={(v) => updateAttendeeCount(Number(v))}
                    options={Array.from({ length: MAX_ATTENDEES }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: `${n}명`,
                    }))}
                  />
                </Field>
              )}

              <AttendeeTabs
                count={attendeeCount}
                activeIndex={activeAttendeeIndex}
                errorIndexes={errorAttendeeIndexes}
                onSelect={setActiveAttendeeIndex}
              />

              <div>
                {activeAttendeeIndex < attendees.length && (
                  <AttendeeCard
                    index={activeAttendeeIndex}
                    attendee={attendees[activeAttendeeIndex]}
                    isDatingSession={isDatingSession}
                    maleClosed={maleClosed}
                    femaleClosed={femaleClosed}
                    isConflict={conflictPhones.has(phoneDigits(`${attendees[activeAttendeeIndex].phone1}${attendees[activeAttendeeIndex].phone2}${attendees[activeAttendeeIndex].phone3}`))}
                    conflictReason={state.conflictReason ?? (preCheckConflictPhones.size > 0 ? "theme" : undefined)}
                    attendeeCount={attendeeCount}
                    errors={{
                      name: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-name`)?.message,
                      phone: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-phone`)?.message,
                      birthYear: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-birthYear`)?.message,
                      gender: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-gender`)?.message,
                      experienceRange: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-experienceRange`)?.message,
                      nickname: validationErrors.find((e) => e.field === `attendee-${activeAttendeeIndex}-nickname`)?.message,
                    }}
                    onNameChange={(value) => {
                      updateAttendee(activeAttendeeIndex, "name", value);
                    }}
                    onPhoneSegmentChange={(field, rawValue, maxLength, nextId) => {
                      updatePhoneSegment(activeAttendeeIndex, field, rawValue, maxLength, nextId);
                    }}
                    onPhoneBackspace={(e, prevId) => handlePhoneBackspace(e, prevId)}
                    onBirthYearChange={(value) => {
                      updateAttendee(activeAttendeeIndex, "birthYear", value);
                    }}
                    onGenderChange={(value) => {
                      updateAttendee(activeAttendeeIndex, "gender", value);
                    }}
                    onExperienceChange={(value) => {
                      updateAttendee(activeAttendeeIndex, "experienceRange", attendees[activeAttendeeIndex].experienceRange === value ? "" : value);
                    }}
                    onNicknameChange={(value) => {
                      updateAttendee(activeAttendeeIndex, "nickname", value);
                      setNicknameCheckState((prev) => ({ ...prev, [activeAttendeeIndex]: "idle" }));
                    }}
                    nicknameCheckState={nicknameCheckState[activeAttendeeIndex]}
                    onNicknameCheckStart={() => handleNicknameCheckStart(activeAttendeeIndex)}
                  />
                )}
              </div>

              {attendees.length >= 2 && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="notes" className="text-sm font-semibold text-foreground">
                    비고 (선택)
                  </label>
                  <input
                    id="notes"
                    type="text"
                    maxLength={50}
                    placeholder="예: 친구들과 같은 조로 배정해주세요."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-shadow ${
                      !!validationErrors.find((e) => e.field === "notes")
                        ? "border-danger bg-danger-soft text-danger"
                        : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                    }`}
                  />
                  {validationErrors.find((e) => e.field === "notes") ? (
                    <p className="text-xs text-danger">{validationErrors.find((e) => e.field === "notes")!.message}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="depositorName" className="text-sm font-semibold text-foreground">
                  입금 시 사용할 이름 (입금자명)
                </label>
                <input
                  id="depositorName"
                  type="text"
                  required
                  placeholder="홍길동"
                  value={depositorName}
                  onChange={(e) => {
                    setDepositorName(e.target.value);
                  }}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-shadow ${
                    !!validationErrors.find((e) => e.field === "depositorName")
                      ? "border-danger bg-danger-soft text-danger"
                      : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                  }`}
                />
                {validationErrors.find((e) => e.field === "depositorName") ? (
                  <p className="text-xs text-danger">{validationErrors.find((e) => e.field === "depositorName")!.message}</p>
                ) : null}
              </div>

              {displayError ? <p className="text-sm text-danger">{displayError}</p> : null}
            </div>
          </>
        )}

        {currentStep === 1 && (
          <>
            {/* 단계 2: 약관동의 */}
            <ApplyConsent partySize={attendeeCount} value={consents} onChange={setConsents} />
            {submitAttempted && validationErrors.some((e) => e.field === "consents") && (
              <p className="text-sm text-danger mt-4">{validationErrors.find((e) => e.field === "consents")!.message}</p>
            )}
            {displayError ? <p className="text-sm text-danger mt-4">{displayError}</p> : null}
            <div className="mt-20" />
          </>
        )}

        {currentStep === 2 && (
          <>
            {/* 단계 3: 요금 안내 + 신청 */}
            <div className="flex flex-col gap-4 mb-20">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">기본가</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatKrw(originalPriceKrw)}
                      {attendeeCount > 1 && <span className="font-normal text-muted"> × {attendeeCount}명</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">할인</span>
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold bg-confirm-soft text-confirm">BETA</span>
                    </span>
                    <span className="text-sm font-bold text-danger">
                      -{formatKrw(originalPriceKrw - priceKrw)}
                      {attendeeCount > 1 && <span className="font-normal text-muted"> × {attendeeCount}명</span>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 mt-3">
                  <span className="text-sm font-semibold text-foreground">총 요금</span>
                  <span className="text-xl font-extrabold text-foreground">{formatKrw(priceKrw * attendeeCount)}</span>
                </div>
                <p className="text-sm text-muted text-right font-semibold mt-3">
                  베타 기간 한정 · 리뷰 작성 시 인당 <span style={{ color: "var(--brand)" }}>5,000원</span> 페이백
                </p>
              </div>

              {displayError ? <p className="text-sm text-danger">{displayError}</p> : null}
            </div>
          </>
        )}
      </div>

      {/* 고정 하단 버튼 */}
      <div className="fixed inset-x-0 bottom-0 bg-background/90 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl sm:max-w-3xl lg:max-w-4xl">
          <button
            type="button"
            disabled={pending || checkingConflicts}
            onClick={handleNextStep}
            onPointerEnter={handlePointerFillOrigin}
            className="apply-submit-button relative inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all disabled:pointer-events-none disabled:opacity-50"
          >
            <span aria-hidden className="apply-submit-fill" />
            <span className="apply-submit-label">
              {pending ? "제출 중..." : checkingConflicts ? "확인 중..." : currentStep === 2 ? "신청하기" : "다음"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
