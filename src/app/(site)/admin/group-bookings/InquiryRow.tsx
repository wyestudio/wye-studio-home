"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { INQUIRY_STATUSES } from "@/lib/groupBooking";
import { saveInquiryStatus } from "./actions";

/**
 * 문의 한 건의 상태·메모 칸.
 *
 * 저장은 눌러야 된다 — 상태를 고르는 순간 저장되게 하면, 목록을 훑다가 잘못 건드린
 * 것도 그대로 기록된다(되돌릴 방법이 없다).
 */
export function InquiryRow({
  id,
  status: initialStatus,
  memo: initialMemo,
}: {
  id: string;
  status: string;
  memo: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [memo, setMemo] = useState(initialMemo);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const dirty = status !== initialStatus || memo !== initialMemo;

  function save() {
    startTransition(async () => {
      const res = await saveInquiryStatus({ id, status, memo });
      setMessage("error" in res ? res.error : (res.message ?? "저장했습니다."));
    });
  }

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <Select
        value={status}
        onChange={setStatus}
        options={INQUIRY_STATUSES.map((s) => ({ value: s.code, label: s.label }))}
      />
      <textarea
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="응대 메모"
        className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-body-sm outline-none focus:border-glow"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-brand px-3 py-1.5 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {message && <span className="text-micro text-muted">{message}</span>}
      </div>
    </div>
  );
}
