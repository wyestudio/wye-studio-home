import assert from "node:assert/strict";
import { test } from "node:test";
import { LEADER_QUESTIONS } from "@/lib/groupForms/leaderSchema";
import { PARTICIPANT_FORM } from "@/lib/groupForms/schema";
import { defaultTemplate, flattenTemplate, leaderParts, lockedIds, validateTemplate, type FormKey, type FormTemplate } from "@/lib/groupForms/template";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ok = (key: FormKey, t: unknown): FormTemplate => {
  const res = validateTemplate(key, t);
  assert.ok("template" in res, "error" in res ? res.error : "");
  return res.template;
};
const err = (key: FormKey, t: unknown): string => {
  const res = validateTemplate(key, t);
  assert.ok("error" in res, "통과하면 안 되는 양식이 통과했다");
  return res.error;
};
const find = (t: FormTemplate, id: string) => t.sections.flatMap((s) => s.questions).find((q) => q.id === id)!;

test("기본 양식 3벌은 검사를 그대로 통과하고, 통과한 결과가 원래와 같다", () => {
  for (const key of ["leader", "participant", "review"] as const) {
    const base = defaultTemplate(key);
    assert.deepEqual(ok(key, clone(base)), clone(base), key);
  }
});

test("기본 양식을 풀면 지금 폼과 같은 질문 순서가 나온다", () => {
  assert.deepEqual(flattenTemplate(defaultTemplate("participant")).map((q) => q.id), PARTICIPANT_FORM.questions.map((q) => q.id));
  const parts = leaderParts(defaultTemplate("leader"));
  assert.deepEqual(parts.base.map((q) => q.id), ["date", "time", "groupName", "headcount", "groupKind", "leaderName", "phone"]);
  assert.deepEqual(parts.second.map((q) => q.id), ["date2", "time2"]);
  assert.deepEqual([...parts.before, ...parts.after].map((q) => q.id), LEADER_QUESTIONS.map((q) => q.id));
  assert.equal(parts.after[0].id, "level");
});

test("잠긴 질문 — 문구는 바뀌고 구조는 화면이 뭐라고 보내든 그대로다", () => {
  const t = clone(defaultTemplate("leader"));
  const team = find(t, "team") as unknown as Record<string, unknown>;
  team.ask = "팀을 어떻게 짤까요?";
  team.help = "새 도움말";
  team.options = ["아무거나", "바꿨다"];
  team.type = "text";
  team.required = false;
  delete team.locked;
  const out = find(ok("leader", t), "team");
  assert.equal(out.ask, "팀을 어떻게 짤까요?");
  assert.equal(out.help, "새 도움말");
  assert.equal(out.type, "radio");
  assert.equal(out.required, true);
  assert.equal(out.locked, true);
  assert.deepEqual(out.options, ["현장에서 랜덤 편성 (방탈출 횟수로 균등하게)", "직접 구성해서 전달", "상담 후 결정"]);
});

test("잠긴 질문과 시스템 묶음은 지울 수 없다", () => {
  const t = clone(defaultTemplate("leader"));
  const s = t.sections.find((x) => x.questions.some((q) => q.id === "team"))!;
  s.questions = s.questions.filter((q) => q.id !== "team" && q.id !== "teamHow");
  assert.match(err("leader", t), /지울 수 없어요/);

  const t2 = clone(defaultTemplate("leader"));
  t2.sections = t2.sections.filter((x) => x.system !== "second");
  assert.match(err("leader", t2), /지울 수 없어요/);

  const t3 = clone(defaultTemplate("leader"));
  t3.sections[0].questions.pop();
  assert.match(err("leader", t3), /더하거나 뺄 수 없어요/);

  const p = clone(defaultTemplate("participant"));
  p.sections[0].questions = p.sections[0].questions.filter((q) => q.id !== "phone");
  assert.match(err("participant", p), /전화번호/);
});

test("질문 추가 · 필수 변경 · 선택지 수정 · 삭제", () => {
  const t = clone(defaultTemplate("participant"));
  t.sections[0].questions.push(
    { id: "qfood", label: "못 먹는 음식", ask: "못 먹는 음식이 있나요?", type: "text", max: 50 } as never,
    { id: "qsize", label: "티셔츠 사이즈", type: "radio", required: true, options: ["S", "M", "L"] } as never
  );
  const out = ok("participant", t);
  assert.equal(find(out, "qfood").required, undefined);
  assert.equal(find(out, "qfood").max, 50);
  assert.deepEqual(find(out, "qsize").options, ["S", "M", "L"]);

  const r = clone(defaultTemplate("review"));
  const rec = find(r, "rec");
  rec.options = ["꼭 추천해요", "추천하지 않아요", "잘 모르겠어요"];
  rec.required = false;
  r.sections[0].questions = r.sections[0].questions.filter((q) => q.id !== "more");
  const out2 = ok("review", r);
  assert.equal(find(out2, "rec").options?.[0], "꼭 추천해요");
  assert.equal(find(out2, "rec").required, undefined);
  assert.equal(out2.sections[0].questions.some((q) => q.id === "more"), false);
});

test("새 질문에 전화번호 유형 · 모르는 칸은 들어가지 않는다", () => {
  const t = clone(defaultTemplate("participant"));
  t.sections[0].questions.push({ id: "qtel", label: "비상 연락처", type: "tel" } as never);
  assert.match(err("participant", t), /유형/);

  const t2 = clone(defaultTemplate("participant"));
  t2.sections[0].questions.push({ id: "qx", label: "메모 칸", type: "text", kind: "name", locked: true, width: 3, link: { href: "https://evil", label: "x" }, onclick: "alert(1)" } as never);
  const q = find(ok("participant", t2), "qx") as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(q).sort(), ["id", "label", "max", "type"]);
});

test("선택지 · 글자 수 · 이름 규칙", () => {
  const add = (q: Record<string, unknown>) => {
    const t = clone(defaultTemplate("review"));
    t.sections[0].questions.push(q as never);
    return validateTemplate("review", t);
  };
  assert.ok("error" in add({ id: "q1", label: "하나", type: "radio", options: ["혼자"] }));
  assert.ok("error" in add({ id: "q1", label: "중복", type: "radio", options: ["a", "a"] }));
  assert.ok("error" in add({ id: "q1", label: "기타 없음", type: "radio", options: ["a", "b"], other: true }));
  assert.ok("template" in add({ id: "q1", label: "기타 있음", type: "radio", options: ["a", "기타"], other: true }));
  assert.ok("error" in add({ id: "q1", label: "없음 틀림", type: "checkbox", options: ["a", "b"], none: "c" }));
  assert.ok("error" in add({ id: "q1", label: "너무 김", type: "text", max: 501 }));
  assert.ok("error" in add({ id: "q1", label: "x", type: "text" }));
  assert.ok("error" in add({ id: "1bad", label: "아이디", type: "text" }));
  assert.ok("error" in add({ id: "sat", label: "같은 아이디", type: "text" }));
  assert.ok("error" in add({ id: "q1", label: "범위", type: "number", min: 10, max: 5 }));
});

test("조건 — 앞에 있는 질문만, 그 질문의 선택지에 있는 값만", () => {
  const t = clone(defaultTemplate("review"));
  t.sections[0].questions.push({ id: "qwhy", label: "추천하지 않는 이유", type: "textarea", showIf: { id: "rec", is: "추천하지 않아요" } } as never);
  assert.deepEqual(find(ok("review", t), "qwhy").showIf, { id: "rec", is: "추천하지 않아요" });

  const bad = clone(t);
  (find(bad, "qwhy") as { showIf: unknown }).showIf = { id: "rec", is: "없는 값" };
  assert.match(err("review", bad), /선택지에 없어요/);

  // 가리키는 질문보다 앞으로 옮기면 안 된다
  const moved = clone(t);
  const qs = moved.sections[0].questions;
  qs.unshift(qs.pop()!);
  assert.match(err("review", moved), /앞에 있는 질문만/);

  // 조건이 걸린 질문의 선택지 글자를 바꾸면 조건을 고치라고 알려준다
  const renamed = clone(defaultTemplate("leader"));
  const pref = find(renamed, "contactPref");
  pref.options = pref.options!.map((o) => (o === "오픈카톡" ? "오픈채팅" : o));
  assert.match(err("leader", renamed), /오픈카톡/);
});

test("묶음 — 추가 · 이름 · 순서는 되고, 시스템 질문을 다른 묶음으로 옮기지는 못한다", () => {
  const t = clone(defaultTemplate("leader"));
  t.sections.push({ id: "extra", title: "추가 질문", questions: [{ id: "qmemo", label: "하고 싶은 말", type: "textarea" } as never] });
  t.sections[2].title = "신청하게 된 계기";
  const out = ok("leader", t);
  assert.equal(out.sections.at(-1)?.title, "추가 질문");
  assert.equal(out.sections[2].title, "신청하게 된 계기");

  const moved = clone(defaultTemplate("leader"));
  const date = moved.sections[0].questions.shift()!;
  moved.sections[2].questions.push(date);
  assert.ok("error" in validateTemplate("leader", moved));
});

test("잠긴 질문 목록", () => {
  const p = lockedIds("participant");
  for (const id of ["name", "phone", "nick", "age", "exp", "terms", "privacy", "phoneBox", "photo"]) assert.ok(p.has(id), id);
  const l = lockedIds("leader");
  for (const id of ["date", "phone", "date2", "team", "difficulty", "event", "repeat", "afterParty", "policy", "channel"]) assert.ok(l.has(id), id);
  assert.equal(l.has("purpose"), false);
  assert.deepEqual([...lockedIds("review")], ["sat"]);
});
