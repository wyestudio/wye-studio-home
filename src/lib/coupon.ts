/**
 * 쿠폰 코드 정규화 — DB 의 normalize_coupon_code() 와 같은 규칙.
 *
 * 화면에서 미리 다듬어 보여주기 위한 것이고, 최종 판정은 서버(DB)가 한다.
 * 두 곳의 규칙이 어긋나면 화면에는 통과인데 실제로는 안 먹는 일이 생기므로
 * 바꿀 때는 반드시 같이 바꾼다.
 *
 * 코드 알파벳이 I·L·O·U 를 제외하고 만들어졌으므로, 이 글자가 들어왔다면
 * 오독이 확실하다. 1/1/0/V 로 되돌린다.
 */
export function normalizeCouponCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
}

/** 표시용 4-4 하이픈 (M0EHEVG1 → M0EH-EVG1). */
export function formatCouponCode(code: string): string {
  const n = normalizeCouponCode(code);
  return n.length === 8 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
}
