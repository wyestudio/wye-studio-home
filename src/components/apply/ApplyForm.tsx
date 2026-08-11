"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { applyAction, type ApplyState } from "@/app/sessions/[id]/apply/actions";
import { ELIGIBLE_BIRTH_YEAR_MAX, ELIGIBLE_BIRTH_YEAR_MIN } from "@/lib/eligibility";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import { pushDataLayerEvent } from "@/lib/analytics";

const initialState: ApplyState = {};
const MAX_ATTENDEES = 8;
const BIRTH_YEARS = Array.from(
  { length: ELIGIBLE_BIRTH_YEAR_MAX - ELIGIBLE_BIRTH_YEAR_MIN + 1 },
  (_, i) => ELIGIBLE_BIRTH_YEAR_MAX - i
);

const selectClassName =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]";

type AttendeeField = "name" | "phone1" | "phone2" | "phone3" | "birthYear" | "nickname" | "gender";
type AttendeeState = {
  name: string;
  phone1: string;
  phone2: string;
  phone3: string;
  birthYear: string;
  nickname: string;
  gender: string;
};

const emptyAttendee: AttendeeState = {
  name: "",
  phone1: "",
  phone2: "",
  phone3: "",
  birthYear: "",
  nickname: "",
  gender: "",
};

function phoneInputClassName(invalid: boolean) {
  return `w-full rounded-lg border px-3 py-2.5 text-center text-sm outline-none transition-shadow ${
    invalid
      ? "border-danger bg-danger-soft text-danger"
      : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]"
  }`;
}

export function ApplyForm({
  sessionId,
  priceKrw,
  sessionTitle,
  eventDate,
  themeLabel,
}: {
  sessionId: string;
  priceKrw: number;
  sessionTitle: string;
  eventDate: string;
  themeLabel: string;
}) {
  const isDatingSession = themeLabel === "소개팅";
  const [state, formAction, pending] = useActionState(applyAction, initialState);
  const [attendeeCount, setAttendeeCount] = useState(1);
  // 입력값을 React state로 들고 있어야 서버 액션이 에러를 반환해 다시 렌더링돼도
  // (React가 uncontrolled 폼 필드는 액션 완료 후 리셋시킴) 사용자가 입력한 내용이
  // 사라지지 않는다 — 신청 실패 시 폼을 그대로 두고 수정만 하게 해달라는 요청.
  const [attendees, setAttendees] = useState<AttendeeState[]>([{ ...emptyAttendee }]);
  const [depositorName, setDepositorName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  // 제출을 한 번이라도 시도한 뒤부터 형식 오류 칸을 빨갛게 표시한다 — 타이핑
  // 중간에 매 글자마다 빨개지는 건 거슬리니, 시도 이후에는 실시간으로 반영.
  const [submitAttempted, setSubmitAttempted] = useState(false);
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

  // 빈 칸에서 백스페이스를 누르면 이전 칸으로 포커스를 옮겨 자연스럽게
  // 이어서 지울 수 있게 한다.
  function handlePhoneBackspace(e: React.KeyboardEvent<HTMLInputElement>, prevId: string | null) {
    if (e.key === "Backspace" && e.currentTarget.value === "" && prevId) {
      document.getElementById(prevId)?.focus();
    }
  }

  // <form action={formAction}>로 직접 연결하면 React가 액션 완료 후(성공이든 에러든)
  // 네이티브 form.reset()을 호출하는데, 이게 checkbox/select 같은 엘리먼트는 React
  // state와 무관하게 실제로 리셋시켜버린다(실제로 겪은 버그 — 이용약관 체크가 풀리고
  // 출생년도가 첫 옵션으로 되돌아감). 그래서 onSubmit에서 직접 막고, FormData도 DOM이
  // 아니라 이미 들고 있는 React state에서 그대로 구성해 제출한다.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const hasInvalidPhone = attendees.some(
      (a) => !isValidPhoneDigits(`${a.phone1}${a.phone2}${a.phone3}`)
    );
    if (hasInvalidPhone) {
      setSubmitAttempted(true);
      return;
    }

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("depositorName", depositorName);
    if (agreedTerms) formData.set("agreedTerms", "on");
    attendees.forEach((attendee, i) => {
      formData.set(`attendees[${i}][name]`, attendee.name);
      formData.set(`attendees[${i}][phone]`, `${attendee.phone1}${attendee.phone2}${attendee.phone3}`);
      formData.set(`attendees[${i}][birthYear]`, attendee.birthYear);
      formData.set(`attendees[${i}][nickname]`, attendee.nickname);
      formData.set(`attendees[${i}][gender]`, attendee.gender);
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
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="rounded-xl bg-brand-soft p-4 text-xs text-muted">
        비슷한 또래끼리 더 즐겁게 즐기실 수 있도록, {ELIGIBLE_BIRTH_YEAR_MIN}~{ELIGIBLE_BIRTH_YEAR_MAX}년생만
        참여하실 수 있어요.
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
          return (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                isConflict ? "border-danger bg-danger-soft" : "border-border bg-surface"
              }`}
            >
              <p className="mb-3 text-xs font-bold text-muted">
                {i === 0 ? (isDatingSession ? "신청자 (본인)" : "대표 신청자 (본인)") : `동행자 ${i}`}
              </p>
              <div className="flex flex-col gap-3">
                <Field label="이름" htmlFor={`attendee-${i}-name`}>
                  <Input
                    id={`attendee-${i}-name`}
                    name={`attendees[${i}][name]`}
                    type="text"
                    required
                    value={attendee.name}
                    onChange={(e) => updateAttendee(i, "name", e.target.value)}
                  />
                </Field>
                <Field
                  label="전화번호"
                  htmlFor={`attendee-${i}-phone1`}
                  error={isFormatInvalid ? "올바른 휴대폰 번호 형식이 아니에요." : undefined}
                >
                  <div className="flex items-center gap-2">
                    <input
                      id={`attendee-${i}-phone1`}
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={3}
                      placeholder="010"
                      value={attendee.phone1}
                      onChange={(e) =>
                        updatePhoneSegment(i, "phone1", e.target.value, 3, `attendee-${i}-phone2`)
                      }
                      className={phoneInputClassName(phoneInvalid)}
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
                      onChange={(e) =>
                        updatePhoneSegment(i, "phone2", e.target.value, 4, `attendee-${i}-phone3`)
                      }
                      className={phoneInputClassName(phoneInvalid)}
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
                      onChange={(e) => updatePhoneSegment(i, "phone3", e.target.value, 4, null)}
                      className={phoneInputClassName(phoneInvalid)}
                    />
                  </div>
                </Field>
                <Field label="출생년도" htmlFor={`attendee-${i}-birthYear`}>
                  <select
                    id={`attendee-${i}-birthYear`}
                    name={`attendees[${i}][birthYear]`}
                    required
                    value={attendee.birthYear}
                    onChange={(e) => updateAttendee(i, "birthYear", e.target.value)}
                    className={selectClassName}
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
                </Field>
                {isDatingSession ? (
                  <Field label="성별" htmlFor={`attendee-${i}-gender`}>
                    <select
                      id={`attendee-${i}-gender`}
                      name={`attendees[${i}][gender]`}
                      required
                      value={attendee.gender}
                      onChange={(e) => updateAttendee(i, "gender", e.target.value)}
                      className={selectClassName}
                    >
                      <option value="" disabled>
                        선택
                      </option>
                      <option value="M">남성</option>
                      <option value="F">여성</option>
                    </select>
                  </Field>
                ) : null}
                <Field label="닉네임 (선택)" htmlFor={`attendee-${i}-nickname`}>
                  <Input
                    id={`attendee-${i}-nickname`}
                    name={`attendees[${i}][nickname]`}
                    type="text"
                    placeholder="같은 회차 내에서 다른 참여자와 중복될 수 없어요"
                    value={attendee.nickname}
                    onChange={(e) => updateAttendee(i, "nickname", e.target.value)}
                  />
                </Field>
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

      <Field label="입금 시 사용할 이름 (입금자명)" htmlFor="depositorName">
        <Input
          id="depositorName"
          name="depositorName"
          type="text"
          required
          value={depositorName}
          onChange={(e) => setDepositorName(e.target.value)}
        />
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="agreedTerms"
          required
          className="mt-1"
          checked={agreedTerms}
          onChange={(e) => setAgreedTerms(e.target.checked)}
        />
        <span>이용약관, 개인정보처리방침, 환불정책에 모두 동의합니다.</span>
      </label>

      <p className="text-xs text-muted">🔒 입력하신 이름·전화번호는 암호화되어 저장돼요.</p>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "제출 중..." : "신청 제출"}
      </Button>
    </form>
  );
}
