"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { ApplyNotices } from "@/components/apply/ApplyNotices";
import { ApplySessionSummary } from "@/components/apply/ApplySessionSummary";
import { applyAction, type ApplyState } from "@/app/sessions/[slug]/apply/actions";
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
import { AttendeeCard } from "@/components/apply/AttendeeCard";
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

export function ApplyForm({
  sessionId,
  priceKrw,
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
  // 입력값을 React state로 들고 있어야 서버 액션이 에러를 반환해 다시 렌더링돼도
  // (React가 uncontrolled 폼 필드는 액션 완료 후 리셋시킴) 사용자가 입력한 내용이
  // 사라지지 않는다 — 신청 실패 시 폼을 그대로 두고 수정만 하게 해달라는 요청.
  const [attendees, setAttendees] = useState<AttendeeState[]>([{ ...emptyAttendee }]);
  const [depositorName, setDepositorName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const completeEventSent = useRef(false);

  const conflictPhones = useMemo(() => new Set(state.conflictPhoneDigits ?? []), [state.conflictPhoneDigits]);

  const validateForm = useCallback((): ValidationError[] => {
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
  }, [depositorName, agreedTerms, attendees, notes]);

  const validationErrors = useMemo(
    () => (submitAttempted ? validateForm() : []),
    [submitAttempted, validateForm]
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

  function updateAttendeeCount(count: number) {
    setAttendeeCount(count);
    setActiveAttendeeIndex((prev) => Math.min(prev, count - 1));
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
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
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
        {/* 모바일 전용 요약 카드 */}
      <div className="lg:hidden">
        <ApplySessionSummary
          themeLabel={themeLabel}
          startAt={startAt}
          endAt={endAt}
          venueArea={venueArea}
        />
      </div>

      {/* 입력 필드 블록 — 모바일: 그대로, 데스크톱: 왼쪽 flex-1 */}
      <div className="flex flex-col gap-5 lg:flex-1">
        {isDatingSession ? null : (
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
              conflictReason={state.conflictReason}
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
              }}
            />
          )}
        </div>

        {attendees.length >= 2 ? (
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
        ) : null}

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
      </div>

      {/* 사이드바 — 모바일: 그대로, 데스크톱: 오른쪽 380px */}
      <div className="flex flex-col gap-8 lg:w-[380px] lg:shrink-0">
        {/* 데스크톱 전용 요약 카드 */}
        <div className="hidden lg:block">
          <ApplySessionSummary
            themeLabel={themeLabel}
            startAt={startAt}
            endAt={endAt}
            venueArea={venueArea}
          />
        </div>

        {/* 요금 패널 — 모바일: DOM 순서상 1번째(안내사항보다 먼저), 데스크톱: lg:order-2로 2번째 */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 lg:order-2">
          <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-sm font-semibold text-foreground">할인</span>
            <span className="text-right text-sm font-semibold text-foreground">베타 기간 한정 · 리뷰 작성 시 인당 <span style={{ color: "var(--brand)" }}>5,000원</span> 페이백</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">요금</span>
            <span className="text-xl font-extrabold text-foreground">{formatKrw(priceKrw * attendeeCount)}</span>
          </div>
        </div>

        {/* 안내사항 — 모바일: DOM 순서상 2번째(요금 다음), 데스크톱: lg:order-1로 요금보다 앞으로 */}
        <div className="lg:order-1">
          <ApplyNotices isDatingSession={isDatingSession} />
        </div>

        {/* 동의 및 제출 — 모바일/데스크톱 모두 마지막 */}
        <div className="flex flex-col gap-5 lg:order-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="agreedTerms"
            required
            className="mt-1"
            checked={agreedTerms}
            onChange={(e) => {
              setAgreedTerms(e.target.checked);
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
          onPointerEnter={handlePointerFillOrigin}
          className="apply-submit-button relative inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all disabled:pointer-events-none disabled:opacity-50"
        >
          <span aria-hidden className="apply-submit-fill" />
          <span className="apply-submit-label">{pending ? "제출 중..." : "제출하기"}</span>
        </button>
        </div>
      </div>
      </form>
    </>
  );
}
