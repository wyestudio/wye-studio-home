import { randomBytes } from "node:crypto";

/**
 * 쿠폰 코드 생성.
 *
 * 알파벳은 대표님 명세(프리오픈 배치)와 동일하게 맞춘다 — 이미 발급된 80장과
 * 규격이 다르면 운영자가 두 종류를 구분해서 다뤄야 한다.
 *
 * 혼동 문자 I·L·O·U 를 뺀 32자다. 1/I/L, 0/O, V/U 오독을 막는다.
 * 32 = 2^5 이라 5비트를 그대로 한 글자에 대응시킬 수 있다 —
 * 나머지 연산(modulo)을 쓰지 않으므로 특정 글자가 더 자주 나오는 편향이 없다.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY_LENGTH = 7;

/**
 * @param prefix 코드 맨 앞 한 글자 (본인 M · 지인 F 처럼 종류를 눈으로 구분).
 *               비우면 본문만 8자로 만든다.
 */
export function generateCouponCode(prefix = ""): string {
  const head = prefix.toUpperCase().slice(0, 1);
  const length = head ? BODY_LENGTH : BODY_LENGTH + 1;

  // 한 글자에 5비트. 넉넉히 뽑아 5비트씩 잘라 쓴다.
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] & 0x1f];
  }
  return head + out;
}

/** 요청한 개수만큼 서로 겹치지 않는 코드를 만든다. DB 유니크 제약과는 별개의 1차 방어. */
export function generateUniqueCodes(count: number, prefix = ""): string[] {
  const set = new Set<string>();
  // 32^7 ≈ 344억이라 수백 장 규모에서 충돌은 사실상 없지만, 루프 상한은 둔다.
  for (let guard = 0; set.size < count && guard < count * 50; guard++) {
    set.add(generateCouponCode(prefix));
  }
  return [...set];
}
