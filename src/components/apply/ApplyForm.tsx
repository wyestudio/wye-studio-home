"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { applyAction, type ApplyState } from "@/app/sessions/[id]/apply/actions";
import { ELIGIBLE_BIRTH_YEAR_MAX, ELIGIBLE_BIRTH_YEAR_MIN } from "@/lib/eligibility";

const initialState: ApplyState = {};
const MAX_ATTENDEES = 8;
const BIRTH_YEARS = Array.from(
  { length: ELIGIBLE_BIRTH_YEAR_MAX - ELIGIBLE_BIRTH_YEAR_MIN + 1 },
  (_, i) => ELIGIBLE_BIRTH_YEAR_MAX - i
);

const selectClassName =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand";

type AttendeeField = "name" | "phone" | "birthYear" | "nickname";
type AttendeeState = { name: string; phone: string; birthYear: string; nickname: string };

const emptyAttendee: AttendeeState = { name: "", phone: "", birthYear: "", nickname: "" };

function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

export function ApplyForm({
  sessionId,
  priceKrw,
  sessionTitle,
  eventDate,
}: {
  sessionId: string;
  priceKrw: number;
  sessionTitle: string;
  eventDate: string;
}) {
  const [state, formAction, pending] = useActionState(applyAction, initialState);
  const [attendeeCount, setAttendeeCount] = useState(1);
  // 입력값을 React state로 들고 있어야 서버 액션이 에러를 반환해 다시 렌더링돼도
  // (React가 uncontrolled 폼 필드는 액션 완료 후 리셋시킴) 사용자가 입력한 내용이
  // 사라지지 않는다 — 신청 실패 시 폼을 그대로 두고 수정만 하게 해달라는 요청.
  const [attendees, setAttendees] = useState<AttendeeState[]>([{ ...emptyAttendee }]);
  const [depositorName, setDepositorName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);

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

  // <form action={formAction}>로 직접 연결하면 React가 액션 완료 후(성공이든 에러든)
  // 네이티브 form.reset()을 호출하는데, 이게 checkbox/select 같은 엘리먼트는 React
  // state와 무관하게 실제로 리셋시켜버린다(실제로 겪은 버그 — 이용약관 체크가 풀리고
  // 출생년도가 첫 옵션으로 되돌아감). 그래서 onSubmit에서 직접 막고, FormData도 DOM이
  // 아니라 이미 들고 있는 React state에서 그대로 구성해 제출한다.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("depositorName", depositorName);
    if (agreedTerms) formData.set("agreedTerms", "on");
    attendees.forEach((attendee, i) => {
      formData.set(`attendees[${i}][name]`, attendee.name);
      formData.set(`attendees[${i}][phone]`, attendee.phone);
      formData.set(`attendees[${i}][birthYear]`, attendee.birthYear);
      formData.set(`attendees[${i}][nickname]`, attendee.nickname);
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
      </div>

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

      <div className="flex flex-col gap-4">
        {attendees.map((attendee, i) => {
          const isConflict = conflictPhones.has(phoneDigits(attendee.phone));
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
                <Field label="전화번호" htmlFor={`attendee-${i}-phone`}>
                  <Input
                    id={`attendee-${i}-phone`}
                    name={`attendees[${i}][phone]`}
                    type="tel"
                    required
                    placeholder="010-0000-0000"
                    value={attendee.phone}
                    onChange={(e) => updateAttendee(i, "phone", e.target.value)}
                  />
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

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "제출 중..." : "신청 제출"}
      </Button>
    </form>
  );
}
