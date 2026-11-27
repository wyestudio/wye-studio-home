import assert from "node:assert/strict";
import { test } from "node:test";
import { fillTeams, moveMember, nametagColor, reconcileTeams, suggestTeams, teamCountFor, teamsText, type TeamPerson } from "@/lib/groupTeams";

// 시안의 test_teams.py 와 같은 시험 데이터: 방수 = (i * 37) % 300
const people = (n: number): TeamPerson[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nick: `닉${i}`, count: (i * 37) % 300 }));
const sizes = (n: number, k?: number) => suggestTeams(people(n), k).map((t) => t.members.length).sort((a, b) => a - b);

test("인원별 추천 팀 수와 팀당 인원 (시안 시나리오)", () => {
  assert.deepEqual(sizes(13), [3, 3, 3, 4]);
  assert.deepEqual(sizes(6), [3, 3]);
  assert.deepEqual(sizes(9), [3, 3, 3]);
  assert.deepEqual(sizes(14), [3, 3, 4, 4]);
  assert.deepEqual(sizes(17), [3, 3, 3, 4, 4]);
  assert.deepEqual(sizes(24), [4, 4, 4, 4, 4, 4]);
  assert.deepEqual(sizes(26), [4, 4, 4, 4, 5, 5]);
});

test("팀은 최대 6팀, 인원 차이는 1명 이내, 모두 한 번씩만 들어간다", () => {
  for (const n of [0, 1, 2, 5, 7, 13, 25, 60, 200]) {
    const teams = suggestTeams(people(n));
    assert.ok(teams.length >= 1 && teams.length <= 6);
    assert.equal(teams.length, teamCountFor(n));
    const s = teams.map((t) => t.members.length);
    assert.ok(Math.max(...s) - Math.min(...s) <= 1, `${n}명: ${s}`);
    const all = teams.flatMap((t) => t.members);
    assert.equal(all.length, n);
    assert.equal(new Set(all).size, n);
  }
});

test("팀 수를 정해 다시 나누면 팀명 · 구호는 남는다", () => {
  const first = suggestTeams(people(13)).map((t, i) => ({ ...t, name: i === 0 ? "탈출 어벤져스 ★" : "", slogan: i === 0 ? "나가자! 1등!" : "" }));
  const again = suggestTeams(people(13), 5, first);
  assert.equal(again.length, 5);
  assert.equal(again[0].name, "탈출 어벤져스 ★");
  assert.equal(again[0].slogan, "나가자! 1등!");
  assert.deepEqual(again.map((t) => t.members.length).sort(), [2, 2, 3, 3, 3]);
  assert.equal(suggestTeams(people(13), 99).length, 6);
  assert.equal(suggestTeams(people(13), 0).length, 1);
});

test("고수가 한 팀에 몰리지 않는다", () => {
  const ps: TeamPerson[] = [500, 400, 300, 200, 5, 4, 3, 2].map((count, i) => ({ id: `p${i}`, nick: `n${i}`, count }));
  const teams = suggestTeams(ps, 2);
  const tops = teams.map((t) => t.members.filter((id) => ["p0", "p1", "p2", "p3"].includes(id)).length);
  assert.deepEqual(tops, [2, 2]);
});

test("옮기기 · 미배정 · 자동 배치", () => {
  const ps = people(13);
  let teams = suggestTeams(ps);
  const who = teams[0].members[0];
  teams = moveMember(teams, who, 1);
  assert.equal(teams[0].members.includes(who), false);
  assert.equal(teams[1].members.at(-1), who);
  teams = moveMember(teams, who, -1);
  assert.equal(teams.some((t) => t.members.includes(who)), false);

  // 새 응답이 오면 미배정으로 모인다. 없어진 참가자는 빠진다.
  const next = [...ps.filter((p) => p.id !== "p3"), { id: "new", nick: "뉴비", count: 3 }];
  const rec = reconcileTeams(teams, next);
  assert.deepEqual(rec.free.sort(), ["new", who].sort());
  assert.equal(rec.teams.some((t) => t.members.includes("p3")), false);

  const filled = fillTeams(rec.teams, rec.free, next);
  assert.equal(filled.flatMap((t) => t.members).length, next.length);
  const s = filled.map((t) => t.members.length);
  assert.ok(Math.max(...s) - Math.min(...s) <= 1, String(s));
});

test("팀 명단 글", () => {
  const ps: TeamPerson[] = [
    { id: "a", nick: "ez", count: 1 },
    { id: "b", nick: "민트", count: 2 },
  ];
  const text = teamsText([{ name: "B팀", slogan: "가자", members: ["a", "b"] }, { name: "", slogan: "", members: [] }], ps);
  assert.equal(text, 'B팀 "가자"\nez, 민트\n\n2팀\n(팀원 없음)');
});

test("명찰 색 — 숙련자 · 초심자 기준", () => {
  const exp = (n: number) => nametagColor(n, "experienced");
  assert.deepEqual([0, 50, 51, 100, 101, 200, 201, 500, 501, 9999].map(exp), ["흰색", "흰색", "베이지색", "베이지색", "갈색", "갈색", "연회색", "연회색", "검회색", "검회색"]);
  const beg = (n: number) => nametagColor(n, "beginner");
  assert.deepEqual([0, 1, 10, 11, 20, 21, 50, 51, 300].map(beg), ["흰색", "베이지색", "베이지색", "갈색", "갈색", "연회색", "연회색", "검회색", "검회색"]);
});
