"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadRecipients,
  previewCouponSms,
  sendCoupons,
  type Recipient,
} from "./sendActions";
import { formatCouponCode } from "@/lib/coupon";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/**
 * 쿠폰 수동 발송.
 *
 * 자동 발송을 두지 않은 것은 의도된 것이다 — 쿠폰은 한 번 나가면 회수할 수 없다.
 * 운영자가 대상을 눈으로 확인하고 고른 뒤 직접 보낸다.
 */
export function SendPanel({
  campaigns,
  sessions,
  templates,
}: {
  campaigns: { id: string; name: string }[];
  sessions: { id: string; label: string }[];
  templates: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [paidOnly, setPaidOnly] = useState(true);

  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<
    { name: string; code: string; ok: boolean; detail: string }[] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setOutcomes(null);
    const result = await loadRecipients({ sessionId, campaignId, paidOnly });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setRecipients(result.recipients);
    // 아직 쿠폰을 안 받은 사람만 기본 선택 — 재발송으로 중복 지급되는 걸 막는다.
    setSelected(new Set(result.recipients.filter((r) => !r.assignedCode).map((r) => r.phoneHash)));
  }

  async function doPreview() {
    setError(null);
    const result = await previewCouponSms({ campaignId, templateKey, sampleName: "홍길동" });
    if (!result.ok) return setError(result.error);
    setPreview(result.text);
  }

  async function doSend() {
    setBusy(true);
    setError(null);
    setConfirming(false);
    const result = await sendCoupons({
      campaignId,
      templateKey,
      phoneHashes: [...selected],
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOutcomes(result.outcomes);
    router.refresh();
    await load();
  }

  const toggle = (hash: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <div>
          <label className="mb-1 block text-xs text-muted">쿠폰 종류</label>
          <select className={field} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">받을 사람 (회차 참여자)</label>
          <select className={field} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">문자 문구</label>
          <select className={field} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} />
          입금 확인된 사람만
        </label>
        <button
          onClick={load}
          disabled={busy || !campaignId || !sessionId}
          className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "불러오는 중…" : "대상 불러오기"}
        </button>
        <button onClick={doPreview} className="rounded border border-border px-4 py-2 text-sm">
          문구 미리보기
        </button>
      </div>

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">문구 미리보기</p>
            <button onClick={() => setPreview(null)} className="text-xs text-muted">닫기</button>
          </div>
          <pre className="whitespace-pre-wrap rounded bg-background p-3 text-sm">{preview}</pre>
          <p className="mt-2 text-xs text-muted">
            문구는 <strong>설정 › 문자 템플릿</strong>에서 고칠 수 있습니다. 쿠폰번호·기한·링크는
            사람마다 자동으로 바뀝니다.
          </p>
        </div>
      )}

      {outcomes && (
        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-sm font-semibold">
            발송 결과 — 성공 {outcomes.filter((o) => o.ok).length} · 실패{" "}
            {outcomes.filter((o) => !o.ok).length}
          </p>
          <div className="max-h-56 overflow-y-auto text-xs">
            {outcomes.map((o, i) => (
              <div key={i} className="flex justify-between border-b border-border/40 py-1">
                <span>{o.name || "(이름 없음)"} · {o.code || "-"}</span>
                <span className={o.ok ? "text-glow" : "text-red-400"}>{o.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recipients && (
        <div className="rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <p className="text-sm">
              대상 <strong>{recipients.length}</strong>명 · 선택{" "}
              <strong className="text-glow">{selected.size}</strong>명
              <span className="ml-2 text-muted">
                (이미 받은 사람 {recipients.filter((r) => r.assignedCode).length}명)
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(new Set(recipients.map((r) => r.phoneHash)))}
                className="rounded border border-border px-3 py-1.5 text-xs"
              >
                전체 선택
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded border border-border px-3 py-1.5 text-xs"
              >
                선택 해제
              </button>
              <button
                onClick={() => setConfirming(true)}
                disabled={busy || selected.size === 0}
                className="rounded bg-glow px-4 py-1.5 text-xs font-semibold text-glow-foreground disabled:opacity-50"
              >
                {selected.size}명에게 발송
              </button>
            </div>
          </div>

          {confirming && (
            <div className="border-b border-border bg-amber-500/10 p-4">
              <p className="text-sm font-semibold">{selected.size}명에게 쿠폰 문자를 보낼까요?</p>
              <p className="mt-1 text-xs text-muted">
                한 번 나간 쿠폰은 회수할 수 없습니다. 아직 쿠폰을 받지 않은 사람에게는 새 코드가
                배정되고, 이미 받은 사람에게는 같은 코드가 다시 갑니다.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={doSend}
                  className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground"
                >
                  네, 보냅니다
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded border border-border px-4 py-2 text-sm text-muted"
                >
                  아니요
                </button>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">전화번호</th>
                  <th className="px-3 py-2">접수번호</th>
                  <th className="px-3 py-2">배정된 쿠폰</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.phoneHash} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.phoneHash)}
                        onChange={() => toggle(r.phoneHash)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {r.name}
                      {!r.isRepresentative && (
                        <span className="ml-1.5 text-xs text-muted">동행</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">···{r.phone.slice(-4)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.confirmationCode}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.assignedCode ? (
                        <span className="text-amber-400">{formatCouponCode(r.assignedCode)}</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
