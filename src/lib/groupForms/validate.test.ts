/**
 * 공개 폼 검증 규칙 — 관리자 개편 docs/04 유효성 검사표. 돌리는 법: `npm test`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PARTICIPANT_FORM, REVIEW_FORM } from "@/lib/groupForms/schema";
import { charLen, cleanText, nicknameWidth, validateForm } from "@/lib/groupForms/validate";

const OK = { name: "이민지", phone: "010-1234-5678", nick: "ez", age: "25~29세", exp: "35", terms: true, privacy: true, phoneBox: true, photo: false };
const errs = (patch: Record<string, unknown>) => validateForm(PARTICIPANT_FORM, { ...OK, ...patch }).errors;

test("참가자 설문 — 올바른 답은 통과하고 전화번호는 숫자 11자리로 정리된다", () => {
  const r = validateForm(PARTICIPANT_FORM, OK);
  assert.deepEqual(r.errors, {});
  assert.equal(r.answers.phone, "01012345678");
});

test("이름 — 2~20자, 숫자 · 이모지 불가, 가운뎃점 · 하이픈 · 띄어쓰기는 가능", () => {
  assert.ok(errs({ name: "김" }).name);
  assert.ok(errs({ name: "김민수1" }).name);
  assert.ok(errs({ name: "김민수😀" }).name);
  assert.ok(errs({ name: "가".repeat(21) }).name);
  assert.equal(errs({ name: "Mary-Jane O'Neil" }).name, undefined);
  assert.equal(errs({ name: "  김   민수  " }).name, undefined);
});

test("전화번호 — 010 + 8자리만", () => {
  assert.ok(errs({ phone: "0212345678" }).phone);
  assert.ok(errs({ phone: "0101234567" }).phone);
  assert.ok(errs({ phone: "011-1234-5678" }).phone);
  assert.equal(errs({ phone: "010 1234 5678" }).phone, undefined);
});

test("닉네임 — 폭 12 이하(한글 8자 = 영어 12자), 기호는 가능", () => {
  assert.equal(nicknameWidth("가나다라마바사아"), 12);
  assert.equal(errs({ nick: "가나다라마바사아" }).nick, undefined);
  assert.ok(errs({ nick: "가나다라마바사아자" }).nick);
  assert.equal(errs({ nick: "abcdefghijkl" }).nick, undefined);
  assert.ok(errs({ nick: "abcdefghijklm" }).nick);
  assert.equal(errs({ nick: "★ez★" }).nick, undefined);
  assert.ok(errs({ nick: "   " }).nick);
});

test("방수 — 정수 0~9999", () => {
  assert.equal(errs({ exp: "0" }).exp, undefined);
  assert.equal(errs({ exp: "9999" }).exp, undefined);
  assert.ok(errs({ exp: "10000" }).exp);
  assert.ok(errs({ exp: "-1" }).exp);
  assert.ok(errs({ exp: "3.5" }).exp);
  assert.ok(errs({ exp: "" }).exp);
});

test("선택형 — 양식의 선택지에 없는 값은 거절", () => {
  assert.ok(errs({ age: "100세" }).age);
});

test("약관 — 필수 셋은 동의해야 하고 선택(사진 홍보)은 빼도 된다", () => {
  assert.ok(errs({ terms: false }).terms);
  assert.ok(errs({ privacy: "true" }).privacy); // 글자 'true' 는 동의가 아니다
  assert.equal(errs({ photo: false }).photo, undefined);
});

test("양식에 없는 열쇠는 버린다", () => {
  const r = validateForm(PARTICIPANT_FORM, { ...OK, admin: true, phone_hash: "x" });
  assert.equal("admin" in r.answers, false);
  assert.equal("phone_hash" in r.answers, false);
});

test("후기 — 별점 1~5, 주관식 2~500자, 개선할 점은 비워도 된다", () => {
  const ok = { age: "만 20~29세", fun: "마지막 문제", sat: 5, rec: "추천해요", why: "몰입됐어요", more: "" };
  assert.deepEqual(validateForm(REVIEW_FORM, ok).errors, {});
  assert.ok(validateForm(REVIEW_FORM, { ...ok, sat: 6 }).errors.sat);
  assert.ok(validateForm(REVIEW_FORM, { ...ok, sat: 0 }).errors.sat);
  assert.ok(validateForm(REVIEW_FORM, { ...ok, fun: "가" }).errors.fun);
  assert.ok(validateForm(REVIEW_FORM, { ...ok, why: "가".repeat(501) }).errors.why);
  assert.equal(validateForm(REVIEW_FORM, { ...ok, why: "가".repeat(500) }).errors.why, undefined);
});

test("정리 — 보이지 않는 문자는 지우고, 이모지를 잇는 글자는 남긴다. 글자 수는 유니코드 글자 단위", () => {
  assert.equal(cleanText("  a​b\u0000c  "), "abc");
  assert.equal(cleanText("👨‍👩‍👧"), "👨‍👩‍👧");
  assert.equal(charLen("한글😀"), 3);
});
