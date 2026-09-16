"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatKrw } from "@/lib/format";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { SettlementResult, SettlementRow, SettlementSnapshot } from "@/lib/settlement";
import { saveSettlementSnapshot } from "./actions";

const CSV_HEADERS = [
  "예약번호", "프로그램", "회차", "예약인원", "쿠폰코드",
  "적용쿠폰", "총할인액", "잼핏할인액", "실입금액", "취소여부", "환불률", "보유액", "수수료(5%)", "잼핏쿠폰부담(50%)", "유입경로",
];

function csvRow(r: SettlementRow) {
  return [
    r.confirmationCode, r.themeName, r.sessionLabel, r.headcount, r.couponCode ?? "",
    r.allCoupons, r.discountKrw, r.partnerDiscountKrw, r.paidKrw,
    r.cancelled ? "취소" : "정상",
    r.refundRatio === null ? "" : `${Math.round(r.refundRatio * 100)}%`,
    r.retainedKrw, r.commissionKrw, r.partnerCouponShareKrw, r.utmSource ?? "",
  ];
}

/** 취소 건의 상태를 한 눈에. 환불률이 곧 우리가 못 받는 비율이다. */
function statusLabel(r: SettlementRow): { text: string; cls: string } {
  if (!r.cancelled) return { text: "정상", cls: "text-foreground" };
  if (r.refundRatio === null) return { text: "취소 (확인 필요)", cls: "text-amber-400" };
  if (r.refundRatio === 1) return { text: "취소 · 전액환불", cls: "text-muted" };
  return { text: `취소 · ${Math.round(r.refundRatio * 100)}% 환불`, cls: "text-amber-400" };
}

function Table({ rows, 제목 }: { rows: SettlementRow[]; 제목: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{제목}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-background/50">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">예약번호</th>
              <th className="px-3 py-2">회차</th>
              <th className="px-3 py-2 text-right">인원</th>
              <th className="px-3 py-2">쿠폰코드</th>
              <th className="px-3 py-2 text-right">실입금액</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">보유액</th>
              <th className="px-3 py-2 text-right">수수료</th>
              <th className="px-3 py-2 text-right">잼핏 쿠폰부담</th>
              <th className="px-3 py-2">유입경로</th>
            </tr>
          </thead>
          <tbody className="font-[family-name:var(--font-geist-mono)] tabular-nums">
            {rows.map((r) => {
              const st = statusLabel(r);
              return (
                <tr key={r.confirmationCode} className="border-b border-border/40">
                  <td className="px-3 py-2">{r.confirmationCode}</td>
                  <td className="px-3 py-2 text-muted">{r.sessionLabel}</td>
                  <td className="px-3 py-2 text-right">{r.headcount}</td>
                  <td className="px-3 py-2">
                    {r.allCoupons || "-"}
                    {r.partnerDiscountKrw > 0 && r.discountKrw !== r.partnerDiscountKrw && (
                      <span className="ml-1 text-[11px] text-muted">
                        (잼핏분 {formatKrw(r.partnerDiscountKrw)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{formatKrw(r.paidKrw)}</td>
                  <td className={`px-3 py-2 ${st.cls}`}>
                    {st.text}
                    {r.needsReview && <span className="ml-1" title="규정과 다르게 환불했을 수 있어요">⚠️</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{formatKrw(r.retainedKrw)}</td>
                  <td className="px-3 py-2 text-right font-bold text-glow">{formatKrw(r.commissionKrw)}</td>
                  <td className="px-3 py-2 text-right text-amber-400">
                    {r.partnerCouponShareKrw > 0 ? `−${formatKrw(r.partnerCouponShareKrw)}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.utmSource ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettlementPanel({
  data,
  months,
  snapshots,
}: {
  data: SettlementResult;
  months: string[];
  snapshots: SettlementSnapshot[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { rows, totals, deductions, month } = data;

  const 차감합계 = deductions.reduce((a, r) => a + r.commissionKrw, 0);
  const 정산전 = totals.commissionKrw;
  // 제6조 4항 — 잼핏의 쿠폰 부담분은 "양 당사자의 동의 하에" 상계할 수 있다.
  // 합의 전에는 상계하지 않은 금액을 지급해야 하므로 두 경우를 같이 보여준다.
  const 상계전 = 정산전 - 차감합계;
  const 상계후 = 상계전 - totals.partnerCouponShareKrw;
  const needsReview = [...rows, ...deductions].filter((r) => r.needsReview).length;

  function 내려받기() {
    const csv = toCsv(CSV_HEADERS, [
      ...rows.map(csvRow),
      ...(deductions.length > 0
        ? [[], ["※ 이전 달 정산분 중 이번 달 취소 — 차감 대상"], ...deductions.map(csvRow)]
        : []),
    ]);
    downloadCsv(`잼핏정산_${month}.csv`, csv);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-2">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => router.push(`/admin/settlement?month=${m}`)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                m === month
                  ? "border-glow bg-glow/10 text-foreground"
                  : "border-border bg-background/50 text-muted hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              {m.replace("-", ".")}
            </button>
          ))}
        </div>
        <button
          onClick={내려받기}
          disabled={rows.length === 0 && deductions.length === 0}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/30 disabled:opacity-40"
        >
          CSV 내려받기
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <p className="text-xs text-muted">성과 인정 예약</p>
          <p className="mt-1 text-2xl font-bold">{totals.count}건</p>
          <p className="mt-1 text-xs text-muted">{totals.headcount}명</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <p className="text-xs text-muted">보유액 합계</p>
          <p className="mt-1 text-2xl font-bold">{formatKrw(totals.retainedKrw)}</p>
          <p className="mt-1 text-xs text-muted">수수료의 기준</p>
        </div>
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <p className="text-xs text-muted">이번 달 수수료 (5%)</p>
          <p className="mt-1 text-2xl font-bold">{formatKrw(정산전)}</p>
        </div>
        <div className="rounded-lg border border-glow/40 bg-glow/5 p-4">
          <p className="text-xs text-muted">지급할 금액</p>
          <p className="mt-1 text-2xl font-bold text-glow">{formatKrw(상계전)}</p>
          <p className="mt-1 text-xs text-muted">
            {차감합계 > 0 ? `차감 −${formatKrw(차감합계)} 반영` : "상계 없이"}
          </p>
        </div>
      </div>

      {totals.partnerCouponShareKrw > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-background/50 p-4">
          <p className="mb-2 text-sm font-semibold">쿠폰 비용 상계 (제6조 3·4항)</p>
          <p className="mb-3 text-sm text-muted">
            <strong className="text-foreground">잼핏 쿠폰</strong> 할인비용은{" "}
            <strong className="text-foreground">잼핏 50% · 우리 50%</strong> 부담입니다. 다른 이벤트
            쿠폰(인스타 등)은 우리가 전액 부담하므로 여기 들어가지 않습니다.
            아래 금액은 <strong className="text-foreground">우리가 잼핏에게 받을 돈</strong>이고,
            계약은 이를 수수료와 상계할 수 있다고 정합니다 —
            다만 <strong className="text-foreground">&ldquo;양 당사자의 동의 하에&rdquo;</strong>이므로
            합의 전에는 상계하지 말고 수수료 전액을 지급한 뒤 따로 청구해야 합니다.
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded border border-border px-3 py-2">
              <dt className="text-xs text-muted">잼핏 쿠폰 할인액</dt>
              <dd className="mt-0.5 font-bold">
                {formatKrw(rows.reduce((a, r) => a + (r.retainedKrw > 0 ? r.partnerDiscountKrw : 0), 0))}
              </dd>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <dt className="text-xs text-muted">잼핏 부담 (50%)</dt>
              <dd className="mt-0.5 font-bold text-amber-400">
                {formatKrw(totals.partnerCouponShareKrw)}
              </dd>
            </div>
            <div className="rounded border border-glow/30 bg-glow/5 px-3 py-2">
              <dt className="text-xs text-muted">상계하면 지급액</dt>
              <dd className="mt-0.5 font-bold text-glow">{formatKrw(상계후)}</dd>
            </div>
          </dl>
        </div>
      )}

      {needsReview > 0 && (
        <p className="mb-6 rounded border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-sm text-amber-300">
          ⚠️ 환불 금액을 손으로 정했을 수 있는 건이 {needsReview}건 있습니다. 실제 환불액을 확인하고
          보유액이 맞는지 봐주세요 — 환불 금액은 따로 저장하지 않아 <strong>환불 규정대로</strong> 계산한
          값입니다.
        </p>
      )}

      <Table rows={rows} 제목={`${month.replace("-", "년 ")}월 신청분`} />
      <Table rows={deductions} 제목="이전 달 정산분 중 이번 달 취소 — 차기 정산에서 차감 (제7조 9항)" />

      {rows.length === 0 && deductions.length === 0 && (
        <p className="py-16 text-center text-muted">이 달에는 잼핏 쿠폰을 쓴 입금 완료 건이 없습니다.</p>
      )}

      {/*
        ⚠️ 보관은 **기록일 뿐**이다. 보관했다고 그 달이 잠기거나, 그 건이
           '정산 완료'로 분류되어 다음 달 계산에서 빠지거나 하지 않는다.
           그래서 버튼 이름도 '확정'이 아니라 '보관'이다.
      */}
      <div className="mt-10 rounded-lg border border-border bg-background/50 p-5">
        <h2 className="text-lg font-semibold">이 내역 보관</h2>
        <p className="mt-1 text-sm text-muted">
          정산 화면은 매번 <strong className="text-foreground">실시간으로 다시 계산</strong>합니다. 나중에
          데이터가 바뀌면 과거 달 숫자도 같이 바뀌므로, 잼핏에 보낸 시점의 내역을 그대로 남겨 둡니다.
          <br />
          <strong className="text-foreground">보관은 기록일 뿐입니다</strong> — 보관했다고 이 달이 잠기거나,
          그 건이 다음 달 계산에서 빠지거나 하지 않습니다. 몇 번이든 보관할 수 있습니다.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            placeholder="메모 (예: 잼핏에 메일로 전달)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              startSave(async () => {
                setSaveError(null);
                const res = await saveSettlementSnapshot(month, note);
                if ("error" in res) setSaveError(res.error);
                else {
                  setNote("");
                  router.refresh();
                }
              })
            }
            className="rounded-lg border border-glow/40 bg-glow/10 px-4 py-2 text-sm font-semibold hover:bg-glow/20 disabled:opacity-50"
          >
            {saving ? "보관 중…" : "이 내역 보관"}
          </button>
        </div>
        {saveError && (
          <p className="mt-2 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{saveError}</p>
        )}

        {snapshots.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">보관 시각</th>
                  <th className="px-3 py-2 text-right">건수</th>
                  <th className="px-3 py-2 text-right">수수료</th>
                  <th className="px-3 py-2 text-right">잼핏 쿠폰부담</th>
                  <th className="px-3 py-2">메모</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} className="border-t border-border/50">
                    <td className="px-3 py-2 tabular-nums">
                      {new Date(s.capturedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.totals.count}건</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatKrw(s.totals.commissionKrw)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-400">
                      {formatKrw(s.totals.partnerCouponShareKrw)}
                    </td>
                    <td className="px-3 py-2 text-muted">{s.note ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/30"
                        onClick={() =>
                          downloadCsv(
                            `잼핏정산_${s.month}_보관본.csv`,
                            toCsv(CSV_HEADERS, [
                              ...s.rows.map(csvRow),
                              ...(s.deductions.length > 0
                                ? [[], ["※ 차감 대상"], ...s.deductions.map(csvRow)]
                                : []),
                            ])
                          )
                        }
                      >
                        CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
