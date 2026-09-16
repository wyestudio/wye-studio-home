"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignEditor, type CampaignRow } from "./CampaignEditor";
import { issueCoupons, importIssuedHandles } from "./actions";
import { formatCouponCode } from "@/lib/coupon";
import { formatKrw, formatDateFull } from "@/lib/format";
import { toCsv, downloadCsv, kstStamp } from "@/lib/csv";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

export type CouponRow = {
  id: string;
  campaign_id: string;
  code: string;
  issued_label: string | null;
  used_at: string | null;
  /** 인스타 등 외부 계정으로 배정된 경우 그 아이디 */
  issued_to_handle: string | null;
};

// 날짜 형식은 어드민 전체가 같아야 한다 — formatDateFull 하나만 쓴다.
const kst = formatDateFull;

function discountLabel(c: CampaignRow): string {
  if (c.discount_type === "fixed") return `${formatKrw(c.discount_value)} 할인`;
  const cap = c.max_discount_krw ? ` (최대 ${formatKrw(c.max_discount_krw)})` : "";
  // ⚠️ 새 할인 방식을 추가하면 여기도 같이 고쳐야 한다 — 안 그러면 정률로 잘못 표시된다.
  if (c.discount_type === "per_head") return `1인당 ${formatKrw(c.discount_value)} 할인${cap}`;
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
  // 발송 기록 CSV 반영 (캠페인별로 따로 들고 있는다)
  const [csvInputs, setCsvInputs] = useState<Record<string, string>>({});
  const [csvResult, setCsvResult] = useState<Record<string, string>>({});
  const [busyCsv, setBusyCsv] = useState<string | null>(null);

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
                      {c.stackable && <span className="ml-1.5 text-glow">· 중복 사용 가능</span>}
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

                    {/*
                      연동 도구(외부 DM 발송 페이지)를 쓰는 캠페인은 **발급이 아니라 기록 반영**이
                      필요하다.
                      ⚠️ 수동 발급 칸을 일부러 두지 않았다. 발급을 두 곳에서 하면 서로를 못 봐서
                         같은 코드가 두 사람에게 나간다. 발급은 외부 도구 한 곳에서만 한다.
                         (되살리려면 actions.ts 의 issueCouponToHandle 을 다시 붙이면 된다)
                    */}
                    {c.key && (
                      <div className="mb-3 rounded border border-border bg-background/40 p-3">
                        <p className="text-xs font-semibold">발송 기록 CSV 반영</p>
                        <p className="mt-1 text-[11px] text-muted">
                          외부 발송 도구에서 내보낸 CSV 를 붙여넣으면 「받아간 계정」에 반영됩니다.
                          같은 CSV 를 여러 번 넣어도 안전해요. 이미 다른 아이디가 적힌 코드는
                          덮어쓰지 않고 알려드립니다.
                          <br />
                          ⚠️ <strong className="text-foreground">이 쿠폰은 외부 도구에서만 발급합니다.</strong>{" "}
                          여기서 따로 발급하면 같은 코드가 두 사람에게 갈 수 있어요.
                        </p>
                        <textarea
                          className="mt-2 h-24 w-full rounded border border-border bg-background p-2 font-mono text-[11px]"
                          placeholder={'"코드","메모","발송여부","인스타아이디","발송일시"\n"E01Y-07TY",...'}
                          value={csvInputs[c.id] ?? ""}
                          onChange={(e) => setCsvInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busyCsv === c.id || !(csvInputs[c.id] ?? "").trim()}
                            onClick={async () => {
                              setBusyCsv(c.id);
                              setCsvResult((p) => ({ ...p, [c.id]: "" }));
                              const res = await importIssuedHandles(c.key!, csvInputs[c.id] ?? "");
                              setBusyCsv(null);
                              if ("error" in res) {
                                setCsvResult((p) => ({ ...p, [c.id]: `⚠️ ${res.error}` }));
                              } else {
                                const 부분 = [`반영 ${res.applied}건`, `이미 반영됨 ${res.unchanged}건`];
                                if (res.notFound.length) 부분.push(`없는 코드 ${res.notFound.length}건`);
                                if (res.conflicts.length)
                                  부분.push(`충돌 ${res.conflicts.length}건 — ${res.conflicts.join(", ")}`);
                                if (res.duplicateHandles.length)
                                  부분.push(`중복 아이디 ${res.duplicateHandles.length}건 — ${res.duplicateHandles.join(", ")}`);
                                setCsvResult((p) => ({ ...p, [c.id]: 부분.join(" · ") }));
                                setCsvInputs((p) => ({ ...p, [c.id]: "" }));
                              }
                              router.refresh();
                            }}
                            className="rounded border border-border px-3 py-2 text-xs hover:bg-muted/30 disabled:opacity-40"
                          >
                            {busyCsv === c.id ? "반영 중…" : "CSV 반영"}
                          </button>
                          {csvResult[c.id] && (
                            <span className="text-xs text-glow">{csvResult[c.id]}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {mine.length > 0 && (
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-muted">
                          발급된 코드 {mine.length}장 · 사용 {mine.filter((c) => c.used_at).length}장
                        </p>
                        {/*
                          제휴처에 코드를 넘길 때 쓴다. 화면에서 500장을 눈으로 옮겨 적으면
                          한 장만 틀려도 그 손님이 쿠폰을 못 쓴다.
                        */}
                        <button
                          type="button"
                          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted/30"
                          onClick={() =>
                            downloadCsv(
                              `쿠폰_${c.name}_${kstStamp()}.csv`,
                              toCsv(
                                ["코드", "메모", "사용여부", "사용일시"],
                                mine.map((cp) => [
                                  formatCouponCode(cp.code),
                                  cp.issued_label ?? "",
                                  cp.used_at ? "사용" : "미사용",
                                  cp.used_at ? kst(cp.used_at) : "",
                                ])
                              )
                            )
                          }
                        >
                          CSV 내려받기
                        </button>
                      </div>
                    )}

                    {mine.length > 0 && (
                      <div className="max-h-72 overflow-y-auto rounded border border-border">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-background text-left text-muted">
                            <tr>
                              <th className="px-3 py-2">코드</th>
                              <th className="px-3 py-2">받아간 계정</th>
                              <th className="px-3 py-2">메모</th>
                              <th className="px-3 py-2">사용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mine.map((cp) => (
                              <tr key={cp.id} className="border-t border-border/50">
                                <td className="px-3 py-1.5 font-mono">{formatCouponCode(cp.code)}</td>
                                <td className="px-3 py-1.5">
                                  {cp.issued_to_handle ? (
                                    <span className="text-glow">@{cp.issued_to_handle}</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
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
