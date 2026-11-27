import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReportFill, cleanReportState, reportDateText } from "@/lib/groupReport";

test("일시 글 — 요일과 끝나는 시각", () => {
  assert.equal(reportDateText("2026-12-03", "15:00", 180), "2026. 12. 03 (목) 15:00 – 18:00");
  assert.equal(reportDateText("2026-12-03", null, 180), "2026. 12. 03 (목)");
  assert.equal(reportDateText(null, "15:00", 180), "");
});

test("처음 채울 값 — 단체 정보와 팀 편성에서", () => {
  const fill = buildReportFill({
    title: "방사모 10월 정모",
    date: "2026-12-05",
    time: "15:30",
    headcount: 13,
    icebreaking: false,
    teams: [
      { name: "탈출 어벤져스 ★", slogan: "나가자! 1등!", members: ["a", "b"] },
      { name: "", slogan: "", members: ["c"] },
    ],
    people: [
      { id: "a", nick: "ez", count: 1 },
      { id: "b", nick: "민트", count: 2 },
      { id: "c", nick: "<b>굵게</b>", count: 3 },
    ],
  });
  assert.equal(fill.texts.title, "방사모 10월 정모 단체모임");
  assert.equal(fill.texts.v1, "2026. 12. 05 (토) 15:30 – 18:00");
  assert.equal(fill.texts.s1v, "13명");
  assert.equal(fill.texts.s4v, "150분");
  assert.match(fill.texts.v3, /MC NOIS/);
  assert.deepEqual(fill.teams, [
    { name: "탈출 어벤져스 ★", members: "ez · 민트", award: "", comment: '"나가자! 1등!"' },
    { name: "2팀", members: "<b>굵게</b>", award: "", comment: "" },
  ]);
  assert.equal(fill.games.length, 5);
  const noName = buildReportFill({ title: "", date: null, time: null, headcount: 8, icebreaking: true, teams: [], people: [] });
  assert.equal(noName.texts.title, "단체모임");
  assert.equal(noName.texts.brandKo, "우주이스케이프");
  assert.equal(noName.texts.v1, undefined);
  assert.equal(noName.texts.s4v, "180분");
});

test("저장 전 정리 — 사진은 반드시 빠지고 아는 모양만 남는다", () => {
  assert.equal(cleanReportState(null), null);
  assert.equal(cleanReportState({ teams: [], games: [{ name: "a" }] }), null);
  const s = cleanReportState({
    docId: "x",
    theme: "light",
    pri: "javascript:alert(1)",
    perPage: 7,
    photoPages: 99,
    photos: { hero: { src: "data:image/jpeg;base64,AAAA" } },
    texts: { title: "제목", "bad key!": "x", n: 3, long: "가".repeat(900) },
    games: [{ name: "게임1" }, { name: "게임2" }],
    teams: [
      { name: "A", members: "ez · 민트", award: "우승", comment: '"가자"', photo: { src: "data:image/jpeg;base64,BBBB" } },
      { name: "B" },
    ],
    scores: [["10", "20", "30"], ["5"]],
  });
  assert.ok(s);
  const text = JSON.stringify(s);
  assert.equal(text.includes("data:image"), false);
  assert.equal(text.includes("photo\""), false);
  assert.equal(s.theme, "light");
  assert.equal(s.pri, "#ffd84a");
  assert.equal(s.perPage, 9);
  assert.equal(s.photoPages, 8);
  assert.deepEqual(Object.keys(s.texts).sort(), ["long", "title"]);
  assert.equal(Array.from(s.texts.long).length, 500);
  assert.deepEqual(s.scores, [["10", "20"], ["5", "0"]]);
  assert.deepEqual(s.teams[1], { name: "B", members: "", award: "", comment: "" });
});
