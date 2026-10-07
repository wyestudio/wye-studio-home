"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignEditor, type CampaignRow } from "./CampaignEditor";
import { issueCoupons, importIssuedHandles } from "./actions";
import { formatCouponCode } from "@/lib/coupon";
import { formatKrw, formatDateFull } from "@/lib/format";
import { toCsv, downloadCsv, kstStamp, parseCsv, readCsvFile, findIssueColumns } from "@/lib/csv";

const field = "rounded-md border border-border bg-background px-3 py-2 text-body-sm";

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

/**
 * 올린 CSV 를 반영 전에 요약한다.
 *
 * 줄 수만 보여주면 안 된다 — 발송 기록에는 「미발송」 줄이 섞여 있어(아이디가 비어 있다)
 * 300줄짜리 파일에서 실제로 반영되는 건 11건뿐인 일이 흔하다. 그 차이를 미리 보여줘야
 * 반영 결과를 보고 "덜 들어갔다"고 놀라지 않는다.
 */
function summarizeCsv(text: string): { rows: number; withHandle: number } | null {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return null;
  const { codeAt, handleAt } = findIssueColumns(parsed[0]);
  if (codeAt < 0 || handleAt < 0) return null;
  const body = parsed.slice(1);
  return {
    rows: body.length,
    withHandle: body.filter((r) => (r[codeAt] ?? "").trim() && (r[handleAt] ?? "").trim()).length,
  };
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
  const [csvNames, setCsvNames] = useState<Record<string, string>>({});
  const [csvResult, setCsvResult] = useState<Record<string, string>>({});
  const [busyCsv, setBusyCsv] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState<string | null>(null);

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

  /** 골라온 / 끌어다 놓은 파일을 읽어 반영 대기 상태로 만든다. */
  async function loadCsvFile(campaignId: string, file: File) {
    setCsvResult((p) => ({ ...p, [campaignId]: "" }));
    if (!/\.csv$/i.test(file.name)) {
      setCsvResult((p) => ({ ...p, [campaignId]: "⚠️ CSV 파일만 올릴 수 있어요." }));
      return;
    }
    const text = await readCsvFile(file);
    if (!text.trim()) {
      setCsvResult((p) => ({ ...p, [campaignId]: "⚠️ 파일이 비어 있어요." }));
      return;
    }
    setCsvInputs((p) => ({ ...p, [campaignId]: text }));
    setCsvNames((p) => ({ ...p, [campaignId]: file.name }));
  }

  function clearCsv(campaignId: string) {
    setCsvInputs((p) => ({ ...p, [campaignId]: "" }));
    setCsvNames((p) => ({ ...p, [campaignId]: "" }));
    setCsvResult((p) => ({ ...p, [campaignId]: "" }));
  }

  /** 들고 있는 CSV 내용을 반영한다. 파일·붙여넣기 두 경로가 이 함수를 같이 쓴다. */
  async function applyCsv(campaignId: string, campaignKey: string) {
    setBusyCsv(campaignId);
    setCsvResult((p) => ({ ...p, [campaignId]: "" }));
    const res = await importIssuedHandles(campaignKey, csvInputs[campaignId] ?? "");
    setBusyCsv(null);
    if ("error" in res) {
      setCsvResult((p) => ({ ...p, [campaignId]: `⚠️ ${res.error}` }));
    } else {
      // 건수는 전체를 쓰고, 뒤에 붙는 목록은 예시일 뿐이다(서버가 10개로 자른다).
      const 예시 = (전체: number, 목록: string[]) =>
        목록.length ? ` — ${목록.join(", ")}${전체 > 목록.length ? " …" : ""}` : "";
      const 부분 = [`반영 ${res.applied}건`, `이미 반영됨 ${res.unchanged}건`];
      if (res.notFoundCount)
        부분.push(`없는 코드 ${res.notFoundCount}건${예시(res.notFoundCount, res.notFound)}`);
      if (res.conflictCount)
        부분.push(`충돌 ${res.conflictCount}건${예시(res.conflictCount, res.conflicts)}`);
      if (res.duplicateHandleCount)
        부분.push(
          `중복 아이디 ${res.duplicateHandleCount}건${예시(res.duplicateHandleCount, res.duplicateHandles)}`
        );
      setCsvResult((p) => ({ ...p, [campaignId]: 부분.join(" · ") }));
      // 반영된 내용은 비운다 — 남겨두면 같은 파일을 또 누르게 된다.
      setCsvInputs((p) => ({ ...p, [campaignId]: "" }));
      setCsvNames((p) => ({ ...p, [campaignId]: "" }));
    }
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
          className="rounded-md border border-border px-3 py-1.5 text-body-sm"
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
        <div className="rounded-lg border border-border py-16 text-center text-body-sm text-muted">
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
                      {!c.is_active && <span className="ml-2 text-micro text-amber-400">중지됨</span>}
                      {c.restrict_to_issued_phone && (
                        <span className="ml-2 text-micro text-muted">본인 전용</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-micro text-muted">
                      {discountLabel(c)} · {periodLabel(c)}
                      {c.stackable && <span className="ml-1.5 text-glow">· 중복 사용 가능</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-body-sm">
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
                      className="rounded-md border border-border px-3 py-1.5 text-micro"
                    >
                      코드
                    </button>
                    <button
                      onClick={() => {
                        setOpenId(openId === c.id ? null : c.id);
                        setCodesFor(null);
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-micro"
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
                        <label className="block text-micro text-muted mb-1">발급 수량</label>
                        <input
                          type="number"
                          className={`${field} w-24`}
                          value={count}
                          onChange={(e) => setCount(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-micro text-muted mb-1">앞글자</label>
                        <input
                          className={`${field} w-20 uppercase`}
                          value={prefix}
                          maxLength={1}
                          onChange={(e) => setPrefix(e.target.value)}
                          placeholder="M"
                        />
                      </div>
                      <div>
                        <label className="block text-micro text-muted mb-1">메모</label>
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
                        className="rounded-md bg-glow px-4 py-2 text-body-sm font-semibold text-glow-foreground disabled:opacity-50"
                      >
                        {busy ? "발급 중…" : `${count}장 발급`}
                      </button>
                    </div>
                    <p className="mb-3 text-micro text-muted">
                      혼동하기 쉬운 글자(I·L·O·U)를 뺀 8자리로 만듭니다. 앞글자로 종류를 구분할 수 있어요.
                    </p>

                    {error && (
                      <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-body-sm text-red-400">{error}</p>
                    )}
                    {issued && (
                      <div className="mb-3 rounded-md bg-glow/10 p-3">
                        <p className="mb-2 text-body-sm text-glow">{issued.length}장 발급했습니다.</p>
                        <textarea
                          readOnly
                          className="h-24 w-full rounded-md border border-border bg-background p-2 font-mono text-micro"
                          value={issued.map(formatCouponCode).join("\n")}
                        />
                        <p className="mt-1 text-micro text-muted">
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
                      <div className="mb-3 rounded-md border border-border bg-background/40 p-3">
                        <p className="text-micro font-semibold">발송 기록 CSV 반영</p>
                        <p className="mt-1 text-micro text-muted">
                          외부 발송 도구에서 내보낸 CSV 파일을 그대로 올리면 「받아간 계정」에
                          반영됩니다. 같은 파일을 여러 번 올려도 안전해요. 이미 다른 아이디가 적힌
                          코드는 덮어쓰지 않고 알려드립니다.
                          <br />
                          ⚠️ <strong className="text-foreground">이 쿠폰은 외부 도구에서만 발급합니다.</strong>{" "}
                          여기서 따로 발급하면 같은 코드가 두 사람에게 갈 수 있어요.
                        </p>

                        {/*
                          파일을 끌어다 놓거나 골라서 올린다.
                          예전에는 CSV 를 편집기로 열어 텍스트로 붙여넣어야 했다 —
                          붙여넣기 칸은 아래에 접어서 남겨둔다(엑셀에서 몇 줄만 복사할 때 쓴다).
                        */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(c.id);
                          }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(null);
                            const f = e.dataTransfer.files?.[0];
                            if (f) void loadCsvFile(c.id, f);
                          }}
                          className={`mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-5 text-center ${
                            dragOver === c.id ? "border-glow bg-glow/5" : "border-border"
                          }`}
                        >
                          <p className="text-micro text-muted">CSV 파일을 여기에 끌어다 놓으세요</p>
                          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-micro hover:bg-muted/30">
                            파일 고르기
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void loadCsvFile(c.id, f);
                                e.target.value = ""; // 같은 파일을 다시 골라도 이벤트가 나게 한다
                              }}
                            />
                          </label>
                        </div>

                        {(csvInputs[c.id] ?? "").trim() &&
                          (() => {
                            const 요약 = summarizeCsv(csvInputs[c.id] ?? "");
                            return (
                              <p className="mt-2 rounded-md bg-glow/10 px-3 py-2 text-micro">
                                <strong>{csvNames[c.id] || "붙여넣은 내용"}</strong>
                                <span className="ml-2 text-muted">
                                  {요약
                                    ? `${요약.rows}줄 중 아이디가 적힌 ${요약.withHandle}건이 반영 대상입니다 — 아래 「CSV 반영」을 누르세요`
                                    : "「코드」·「인스타아이디」 칸을 찾지 못했어요. 파일을 확인해주세요."}
                                </span>
                              </p>
                            );
                          })()}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busyCsv === c.id || !(csvInputs[c.id] ?? "").trim()}
                            onClick={() => void applyCsv(c.id, c.key!)}
                            className="rounded-md border border-border px-3 py-2 text-micro hover:bg-muted/30 disabled:opacity-40"
                          >
                            {busyCsv === c.id ? "반영 중…" : "CSV 반영"}
                          </button>
                          {(csvInputs[c.id] ?? "").trim() && (
                            <button
                              type="button"
                              onClick={() => clearCsv(c.id)}
                              className="rounded-md border border-border px-3 py-2 text-micro text-muted hover:bg-muted/30"
                            >
                              비우기
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowPaste(showPaste === c.id ? null : c.id)}
                            className="text-micro text-muted underline"
                          >
                            {showPaste === c.id ? "붙여넣기 칸 접기" : "직접 붙여넣기"}
                          </button>
                          {csvResult[c.id] && (
                            <span
                              className={`text-micro ${
                                csvResult[c.id].startsWith("⚠️") ? "text-red-400" : "text-glow"
                              }`}
                            >
                              {csvResult[c.id]}
                            </span>
                          )}
                        </div>

                        {showPaste === c.id && (
                          <textarea
                            className="mt-2 h-24 w-full rounded-md border border-border bg-background p-2 font-mono text-micro"
                            placeholder={'"코드","메모","발송여부","인스타아이디","발송일시"\n"E01Y-07TY",...'}
                            value={csvInputs[c.id] ?? ""}
                            onChange={(e) => {
                              setCsvInputs((p) => ({ ...p, [c.id]: e.target.value }));
                              setCsvNames((p) => ({ ...p, [c.id]: "" }));
                            }}
                          />
                        )}
                      </div>
                    )}

                    {mine.length > 0 && (
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-micro text-muted">
                          발급된 코드 {mine.length}장 · 사용 {mine.filter((c) => c.used_at).length}장
                        </p>
                        {/*
                          제휴처에 코드를 넘길 때 쓴다. 화면에서 500장을 눈으로 옮겨 적으면
                          한 장만 틀려도 그 손님이 쿠폰을 못 쓴다.
                        */}
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1.5 text-micro hover:bg-muted/30"
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
                      <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                        <table className="w-full text-micro">
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
