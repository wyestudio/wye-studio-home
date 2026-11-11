"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OPTION } from "@/lib/groupPricing";
import { saveInquiryInfo } from "./actions";
import type { Inquiry } from "./inquiryParts";

type Opts = { icebreaking: boolean; character: boolean; after_party_hours: number; cleanup: boolean };

/** 저장된 구성 → 칸 값. 빠진 값은 견적 화면의 기본값(레크리에이션 포함, 나머지 없음)으로 채운다. */
function toOpts(o: Inquiry["options"]): Opts {
  return {
    icebreaking: o?.icebreaking !== false,
    character: !!o?.character,
    after_party_hours: o?.after_party_hours ?? 0,
    cleanup: !!o?.cleanup,
  };
}

/**
 * 문의 상세 머리의 「모임 이름 · 담당자 · 인원」 줄. 수정을 누르면 세 칸과 구성을 고칠 수 있다(2026-11-11 대표님).
 * 예상 금액은 접수 때 계산한 값 그대로다 — 인원 · 구성을 바꿔도 다시 계산하지 않는다.
 */
export function InquiryInfoEditor({
  id,
  headcount,
  groupName,
  organizerName,
  options,
  statusTag,
}: {
  id: string;
  headcount: number;
  groupName: string | null;
  organizerName: string | null;
  /** 견적 단계에서 고른 구성. v1 접수분은 null. */
  options: Inquiry["options"];
  /** 상태 꼬리표 — 보기 모드에서 인원 옆에 그대로 둔다. */
  statusTag: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(String(headcount));
  const [group, setGroup] = useState(groupName ?? "");
  const [organizer, setOrganizer] = useState(organizerName ?? "");
  const [opts, setOpts] = useState<Opts>(toOpts(options));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function cancel() {
    setCount(String(headcount));
    setGroup(groupName ?? "");
    setOrganizer(organizerName ?? "");
    setOpts(toOpts(options));
    setMessage("");
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      // 구성 없이 받은 접수분(v1)은 구성을 건드리지 않았으면 그대로 비워 둔다.
      const untouched = JSON.stringify(opts) === JSON.stringify(toOpts(null));
      const res = await saveInquiryInfo({
        id,
        headcount: Number(count),
        groupName: group,
        organizerName: organizer,
        options: options === null && untouched ? null : opts,
      });
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
          수정
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
      <fieldset className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
        <legend className="px-1 text-label text-muted">구성</legend>
        {(
          [
            ["icebreaking", "레크리에이션"],
            ["character", "캐릭터 꾸미기"],
            ["cleanup", "뒷정리"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-body-sm">
            <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-body-sm">
          애프터파티
          <select
            value={opts.after_party_hours}
            onChange={(e) => setOpts({ ...opts, after_party_hours: Number(e.target.value) })}
            className="rounded-lg border border-border bg-panel px-2 py-1 text-input"
          >
            {Array.from({ length: OPTION.afterParty.maxHours + 1 }, (_, h) => (
              <option key={h} value={h}>
                {h === 0 ? "없음" : `${h}시간`}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <p className="text-body-sm text-muted">인원 · 구성을 바꿔도 예상 금액은 접수 때 값 그대로입니다.</p>
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
