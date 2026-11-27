import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanNametagState, nametagRoster } from "@/lib/groupNametag";

test("상태 정리 — 아는 모양만 남긴다", () => {
  assert.equal(cleanNametagState(null), null);
  assert.equal(cleanNametagState({ people: "x" }), null);
  const s = cleanNametagState({
    edition: "halloween",
    experience: "beginner",
    zoom: 3,
    evil: "<script>",
    people: [
      { name: "  ez ", count: "12", box: { x: 10, y: 20, w: 30, h: 40, extra: 1 }, manualSize: 500, id: 9 },
      { name: "", count: 3 },
      { name: "<b>굵게</b>", count: -5, box: { x: "a" }, manualSize: null },
      "문자열",
      { name: "가".repeat(60), count: 1e12 },
    ],
  });
  assert.deepEqual(s, {
    edition: "regular",
    experience: "beginner",
    people: [
      { name: "ez", count: 12, box: { x: 10, y: 20, w: 30, h: 40 }, manualSize: 96 },
      { name: "<b>굵게</b>", count: 0, box: null, manualSize: null },
      { name: "가".repeat(40), count: 9_999_999, box: null, manualSize: null },
    ],
  });
  assert.equal(cleanNametagState({ people: Array.from({ length: 500 }, (_, i) => ({ name: `n${i}`, count: i })) })?.people.length, 300);
});

test("명단 정하기 — 저장이 없으면 설문 그대로", () => {
  const r = nametagRoster(null, [
    { nick: "ez", count: 1 },
    { nick: "민트", count: 60 },
  ]);
  assert.equal(r.fromSaved, false);
  assert.deepEqual(r.people.map((p) => [p.name, p.count]), [["ez", 1], ["민트", 60]]);
});

test("명단 정하기 — 저장해 둔 명찰을 쓰고 새 응답만 뒤에 더한다", () => {
  const saved = {
    edition: "christmas" as const,
    experience: "experienced" as const,
    people: [
      { name: "EZ!", count: 1, box: { x: 1, y: 2, w: 3, h: 4 }, manualSize: 30 }, // 닉네임을 고쳐 둠
      { name: "민트", count: 61, box: null, manualSize: null }, // 방수를 고쳐 둠
    ],
  };
  const r = nametagRoster(saved, [
    { nick: "ez", count: 1 },
    { nick: "민트", count: 60 },
    { nick: "뉴비", count: 0 },
  ]);
  assert.equal(r.fromSaved, true);
  // 'ez' 는 저장된 명찰에 같은 닉네임이 없어 새 응답으로 본다(고친 명찰은 그대로 둔다).
  assert.deepEqual(r.people.map((p) => p.name), ["EZ!", "민트", "ez", "뉴비"]);
  assert.equal(r.added, 2);
  assert.equal(r.people[0].manualSize, 30);
  assert.equal(r.people[1].count, 61);
});

test("명단 정하기 — 같은 닉네임이 둘이면 수만큼 맞춘다", () => {
  const saved = { edition: "regular" as const, experience: "experienced" as const, people: [{ name: "A", count: 1, box: null, manualSize: null }] };
  const r = nametagRoster(saved, [
    { nick: "A", count: 1 },
    { nick: "A", count: 2 },
  ]);
  assert.equal(r.people.length, 2);
  assert.equal(r.added, 1);
});

test("명단 정하기 — 닉네임을 고쳐 저장해도 원래 응답이 새 응답으로 붙지 않는다", () => {
  const saved = {
    edition: "regular" as const,
    experience: "experienced" as const,
    people: [
      { name: "EZ-고침", count: 0, box: null, manualSize: null },
      { name: "민트", count: 60, box: null, manualSize: null },
    ],
    seen: ["ez", "민트"],
  };
  const same = nametagRoster(saved, [
    { nick: "ez", count: 0 },
    { nick: "민트", count: 60 },
  ]);
  assert.deepEqual(same.people.map((p) => p.name), ["EZ-고침", "민트"]);
  assert.equal(same.added, 0);
  const more = nametagRoster(saved, [
    { nick: "ez", count: 0 },
    { nick: "민트", count: 60 },
    { nick: "뉴비", count: 3 },
  ]);
  assert.deepEqual(more.people.map((p) => p.name), ["EZ-고침", "민트", "뉴비"]);
  assert.equal(more.added, 1);
  assert.deepEqual(cleanNametagState({ people: [{ name: "a", count: 1 }], seen: ["a", 3, "b"] })?.seen, ["a", "b"]);
});
