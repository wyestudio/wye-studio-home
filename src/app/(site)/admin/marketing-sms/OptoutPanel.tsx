"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard, AdminEmpty, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { formatPhoneDigits, formatPhoneInput } from "@/lib/phone";
import type { MarketingOptout } from "@/lib/marketingSmsServer";
import { addOptout, removeOptout } from "./actions";

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
    <div className="space-y-4">
      <AdminCard title="수신거부 등록">
        <p className="mb-4 text-body-sm text-muted">
          카카오톡·전화로 거부를 받았거나 솔라피 080 거부 내역을 옮길 때 등록합니다. 등록된 번호는
          광고 문자 대상에서 자동으로 빠집니다.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="md:w-48">
            <label htmlFor="optout-phone" className="mb-1.5 block text-label font-semibold text-foreground">
              휴대폰 번호
            </label>
            <input
              id="optout-phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="010-0000-0000"
              className={adminInputClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="optout-note" className="mb-1.5 block text-label font-semibold text-foreground">
              메모(선택)
            </label>
            <input
              id="optout-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 9/20 카카오톡으로 거부 요청"
              className={adminInputClass}
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={busy || phone.replace(/\D/g, "").length < 10}
            className={`${adminButtonClass("primary")} whitespace-nowrap`}
          >
            거부 등록
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-body-sm text-danger">
            {error}
          </p>
        )}
      </AdminCard>

      {optouts.length === 0 ? (
        <AdminEmpty title="등록된 번호가 없어요" hint="080 수신거부는 솔라피가 받습니다. 직접 받은 거부만 위에서 등록합니다." />
      ) : (
        <ul className="rounded-xl border border-border bg-surface text-body-sm">
          {optouts.map((o) => (
            <li key={o.phoneHash} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2 last:border-0">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums text-foreground">{formatPhoneDigits(o.phone)}</span>
                <span className="ml-2 tabular-nums text-muted">
                  {new Date(o.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </span>
                {o.note && <span className="block break-words text-muted">{o.note}</span>}
              </span>
              {pendingRemove === o.phoneHash ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-wait">다시 광고를 받게 됩니다.</span>
                  <button type="button" onClick={() => remove(o.phoneHash)} disabled={busy} className={adminButtonClass("danger")}>
                    해제
                  </button>
                  <button type="button" onClick={() => setPendingRemove(null)} className={adminButtonClass("secondary")}>
                    취소
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setPendingRemove(o.phoneHash)} className={adminButtonClass("secondary")}>
                  해제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
