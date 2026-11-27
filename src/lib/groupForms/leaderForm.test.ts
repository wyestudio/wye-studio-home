import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPending, consultItems, eventChecklistLabel, summaryRows, type LeaderGroupNow } from "@/lib/groupForms/leaderForm";
import { LEADER_ALL, LEADER_QUESTIONS, leaderFormDef } from "@/lib/groupForms/leaderSchema";
import { isVisible, validateForm } from "@/lib/groupForms/validate";

const now: LeaderGroupNow = { headcount: 16, date: "2026-12-05", time: "15:30", fixed: false, afterPartyHours: 1, cleanup: true };

test("견적과 같으면 다른 내용이 없다", () => {
  const a = { headcount: 16, date: "2026-12-05", time: "15:30", afterParty: "신청할게요", apHours: "1시간", cleanup: "예" };
  assert.deepEqual(buildPending(a, now, false), []);
});

test("인원 · 일시 · 애프터파티 · 정리 지원이 다르면 올린다", () => {
  const a = { headcount: 18, date: "2026-12-12", time: "19:30", afterParty: "신청할게요", apHours: "3시간", cleanup: "아니요" };
  const keys = buildPending(a, now, true).map((p) => p.key);
  assert.deepEqual(keys, ["headcount", "schedule", "after_party", "cleanup", "leader_name"]);
});

test("확정된 단체는 일시가 달라도 올리지 않는다", () => {
  const a = { headcount: 16, date: "2026-12-12", time: "19:30" };
  assert.deepEqual(buildPending(a, { ...now, fixed: true }, false), []);
});

test("미정 · 고민 중은 견적보다 늘리지 않는다", () => {
  assert.deepEqual(buildPending({ headcount: 16, afterParty: "아직 고민 중이에요", apHours: "3시간", cleanup: "예" }, { ...now, cleanup: false }, false), []);
  assert.deepEqual(buildPending({ headcount: 16, afterParty: "신청할게요", apHours: "아직 미정", cleanup: "아직 미정" }, now, false), []);
  assert.deepEqual(buildPending({ headcount: 16, afterParty: "신청할게요", apHours: "4시간 넘게 (별도 상담)" }, now, false), []);
});

test("애프터파티를 안 하겠다고 하면 0시간으로 올린다", () => {
  const p = buildPending({ headcount: 16, afterParty: "신청하지 않아요" }, now, false);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].key === "after_party" && p[0].hours, 0);
  assert.deepEqual(buildPending({ headcount: 16, afterParty: "신청하지 않아요" }, { ...now, afterPartyHours: 0, cleanup: false }, false), []);
});

test("상담이 필요한 내용", () => {
  const items = consultItems({
    headcount: 30,
    repeat: "프리오픈 참여자 있음",
    repeatN: "2명",
    apHours: "4시간 넘게 (별도 상담)",
    difficulty: "별도 상담 희망",
    team: "상담 후 결정",
  });
  assert.equal(items.length, 5);
  assert.deepEqual(consultItems({ headcount: 12, repeat: "없음", difficulty: "기본 난이도로 진행", team: "직접 구성해서 전달" }), []);
});

test("이벤트 체크리스트 줄은 60자를 넘지 않는다", () => {
  assert.equal(eventChecklistLabel({ event: ["없음"] }), null);
  assert.equal(eventChecklistLabel({}), null);
  assert.equal(eventChecklistLabel({ event: ["생일"], eventDetail: "민지님 생일" }), "이벤트 준비: 민지님 생일");
  const long = eventChecklistLabel({ event: ["생일"], eventDetail: "가".repeat(200) });
  assert.equal(Array.from(long ?? "").length, 60);
});

test("조건 문항 — 앞 답에 따라 보이고, 안 보이는 문항의 값은 버린다", () => {
  const q = (id: string) => LEADER_ALL.find((x) => x.id === id)!;
  assert.equal(isVisible(q("keyword"), { channel: "네이버·구글 등 검색" }), true);
  assert.equal(isVisible(q("keyword"), { channel: "소모임" }), false);
  assert.equal(isVisible(q("eventDetail"), { event: ["없음"] }), false);
  assert.equal(isVisible(q("eventDetail"), { event: ["생일"] }), true);
  assert.equal(isVisible(q("adult"), { byob: "예, BYOB 예정" }), true);
  assert.equal(isVisible(q("time2"), {}), false);

  const { answers } = validateForm(leaderFormDef(LEADER_QUESTIONS), { channel: "소모임", keyword: "몰래 넣은 값", team: "상담 후 결정", teamHow: "친한 사람끼리" });
  assert.equal(answers.keyword, undefined);
  assert.equal(answers.teamHow, undefined);
});

test("검증 — 기타 직접 입력 · 혼자만 고르는 선택지 · 목록에 없는 값", () => {
  const def = leaderFormDef(LEADER_QUESTIONS);
  const base = {
    expect: ["기타"],
    channel: "소모임",
    headRange: "6~9명",
    purpose: "생일",
    familiar: "대부분 서로 친함",
    level: "잘 모르겠음",
    difficulty: "기본 난이도로 진행",
    team: "상담 후 결정",
    display: "★",
    event: ["없음"],
    repeat: "없음",
    afterParty: "신청하지 않아요",
    contactPref: "문자",
    policy: true,
  };
  assert.match(validateForm(def, base).errors.expect ?? "", /기타 내용/);
  assert.deepEqual(validateForm(def, { ...base, expect__other: "사장님 추천" }).errors, {});
  assert.match(validateForm(def, { ...base, expect__other: "사장님 추천", event: ["없음", "생일"] }).errors.event ?? "", /혼자만/);
  assert.match(validateForm(def, { ...base, expect__other: "사장님 추천", team: "아무렇게나" }).errors.team ?? "", /선택지/);
  assert.match(validateForm(def, { ...base, expect__other: "사장님 추천", policy: false }).errors.policy ?? "", /동의/);
  // 오픈카톡을 고르면 링크가 https 여야 한다(선택 문항이라 비워도 된다).
  assert.match(validateForm(def, { ...base, expect__other: "사장님 추천", contactPref: "오픈카톡", openchat: "http://x.y" }).errors.openchat ?? "", /https/);
});

test("요약에는 이름 · 휴대폰 번호가 없다", () => {
  const rows = summaryRows({ groupName: "모임", headcount: 12, leaderName: "김서윤", phone: "01012345678", team: "상담 후 결정" });
  assert.equal(rows.some((r) => r.id === "leaderName" || r.id === "phone"), false);
  assert.equal(rows.some((r) => r.value.includes("김서윤") || r.value.includes("0101234")), false);
});
