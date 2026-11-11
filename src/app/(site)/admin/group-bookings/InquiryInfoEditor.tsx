"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInquiryInfo } from "./actions";

/**
 * 문의 상세 머리의 「모임 이름 · 담당자 · 인원」 줄. 고치기를 누르면 세 칸을 고칠 수 있다(2026-11-11 대표님).
 * 예상 금액은 접수 때 계산한 값 그대로다 — 인원을 바꿔도 다시 계산하지 않는다.
 */
export function InquiryInfoEditor({
  id,
  headcount,
  groupName,
  organizerName,
  statusTag,
}: {
  id: string;
  headcount: number;
  groupName: string | null;
  organizerName: string | null;
  /** 상태 꼬리표 — 보기 모드에서 인원 옆에 그대로 둔다. */
  statusTag: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(String(headcount));
  const [group, setGroup] = useState(groupName ?? "");
  const [organizer, setOrganizer] = useState(organizerName ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function cancel() {
    setCount(String(headcount));
    setGroup(groupName ?? "");
    setOrganizer(organizerName ?? "");
    setMessage("");
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      const res = await saveInquiryInfo({ id, headcount: Number(count), groupName: group, organizerName: organizer });
      if ("error" in res) return setMessage(res.error);
      setMessage("");
      setEditing(false);
      // 저장한 뒤 한 번만 새로 그린다 — 머리 · 담당자 칸 · 견적 칸에 같은 값이 여러 번 나온다.
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-body font-semibold">{groupName ?? organizerName ?? "이름 없음"}</span>
        {groupName && organizerName && <span className="text-body-sm text-muted">{organizerName}</span>}
        <span className="rounded-md bg-muted/20 px-2 py-0.5 text-micro text-muted">{headcount}명</span>
        {statusTag}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto rounded-md border border-border px-2 py-1 text-body-sm text-muted hover:text-foreground"
        >
          고치기
        </button>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-border bg-panel px-3 py-2 text-input outline-none focus:border-glow";
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
        <label className="flex flex-col gap-1 text-label text-muted">
          모임 이름
          <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="없으면 비워 두세요" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-label text-muted">
          담당자
          <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-label text-muted">
          인원
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <p className="text-body-sm text-muted">인원을 바꿔도 예상 금액은 접수 때 값 그대로입니다.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-body-sm text-muted hover:text-foreground"
        >
          취소
        </button>
        {message && <span className="text-body-sm text-danger">{message}</span>}
      </div>
    </div>
  );
}
