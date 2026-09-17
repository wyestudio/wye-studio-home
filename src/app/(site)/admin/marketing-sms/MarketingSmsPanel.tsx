"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPhoneDigits } from "@/lib/phone";
import {
  LMS_MAX_BYTES,
  NAME_PLACEHOLDER,
  SMS_MAX_BYTES,
  buildMarketingSms,
  isQuietHoursKst,
  smsBytes,
} from "@/lib/marketingSms";
import type { MarketingRecipient } from "@/lib/marketingSmsServer";
import { sendMarketingSms, type SendResult } from "./actions";

const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));

/**
 * 광고 문자 작성·발송.
 *
 * "(광고) 우주이스케이프" 머리말과 080 수신거부 꼬리말은 코드가 붙인다. 운영자가
 * 빠뜨리면 과태료 대상이라 입력칸에서 뺐다.
 */
export function MarketingSmsPanel({ recipients }: { recipients: MarketingRecipient[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  // 대상 조건을 이미 DB 가 걸렀으므로 기본은 전원 선택.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.map((r) => r.phoneHash))
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<SendResult, { ok: true }> | null>(null);

  const sampleName = recipients[0]?.name ?? "홍길동";
  const preview = useMemo(() => buildMarketingSms(body, sampleName), [body, sampleName]);
  const bytes = smsBytes(preview);
  const tooLong = bytes > LMS_MAX_BYTES;
  const quiet = isQuietHoursKst();

  const toggle = (hash: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  // ⚠️ 선택 수는 지금 목록에 남아 있는 사람만 센다. 수신거부 등록으로 목록이 새로
  //    그려지면 빠진 사람의 선택이 남아 "대상 1명 · 선택 2명" 으로 보였다.
  const chosen = recipients.filter((r) => selected.has(r.phoneHash)).map((r) => r.phoneHash);
  const allSelected = recipients.length > 0 && chosen.length === recipients.length;

  async function doSend() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await sendMarketingSms({ body, phoneHashes: chosen });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setError(res.error);
    setResult(res);
    router.refresh();
  }

  const canSend = !busy && !quiet && !tooLong && body.trim().length > 0 && chosen.length > 0;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <label htmlFor="marketing-body" className="mb-1 block text-sm font-semibold">
            문구
          </label>
          <p className="mb-2 text-xs text-muted">
            첫 줄은 &quot;(광고) 우주이스케이프&quot; 바로 뒤에 한 칸 띄고 이어집니다. 수신거부 안내는
            맨 끝에 자동으로 붙습니다. {NAME_PLACEHOLDER} 는 받는 사람 이름으로 바뀝니다.
          </p>
          <textarea
            id="marketing-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={`🚀 GRAND OPEN EVENT\n9/26 정식 오픈 기념, 인스타그램에서 5,000원 할인 이벤트를 진행합니다!`}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">받는 화면 미리보기</p>
            <span className={`text-xs ${tooLong ? "text-red-400" : "text-muted"}`}>
              {bytes}바이트 · {bytes > SMS_MAX_BYTES ? "장문(LMS)" : "단문(SMS)"}
            </span>
          </div>
          <pre className="whitespace-pre-wrap rounded bg-surface p-3 text-sm">{preview}</pre>
        </div>
      </div>

      {quiet && (
        <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
          지금은 밤 9시~아침 8시라 광고 문자를 보낼 수 없습니다(야간 광고는 별도 동의 필요).
        </p>
      )}
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {result && (
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="font-semibold text-glow">발송 완료 — {result.sent}건 접수</p>
          {result.failures.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-400">
              {result.failures.map((f, i) => (
                <li key={i}>
                  {f.name || "(이름 없음)"}: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-sm">
            대상 <strong>{recipients.length}</strong>명 · 선택{" "}
            <strong className="text-glow">{chosen.length}</strong>명
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(recipients.map((r) => r.phoneHash)))
              }
              className="rounded border border-border px-3 py-1.5 text-xs"
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </button>
            <button
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={!canSend}
              className="rounded bg-glow px-4 py-1.5 text-sm font-semibold text-glow-foreground disabled:opacity-50"
            >
              {busy ? "보내는 중…" : `${chosen.length}명에게 보내기`}
            </button>
          </div>
        </div>

        {recipients.length === 0 ? (
          <p className="p-4 text-sm text-muted">보낼 수 있는 사람이 없습니다.</p>
        ) : (
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="w-10 p-2" />
                  <th className="p-2">이름</th>
                  <th className="p-2">전화번호</th>
                  <th className="p-2">마지막 참여 회차</th>
                  <th className="p-2">참여 횟수</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.phoneHash} className="border-b border-border/40">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`${r.name} 선택`}
                        checked={selected.has(r.phoneHash)}
                        onChange={() => toggle(r.phoneHash)}
                      />
                    </td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 tabular-nums">{formatPhoneDigits(r.phone)}</td>
                    <td className="p-2">{kstDate(r.lastSessionStart)}</td>
                    <td className="p-2 tabular-nums">{r.participationCount}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        wide
        title={`${chosen.length}명에게 광고 문자를 보낼까요?`}
        message="보낸 문자는 되돌릴 수 없습니다. 아래 문구로 나갑니다."
        cancelLabel="아니요"
        confirmLabel={busy ? "보내는 중…" : "네, 보내기"}
        onCancel={() => setConfirming(false)}
        onConfirm={doSend}
        error={error}
        confirmDisabled={!canSend}
      >
        <pre className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-glass-border p-2 text-xs text-muted">
          {preview}
        </pre>
      </ConfirmDialog>
    </section>
  );
}
