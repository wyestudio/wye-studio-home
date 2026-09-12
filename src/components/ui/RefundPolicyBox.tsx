import { REFUND_TIERS } from "@/lib/refundPolicy";

/**
 * 취소·환불 규정 안내.
 *
 * 신청 완료·참여내역 조회에서 같은 모양으로 쓴다. 규정 자체는
 * src/lib/refundPolicy.ts 한 곳에만 있다.
 *
 * 붉은 계열로 눈에 띄게 하되, 예전처럼 배경을 통째로 붉게 칠하지는 않는다 —
 * 이 화면의 다른 카드들과 이질적이라 '경고' 가 아니라 '오류' 처럼 읽혔다.
 * 테두리와 제목만 붉게 두고 표의 마지막 줄(환불 불가)만 강조한다.
 */
export function RefundPolicyBox() {
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/[0.07] p-5">
      <p className="text-sm font-bold text-danger">취소·환불 규정</p>

      <ul className="mt-3 space-y-1.5">
        {REFUND_TIERS.map((tier) => (
          <li key={tier.when} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-muted">{tier.when} 취소</span>
            <span
              className={
                tier.tone === "danger" ? "font-bold text-danger" : "font-semibold text-foreground"
              }
            >
              {tier.result}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-danger/20 pt-3 text-xs text-muted">
        취소는 참여 내역 조회에서 직접 하실 수 있고, 환불은 영업일 기준 3~5일 이내 처리됩니다.
        연락 없이 불참(노쇼)하시면 이후 신청이 제한될 수 있습니다.
      </p>
    </div>
  );
}
