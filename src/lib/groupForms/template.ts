/**
 * 단체 설문 양식(관리자 개편 docs/04 5장) — 「단체 도구 › 설문 양식」 에서 고치는 양식의 모양과 규칙. 전부 순수 함수다.
 *
 * 양식 = 제목 + 묶음(섹션)들 + 묶음 안의 질문들. 버전 1 은 코드의 기본 양식(schema.ts · leaderSchema.ts)이고,
 * 운영자가 고치면 DB(group_form_templates)에 새 버전으로 쌓인다. 받은 답은 그때의 버전 번호와 함께 보관한다.
 *
 * 잠긴 질문(2026-11-27 대표님 — **문구만 고친다**)
 *   · 기본 양식에서 locked 가 붙은 질문과, 모임장 신청서의 「기본 정보」 · 「일정(2순위)」 묶음의 질문.
 *   · 고칠 수 있는 것: 질문 문구 · 짧은 이름 · 도움말 · 입력 예시 · 요약 줄 · 전문.
 *   · 고칠 수 없는 것: 삭제 · 유형 · 필수 여부 · 선택지 · 조건 · 글자 수. 시스템이 이 값들을 읽어 저장 · 금액 비교 · 상담 표시를 한다.
 *   → 잠긴 질문은 **기본 양식의 것을 그대로 가져오고 문구만 덮어쓴다.** 화면이 뭐라고 보내든 구조는 바뀌지 않는다.
 *
 * 새 질문의 유형에 「전화번호」 는 없다(2026-11-27 대표님) — 새 질문의 답은 암호화되지 않은 칸에 들어가기 때문이다.
 * 기존 전화번호 질문(참가자 전화번호 · 모임장 휴대폰 번호)은 잠긴 질문이라 그대로 받고 암호화해 저장한다.
 */
import { LEADER_BASE, LEADER_QUESTIONS, LEADER_SECOND } from "@/lib/groupForms/leaderSchema";
import { OTHER, PARTICIPANT_FORM, REVIEW_FORM, type Question, type QuestionType, type ShowIf } from "@/lib/groupForms/schema";

export type FormKey = "leader" | "participant" | "review";
export const FORM_KEYS: { key: FormKey; label: string }[] = [
  { key: "leader", label: "모임장용 신청서" },
  { key: "participant", label: "참가자용 사전 설문" },
  { key: "review", label: "모임 후기 설문" },
];
export const isFormKey = (v: string): v is FormKey => FORM_KEYS.some((f) => f.key === v);

export type TemplateSection = {
  id: string;
  title: string;
  /** 시스템 묶음 — 질문을 더하거나 빼거나 순서를 바꿀 수 없다. base: 견적에서 받은 값 · second: 미확정 단체에만 묻는 2순위 일정 */
  system?: "base" | "second";
  questions: Question[];
};
export type FormTemplate = { title: string; sections: TemplateSection[] };

/** 운영자가 새 질문에 고를 수 있는 유형. 전화번호(tel)는 없다. */
export const ADDABLE_TYPES: { type: QuestionType; label: string }[] = [
  { type: "text", label: "짧은 글" },
  { type: "textarea", label: "긴 글" },
  { type: "number", label: "숫자" },
  { type: "date", label: "날짜" },
  { type: "time", label: "시간" },
  { type: "radio", label: "하나 고르기" },
  { type: "checkbox", label: "여러 개 고르기" },
  { type: "scale", label: "별점" },
  { type: "agree", label: "동의" },
];
export const typeLabel = (t: QuestionType) => (t === "tel" ? "전화번호" : (ADDABLE_TYPES.find((x) => x.type === t)?.label ?? t));

export const TEMPLATE_LIMITS = {
  title: 40,
  sections: 20,
  sectionTitle: 30,
  questions: 60,
  label: 80,
  help: 200,
  ph: 80,
  sumLines: 6,
  sumLine: 120,
  detail: 3000,
  options: 20,
  option: 60,
  textMax: 500,
  textareaMax: 1000,
  numberMax: 1_000_000,
} as const;

const strip = (q: Question): Question => {
  const { section: _section, ...rest } = q;
  void _section;
  return { ...rest };
};

function group(questions: readonly Question[], fallback: string): TemplateSection[] {
  const out: TemplateSection[] = [];
  for (const q of questions) {
    const title = q.section ?? fallback;
    let s = out.find((x) => x.title === title);
    if (!s) {
      s = { id: `s${out.length + 1}`, title, questions: [] };
      out.push(s);
    }
    s.questions.push(strip(q));
  }
  return out;
}

/** 코드의 기본 양식(버전 1). */
export function defaultTemplate(key: FormKey): FormTemplate {
  if (key === "participant") {
    return {
      title: PARTICIPANT_FORM.title,
      sections: [
        { id: "info", title: "참가자 정보", questions: PARTICIPANT_FORM.questions.filter((q) => q.type !== "agree").map(strip) },
        { id: "terms", title: "약관", questions: PARTICIPANT_FORM.questions.filter((q) => q.type === "agree").map(strip) },
      ],
    };
  }
  if (key === "review") {
    return { title: REVIEW_FORM.title, sections: [{ id: "review", title: "모임 후기", questions: REVIEW_FORM.questions.map(strip) }] };
  }
  // 모임장 신청서 — 2순위 일정 묶음은 「모임 성격」 다음(방탈출 경험 수준 앞)에 둔다.
  const main = group(LEADER_QUESTIONS, "기타");
  const cut = main.findIndex((s) => s.questions.some((q) => q.id === "level"));
  const second: TemplateSection = { id: "second", title: "일정 (2순위 · 미확정 단체만)", system: "second", questions: LEADER_SECOND.map(strip) };
  const sections = cut < 0 ? [...main, second] : [...main.slice(0, cut), second, ...main.slice(cut)];
  return {
    title: "단체 예약 신청서 · 모임장용",
    sections: [{ id: "base", title: "기본 정보 (견적에서 받은 값)", system: "base", questions: LEADER_BASE.map(strip) }, ...sections],
  };
}

/** 묶음을 풀어 질문만 순서대로. 질문마다 묶음 이름(section)을 붙인다. */
export function flattenTemplate(t: FormTemplate, opts: { skip?: readonly ("base" | "second")[] } = {}): Question[] {
  return t.sections.filter((s) => !s.system || !(opts.skip ?? []).includes(s.system)).flatMap((s) => s.questions.map((q) => ({ ...q, section: s.title })));
}

/** 모임장 신청서의 세 갈래 — 기본 정보 · 2순위 일정 · 나머지(2순위 일정이 들어갈 자리 포함). */
export function leaderParts(t: FormTemplate): { base: Question[]; second: Question[]; before: Question[]; after: Question[] } {
  const tag = (s: TemplateSection) => s.questions.map((q) => ({ ...q, section: s.title }));
  const at = t.sections.findIndex((s) => s.system === "second");
  const plain = (list: TemplateSection[]) => list.filter((s) => !s.system).flatMap(tag);
  return {
    base: t.sections.filter((s) => s.system === "base").flatMap(tag),
    second: t.sections.filter((s) => s.system === "second").flatMap(tag),
    before: at < 0 ? plain(t.sections) : plain(t.sections.slice(0, at)),
    after: at < 0 ? [] : plain(t.sections.slice(at + 1)),
  };
}

// ── 검사 ─────────────────────────────────────────────────────────

const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌⁠﻿]/g;
const line = (v: unknown) => String(v ?? "").normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
const multi = (v: unknown) =>
  String(v ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const len = (s: string) => Array.from(s).length;
const ID_RE = /^[a-zA-Z][a-zA-Z0-9]{0,23}$/;
const SECTION_ID_RE = /^[a-z][a-z0-9]{0,15}$/;

type Fail = { error: string };
const fail = (error: string): Fail => ({ error });

/** 고칠 수 있는 글 칸만 화면 값으로 덮는다(잠긴 질문 · 안 잠긴 질문 공통). */
function textFields(raw: Record<string, unknown>, name: string): Partial<Question> | Fail {
  const L = TEMPLATE_LIMITS;
  const label = line(raw.label);
  if (len(label) < 2 || len(label) > L.label) return fail(`「${name}」 의 짧은 이름은 2~${L.label}자로 적어주세요.`);
  const ask = line(raw.ask);
  if (len(ask) > L.label) return fail(`「${name}」 의 질문 문구는 ${L.label}자까지 쓸 수 있어요.`);
  const help = line(raw.help);
  if (len(help) > L.help) return fail(`「${name}」 의 도움말은 ${L.help}자까지 쓸 수 있어요.`);
  const ph = line(raw.ph);
  if (len(ph) > L.ph) return fail(`「${name}」 의 입력 예시는 ${L.ph}자까지 쓸 수 있어요.`);
  const sum = (Array.isArray(raw.sum) ? raw.sum : []).map(line).filter(Boolean);
  if (sum.length > L.sumLines || sum.some((x) => len(x) > L.sumLine)) return fail(`「${name}」 의 요약은 ${L.sumLines}줄, 한 줄 ${L.sumLine}자까지 쓸 수 있어요.`);
  const detail = multi(raw.detail);
  if (len(detail) > L.detail) return fail(`「${name}」 의 전문은 ${L.detail}자까지 쓸 수 있어요.`);
  return {
    label,
    ...(ask ? { ask } : {}),
    ...(help ? { help } : {}),
    ...(ph ? { ph } : {}),
    ...(sum.length ? { sum } : {}),
    ...(detail ? { detail } : {}),
  };
}

const TEXT_KEYS = ["label", "ask", "help", "ph", "sum", "detail"] as const;

function cleanShowIf(raw: unknown): ShowIf | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = line(r.id);
  if (!ID_RE.test(id)) return null;
  if (r.filled === true) return { id, filled: true };
  if (typeof r.is === "string" && line(r.is)) return { id, is: line(r.is) };
  if (Array.isArray(r.in) && r.in.length) return { id, in: r.in.map(line).filter(Boolean) };
  if (typeof r.anyExcept === "string" && line(r.anyExcept)) return { id, anyExcept: line(r.anyExcept) };
  return null;
}

/** 안 잠긴 질문 하나를 정리한다 — 아는 칸만 옮겨 담는다. */
function cleanFreeQuestion(raw: Record<string, unknown>, id: string, base: Question | undefined): Question | Fail {
  const L = TEMPLATE_LIMITS;
  const name = line(raw.label) || id;
  const type = String(raw.type) as QuestionType;
  if (!ADDABLE_TYPES.some((t) => t.type === type)) return fail(`「${name}」 의 유형을 다시 골라주세요.`);
  const text = textFields(raw, name);
  if ("error" in text) return text;
  const q: Question = { id, label: text.label ?? name, type, ...text, ...(raw.required === true ? { required: true } : {}) };

  if (type === "radio" || type === "checkbox") {
    const options = (Array.isArray(raw.options) ? raw.options : []).map(line).filter(Boolean);
    if (options.length < 2 || options.length > L.options) return fail(`「${name}」 의 선택지는 2~${L.options}개로 넣어주세요.`);
    if (options.some((o) => len(o) > L.option)) return fail(`「${name}」 의 선택지는 ${L.option}자까지 쓸 수 있어요.`);
    if (new Set(options).size !== options.length) return fail(`「${name}」 에 같은 선택지가 두 번 있어요.`);
    q.options = options;
    if (raw.other === true) {
      if (!options.includes(OTHER)) return fail(`「${name}」 에서 직접 입력을 받으려면 선택지에 「${OTHER}」 를 넣어주세요.`);
      q.other = true;
    }
    if (type === "checkbox" && typeof raw.none === "string" && line(raw.none)) {
      const none = line(raw.none);
      if (!options.includes(none)) return fail(`「${name}」 의 「혼자만 고르는 선택지」 가 선택지 목록에 없어요.`);
      q.none = none;
    }
  }
  if (type === "number") {
    const min = raw.min == null || raw.min === "" ? 0 : Number(raw.min);
    const max = raw.max == null || raw.max === "" ? 9999 : Number(raw.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > L.numberMax || min > max) return fail(`「${name}」 의 숫자 범위를 확인해주세요(0~${L.numberMax}).`);
    q.min = min;
    q.max = max;
  }
  if (type === "text" || type === "textarea") {
    const cap = type === "text" ? L.textMax : L.textareaMax;
    const max = raw.max == null || raw.max === "" ? (type === "text" ? 100 : 1000) : Number(raw.max);
    const min = raw.min == null || raw.min === "" ? 0 : Number(raw.min);
    if (!Number.isInteger(max) || max < 1 || max > cap) return fail(`「${name}」 의 최대 글자 수는 1~${cap} 사이로 넣어주세요.`);
    if (!Number.isInteger(min) || min < 0 || min > max) return fail(`「${name}」 의 최소 글자 수를 확인해주세요.`);
    q.max = max;
    if (min > 0) q.min = min;
    if (raw.free === true) q.free = true;
    // 기본 양식에 있던 질문의 글 종류(링크 등)는 유형이 그대로일 때 유지한다. 새 질문에는 붙지 않는다.
    if (base?.kind && base.type === type) q.kind = base.kind;
  }
  const cond = cleanShowIf(raw.showIf);
  if (cond) q.showIf = cond;
  return q;
}

/**
 * 양식 전체를 정리 · 검사한다. 통과하면 저장해도 되는 양식을 돌려준다.
 * 화면(저장 전 안내)과 서버 액션(저장 직전) · 읽을 때(DB 에 있던 값이 여전히 맞는지)가 같은 함수를 쓴다.
 */
export function validateTemplate(key: FormKey, raw: unknown): { template: FormTemplate } | Fail {
  const L = TEMPLATE_LIMITS;
  const base = defaultTemplate(key);
  const baseById = new Map<string, { q: Question; system?: "base" | "second"; locked: boolean }>();
  for (const s of base.sections) for (const q of s.questions) baseById.set(q.id, { q, system: s.system, locked: !!q.locked || !!s.system });

  if (!raw || typeof raw !== "object") return fail("양식을 읽지 못했습니다.");
  const r = raw as Record<string, unknown>;
  const title = line(r.title);
  if (len(title) < 2 || len(title) > L.title) return fail(`양식 이름은 2~${L.title}자로 적어주세요.`);
  if (!Array.isArray(r.sections) || r.sections.length < 1 || r.sections.length > L.sections) return fail(`묶음은 1~${L.sections}개로 둘 수 있어요.`);

  const sections: TemplateSection[] = [];
  const seen = new Map<string, Question>();
  const sectionIds = new Set<string>();
  let total = 0;

  for (const rs of r.sections as unknown[]) {
    if (!rs || typeof rs !== "object") return fail("묶음을 읽지 못했습니다.");
    const s = rs as Record<string, unknown>;
    const id = String(s.id ?? "");
    if (!SECTION_ID_RE.test(id) || sectionIds.has(id)) return fail("묶음을 읽지 못했습니다. 화면을 새로고침한 뒤 다시 해주세요.");
    sectionIds.add(id);
    const sTitle = line(s.title);
    if (len(sTitle) < 1 || len(sTitle) > L.sectionTitle) return fail(`묶음 이름은 1~${L.sectionTitle}자로 적어주세요.`);
    const baseSection = base.sections.find((b) => b.id === id && b.system);
    const system = baseSection?.system;
    const list = Array.isArray(s.questions) ? (s.questions as unknown[]) : [];
    const questions: Question[] = [];

    if (system && baseSection) {
      // 시스템 묶음 — 기본 양식의 질문을 그 순서 그대로 쓰고 문구만 덮는다.
      for (const bq of baseSection.questions) {
        const rq = list.find((x) => x && typeof x === "object" && (x as { id?: unknown }).id === bq.id) as Record<string, unknown> | undefined;
        const text = textFields(rq ?? (bq as unknown as Record<string, unknown>), bq.label);
        if ("error" in text) return text;
        const kept: Question = { ...bq };
        for (const k of TEXT_KEYS) delete kept[k];
        questions.push({ ...kept, ...text } as Question);
      }
      if (list.length !== baseSection.questions.length) return fail(`「${sTitle}」 묶음에는 질문을 더하거나 뺄 수 없어요.`);
    } else {
      for (const rq of list) {
        if (!rq || typeof rq !== "object") return fail("질문을 읽지 못했습니다.");
        const q = rq as Record<string, unknown>;
        const qid = String(q.id ?? "");
        if (!ID_RE.test(qid)) return fail("질문을 읽지 못했습니다. 화면을 새로고침한 뒤 다시 해주세요.");
        const b = baseById.get(qid);
        if (b?.system) return fail(`「${b.q.label}」 은 원래 묶음에서 옮길 수 없어요.`);
        if (b?.locked) {
          const text = textFields(q, b.q.label);
          if ("error" in text) return text;
          const kept: Question = { ...b.q };
          for (const k of TEXT_KEYS) delete kept[k];
          questions.push({ ...kept, ...text } as Question);
        } else {
          const cleaned = cleanFreeQuestion(q, qid, b?.q);
          if ("error" in cleaned) return cleaned;
          questions.push(cleaned);
        }
      }
    }
    for (const q of questions) {
      if (seen.has(q.id)) return fail(`같은 질문(${q.label})이 두 번 들어 있어요.`);
      seen.set(q.id, q);
    }
    total += questions.length;
    sections.push({ id, title: sTitle, ...(system ? { system } : {}), questions });
  }

  if (total > L.questions) return fail(`질문은 ${L.questions}개까지 둘 수 있어요.`);
  for (const b of base.sections.filter((x) => x.system)) {
    if (!sections.some((s) => s.id === b.id)) return fail(`「${b.title}」 묶음은 지울 수 없어요.`);
  }
  for (const [id, b] of baseById) {
    if (b.locked && !seen.has(id)) return fail(`「${b.q.label}」 은 시스템이 쓰는 질문이라 지울 수 없어요.`);
  }

  // 조건 — 가리키는 질문이 **앞에** 있어야 하고, 값이 그 질문의 선택지에 있어야 한다.
  const order = sections.flatMap((s) => s.questions);
  const pos = new Map(order.map((q, i) => [q.id, i]));
  for (const [i, q] of order.entries()) {
    const c = q.showIf;
    if (!c) continue;
    const target = seen.get(c.id);
    const at = pos.get(c.id);
    if (!target || at == null) return fail(`「${q.label}」 의 조건이 가리키는 질문이 없어요. 조건을 다시 골라주세요.`);
    if (at >= i) return fail(`「${q.label}」 의 조건은 그보다 앞에 있는 질문만 가리킬 수 있어요(지금은 「${target.label}」 이 뒤에 있어요).`);
    if (target.type === "agree") return fail(`「${q.label}」 의 조건은 동의 문항을 가리킬 수 없어요.`);
    const options = target.options ?? [];
    const missing = (v: string) => `「${q.label}」 의 조건 값 「${v}」 이(가) 「${target.label}」 의 선택지에 없어요.`;
    if (c.is != null) {
      if (target.type !== "radio") return fail(`「${q.label}」 의 조건(답이 ○○일 때)은 「하나 고르기」 질문에만 걸 수 있어요.`);
      if (!options.includes(c.is)) return fail(missing(c.is));
    } else if (c.in) {
      if (target.type !== "radio") return fail(`「${q.label}」 의 조건(답이 ○○ 중 하나일 때)은 「하나 고르기」 질문에만 걸 수 있어요.`);
      const bad = c.in.find((v) => !options.includes(v));
      if (bad) return fail(missing(bad));
    } else if (c.anyExcept != null) {
      if (target.type !== "checkbox") return fail(`「${q.label}」 의 조건(○○ 말고 다른 것을 골랐을 때)은 「여러 개 고르기」 질문에만 걸 수 있어요.`);
      if (!options.includes(c.anyExcept)) return fail(missing(c.anyExcept));
    }
  }
  return { template: { title, sections } };
}

/** 지금 양식에서 그 질문이 잠겼는가(편집 화면이 쓴다). */
export function lockedIds(key: FormKey): Set<string> {
  const out = new Set<string>();
  for (const s of defaultTemplate(key).sections) for (const q of s.questions) if (q.locked || s.system) out.add(q.id);
  return out;
}
