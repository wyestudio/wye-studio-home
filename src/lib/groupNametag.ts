/**
 * 명찰 제작기와 주고받는 값(관리자 개편 docs/02 9장). 전부 순수 함수다.
 *
 * 제작기는 대표님이 만든 단일 HTML 이고, 관리자 화면 안의 격리된 틀(iframe)에서 돈다. 주고받는 것은
 * **닉네임과 방수, 그리고 명찰 위의 글자 위치 · 크기**뿐이다. 이름 · 연락처는 넘기지 않는다.
 *
 * 고친 내용은 단체별로 저장한다(group_nametag_states). 설문 원본은 바꾸지 않는다.
 */
import { isNametagMode, type NametagMode } from "@/lib/groupTeams";

export const NAMETAG_FILE = "nametag-maker.html";
export const NAMETAG_BUCKET = "admin-tools";
export const NAMETAG_MAX_PEOPLE = 300;

export type NametagBox = { x: number; y: number; w: number; h: number };
export type NametagPerson = { name: string; count: number; box: NametagBox | null; manualSize: number | null };
export type NametagEdition = "regular" | "christmas";
export type NametagState = {
  edition: NametagEdition;
  experience: NametagMode;
  people: NametagPerson[];
  /**
   * 저장할 때 설문에 있던 닉네임들(서버가 채운다). 다시 열 때 "그 뒤에 들어온 응답" 을 가려내는 데 쓴다 —
   * 제작기에서 닉네임을 고쳐도(오타 수정 등) 원래 응답이 새 응답으로 잘못 붙지 않게.
   */
  seen?: string[];
};

const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

function cleanBox(raw: unknown): NametagBox | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const x = num(b.x, -100, 200);
  const y = num(b.y, -100, 200);
  const w = num(b.w, 1, 200);
  const h = num(b.h, 1, 200);
  return x == null || y == null || w == null || h == null ? null : { x, y, w, h };
}

/**
 * 제작기가 돌려준 상태를 저장하기 전에 **아는 모양만** 남긴다. 모양이 아니면 null.
 * 제작기 파일에서 온 값이라 그대로 믿지 않는다 — 열쇠 · 길이 · 범위를 여기서 다시 본다.
 */
export function cleanNametagState(raw: unknown): NametagState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.people)) return null;
  const experience = typeof s.experience === "string" && isNametagMode(s.experience) ? s.experience : "experienced";
  const edition: NametagEdition = s.edition === "christmas" ? "christmas" : "regular";
  const people: NametagPerson[] = [];
  for (const p of s.people.slice(0, NAMETAG_MAX_PEOPLE)) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    // 보이지 않는 글자를 빼고 40자까지. 기호는 막지 않는다(명찰에 그대로 찍히는 값).
    const name = Array.from(String(r.name ?? "").normalize("NFC").replace(/[\u0000-\u001F\u007F​‌⁠﻿]/g, "").trim()).slice(0, 40).join("");
    if (!name) continue;
    const count = Math.max(0, Math.min(9_999_999, Math.floor(Number(r.count) || 0)));
    people.push({ name, count, box: cleanBox(r.box), manualSize: r.manualSize == null ? null : num(r.manualSize, 0.1, 96) });
  }
  const seen = Array.isArray(s.seen)
    ? s.seen
        .filter((x): x is string => typeof x === "string")
        .slice(0, 600)
        .map((x) => Array.from(x).slice(0, 40).join(""))
    : undefined;
  return seen ? { edition, experience, people, seen } : { edition, experience, people };
}

/**
 * 제작기에 보낼 명단을 정한다.
 *   · 저장해 둔 것이 없으면 설문 명단 그대로.
 *   · 있으면 저장해 둔 명찰(고친 닉네임 · 위치 · 글자 크기)을 쓰고, 그 뒤에 들어온 설문 응답은 **뒤에 더한다**.
 *     "그 뒤에 들어온 응답" 은 저장할 때 설문에 없던 닉네임의 응답이다(같은 닉네임이 둘이면 수만큼 맞춘다).
 */
export function nametagRoster(
  saved: NametagState | null,
  survey: readonly { nick: string; count: number }[]
): { people: NametagPerson[]; fromSaved: boolean; added: number } {
  const fresh = (p: { nick: string; count: number }): NametagPerson => ({ name: p.nick, count: p.count, box: null, manualSize: null });
  if (!saved || saved.people.length === 0) return { people: survey.slice(0, NAMETAG_MAX_PEOPLE).map(fresh), fromSaved: false, added: 0 };
  // 저장할 때 설문에 있던 닉네임(seen)이 기준이다. 없으면(옛 저장본) 저장된 명찰의 닉네임으로 본다.
  const left = new Map<string, number>();
  for (const name of saved.seen ?? saved.people.map((p) => p.name)) left.set(name, (left.get(name) ?? 0) + 1);
  const extra: NametagPerson[] = [];
  for (const p of survey) {
    const n = left.get(p.nick) ?? 0;
    if (n > 0) left.set(p.nick, n - 1);
    else extra.push(fresh(p));
  }
  return { people: [...saved.people, ...extra].slice(0, NAMETAG_MAX_PEOPLE), fromSaved: true, added: extra.length };
}
