"use client";

import { formatPhoneInput } from "@/lib/phone";
import type { AttendeeForm } from "./ApplyForm";
import { errorProps, errorText, field, fieldInvalid } from "./AttendeeFields";

/**
 * 노말모드(단독 진행 상품) 예약자 입력 — **이름 | 휴대폰** 한 줄을 인원수만큼 쌓는다.
 *
 * 왜 탭(AttendeeTabs)이 아닌가 (2026-10-18 대표님)
 *   노말은 이름·휴대폰만 받는다. 칸이 둘뿐인데 사람마다 탭을 넘기게 하면, 몇 명째를
 *   쓰고 있는지·빠뜨린 사람이 없는지가 한눈에 안 보인다. 한 화면에 다 펼친다.
 *
 * ⚠️ 칸 id 는 파티 칸과 같은 규칙(`attendee-{i}-name` · `-phone`)이다. 오류가 나면
 *    ApplyForm 이 그 id 로 포커스를 옮긴다.
 * ⚠️ 칸 모양·오류 연결은 AttendeeFields 와 같은 상수를 쓴다 — 한 화면 안에서 칸 크기가
 *    다르면 안 된다(16px 미만이면 아이폰이 확대한다).
 */
export function SoloAttendeeRows({
  attendees,
  verb,
  errorOf,
  conflictPhones,
  onChange,
  onTouch,
}: {
  attendees: AttendeeForm[];
  verb: string;
  /** 칸 id → 오류 문구. 아직 손대지 않은 칸은 비어 있다. */
  errorOf: (fieldId: string) => string | undefined;
  /** 이미 같은 테마에 예약한 번호(숫자만). */
  conflictPhones: Set<string>;
  onChange: (index: number, patch: Partial<AttendeeForm>) => void;
  onTouch: (fieldId: string) => void;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 머리는 한 번만 — 줄마다 '이름' '휴대폰' 라벨을 달면 줄이 두 배로 길어진다. */}
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 text-label font-semibold text-muted sm:gap-3"
      >
        <span>이름 *</span>
        <span>휴대폰 번호 *</span>
      </div>

      {attendees.map((a, i) => {
        const nameId = `attendee-${i}-name`;
        const phoneId = `attendee-${i}-phone`;
        const who = i === 0 ? (attendees.length > 1 ? `대표 ${verb}자 (본인)` : `${verb}자`) : `동행자 ${i}`;
        const nameErr = errorOf(nameId);
        const conflict = conflictPhones.has(a.phoneInput.replace(/\D/g, ""));
        const phoneErr = errorOf(phoneId) ?? (conflict ? `이미 같은 테마에 예약하신 번호예요.` : undefined);
        return (
          <div key={i}>
            <p className="mb-1.5 text-label text-muted">{who}</p>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 sm:gap-3">
              <input
                {...errorProps(nameId, !!nameErr)}
                aria-label={`${who} 이름`}
                className={nameErr ? fieldInvalid : field}
                // 대표만 자동완성 — 동행자 칸에 "name" 을 주면 본인 이름이 채워진다.
                autoComplete={i === 0 ? "name" : "off"}
                placeholder="홍길동"
                value={a.name}
                onBlur={() => onTouch(nameId)}
                onChange={(e) => onChange(i, { name: e.target.value })}
              />
              <input
                {...errorProps(phoneId, !!phoneErr)}
                aria-label={`${who} 휴대폰 번호`}
                className={phoneErr ? fieldInvalid : field}
                type="tel"
                inputMode="numeric"
                autoComplete={i === 0 ? "tel" : "off"}
                // 하이픈 포함 13자 — 숫자 11자리가 아니다(AttendeeFields 와 같다).
                maxLength={13}
                placeholder="010-0000-0000"
                value={a.phoneInput}
                onBlur={() => onTouch(phoneId)}
                onChange={(e) => onChange(i, { phoneInput: formatPhoneInput(e.target.value) })}
              />
            </div>
            {nameErr && (
              <p id={`${nameId}-error`} role="alert" className={errorText}>
                {nameErr}
              </p>
            )}
            {phoneErr && (
              <p id={`${phoneId}-error`} role="alert" className={errorText}>
                {phoneErr}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
