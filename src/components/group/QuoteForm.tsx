"use client";

import { useRef, useState } from "react";
import { GROUP_EVENT, pushGa4Event } from "@/lib/analytics";
import { readAttribution } from "@/lib/attribution";
import {
  CONTACT_METHODS,
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  GROUP_KINDS,
  GROUP_PAGE_LABEL,
  PREFERRED_TIMES,
  contactMethodLabel,
  groupKindLabel,
  preferredTimeLabel,
} from "@/lib/groupBooking";

const field =
  "w-full rounded-lg border border-line bg-fill px-3.5 py-3 text-body outline-none focus:border-[#f082f4] sm:py-3.5";

/** 고르는 칸(알약 버튼) 한 줄. 손가락으로 누르는 크기(44px) 를 지킨다. */
function ChipGroup({
  options,
  value,
  onPick,
}: {
  options: readonly { code: string; label: string }[];
  value: string;
  onPick: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.code;
        return (
          <button
            key={o.code}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.code)}
            className={`min-h-[44px] rounded-full px-4 text-body-sm transition ${
              on
                ? "bg-[#f082f4] font-bold text-[#141414]"
                : "border border-line bg-fill text-foreground hover:border-line-strong"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-body-sm font-bold text-foreground">
      {children}
    </label>
  );
}

type Done = {
  headcount: string;
  contactMethod: string;
  contact: string;
  preferredDate: string;
  preferredTime: string;
  groupKind: string;
};

/**
 * 단체 예약 견적 신청 폼.
 *
 * 받는 것은 **상담에 필요한 최소**다(인원·연락 수단·연락처·희망 일시·모임 성격).
 * 팀 편성 방식·모임 이름·기념일 같은 세부는 일정이 맞은 뒤 상세 신청서로 받는다 —
 * 첫 폼이 길면 "확정도 아닌데 이걸 다 적나" 하고 닫는다.
 *
 * ⚠️ 접수된 것은 예약이 아니다. 완료 화면에서 그 말을 가장 크게 해야 한다 —
 *    예약이 됐다고 믿고 안 오는 사람이 생기면 회차 하나가 날아간다.
 */
export function QuoteForm() {
  const [headcount, setHeadcount] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [contact, setContact] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [groupKind, setGroupKind] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  // '폼을 건드렸다' 는 방문당 한 번만 보낸다. 칸마다 보내면 칸 수만큼 부풀어
  // 읽고 나간 사람과의 비율을 못 잰다.
  const startSent = useRef(false);
  function markStart() {
    if (startSent.current) return;
    startSent.current = true;
    pushGa4Event(GROUP_EVENT.quoteStart, { themeLabel: GROUP_PAGE_LABEL });
  }

  /**
   * 값을 고치면 에러 문구를 지운다.
   *
   * 안 지우면 "인원을 10~24명으로" 가 인원을 고친 뒤에도 그대로 남아, 다음에 막힌
   * 항목이 연락처인데도 인원이 틀린 것처럼 읽힌다(로컬 확인에서 실제로 그랬다).
   */
  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setError("");
    };
  }

  function fail(label: string, message: string) {
    setError(message);
    // 어느 항목에서 막혔는지. 한 항목이 유독 많으면 그 칸을 손봐야 한다.
    pushGa4Event(GROUP_EVENT.quoteError, {
      themeLabel: GROUP_PAGE_LABEL,
      sectionKey: "quote",
      sectionLabel: label,
    });
  }

  async function submit() {
    const n = Number(headcount);
    if (!Number.isInteger(n) || n < GROUP_HEADCOUNT_MIN || n > GROUP_HEADCOUNT_MAX) {
      return fail(
        "인원",
        `예상 참여 인원을 ${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명 사이로 입력해주세요.`
      );
    }
    if (!contactMethod) return fail("연락 수단", "연락 수단을 선택해주세요.");
    if (!contact.trim()) return fail("연락처", "연락처를 입력해주세요.");
    if (!preferredDate) return fail("날짜", "예상 날짜를 선택해주세요.");
    if (!preferredTime) return fail("시간", "예상 이용 시간을 선택해주세요.");
    if (!groupKind) return fail("모임 성격", "모임 성격을 선택해주세요.");

    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/group-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headcount: n,
          contactMethod,
          contact: contact.trim(),
          preferredDate,
          preferredTime,
          groupKind,
          note: note.trim() || null,
          // 첫 유입 기록. 없으면(직접 방문) 빈 값이 그대로 간다.
          attribution: readAttribution(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        return fail("서버", json.error || "접수에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      pushGa4Event(GROUP_EVENT.quoteSubmit, { themeLabel: GROUP_PAGE_LABEL });
      setDone({
        headcount: `${n}명`,
        contactMethod: contactMethodLabel(contactMethod),
        contact: contact.trim(),
        preferredDate,
        preferredTime: preferredTimeLabel(preferredTime),
        groupKind: groupKindLabel(groupKind),
      });
    } catch {
      fail("네트워크", "접수에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f082f4"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </svg>
        <h3 className="text-h2 font-extrabold">견적 신청이 접수됐어요</h3>
        <p className="text-body leading-relaxed text-muted">
          아직 예약이 확정된 건 아닙니다.
          <br />
          희망 일시의 진행 가능 여부를 확인한 뒤 남겨주신 연락 수단으로 연락드리고, 예약금 30%
          입금이 확인되면 최종 확정됩니다.
        </p>
        <dl className="w-full rounded-xl border border-panel-border bg-background/60 px-5 py-4 text-left text-body-sm text-muted">
          {[
            ["인원", done.headcount],
            ["날짜", done.preferredDate],
            ["시간", done.preferredTime],
            ["모임", done.groupKind],
            ["연락", `${done.contactMethod} ${done.contact}`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 py-1">
              <dt className="w-12 shrink-0">{k}</dt>
              <dd className="font-bold text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="min-h-[44px] rounded-full border border-line px-5 text-body-sm text-foreground hover:border-line-strong"
        >
          내용 수정해서 다시 신청
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onFocusCapture={markStart}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="q-headcount">예상 참여 인원</Label>
        <div className="flex items-center gap-2.5">
          <input
            id="q-headcount"
            type="number"
            inputMode="numeric"
            min={GROUP_HEADCOUNT_MIN}
            max={GROUP_HEADCOUNT_MAX}
            placeholder={`${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}`}
            value={headcount}
            onChange={(e) => edit(setHeadcount)(e.target.value)}
            className={`${field} w-28`}
          />
          <span className="text-body-sm text-muted">명</span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-body-sm font-bold text-foreground">연락 수단</legend>
        <ChipGroup options={CONTACT_METHODS} value={contactMethod} onPick={edit(setContactMethod)} />
        <label htmlFor="q-contact" className="mt-2 text-micro text-muted">
          연락처 (선택한 수단의 전화번호 · 카카오톡 ID · 이메일)
        </label>
        <input
          id="q-contact"
          type="text"
          placeholder="예: 010-0000-0000"
          value={contact}
          onChange={(e) => edit(setContact)(e.target.value)}
          className={field}
        />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-date">예상 날짜</Label>
        <input
          id="q-date"
          type="date"
          value={preferredDate}
          onChange={(e) => edit(setPreferredDate)(e.target.value)}
          className={field}
          style={{ colorScheme: "dark" }}
        />
        <p className="text-micro leading-relaxed text-muted">
          미정이면 가장 유력한 날짜를 골라주시고, 아래 요청사항에 후보일을 적어주세요.
        </p>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-2 text-body-sm font-bold text-foreground">예상 이용 시간</legend>
        <ChipGroup options={PREFERRED_TIMES} value={preferredTime} onPick={edit(setPreferredTime)} />
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className="mb-2 text-body-sm font-bold text-foreground">모임 성격</legend>
        <ChipGroup options={GROUP_KINDS} value={groupKind} onPick={edit(setGroupKind)} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-note">
          기타 문의 및 요청사항 <span className="font-normal text-muted">(선택)</span>
        </Label>
        <textarea
          id="q-note"
          rows={4}
          placeholder="예: AFTER PARTY도 함께 문의드려요 / 재참여자 2명 있어요"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${field} resize-y`}
        />
      </div>

      {error && (
        <p role="alert" className="text-body-sm font-bold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="min-h-[52px] rounded-full bg-[#f082f4] px-6 text-h3 font-extrabold text-[#141414] transition hover:bg-[#f6a8f9] disabled:opacity-60"
        >
          {sending ? "접수 중…" : "견적 신청하기"}
        </button>
        <p className="text-center text-micro leading-relaxed text-muted">
          견적 신청만으로 예약이 확정되지 않으며, 일정 확인 후 개별 연락드립니다.
          <br />
          입력하신 정보는 단체 예약 상담 목적으로만 사용됩니다.{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            개인정보처리방침
          </a>
        </p>
      </div>
    </div>
  );
}
