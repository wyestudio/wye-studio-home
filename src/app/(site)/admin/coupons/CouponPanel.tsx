"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignEditor, type CampaignRow } from "./CampaignEditor";
import { issueCoupons } from "./actions";
import { formatCouponCode } from "@/lib/coupon";
import { formatKrw, formatDateFull } from "@/lib/format";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

export type CouponRow = {
  id: string;
  campaign_id: string;
  code: string;
  issued_label: string | null;
  used_at: string | null;
};

// 날짜 형식은 어드민 전체가 같아야 한다 — formatDateFull 하나만 쓴다.
const kst = formatDateFull;

function discountLabel(c: CampaignRow): string {
  if (c.discount_type === "fixed") return `${formatKrw(c.discount_value)} 할인`;
  const cap = c.max_discount_krw ? ` (최대 ${formatKrw(c.max_discount_krw)})` : "";
  return `${c.discount_value}% 할인${cap}`;
}

function periodLabel(c: CampaignRow): string {
  if (!c.valid_from && !c.valid_until) return "기간 제한 없음";
  const from = c.valid_from ? kst(c.valid_from) : "";
  const until = c.valid_until ? kst(c.valid_until) : "";
  return `${from} ~ ${until}`;
}

/** 캠페인 목록 + 코드 발급 + 사용 현황. */
export function CouponPanel({
  campaigns,
  coupons,
  themes,
}: {
  campaigns: CampaignRow[];
  coupons: CouponRow[];
  themes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [codesFor, setCodesFor] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState("");
  const [issueLabel, setIssueLabel] = useState("");
  const [issued, setIssued] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function issue(campaignId: string) {
    setBusy(true);
    setError(null);
    setIssued(null);
    const result = await issueCoupons({ campaignId, count, prefix, label: issueLabel });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setIssued(result.codes);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            setAdding((v) => !v);
            setOpenId(null);
          }}
          className="rounded border border-border px-3 py-1.5 text-sm"
        >
          {adding ? "취소" : "+ 쿠폰 종류 만들기"}
        </button>
      </div>

      {adding && (
        <div className="mb-4">
          <CampaignEditor themes={themes} onDone={() => setAdding(false)} />
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-border py-16 text-center text-sm text-muted">
          아직 만든 쿠폰이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => {
            const mine = coupons.filter((x) => x.campaign_id === c.id);
            const used = mine.filter((x) => x.used_at).length;
            return (
              <div key={c.id} className="rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.name}
                      {!c.is_active && <span className="ml-2 text-xs text-amber-400">중지됨</span>}
                      {c.restrict_to_issued_phone && (
                        <span className="ml-2 text-xs text-muted">본인 전용</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {discountLabel(c)} · {periodLabel(c)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm">
                      <strong>{mine.length}</strong>장 발급
                      <span className="ml-2 text-muted">
                        {used}장 사용 · {mine.length - used}장 남음
                      </span>
                    </p>
                    <button
                      onClick={() => {
                        setCodesFor(codesFor === c.id ? null : c.id);
                        setOpenId(null);
                        setIssued(null);
                      }}
                      className="rounded border border-border px-3 py-1.5 text-xs"
                    >
                      코드
                    </button>
                    <button
                      onClick={() => {
                        setOpenId(openId === c.id ? null : c.id);
                        setCodesFor(null);
                      }}
                      className="rounded border border-border px-3 py-1.5 text-xs"
                    >
                      수정
                    </button>
                  </div>
                </div>

                {openId === c.id && (
                  <div className="border-t border-border p-4">
                    <CampaignEditor campaign={c} themes={themes} onDone={() => setOpenId(null)} />
                  </div>
                )}

                {codesFor === c.id && (
                  <div className="border-t border-border p-4">
                    <div className="mb-3 flex flex-wrap items-end gap-2">
                      <div>
                        <label className="block text-xs text-muted mb-1">발급 수량</label>
                        <input
                          type="number"
                          className={`${field} w-24`}
                          value={count}
                          onChange={(e) => setCount(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">앞글자</label>
                        <input
                          className={`${field} w-20 uppercase`}
                          value={prefix}
                          maxLength={1}
                          onChange={(e) => setPrefix(e.target.value)}
                          placeholder="M"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">메모</label>
                        <input
                          className={`${field} w-32`}
                          value={issueLabel}
                          onChange={(e) => setIssueLabel(e.target.value)}
                          placeholder="본인 / 지인"
                        />
                      </div>
                      <button
                        onClick={() => issue(c.id)}
                        disabled={busy || count < 1}
                        className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
                      >
                        {busy ? "발급 중…" : `${count}장 발급`}
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-muted">
                      혼동하기 쉬운 글자(I·L·O·U)를 뺀 8자리로 만듭니다. 앞글자로 종류를 구분할 수 있어요.
                    </p>

                    {error && (
                      <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
                    )}
                    {issued && (
                      <div className="mb-3 rounded bg-glow/10 p-3">
                        <p className="mb-2 text-sm text-glow">{issued.length}장 발급했습니다.</p>
                        <textarea
                          readOnly
                          className="h-24 w-full rounded border border-border bg-background p-2 font-mono text-xs"
                          value={issued.map(formatCouponCode).join("\n")}
                        />
                        <p className="mt-1 text-xs text-muted">
                          복사해서 발송에 쓰세요. 이 목록은 아래 표에서 다시 볼 수 있습니다.
                        </p>
                      </div>
                    )}

                    {mine.length > 0 && (
                      <div className="max-h-72 overflow-y-auto rounded border border-border">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-background text-left text-muted">
                            <tr>
                              <th className="px-3 py-2">코드</th>
                              <th className="px-3 py-2">메모</th>
                              <th className="px-3 py-2">사용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mine.map((cp) => (
                              <tr key={cp.id} className="border-t border-border/50">
                                <td className="px-3 py-1.5 font-mono">{formatCouponCode(cp.code)}</td>
                                <td className="px-3 py-1.5 text-muted">{cp.issued_label ?? "-"}</td>
                                <td className="px-3 py-1.5">
                                  {cp.used_at ? (
                                    <span className="text-muted">{kst(cp.used_at)} 사용</span>
                                  ) : (
                                    <span className="text-glow">미사용</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
