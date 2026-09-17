"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPhoneDigits, formatPhoneInput } from "@/lib/phone";
import type { MarketingOptout } from "@/lib/marketingSmsServer";
import { addOptout, removeOptout } from "./actions";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/**
 * 수신거부 목록.
 *
 * 080 으로 들어온 거부는 솔라피가 받는다. 카카오톡·전화로 직접 거부를 받았거나
 * 솔라피 거부 내역을 옮겨 적을 때 여기에 등록한다. 등록된 번호는 동의 여부와
 * 관계없이 대상에서 빠진다.
 */
export function OptoutPanel({ optouts }: { optouts: MarketingOptout[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 해제는 실수 한 번에 다시 광고가 나가게 되므로 한 번 더 누르게 한다.
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await addOptout({ phone, note });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPhone("");
    setNote("");
    router.refresh();
  }

  async function remove(hash: string) {
    setBusy(true);
    setError(null);
    const res = await removeOptout(hash);
    setBusy(false);
    setPendingRemove(null);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">수신거부 목록</h2>
      <p className="mb-3 mt-1 text-xs text-muted">
        카카오톡·전화로 거부를 받았거나 솔라피 080 거부 내역을 옮길 때 등록합니다. 등록된 번호는
        광고 문자 대상에서 자동으로 빠집니다.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="optout-phone" className="mb-1 block text-xs text-muted">
            휴대폰 번호
          </label>
          <input
            id="optout-phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="010-0000-0000"
            className={field}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="optout-note" className="mb-1 block text-xs text-muted">
            메모(선택)
          </label>
          <input
            id="optout-note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 9/20 카카오톡으로 거부 요청"
            className={`${field} w-full`}
          />
        </div>
        <button
          onClick={add}
          disabled={busy || phone.replace(/\D/g, "").length < 10}
          className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          거부 등록
        </button>
      </div>

      {error && <p className="mt-2 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {optouts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">등록된 번호가 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/40 text-sm">
          {optouts.map((o) => (
            <li key={o.phoneHash} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="tabular-nums">{formatPhoneDigits(o.phone)}</span>
                {o.note && <span className="ml-2 text-xs text-muted">{o.note}</span>}
                <span className="ml-2 text-xs text-muted">
                  {new Date(o.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </span>
              </span>
              {pendingRemove === o.phoneHash ? (
                <span className="flex gap-2 text-xs">
                  <span className="text-muted">다시 광고를 받게 됩니다.</span>
                  <button onClick={() => remove(o.phoneHash)} disabled={busy} className="text-red-400">
                    해제
                  </button>
                  <button onClick={() => setPendingRemove(null)} className="text-muted">
                    취소
                  </button>
                </span>
              ) : (
                <button onClick={() => setPendingRemove(o.phoneHash)} className="text-xs text-muted">
                  해제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
