"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";
import { WEEKDAY_TIME_FIRST, WEEKDAY_TIME_LAST, WEEKEND_TIMES, isWeekend } from "@/lib/groupPricing";
import { OTHER, SCALE_LABELS, otherKey, type FormDef, type Question } from "@/lib/groupForms/schema";
import { charLen, cleanText, cleanValue, isVisible, otherError, pickedOther, questionError, type Answers } from "@/lib/groupForms/validate";

/**
 * 한 화면에 한 질문씩 넘어가는 폼(관리자 개편 docs/04 1장 — 대표님: 정보가 한꺼번에 보이면 피한다. 토스처럼).
 *
 *   · 맨 위에 진행 막대와 `3 / 6`, 뒤로 가기.
 *   · 하나 고르기는 고르는 즉시 다음으로 넘어간다(버튼이 없다).
 *   · 입력형은 값이 들어가야 「다음」 이 켜진다. 선택 문항은 비어 있으면 「건너뛰기」.
 *   · 짧은 입력이 이어지면 방금 쓴 답이 위에 작게 쌓인다(이름 → 전화번호 → 닉네임).
 *   · 동의 문항은 한 화면에 모은다 — 「모두 동의하기」 와 개별 체크.
 *   · 조건 문항은 앞 답에 따라 나타나거나 빠지고, 진행 숫자도 그에 맞게 바뀐다.
 *   · 중요한 설명은 요약 몇 줄만 회색 상자로 보여주고 전문은 「자세히 보기」 로 펼친다.
 *   · 마지막 화면의 버튼만 「제출하기」. Enter 로 다음, 입력칸 자동 포커스, 글자 수 표시.
 *   · 입력 글자는 16px 이상(아이폰 확대 방지), 누르는 영역은 44px 이상.
 *
 * 양식(schema.ts)을 그대로 받아 그린다 — 문구 · 선택지 · 글자 수가 이 파일에 박혀 있지 않다.
 * 검증은 서버와 같은 함수(validate.ts)를 쓴다. 여기 검증은 안내용이고 서버가 다시 본다.
 */

export type SubmitResult = { ok: true } | { error: string; field?: string };

type Step = { kind: "question"; q: Question } | { kind: "agree"; qs: Question[] };

const SHORT: Question["type"][] = ["text", "tel", "number"];

export function FormFlow({
  def,
  initial,
  onSubmit,
  onExit,
  checkBeforeNext,
}: {
  def: FormDef;
  /** 미리 채울 값(이 기기에서 전에 낸 답). */
  initial?: Answers;
  onSubmit: (answers: Answers) => Promise<SubmitResult>;
  /** 첫 질문에서 뒤로 가면 불린다(폼의 첫 화면으로). */
  onExit: () => void;
  /** 다음으로 넘어가기 전에 서버에 물어볼 것(예: 닉네임 중복). 문제가 있으면 안내 문구를 돌려준다. */
  checkBeforeNext?: (q: Question, value: string, answers: Answers) => Promise<string | null>;
}) {
  // 지금 답으로 보이는 화면들. 조건 문항은 앞 답에 따라 나타나거나 빠진다.
  const stepsFor = (a: Answers): Step[] => {
    const visible = def.questions.filter((q) => isVisible(q, a));
    const agrees = visible.filter((q) => q.type === "agree");
    return [
      ...visible.filter((q) => q.type !== "agree").map((q): Step => ({ kind: "question", q })),
      ...(agrees.length ? [{ kind: "agree", qs: agrees } as Step] : []),
    ];
  };
  const [answers, setAnswers] = useState<Answers>(initial ?? {});
  const steps = stepsFor(answers);
  const [rawI, setI] = useState(0);
  const i = Math.min(rawI, steps.length - 1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // 화면이 바뀌면 입력칸에 바로 커서를 둔다. 입력칸이 없는 화면(고르기 · 동의)은 질문 제목으로 — 화면 낭독기가 새 질문을 읽게.
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    else titleRef.current?.focus();
  }, [i]);

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setError("");
  };

  const go = (n: number) => {
    setError("");
    setI(Math.max(0, n));
  };

  const submit = async (final: Answers) => {
    setBusy(true);
    const res = await onSubmit(final);
    setBusy(false);
    if ("ok" in res) return;
    // 서버가 어느 문항이 문제인지 알려주면 그 화면으로 돌아가 보여준다.
    const at = res.field
      ? steps.findIndex((s) => (s.kind === "question" ? s.q.id === res.field : s.qs.some((q) => q.id === res.field)))
      : -1;
    if (at >= 0) setI(at);
    setError(res.error);
  };

  const next = async (override?: Answers) => {
    if (busy) return;
    // 상태를 직접 고치지 않게 복사해서 쓴다.
    const cur = { ...(override ?? answers) };
    if (step.kind === "agree") {
      const miss = step.qs.find((q) => questionError(q, cleaned(q, cur)));
      if (miss) return setError("필수 항목에 동의가 필요해요.");
    } else {
      const v = cleaned(step.q, cur);
      const err = questionError(step.q, v, cur);
      if (err) return setError(err);
      if (pickedOther(step.q, v)) {
        const text = cleanText(cur[otherKey(step.q.id)]);
        const otherErr = otherError(text);
        if (otherErr) return setError(otherErr);
        cur[otherKey(step.q.id)] = text;
      }
      if (checkBeforeNext && typeof v === "string" && v !== "") {
        setBusy(true);
        const problem = await checkBeforeNext(step.q, v, cur);
        setBusy(false);
        if (problem) return setError(problem);
      }
      // 정리한 값(공백 · 전화번호 숫자만)을 그대로 담아 둔다.
      cur[step.q.id] = v;
      setAnswers(cur);
    }
    // 방금 답으로 뒤 화면이 달라질 수 있다 — 바뀐 답으로 다시 센다.
    if (i >= stepsFor(cur).length - 1) return submit({ ...cur });
    go(i + 1);
  };

  const back = () => (i === 0 ? onExit() : go(i - 1));

  // 방금 쓴 짧은 답 — 지금 질문 바로 앞에 이어진 짧은 입력들만 쌓아 보여준다.
  const trail: Question[] = [];
  if (step.kind === "question" && SHORT.includes(step.q.type)) {
    for (let k = i - 1; k >= 0; k--) {
      const s = steps[k];
      if (s.kind !== "question" || !SHORT.includes(s.q.type)) break;
      trail.unshift(s.q);
    }
  }

  const value = step.kind === "question" ? answers[step.q.id] : undefined;
  const filled = step.kind === "question" ? !(value == null || value === "" || (Array.isArray(value) && value.length === 0)) : true;
  const optional = step.kind === "question" && !step.q.required;
  // 하나 고르기는 고르는 즉시 넘어간다. 이미 답이 있거나(뒤로 왔을 때) 「기타」 를 골라 직접 적어야 하면 버튼을 보여준다.
  const autoAdvance = step.kind === "question" && isPickOne(step.q, answers) && !filled;

  return (
    <div>
      {/* 진행 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label="이전"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Chevron dir="left" className="h-5 w-5" />
        </button>
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fill-strong"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={i + 1}
          aria-label="진행"
        >
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="shrink-0 text-label tabular-nums text-muted">
          {i + 1} / {steps.length}
        </span>
      </div>

      {trail.length > 0 && (
        <dl className="mb-4 flex flex-col gap-1">
          {trail.map((q) => (
            <div key={q.id} className="flex gap-2 text-body-sm text-muted">
              <dt className="shrink-0">{q.label}</dt>
              <dd className="min-w-0 truncate font-semibold text-foreground">{displayValue(q, answers[q.id])}</dd>
            </div>
          ))}
        </dl>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        {step.kind === "agree" ? (
          <AgreeStep qs={step.qs} answers={answers} set={set} titleRef={titleRef} title={def.agreeTitle} all={def.agreeAll !== false} />
        ) : (
          <QuestionStep
            q={step.q}
            value={value}
            answers={answers}
            set={(v) => set(step.q.id, v)}
            setOther={(v) => set(otherKey(step.q.id), v)}
            inputRef={inputRef}
            titleRef={titleRef}
            error={error}
            onPick={(v) => {
              // 하나 고르기 — 고르는 즉시 다음으로.
              const cur = { ...answers, [step.q.id]: v };
              setAnswers(cur);
              setError("");
              // 「기타」 는 직접 적어야 해서 넘어가지 않는다.
              if (!(step.q.other && v === OTHER)) window.setTimeout(() => void next(cur), 160);
            }}
          />
        )}

        {error && (
          <p id="form-error" role="alert" className="mt-3 text-body-sm font-semibold text-danger">
            {error}
          </p>
        )}

        {autoAdvance && <p className="mt-4 text-body-sm text-muted">하나를 고르면 다음으로 넘어가요.</p>}
        {/* 고르는 즉시 넘어가는 화면에는 버튼이 없다 — 다만 선택 문항은 「건너뛰기」 가 있어야 지나갈 수 있다. */}
        {(!autoAdvance || optional) && (
          <button
            type="submit"
            disabled={busy || (!filled && !optional)}
            className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-foreground px-4 text-body font-semibold text-background transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
          >
            {busy ? (last ? "제출 중…" : "확인 중…") : last ? "제출하기" : !filled && optional ? "건너뛰기" : "다음"}
          </button>
        )}
      </form>
    </div>
  );
}

function cleaned(q: Question, a: Answers) {
  return cleanValue(q, a[q.id]);
}

/** 주말 날짜와 짝인 시간 질문은 정해진 회차 셋 중에서 고른다. */
function weekendTime(q: Question, a: Answers): boolean {
  const date = q.type === "time" && q.dateOf ? String(a[q.dateOf] ?? "") : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isWeekend(date);
}

/** 고르는 즉시 넘어가는 화면인가. */
function isPickOne(q: Question, a: Answers): boolean {
  return q.type === "radio" || weekendTime(q, a);
}

function displayValue(q: Question, v: Answers[string] | undefined): string {
  if (v == null || v === "") return "-";
  if (q.type === "tel") {
    const d = String(v).replace(/\D/g, "");
    return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : String(v);
  }
  return String(v);
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-4 py-3 text-input text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function QuestionStep({
  q,
  value,
  answers,
  set,
  setOther,
  onPick,
  inputRef,
  titleRef,
  error,
}: {
  q: Question;
  value: Answers[string] | undefined;
  answers: Answers;
  set: (v: Answers[string]) => void;
  setOther: (v: string) => void;
  onPick: (v: string) => void;
  inputRef: React.RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  error: string;
}) {
  const id = `q-${q.id}`;
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  const describedBy = [q.help ? `${id}-help` : "", error ? "form-error" : ""].filter(Boolean).join(" ") || undefined;
  const max = q.width != null ? undefined : (q.max ?? (q.type === "textarea" ? 1000 : 100));
  const slots = weekendTime(q, answers);
  const options = slots ? (WEEKEND_TIMES as readonly string[]) : (q.options ?? []);
  const picks = Array.isArray(value) ? value : [];
  const other = pickedOther(q, value);
  const otherText = typeof answers[otherKey(q.id)] === "string" ? (answers[otherKey(q.id)] as string) : "";
  const toggle = (opt: string) => {
    if (picks.includes(opt)) return set(picks.filter((x) => x !== opt));
    // 「없음」 은 혼자만 골라진다 — 고르면 나머지가 풀리고, 다른 것을 고르면 「없음」 이 풀린다.
    if (q.none && opt === q.none) return set([opt]);
    set([...picks.filter((x) => x !== q.none), opt]);
  };

  return (
    <div>
      <h2 ref={titleRef} tabIndex={-1} className="text-h2 font-extrabold text-foreground focus:outline-none">
        <label htmlFor={q.type === "radio" || q.type === "scale" || q.type === "checkbox" || slots ? undefined : id}>{q.ask ?? q.label}</label>
        {!q.required && <span className="ml-2 align-middle text-body-sm font-normal text-muted">선택</span>}
      </h2>
      {q.help && (
        <p id={`${id}-help`} className="mt-2 text-body text-muted">
          {q.help}
        </p>
      )}
      {q.type === "checkbox" && <p className="mt-2 text-body-sm text-muted">여러 개 고를 수 있어요.</p>}
      {q.sum && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-fill p-3 text-body-sm text-foreground">
          {q.sum.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {q.detail && (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-body-sm text-glow underline">자세히 보기</summary>
          <p className="whitespace-pre-line rounded-lg border border-border bg-surface p-3 text-body-sm text-muted">{q.detail}</p>
        </details>
      )}

      <div className="mt-5">
        {q.type === "checkbox" && (
          <div role="group" aria-label={q.ask ?? q.label} className="flex flex-col gap-2">
            {options.map((opt) => {
              const on = picks.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-body transition-colors ${
                    on ? "border-brand bg-brand-soft font-semibold text-foreground" : "border-line bg-surface text-foreground hover:bg-fill"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(opt)} className="h-5 w-5 shrink-0" />
                  {opt}
                </label>
              );
            })}
          </div>
        )}

        {(q.type === "radio" || slots) && (
          <div role="radiogroup" aria-label={q.ask ?? q.label} className="flex flex-col gap-2">
            {options.map((opt) => {
              const on = value === opt;
              return (
                <label
                  key={opt}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-body transition-colors ${
                    on ? "border-brand bg-brand-soft font-semibold text-foreground" : "border-line bg-surface text-foreground hover:bg-fill"
                  }`}
                >
                  <input type="radio" name={id} value={opt} checked={on} onChange={() => onPick(opt)} className="h-5 w-5 shrink-0" />
                  {opt}
                </label>
              );
            })}
          </div>
        )}

        {other && (
          <div className="mt-3">
            <label htmlFor={`${id}-other`} className="text-body-sm font-semibold text-foreground">
              기타 내용
            </label>
            <input
              id={`${id}-other`}
              type="text"
              value={otherText}
              onChange={(e) => setOther(e.target.value)}
              maxLength={100}
              placeholder="직접 적어주세요 (2~50자)"
              aria-invalid={!!error}
              className={`${inputClass} mt-1`}
            />
          </div>
        )}

        {q.type === "scale" && <Stars value={Number(value) || 0} set={(n) => set(n)} label={q.ask ?? q.label} />}

        {q.type === "textarea" && (
          <textarea
            id={id}
            ref={inputRef}
            value={text}
            onChange={(e) => set(e.target.value)}
            rows={5}
            maxLength={(max ?? 1000) * 2}
            placeholder={q.ph}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}

        {(q.type === "text" || q.type === "tel" || q.type === "number" || q.type === "date" || (q.type === "time" && !slots)) && (
          <input
            id={id}
            ref={inputRef}
            type={q.type === "tel" ? "tel" : q.type === "date" ? "date" : q.type === "time" ? "time" : "text"}
            // 숫자 칸은 type=number 대신 숫자 자판만 띄운다 — 휠로 값이 바뀌거나 'e' 가 들어가는 일을 막는다.
            inputMode={q.type === "tel" || q.type === "number" ? "numeric" : undefined}
            value={text}
            onChange={(e) => set(q.type === "number" ? e.target.value.replace(/[^\d]/g, "").slice(0, 6) : e.target.value)}
            maxLength={q.type === "tel" ? 13 : q.width != null ? 24 : (max ?? 100) * 2}
            min={q.type === "date" ? q.minDate : q.type === "time" ? WEEKDAY_TIME_FIRST : undefined}
            max={q.type === "time" ? WEEKDAY_TIME_LAST : undefined}
            placeholder={q.type === "tel" ? "010-0000-0000" : q.ph}
            autoComplete={q.kind === "name" ? "name" : q.type === "tel" ? "tel" : "off"}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}

        {/* 글자 수 — 닉네임은 폭 규칙이라 숫자를 보여주지 않는다(안내 문구가 대신한다). */}
        {(q.type === "text" || q.type === "textarea") && max != null && (
          <p className={`mt-1 text-right text-micro tabular-nums ${charLen(text.trim()) > max ? "text-danger" : "text-muted"}`}>
            {charLen(text.trim())} / {max}
          </p>
        )}
      </div>
    </div>
  );
}

/** 별점 — 별을 누르면 채워지고 '4점 · 좋았어요' 처럼 뜻을 같이 적는다. 방향키로도 고를 수 있다. */
function Stars({ value, set, label }: { value: number; set: (n: number) => void; label: string }) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            set(Math.min(5, (value || 0) + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            set(Math.max(1, (value || 1) - 1));
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}점 ${SCALE_LABELS[n]}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onClick={() => set(n)}
            className="flex h-12 w-12 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-9 w-9">
              <path
                d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
                fill={n <= value ? "var(--wait)" : "none"}
                stroke={n <= value ? "var(--wait)" : "var(--muted)"}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-6 text-body font-semibold text-foreground" aria-live="polite">
        {value ? `${value}점 · ${SCALE_LABELS[value]}` : ""}
      </p>
    </div>
  );
}

/** 약관 화면 — 「모두 동의하기」 와 개별 체크. 중요한 설명은 요약 몇 줄만 먼저 보여준다. */
function AgreeStep({
  qs,
  answers,
  set,
  titleRef,
  title,
  all: showAll,
}: {
  qs: Question[];
  answers: Answers;
  set: (id: string, v: boolean) => void;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  title?: string;
  all: boolean;
}) {
  const all = qs.every((q) => answers[q.id] === true);
  return (
    <div>
      <h2 ref={titleRef} tabIndex={-1} className="text-h2 font-extrabold text-foreground focus:outline-none">
        {title ?? "약관을 확인해주세요"}
      </h2>
      {showAll && (
        <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 text-body font-semibold text-foreground">
          {/* 선택 항목까지 한 번에 체크한다(2026-11-27 대표님). 아래에서 하나씩 풀 수 있다. */}
          <input type="checkbox" checked={all} onChange={(e) => qs.forEach((q) => set(q.id, e.target.checked))} className="h-5 w-5 shrink-0" />
          모두 동의하기
        </label>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {qs.map((q) => (
          <li key={q.id} className="rounded-lg border border-border bg-surface p-4">
            {q.ask && <p className="mb-2 text-body-sm font-semibold text-muted">{q.ask}</p>}
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-body text-foreground">
              <input
                type="checkbox"
                checked={answers[q.id] === true}
                onChange={(e) => set(q.id, e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>{q.label}</span>
            </label>
            {q.help && <p className="mt-1 pl-8 text-body-sm text-muted">{q.help}</p>}
            {q.sum && (
              <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-fill p-3 text-body-sm text-foreground">
                {q.sum.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {q.detail && (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer text-body-sm text-glow underline">자세히 보기</summary>
                <p className="mt-1 whitespace-pre-line text-body-sm text-muted">{q.detail}</p>
              </details>
            )}
            {q.link && (
              <a href={q.link.href} target="_blank" rel="noopener noreferrer" className="mt-1 flex min-h-11 items-center text-body-sm text-glow underline">
                {q.link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
