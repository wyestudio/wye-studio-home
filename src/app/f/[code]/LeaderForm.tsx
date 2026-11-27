"use client";

import Image from "next/image";
import { useState } from "react";
import { GROUP_KINDS } from "@/lib/groupBooking";
import { leaderFormDef } from "@/lib/groupForms/leaderSchema";
import { OTHER, otherKey, type Question } from "@/lib/groupForms/schema";
import type { Answers } from "@/lib/groupForms/validate";
import type { LeaderPrefill } from "@/lib/groupLeader";
import { addDays, dateLabel, kstToday } from "@/lib/groupPricing";
import { FormFlow } from "./FormFlow";
import { requestLeaderEdit, submitLeader, viewLeader, type LeaderView } from "./leaderActions";

/**
 * 모임장용 신청서(관리자 개편 docs/04 2장).
 *
 * 첫 화면은 **확인 화면** — 견적에서 이미 받은 값은 다시 묻지 않는다(대표님: "이거 중요한 기능이야").
 * 「수정」 을 누른 항목과 값이 없는 항목만 질문으로 나온다. 담당자는 가린 값으로만 보인다.
 *
 * 제출하면 보기 전용이다. 같은 링크를 다시 열면 휴대폰 번호 끝 4자리를 확인한 뒤에만 낸 내용을 보여준다
 * (서버가 그 전에는 답을 내려보내지 않는다). 고칠 내용은 「수정 요청」 으로 남긴다.
 *
 * 인원 · 일정 · 애프터파티가 견적과 달라도 여기서 금액이 바뀌지 않는다 — 운영자가 확인하고 반영한다.
 */

type View = "confirm" | "form" | "done" | "gate" | "summary";
type BaseId = "schedule" | "groupName" | "headcount" | "groupKind";

const kindLabel = (code: string | null) => GROUP_KINDS.find((k) => k.code === code)?.label ?? null;

const primaryButton =
  "flex min-h-12 w-full items-center justify-center rounded-lg bg-foreground px-4 text-body font-semibold text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40";
const linkButton =
  "min-h-11 shrink-0 rounded-lg px-2 text-body-sm text-glow underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const inputClass =
  "w-full rounded-lg border border-line bg-surface px-4 py-3 text-input text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function LeaderForm({
  code,
  prefill,
  parts,
}: {
  code: string;
  prefill: LeaderPrefill;
  /** 지금 쓰는 양식의 세 갈래(서버가 읽어 넘긴다) — 기본 정보 · 2순위 일정 · 그 앞뒤의 나머지 질문. */
  parts: { base: Question[]; second: Question[]; before: Question[]; after: Question[] };
}) {
  const [view, setView] = useState<View>(prefill.state === "new" ? "confirm" : "gate");
  const [hp, setHp] = useState("");
  // 다시 물어볼 항목(「수정」 을 누른 것).
  const [edit, setEdit] = useState<Set<BaseId>>(new Set());
  const [leaderChanged, setLeaderChanged] = useState(false);
  // 끝 4자리를 확인하고 받은 내용. 확인 전에는 없다.
  const [last4, setLast4] = useState("");
  const [seen, setSeen] = useState<LeaderView | null>(null);

  const when = prefill.date ? `${dateLabel(prefill.date)}${prefill.time ? ` ${prefill.time}` : " · 시간 미정"}` : null;
  // 값이 없어서 어차피 물어야 하는 항목.
  const missing: Record<BaseId, boolean> = {
    schedule: !prefill.fixed && (!prefill.date || !prefill.time),
    groupName: !prefill.groupName,
    headcount: false,
    groupKind: !prefill.groupKind,
  };
  const asks = (id: BaseId) => missing[id] || edit.has(id);
  const toggle = (id: BaseId) =>
    setEdit((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 수정이 열린 신청서를 고쳐 낼 때는 전에 낸 답이 바탕이다.
  const previous = seen?.answers ?? null;
  const needName = leaderChanged || !prefill.organizer;
  const needPhone = previous ? leaderChanged : leaderChanged || !prefill.phoneMasked;

  const questions = (): Question[] => {
    const tomorrow = addDays(kstToday(), 1);
    const base = parts.base.filter((q) => {
      if (q.id === "date" || q.id === "time") return !prefill.fixed && asks("schedule");
      if (q.id === "leaderName") return needName;
      if (q.id === "phone") return needPhone;
      return asks(q.id as BaseId);
    }).map((q) => (q.type === "date" ? { ...q, minDate: tomorrow } : q));
    // 2순위 일정은 미확정 단체에만, 양식에서 그 묶음이 놓인 자리에 묻는다.
    const second = prefill.fixed ? [] : parts.second.map((q) => (q.type === "date" ? { ...q, minDate: tomorrow } : q));
    return [...base, ...parts.before, ...second, ...parts.after];
  };

  const initial = (): Answers => {
    if (previous) {
      // 고쳐 내는 것도 새 제출이다 — 동의는 미리 체크해 두지 않는다.
      const kept = Object.fromEntries(Object.entries(previous).filter(([, v]) => v !== true));
      return { ...kept, headcount: String(previous.headcount ?? prefill.headcount) };
    }
    const a: Answers = { headcount: String(prefill.headcount) };
    if (prefill.groupName) {
      a.groupName = prefill.groupName;
      // 화면 표시 모임명 — 모임 이름이 24자 이하면 미리 채운다.
      if (Array.from(prefill.groupName).length <= 24) a.display = prefill.groupName;
    }
    const kind = kindLabel(prefill.groupKind);
    if (kind) {
      a.groupKind = kind;
      if (kind === OTHER && prefill.groupKindNote) a[otherKey("groupKind")] = prefill.groupKindNote;
    }
    if (!prefill.fixed) {
      if (prefill.date) a.date = prefill.date;
      if (prefill.time) a.time = prefill.time;
    }
    // 견적에서 고른 옵션은 해당 질문에 미리 골라 둔다.
    if (prefill.afterPartyHours > 0) {
      a.afterParty = "신청할게요";
      a.apHours = `${prefill.afterPartyHours}시간`;
      a.cleanup = prefill.cleanup ? "예" : "아니요";
    }
    return a;
  };

  const logo = (
    <div className="mb-6 flex items-center gap-3">
      <Image src="/logo-black.png" alt="" width={860} height={600} className="h-10 w-auto" priority />
      <span className="text-body font-extrabold text-foreground">우주이스케이프</span>
    </div>
  );

  if (view === "form") {
    return (
      <>
        {/* 사람에게는 안 보이는 칸 — 봇이 채우면 서버가 저장하지 않는다 */}
        <div aria-hidden className="hidden">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
          </label>
        </div>
        <FormFlow
          def={leaderFormDef(questions())}
          initial={initial()}
          onExit={() => setView("confirm")}
          onSubmit={async (answers) => {
            const res = await submitLeader(code, answers, hp, last4 || undefined);
            if ("ok" in res) {
              setSeen(null);
              setView("done");
            }
            return res;
          }}
        />
      </>
    );
  }

  if (view === "done") {
    return (
      <div>
        {logo}
        <div role="status" className="rounded-xl border border-confirm bg-confirm-soft p-5">
          <h1 className="text-h2 font-extrabold text-confirm">신청서를 잘 받았어요</h1>
          <p className="mt-2 text-body text-foreground">내용을 확인한 뒤 우주이스케이프에서 연락드릴게요.</p>
        </div>
        <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 text-body-sm text-foreground">
          <li>인원 · 일정 · 애프터파티가 견적과 달라졌다면, 확인한 뒤 바뀐 금액을 따로 안내드려요.</li>
          <li>낸 내용은 이 링크를 다시 열고 휴대폰 번호 끝 4자리를 입력하면 볼 수 있어요.</li>
          <li>고칠 내용이 있으면 그 화면에서 「수정 요청」 을 남겨주세요.</li>
        </ul>
      </div>
    );
  }

  if (view === "gate") {
    return (
      <div>
        {logo}
        <p className="text-body-sm text-muted">{prefill.groupName ?? "단체 모임"}</p>
        <h1 className="mt-1 text-h1 font-extrabold text-foreground">
          {prefill.state === "reopened" ? "신청서를 고칠 수 있어요" : "신청서를 이미 받았어요"}
        </h1>
        <p className="mt-2 text-body text-muted">
          {prefill.submittedOn ? `${prefill.submittedOn}에 제출했어요. ` : ""}
          {prefill.state === "reopened"
            ? "우주이스케이프에서 수정을 열어 두었어요. 본인 확인 후 고쳐서 다시 내주세요."
            : "낸 내용을 보려면 본인 확인이 필요해요."}
        </p>
        <Gate
          code={code}
          onOk={(digits, res) => {
            setLast4(digits);
            setSeen(res);
            setView(res.locked ? "summary" : "confirm");
          }}
        />
      </div>
    );
  }

  if (view === "summary" && seen) {
    return (
      <div>
        {logo}
        <p className="text-body-sm text-muted">{prefill.groupName ?? "단체 모임"}</p>
        <h1 className="mt-1 text-h1 font-extrabold text-foreground">낸 신청서</h1>
        <p className="mt-2 text-body-sm text-muted">보기 전용이에요. 고칠 내용은 아래 「수정 요청」 으로 남겨주세요.</p>
        <Summary rows={seen.rows} />
        <EditRequest code={code} last4={last4} pending={seen.editRequest} onSent={(text) => setSeen({ ...seen, editRequest: text })} />
      </div>
    );
  }

  // 확인 화면
  const rows: { id: BaseId; label: string; value: string | null; locked?: boolean; note?: string }[] = [
    {
      id: "schedule",
      label: prefill.fixed ? "확정된 일정" : "희망 날짜 · 시간",
      value: when,
      locked: prefill.fixed,
      note: prefill.fixed ? "예약금이 확인되어 확정된 일정이에요. 바꾸려면 우주이스케이프로 연락해주세요." : undefined,
    },
    { id: "groupName", label: "모임 이름", value: prefill.groupName },
    {
      id: "headcount",
      label: "인원",
      value: `${prefill.headcount}명`,
      note: "보통 6~24명이에요. 그 밖의 인원은 별도 상담으로만 가능해요.",
    },
    {
      id: "groupKind",
      label: "모임 성격",
      value: kindLabel(prefill.groupKind) === OTHER && prefill.groupKindNote ? `기타: ${prefill.groupKindNote}` : kindLabel(prefill.groupKind),
    },
  ];

  return (
    <div>
      {logo}
      <p className="text-body-sm text-muted">단체 예약 신청서 · 모임장용</p>
      <h1 className="mt-1 text-h1 font-extrabold text-foreground">{previous ? "고칠 내용을 확인해주세요" : "이 내용이 맞나요?"}</h1>
      <p className="mt-2 text-body text-muted">
        이미 알려주신 내용은 다시 묻지 않아요. 달라진 것만 「수정」 을 눌러주세요.
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body-sm text-muted">{r.label}</p>
                <p className="mt-0.5 break-words text-body font-semibold text-foreground">{r.value ?? "아직 없어요"}</p>
              </div>
              {!r.locked && !missing[r.id] && (
                <button type="button" onClick={() => toggle(r.id)} aria-pressed={edit.has(r.id)} className={linkButton}>
                  {edit.has(r.id) ? "수정 취소" : "수정"}
                </button>
              )}
            </div>
            {asks(r.id) && !r.locked && <p className="mt-2 text-body-sm font-semibold text-glow">다음 화면에서 물어볼게요.</p>}
            {r.note && <p className="mt-2 text-body-sm text-muted">{r.note}</p>}
          </li>
        ))}
        <li className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body-sm text-muted">담당자</p>
              <p className="mt-0.5 break-words text-body font-semibold text-foreground">{prefill.organizer ?? "아직 없어요"}</p>
              {prefill.phoneMasked && <p className="whitespace-nowrap text-body font-semibold tabular-nums text-foreground">{prefill.phoneMasked}</p>}
            </div>
            {prefill.organizer && (
              <button type="button" onClick={() => setLeaderChanged(!leaderChanged)} aria-pressed={leaderChanged} className={linkButton}>
                {leaderChanged ? "그대로예요" : "담당자가 바뀌었어요"}
              </button>
            )}
          </div>
          {(needName || needPhone) && (
            <p className="mt-2 text-body-sm font-semibold text-glow">
              다음 화면에서 {needName && needPhone ? "이름과 휴대폰 번호를" : needName ? "이름을" : "휴대폰 번호를"} 물어볼게요.
            </p>
          )}
          <p className="mt-2 text-body-sm text-muted">개인정보 보호를 위해 일부만 보여드려요.</p>
        </li>
      </ul>

      <button type="button" onClick={() => setView("form")} className={`${primaryButton} mt-6`}>
        {previous ? "고쳐서 다시 내기" : "맞아요, 신청서 작성하기"}
      </button>
      <p className="mt-3 text-center text-body-sm text-muted">한 화면에 질문 하나씩 · 5분쯤 걸려요.</p>
    </div>
  );
}

/** 휴대폰 번호 끝 4자리 확인. 맞아야 서버가 낸 내용을 돌려준다. */
function Gate({ code, onOk }: { code: string; onOk: (digits: string, res: LeaderView) => void }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="mt-5 rounded-xl border border-border bg-surface p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const res = await viewLeader(code, digits);
        setBusy(false);
        if ("error" in res) return setError(res.error);
        onOk(digits, res);
      }}
    >
      <label htmlFor="last4" className="text-body font-semibold text-foreground">
        신청서에 적은 휴대폰 번호 끝 4자리
      </label>
      <input
        id="last4"
        inputMode="numeric"
        autoComplete="off"
        value={digits}
        onChange={(e) => {
          setDigits(e.target.value.replace(/\D/g, "").slice(0, 4));
          setError("");
        }}
        placeholder="0000"
        aria-invalid={!!error}
        aria-describedby={error ? "last4-error" : undefined}
        className={`${inputClass} mt-2`}
      />
      {error && (
        <p id="last4-error" role="alert" className="mt-2 text-body-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || digits.length !== 4} className={`${primaryButton} mt-4`}>
        {busy ? "확인 중…" : "확인"}
      </button>
    </form>
  );
}

function Summary({ rows }: { rows: LeaderView["rows"] }) {
  const sections = [...new Set(rows.map((r) => r.section))];
  return (
    <div className="mt-5 flex flex-col gap-3">
      {sections.map((s) => (
        <section key={s} className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-body-sm font-semibold text-muted">{s}</h2>
          <dl className="mt-2 flex flex-col gap-3">
            {rows
              .filter((r) => r.section === s)
              .map((r) => (
                <div key={r.id}>
                  <dt className="text-body-sm text-muted">{r.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-body text-foreground">{r.value}</dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** 수정 요청 — 2~300자. 보내면 운영자의 오늘 할 일에 뜬다. */
function EditRequest({ code, last4, pending, onSent }: { code: string; last4: string; pending: string | null; onSent: (text: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const count = Array.from(text.trim()).length;
  return (
    <section className="mt-5 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-h3 font-semibold text-foreground">수정 요청</h2>
      {pending && (
        <div className="mt-2 rounded-lg bg-fill p-3">
          <p className="text-body-sm text-muted">{sent ? "보낸 요청" : "확인 중인 요청"}</p>
          <p className="mt-1 whitespace-pre-line break-words text-body-sm text-foreground">{pending}</p>
        </div>
      )}
      {sent ? (
        <p role="status" className="mt-3 text-body-sm font-semibold text-confirm">
          요청을 보냈어요. 확인한 뒤 연락드릴게요.
        </p>
      ) : (
        <form
          noValidate
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (count < 2 || count > 300) return setError("수정 요청은 2~300자로 적어주세요.");
            setBusy(true);
            const res = await requestLeaderEdit(code, last4, text);
            setBusy(false);
            if ("error" in res) return setError(res.error);
            setSent(true);
            onSent(text.trim());
          }}
        >
          <label htmlFor="edit-request" className="text-body-sm text-muted">
            {pending ? "새로 보내면 앞의 요청을 바꿔요." : "무엇을 어떻게 고치고 싶은지 적어주세요."}
          </label>
          <textarea
            id="edit-request"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            rows={4}
            maxLength={600}
            placeholder="예) 인원이 22명에서 20명으로 줄었어요"
            aria-invalid={!!error}
            className={`${inputClass} mt-2`}
          />
          <p className={`mt-1 text-right text-micro tabular-nums ${count > 300 ? "text-danger" : "text-muted"}`}>{count} / 300</p>
          {error && (
            <p role="alert" className="text-body-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || count < 2} className={`${primaryButton} mt-3`}>
            {busy ? "보내는 중…" : "수정 요청 보내기"}
          </button>
        </form>
      )}
    </section>
  );
}
