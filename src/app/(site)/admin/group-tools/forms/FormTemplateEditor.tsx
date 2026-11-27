"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FormFlow } from "@/app/f/[code]/FormFlow";
import { AdminBadge, AdminCard, AdminField, AdminNotice, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { OTHER, type FormDef, type Question, type QuestionType, type ShowIf } from "@/lib/groupForms/schema";
import {
  ADDABLE_TYPES,
  TEMPLATE_LIMITS,
  flattenTemplate,
  typeLabel,
  validateTemplate,
  type FormKey,
  type FormTemplate,
  type TemplateSection,
} from "@/lib/groupForms/template";
import { restoreFormTemplate, saveFormTemplate } from "../actions";

/**
 * 설문 양식 편집(관리자 개편 docs/04 5장) — 묶음 · 질문을 더하고 빼고 옮기고, 문구 · 유형 · 선택지 · 조건을 고친다.
 *
 * 고친 내용은 「저장」 을 눌러야 반영된다. 저장하면 새 버전이 되어 공개 폼에 바로 적용된다.
 * 화면의 검사(validateTemplate)는 안내용이고 서버가 같은 함수로 다시 본다 — 잠긴 질문의 구조는 서버가 코드의 것으로 되돌린다.
 *
 * 순서는 위 · 아래 버튼으로 바꾼다(끌기 없이 키보드 · 터치로 된다).
 */

type Version = { version: number; note: string | null; at: string | null };

const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;
const TEXT_TYPES: QuestionType[] = ["text", "textarea", "number"];

function conditionText(c: ShowIf | undefined, all: Question[]): string {
  if (!c) return "";
  const t = all.find((q) => q.id === c.id);
  const name = t?.label ?? "(없는 질문)";
  if (c.filled) return `「${name}」 에 답했을 때만`;
  if (c.is != null) return `「${name}」 의 답이 「${c.is}」 일 때만`;
  if (c.in) return `「${name}」 의 답이 ${c.in.map((v) => `「${v}」`).join(" · ")} 중 하나일 때만`;
  if (c.anyExcept != null) return `「${name}」 에서 「${c.anyExcept}」 말고 다른 것을 골랐을 때만`;
  return "";
}

export function FormTemplateEditor({
  formKey,
  version,
  savedAt,
  initial,
  locked,
  versions,
}: {
  formKey: FormKey;
  version: number;
  savedAt: string | null;
  initial: FormTemplate;
  /** 잠긴 질문의 id — 문구만 고칠 수 있다. */
  locked: string[];
  versions: Version[];
}) {
  const router = useRouter();
  const [tpl, setTpl] = useState<FormTemplate>(initial);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [restoreTo, setRestoreTo] = useState<number>(versions.find((v) => v.version !== version)?.version ?? version);
  const [pending, startTransition] = useTransition();
  const lockedSet = useMemo(() => new Set(locked), [locked]);

  const dirty = useMemo(() => JSON.stringify(tpl) !== JSON.stringify(initial), [tpl, initial]);
  const check = useMemo(() => validateTemplate(formKey, tpl), [formKey, tpl]);
  const problem = "error" in check ? check.error : null;
  const order = tpl.sections.flatMap((s) => s.questions);

  // 저장하지 않고 나가려 하면 브라우저가 한 번 묻는다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (next: FormTemplate) => {
    setTpl(next);
    setNote(null);
  };
  const setSection = (si: number, patch: Partial<TemplateSection>) => change({ ...tpl, sections: tpl.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const setQuestion = (si: number, qi: number, next: Question) =>
    setSection(si, { questions: tpl.sections[si].questions.map((q, i) => (i === qi ? next : q)) });

  const moveSection = (si: number, d: -1 | 1) => {
    const j = si + d;
    if (j < 0 || j >= tpl.sections.length) return;
    const sections = [...tpl.sections];
    [sections[si], sections[j]] = [sections[j], sections[si]];
    change({ ...tpl, sections });
  };
  const addSection = () => {
    if (tpl.sections.length >= TEMPLATE_LIMITS.sections) return setNote({ ok: false, text: `묶음은 ${TEMPLATE_LIMITS.sections}개까지 둘 수 있어요.` });
    change({ ...tpl, sections: [...tpl.sections, { id: newId("s"), title: "새 묶음", questions: [] }] });
  };
  const removeSection = (si: number) => {
    const s = tpl.sections[si];
    if (s.questions.some((q) => lockedSet.has(q.id))) return setNote({ ok: false, text: `「${s.title}」 에는 지울 수 없는 질문이 있어요. 그 질문을 다른 묶음으로 옮긴 뒤 지워주세요.` });
    if (s.questions.length && !window.confirm(`「${s.title}」 묶음과 그 안의 질문 ${s.questions.length}개를 삭제할까요?`)) return;
    change({ ...tpl, sections: tpl.sections.filter((_, i) => i !== si) });
  };
  const addQuestion = (si: number) => {
    if (order.length >= TEMPLATE_LIMITS.questions) return setNote({ ok: false, text: `질문은 ${TEMPLATE_LIMITS.questions}개까지 둘 수 있어요.` });
    const q: Question = { id: newId("q"), label: "새 질문", type: "text", max: 100 };
    setSection(si, { questions: [...tpl.sections[si].questions, q] });
    setOpenQ(q.id);
  };
  const removeQuestion = (si: number, qi: number) => {
    const q = tpl.sections[si].questions[qi];
    const used = order.find((x) => x.showIf?.id === q.id);
    if (used) return setNote({ ok: false, text: `「${used.label}」 의 조건이 이 질문을 보고 있어요. 그 조건을 먼저 바꿔주세요.` });
    if (!window.confirm(`「${q.label}」 질문을 삭제할까요? 이미 받은 답은 지워지지 않아요.`)) return;
    setSection(si, { questions: tpl.sections[si].questions.filter((_, i) => i !== qi) });
  };
  const moveQuestion = (si: number, qi: number, d: -1 | 1) => {
    const list = [...tpl.sections[si].questions];
    const j = qi + d;
    if (j < 0 || j >= list.length) return;
    [list[qi], list[j]] = [list[j], list[qi]];
    setSection(si, { questions: list });
  };
  const moveToSection = (si: number, qi: number, toId: string) => {
    const to = tpl.sections.findIndex((s) => s.id === toId);
    if (to < 0 || to === si) return;
    const q = tpl.sections[si].questions[qi];
    change({
      ...tpl,
      sections: tpl.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.filter((_, k) => k !== qi) } : i === to ? { ...s, questions: [...s.questions, q] } : s)),
    });
  };

  const save = () => {
    if (problem) return setNote({ ok: false, text: problem });
    startTransition(async () => {
      const res = await saveFormTemplate({ formKey, template: tpl, baseVersion: version });
      if ("error" in res) return setNote({ ok: false, text: res.error });
      setNote({ ok: true, text: res.message ?? "저장했습니다." });
      router.refresh();
    });
  };
  const restore = () => {
    if (dirty) return setNote({ ok: false, text: "저장하지 않은 변경이 있어요. 먼저 저장하거나 화면을 새로고침한 뒤 되돌려주세요." });
    if (!window.confirm(`버전 ${restoreTo} 의 내용으로 되돌릴까요? 공개 폼에 바로 반영되고, 지금 버전은 기록에 남습니다.`)) return;
    startTransition(async () => {
      const res = await restoreFormTemplate({ formKey, version: restoreTo });
      if ("error" in res) return setNote({ ok: false, text: res.error });
      setNote({ ok: true, text: res.message ?? "되돌렸습니다." });
      router.refresh();
    });
  };

  const previewDef: FormDef | null =
    "template" in check ? { key: formKey, version, title: check.template.title, questions: flattenTemplate(check.template), agreeTitle: formKey === "leader" ? "마지막으로 확인해주세요" : undefined, agreeAll: formKey !== "leader" } : null;

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title={`지금 버전 ${version}`}>
        <p className="text-body-sm text-muted">{savedAt ? `${savedAt} 저장` : "처음 양식(아직 고친 적 없음)"} · 질문 {order.length}개 · 묶음 {tpl.sections.length}개</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={pending || !dirty} className={adminButtonClass("primary")}>
            {pending ? "저장 중…" : "저장"}
          </button>
          <button type="button" onClick={() => (problem ? setNote({ ok: false, text: problem }) : setPreview(true))} className={adminButtonClass("secondary")}>
            미리보기
          </button>
          {dirty && !pending && <span className="text-body-sm text-wait">저장하지 않은 변경이 있어요.</span>}
        </div>
        {dirty && problem && (
          <p role="alert" className="mt-2 text-body-sm font-semibold text-danger">
            저장할 수 없어요 — {problem}
          </p>
        )}
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`mt-2 text-body-sm ${note.ok ? "text-confirm" : "font-semibold text-danger"}`}>
            {note.text}
          </p>
        )}
        {versions.length > 1 && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div>
              <label htmlFor="restore-version" className="text-body-sm font-semibold text-foreground">
                버전 기록
              </label>
              <select id="restore-version" value={restoreTo} onChange={(e) => setRestoreTo(Number(e.target.value))} className={`${adminInputClass} mt-1`}>
                {versions.map((v) => (
                  <option key={v.version} value={v.version} disabled={v.version === version}>
                    버전 {v.version}
                    {v.version === version ? " (지금)" : ""}
                    {v.at ? ` · ${v.at}` : ""}
                    {v.note ? ` · ${v.note}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={restore} disabled={pending || restoreTo === version} className={adminButtonClass("secondary")}>
              이 버전으로 되돌리기
            </button>
          </div>
        )}
      </AdminCard>

      <AdminNotice title="잠긴 질문">
        「잠김」 이 붙은 질문은 시스템이 값을 읽어 저장 · 금액 비교 · 상담 표시에 쓰는 질문입니다. 문구 · 도움말 · 요약은 고칠 수 있지만 삭제 · 유형 · 선택지 · 필수 여부 ·
        조건은 바꿀 수 없어요. 새 질문의 유형에 전화번호는 없습니다(기존 전화번호 질문은 그대로 받고 암호화해 저장합니다).
      </AdminNotice>

      <AdminCard title="양식 이름">
        <AdminField label="폼 맨 위에 쓰는 이름" htmlFor="tpl-title" hint={`${Array.from(tpl.title.trim()).length} / ${TEMPLATE_LIMITS.title}`}>
          <input id="tpl-title" value={tpl.title} onChange={(e) => change({ ...tpl, title: e.target.value })} maxLength={80} autoComplete="off" className={adminInputClass} />
        </AdminField>
      </AdminCard>

      {tpl.sections.map((s, si) => (
        <section key={s.id} aria-label={s.title} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor={`sec-${s.id}`} className="text-body-sm font-semibold text-foreground">
                묶음 {si + 1} 이름 {s.system && <span className="font-normal text-muted">· 시스템 묶음(질문을 더하거나 뺄 수 없어요)</span>}
              </label>
              <input
                id={`sec-${s.id}`}
                value={s.title}
                onChange={(e) => setSection(si, { title: e.target.value })}
                maxLength={60}
                autoComplete="off"
                className={`${adminInputClass} mt-1`}
              />
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => moveSection(si, -1)} disabled={si === 0} aria-label={`${s.title} 묶음 위로`} className={adminButtonClass("secondary")}>
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveSection(si, 1)}
                disabled={si === tpl.sections.length - 1}
                aria-label={`${s.title} 묶음 아래로`}
                className={adminButtonClass("secondary")}
              >
                ↓
              </button>
              {!s.system && (
                <button type="button" onClick={() => removeSection(si)} aria-label={`${s.title} 묶음 삭제`} className={adminButtonClass("danger")}>
                  삭제
                </button>
              )}
            </div>
          </div>

          <ol className="mt-3 flex flex-col gap-2">
            {s.questions.length === 0 && <li className="text-body-sm text-muted">질문이 없어요.</li>}
            {s.questions.map((q, qi) => {
              const isLocked = lockedSet.has(q.id);
              const isOpen = openQ === q.id;
              const cond = conditionText(q.showIf, order);
              return (
                <li key={q.id} className={`rounded-lg border p-3 ${isOpen ? "border-brand" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-body font-semibold text-foreground">{q.ask || q.label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <AdminBadge tone="idle">{typeLabel(q.type)}</AdminBadge>
                        <AdminBadge tone={q.required ? "progress" : "idle"}>{q.required ? "필수" : "선택"}</AdminBadge>
                        {isLocked && <AdminBadge tone="warn">잠김</AdminBadge>}
                        <span className="text-micro text-muted">{q.label}</span>
                      </div>
                      {cond && <p className="mt-1 text-body-sm text-muted">조건: {cond} 보임</p>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!s.system && (
                        <>
                          <button type="button" onClick={() => moveQuestion(si, qi, -1)} disabled={qi === 0} aria-label={`${q.label} 위로`} className={adminButtonClass("secondary")}>
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(si, qi, 1)}
                            disabled={qi === s.questions.length - 1}
                            aria-label={`${q.label} 아래로`}
                            className={adminButtonClass("secondary")}
                          >
                            ↓
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => setOpenQ(isOpen ? null : q.id)} aria-expanded={isOpen} className={adminButtonClass("secondary")}>
                        {isOpen ? "접기" : "수정"}
                      </button>
                      {!isLocked && (
                        <button type="button" onClick={() => removeQuestion(si, qi)} aria-label={`${q.label} 삭제`} className={adminButtonClass("danger")}>
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <QuestionEditor
                      q={q}
                      locked={isLocked}
                      system={!!s.system}
                      earlier={order.slice(0, order.indexOf(q)).filter((x) => x.type !== "agree")}
                      sections={tpl.sections.filter((x) => !x.system)}
                      sectionId={s.id}
                      onChange={(next) => setQuestion(si, qi, next)}
                      onMove={(toId) => moveToSection(si, qi, toId)}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          {!s.system && (
            <button type="button" onClick={() => addQuestion(si)} className={`${adminButtonClass("secondary")} mt-3`}>
              질문 등록
            </button>
          )}
        </section>
      ))}

      <div>
        <button type="button" onClick={addSection} className={adminButtonClass("secondary")}>
          묶음 등록
        </button>
      </div>

      {preview && previewDef && (
        <div role="dialog" aria-modal="true" aria-label="양식 미리보기" className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
            <p className="text-body-sm text-foreground">
              <strong className="font-semibold">미리보기</strong> — 지금 고치는 중인 내용입니다. 제출해도 저장되지 않아요.
              {formKey === "leader" && " (실제 폼에서는 견적에서 받은 값은 다시 묻지 않고, 확정된 단체에는 2순위 일정을 묻지 않아요.)"}
            </p>
            <button type="button" onClick={() => setPreview(false)} className={adminButtonClass("primary")}>
              닫기
            </button>
          </div>
          <div className="mx-auto w-full max-w-md px-4 py-6">
            <FormFlow
              def={previewDef}
              onExit={() => setPreview(false)}
              onSubmit={async () => {
                setPreview(false);
                setNote({ ok: true, text: "미리보기를 끝까지 넘겼습니다. 제출되지는 않았어요." });
                return { ok: true };
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 질문 하나를 고치는 칸. 잠긴 질문은 글 칸만 나온다. */
function QuestionEditor({
  q,
  locked,
  system,
  earlier,
  sections,
  sectionId,
  onChange,
  onMove,
}: {
  q: Question;
  locked: boolean;
  system: boolean;
  /** 이 질문보다 앞에 있는 질문(동의 제외) — 조건이 가리킬 수 있는 대상. */
  earlier: Question[];
  sections: TemplateSection[];
  sectionId: string;
  onChange: (next: Question) => void;
  onMove: (toSectionId: string) => void;
}) {
  const id = `q-${q.id}`;
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const count = (s: string | undefined) => Array.from((s ?? "").trim()).length;
  const isChoice = q.type === "radio" || q.type === "checkbox";
  const options = q.options ?? [];

  const setType = (type: QuestionType) => {
    // 유형이 바뀌면 그 유형에 맞지 않는 칸을 비운다.
    const kept: Question = { id: q.id, label: q.label, type, ...(q.ask ? { ask: q.ask } : {}), ...(q.help ? { help: q.help } : {}), ...(q.required ? { required: true } : {}) };
    if (q.sum) kept.sum = q.sum;
    if (q.detail) kept.detail = q.detail;
    if (q.showIf) kept.showIf = q.showIf;
    if (type === "radio" || type === "checkbox") kept.options = options.length >= 2 ? [...options] : ["선택지 1", "선택지 2"];
    if (type === "text") kept.max = 100;
    if (type === "textarea") kept.max = 500;
    if (type === "number") {
      kept.min = 0;
      kept.max = 9999;
    }
    if (TEXT_TYPES.includes(type) && q.ph) kept.ph = q.ph;
    onChange(kept);
  };
  const setOption = (i: number, v: string) => {
    const old = options[i];
    const next = options.map((o, k) => (k === i ? v : o));
    set({ options: next, ...(q.none === old ? { none: v } : {}) });
  };
  const removeOption = (i: number) => {
    const gone = options[i];
    set({ options: options.filter((_, k) => k !== i), ...(q.none === gone ? { none: undefined } : {}), ...(gone === OTHER ? { other: undefined } : {}) });
  };
  const moveOption = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    set({ options: next });
  };

  const target = q.showIf ? earlier.find((x) => x.id === q.showIf?.id) : undefined;
  const setTarget = (tid: string) => {
    if (!tid) return set({ showIf: undefined });
    const t = earlier.find((x) => x.id === tid);
    if (!t) return;
    if (t.type === "radio") set({ showIf: { id: tid, is: t.options?.[0] ?? "" } });
    else if (t.type === "checkbox") set({ showIf: { id: tid, anyExcept: t.none ?? t.options?.[0] ?? "" } });
    else set({ showIf: { id: tid, filled: true } });
  };
  const picked = q.showIf?.is != null ? [q.showIf.is] : (q.showIf?.in ?? []);
  const togglePick = (v: string) => {
    if (!q.showIf) return;
    const next = picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v];
    if (next.length === 0) return;
    set({ showIf: next.length === 1 ? { id: q.showIf.id, is: next[0] } : { id: q.showIf.id, in: (target?.options ?? []).filter((o) => next.includes(o)) } });
  };

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {locked && (
        <p className="rounded-lg bg-fill p-2 text-body-sm text-muted">
          {system ? "시스템 묶음의 질문" : "잠긴 질문"}입니다. 문구만 고칠 수 있어요.
          {isChoice && ` 선택지: ${options.join(" / ")}`}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <AdminField label="질문 문구" htmlFor={`${id}-ask`} hint={`폼에 크게 보이는 글 · ${count(q.ask)} / ${TEMPLATE_LIMITS.label}`}>
          <input id={`${id}-ask`} value={q.ask ?? ""} onChange={(e) => set({ ask: e.target.value })} maxLength={160} autoComplete="off" className={adminInputClass} />
        </AdminField>
        <AdminField label="짧은 이름" htmlFor={`${id}-label`} hint={`요약 · 관리자 화면에 쓰는 이름 · ${count(q.label)} / ${TEMPLATE_LIMITS.label}`}>
          <input id={`${id}-label`} value={q.label} onChange={(e) => set({ label: e.target.value })} maxLength={160} autoComplete="off" className={adminInputClass} />
        </AdminField>
      </div>
      <AdminField label="도움말" htmlFor={`${id}-help`} hint={`질문 아래 회색 글 · ${count(q.help)} / ${TEMPLATE_LIMITS.help}`}>
        <input id={`${id}-help`} value={q.help ?? ""} onChange={(e) => set({ help: e.target.value })} maxLength={400} autoComplete="off" className={adminInputClass} />
      </AdminField>
      {TEXT_TYPES.includes(q.type) && (
        <AdminField label="입력 예시" htmlFor={`${id}-ph`} hint={`입력칸에 흐리게 보이는 글 · ${count(q.ph)} / ${TEMPLATE_LIMITS.ph}`}>
          <input id={`${id}-ph`} value={q.ph ?? ""} onChange={(e) => set({ ph: e.target.value })} maxLength={160} autoComplete="off" className={adminInputClass} />
        </AdminField>
      )}

      {!locked && (
        <div className="grid gap-3 md:grid-cols-3">
          <AdminField label="유형" htmlFor={`${id}-type`}>
            <select id={`${id}-type`} value={q.type} onChange={(e) => setType(e.target.value as QuestionType)} className={adminInputClass}>
              {ADDABLE_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="묶음" htmlFor={`${id}-section`}>
            <select id={`${id}-section`} value={sectionId} onChange={(e) => onMove(e.target.value)} className={adminInputClass}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </AdminField>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end text-body-sm text-foreground">
            <input type="checkbox" checked={!!q.required} onChange={(e) => set({ required: e.target.checked || undefined })} className="h-5 w-5 shrink-0" />
            필수로 받기
          </label>
        </div>
      )}

      {!locked && isChoice && (
        <fieldset>
          <legend className="text-body-sm font-semibold text-foreground">
            선택지 {options.length}개 <span className="font-normal text-muted">(2~{TEMPLATE_LIMITS.options}개 · 하나에 {TEMPLATE_LIMITS.option}자까지)</span>
          </legend>
          <ol className="mt-1 flex flex-col gap-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-1">
                <input
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  maxLength={120}
                  aria-label={`선택지 ${i + 1}`}
                  autoComplete="off"
                  className={adminInputClass}
                />
                <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0} aria-label={`선택지 ${i + 1} 위로`} className={adminButtonClass("secondary")}>
                  ↑
                </button>
                <button type="button" onClick={() => moveOption(i, 1)} disabled={i === options.length - 1} aria-label={`선택지 ${i + 1} 아래로`} className={adminButtonClass("secondary")}>
                  ↓
                </button>
                <button type="button" onClick={() => removeOption(i)} disabled={options.length <= 2} aria-label={`선택지 ${i + 1} 삭제`} className={adminButtonClass("danger")}>
                  삭제
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => set({ options: [...options, `선택지 ${options.length + 1}`] })}
              disabled={options.length >= TEMPLATE_LIMITS.options}
              className={adminButtonClass("secondary")}
            >
              선택지 등록
            </button>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
              <input
                type="checkbox"
                checked={!!q.other}
                onChange={(e) => set(e.target.checked ? { other: true, options: options.includes(OTHER) ? options : [...options, OTHER] } : { other: undefined })}
                className="h-5 w-5 shrink-0"
              />
              「{OTHER}」 를 고르면 직접 입력 받기
            </label>
          </div>
          {q.type === "checkbox" && (
            <div className="mt-2 md:w-72">
              <AdminField label="혼자만 고르는 선택지" htmlFor={`${id}-none`} hint="예) 「없음」 — 고르면 나머지가 풀려요">
                <select id={`${id}-none`} value={q.none ?? ""} onChange={(e) => set({ none: e.target.value || undefined })} className={adminInputClass}>
                  <option value="">(없음)</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>
          )}
        </fieldset>
      )}

      {!locked && q.type === "number" && (
        <div className="grid gap-3 md:w-96 md:grid-cols-2">
          <AdminField label="가장 작은 값" htmlFor={`${id}-min`}>
            <input id={`${id}-min`} inputMode="numeric" value={q.min ?? 0} onChange={(e) => set({ min: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={adminInputClass} />
          </AdminField>
          <AdminField label="가장 큰 값" htmlFor={`${id}-max`}>
            <input id={`${id}-max`} inputMode="numeric" value={q.max ?? 9999} onChange={(e) => set({ max: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={adminInputClass} />
          </AdminField>
        </div>
      )}
      {!locked && (q.type === "text" || q.type === "textarea") && (
        <div className="grid items-end gap-3 md:grid-cols-3">
          <AdminField label="최소 글자 수" htmlFor={`${id}-minlen`} hint="0 이면 제한 없음">
            <input id={`${id}-minlen`} inputMode="numeric" value={q.min ?? 0} onChange={(e) => set({ min: Number(e.target.value.replace(/\D/g, "")) || undefined })} className={adminInputClass} />
          </AdminField>
          <AdminField label="최대 글자 수" htmlFor={`${id}-maxlen`} hint={`${q.type === "text" ? TEMPLATE_LIMITS.textMax : TEMPLATE_LIMITS.textareaMax}자까지`}>
            <input id={`${id}-maxlen`} inputMode="numeric" value={q.max ?? ""} onChange={(e) => set({ max: Number(e.target.value.replace(/\D/g, "")) || undefined })} className={adminInputClass} />
          </AdminField>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
            <input type="checkbox" checked={!!q.free} onChange={(e) => set({ free: e.target.checked || undefined })} className="h-5 w-5 shrink-0" />
            기호만 적어도 받기
          </label>
        </div>
      )}

      <AdminField label="요약 줄" htmlFor={`${id}-sum`} hint={`질문 아래 회색 상자 · 한 줄에 하나씩 · ${TEMPLATE_LIMITS.sumLines}줄까지`}>
        <textarea
          id={`${id}-sum`}
          value={(q.sum ?? []).join("\n")}
          onChange={(e) => set({ sum: e.target.value ? e.target.value.split("\n") : undefined })}
          rows={3}
          className={adminInputClass}
        />
      </AdminField>
      <AdminField label="전문" htmlFor={`${id}-detail`} hint={`「자세히 보기」 를 눌러야 펼쳐지는 글 · ${count(q.detail)} / ${TEMPLATE_LIMITS.detail}`}>
        <textarea id={`${id}-detail`} value={q.detail ?? ""} onChange={(e) => set({ detail: e.target.value || undefined })} rows={4} className={adminInputClass} />
      </AdminField>

      {!locked && (
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-body-sm font-semibold text-foreground">보이는 조건</legend>
          <AdminField label="어느 질문의 답을 볼까요" htmlFor={`${id}-cond`} hint="이 질문보다 앞에 있는 질문만 고를 수 있어요">
            <select id={`${id}-cond`} value={q.showIf?.id ?? ""} onChange={(e) => setTarget(e.target.value)} className={adminInputClass}>
              <option value="">항상 보임</option>
              {q.showIf && !target && <option value={q.showIf.id}>(앞에 없는 질문)</option>}
              {earlier.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </AdminField>
          {target?.type === "radio" && (
            <div className="mt-2">
              <p className="text-body-sm text-muted">아래에서 고른 답일 때만 이 질문이 보여요(여러 개 고를 수 있어요).</p>
              {(target.options ?? []).map((o) => (
                <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
                  <input type="checkbox" checked={picked.includes(o)} onChange={() => togglePick(o)} className="h-5 w-5 shrink-0" />
                  {o}
                </label>
              ))}
            </div>
          )}
          {target?.type === "checkbox" && q.showIf && (
            <div className="mt-2 md:w-72">
              <AdminField label="이것 말고 다른 것을 골랐을 때 보임" htmlFor={`${id}-except`}>
                <select
                  id={`${id}-except`}
                  value={q.showIf.anyExcept ?? ""}
                  onChange={(e) => set({ showIf: { id: q.showIf!.id, anyExcept: e.target.value } })}
                  className={adminInputClass}
                >
                  {(target.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </AdminField>
            </div>
          )}
          {target && target.type !== "radio" && target.type !== "checkbox" && <p className="mt-2 text-body-sm text-muted">「{target.label}」 에 답을 적었을 때만 이 질문이 보여요.</p>}
        </fieldset>
      )}
    </div>
  );
}
