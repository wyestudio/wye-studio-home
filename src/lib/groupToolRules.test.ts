import assert from "node:assert/strict";
import { test } from "node:test";
import { REPORT_DEFAULTS_BASE, cleanChecklistTemplate, cleanReportDefaults, groupMessageError } from "@/lib/groupToolRules";

test("안내 문자 문구 — 모르는 치환값 · 짝 안 맞는 블록을 막는다", () => {
  assert.equal(groupMessageError("안녕하세요 {{leader_name}}님\n{{#lines}}\n• {{label}}: {{amount}}\n{{/lines}}\n합계 {{total}}"), null);
  assert.match(groupMessageError("   ") ?? "", /비워둘 수 없/);
  assert.match(groupMessageError("{{leadername}} 님") ?? "", /\{\{leadername\}\}/);
  assert.match(groupMessageError("{{#items}}x{{/items}}") ?? "", /#items/);
  assert.match(groupMessageError("{{#lines}} {{label}}") ?? "", /짝/);
  assert.match(groupMessageError("가".repeat(2001)) ?? "", /2000자/);
  // 중괄호 한 겹은 그냥 글자다
  assert.equal(groupMessageError("{안내} 12월 {5}일"), null);
});

test("체크리스트 양식 — 길이와 개수", () => {
  assert.deepEqual(cleanChecklistTemplate([{ label: "  명찰   출력 ", owner: " TING " }, { label: "다과" }]), {
    items: [
      { label: "명찰 출력", owner: "TING" },
      { label: "다과", owner: "" },
    ],
  });
  assert.ok("error" in cleanChecklistTemplate([{ label: "" }]));
  assert.ok("error" in cleanChecklistTemplate([{ label: "가".repeat(61) }]));
  assert.ok("error" in cleanChecklistTemplate([{ label: "a", owner: "가".repeat(21) }]));
  assert.ok("error" in cleanChecklistTemplate(Array.from({ length: 31 }, () => ({ label: "a" }))));
  assert.ok("error" in cleanChecklistTemplate("x"));
  assert.deepEqual(cleanChecklistTemplate([]), { items: [] });
});

test("리포트 기본값 — 빠진 칸은 기본값, 넘친 칸은 거절", () => {
  assert.deepEqual(cleanReportDefaults(null), { value: REPORT_DEFAULTS_BASE });
  const ok = cleanReportDefaults({ host: "  MC  우쥬 ", games: ["미니게임", " ", "보물찾기"], extra: 1 }, true);
  assert.ok("value" in ok);
  assert.equal(ok.value.host, "MC 우쥬");
  assert.deepEqual(ok.value.games, ["미니게임", "보물찾기"]);
  assert.equal(ok.value.kicker, REPORT_DEFAULTS_BASE.kicker);
  assert.ok("error" in cleanReportDefaults({ host: "가".repeat(61) }, true));
  assert.ok("error" in cleanReportDefaults({ games: [] }, true));
  assert.ok("error" in cleanReportDefaults({ games: Array.from({ length: 9 }, (_, i) => `g${i}`) }, true));
  // 저장돼 있던 값이 이상하면(엄격하지 않게 읽을 때) 그 칸만 기본값으로
  const loose = cleanReportDefaults({ host: "가".repeat(61), sub: "우리 프로그램" });
  assert.ok("value" in loose);
  assert.equal(loose.value.host, REPORT_DEFAULTS_BASE.host);
  assert.equal(loose.value.sub, "우리 프로그램");
});
