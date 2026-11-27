"use client";

import { useState } from "react";
import { AdminField, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import {
  addChecklistItem,
  changeOrganizerName,
  makeChecklist,
  removeChecklistItem,
  setChecklistDone,
  setChecklistOwner,
  stepBackStage,
} from "../groupActions";
import { ActionNote, useGroupAction } from "./GroupDetailClient";

/**
 * 준비 체크리스트 — 단체가 확정되면 양식에서 복사돼 생긴다. 항목마다 담당자와 완료 체크, 단체별로 등록 · 삭제.
 * 행사 3일 전부터 남은 항목이 홈의 오늘 할 일(준비)에 올라온다.
 */
export function Checklist({
  id,
  confirmed,
  cancelled,
  items,
}: {
  id: string;
  confirmed: boolean;
  cancelled: boolean;
  items: { id: string; label: string; owner: string | null; done: boolean; auto: boolean }[];
}) {
  const { pending, note, run } = useGroupAction();
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState("");
  // 체크는 누른 즉시 화면에 반영한다(서버 답을 기다리는 동안 멈춘 것처럼 보이지 않게).
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const view = items.map((i) => (i.id in optimistic ? { ...i, done: optimistic[i.id] } : i));
  const left = view.filter((i) => !i.done).length;

  if (items.length === 0) {
    return (
      <div>
        <p className="text-body-sm text-muted">
          {confirmed
            ? "아직 체크리스트가 없어요. 관리자 개편 전에 확정된 단체라 자동으로 만들어지지 않았습니다."
            : "예약금이 들어와 확정되면 준비 체크리스트가 자동으로 만들어집니다."}
        </p>
        {confirmed && !cancelled && (
          <button type="button" disabled={pending} onClick={() => run(() => makeChecklist({ id }))} className={`${adminButtonClass("secondary")} mt-3`}>
            {pending ? "등록 중…" : "체크리스트 등록"}
          </button>
        )}
        <div className="mt-1">
          <ActionNote note={note} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-body-sm text-muted" aria-live="polite">
        {left === 0 ? "전부 끝났어요" : `${left}개 남음`} · 전체 {view.length}개
      </p>
      <ul className="divide-y divide-border">
        {view.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-2 py-1">
            <label className="flex min-h-11 min-w-0 flex-1 basis-48 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={i.done}
                disabled={pending || cancelled}
                onChange={() => {
                  const next = !i.done;
                  setOptimistic((o) => ({ ...o, [i.id]: next }));
                  run(() => setChecklistDone({ id, itemId: i.id, done: next }));
                }}
                className="h-5 w-5 shrink-0"
              />
              <span className={`min-w-0 text-body-sm ${i.done ? "text-muted line-through" : "text-foreground"}`}>
                {i.label}
                {i.auto && <span className="ml-1 text-micro text-muted">(자동)</span>}
              </span>
            </label>
            {editing === i.id ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () => setChecklistOwner({ id, itemId: i.id, owner: ownerDraft }),
                    () => setEditing(null)
                  );
                }}
              >
                <input value={ownerDraft} onChange={(e) => setOwnerDraft(e.target.value)} maxLength={20} aria-label={`${i.label} 담당자`} placeholder="담당자" autoComplete="off" className={`${adminInputClass} w-28`} />
                <button type="submit" disabled={pending} className={adminButtonClass("secondary")}>
                  저장
                </button>
              </form>
            ) : (
              !cancelled && (
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(i.id);
                      setOwnerDraft(i.owner ?? "");
                    }}
                    className="min-h-11 rounded-lg px-2 text-body-sm text-muted hover:text-foreground"
                  >
                    {i.owner ? `담당 ${i.owner}` : "담당자 등록"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => window.confirm(`「${i.label}」 항목을 삭제할까요?`) && run(() => removeChecklistItem({ id, itemId: i.id }))}
                    className="min-h-11 rounded-lg px-2 text-body-sm text-muted hover:text-danger"
                  >
                    삭제
                  </button>
                </span>
              )
            )}
          </li>
        ))}
      </ul>
      {!cancelled && (
        <form
          className="mt-3 flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addChecklistItem({ id, label, owner }),
              () => {
                setLabel("");
                setOwner("");
              }
            );
          }}
        >
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} aria-label="새 항목" placeholder="항목 직접 적기" autoComplete="off" className={`${adminInputClass} min-w-0 flex-1 basis-48`} />
          <input value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={20} aria-label="새 항목 담당자" placeholder="담당자 (선택)" autoComplete="off" className={`${adminInputClass} w-36`} />
          <button type="submit" disabled={pending} className={adminButtonClass("secondary")}>
            {pending ? "등록 중…" : "항목 등록"}
          </button>
        </form>
      )}
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </div>
  );
}

/** 단계 한 칸 되돌리기 — 문자를 잘못 복사해 단계가 넘어갔을 때. 한 번 더 묻는다. */
export function StageBackButton({ id, from, to }: { id: string; from: string; to: string }) {
  const { pending, note, run } = useGroupAction();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => window.confirm(`단계를 「${from}」 에서 「${to}」 로 되돌릴까요? 기록에 남습니다.`) && run(() => stepBackStage({ id }))}
        className={adminButtonClass("secondary")}
      >
        {pending ? "되돌리는 중…" : "한 단계 되돌리기"}
      </button>
      <span className="text-body-sm text-muted">단계는 문자 복사 · 입금 확인에 따라 넘어갑니다. 잘못 넘어갔을 때만 쓰세요.</span>
      <div className="basis-full">
        <ActionNote note={note} />
      </div>
    </div>
  );
}

/** 담당자 이름 변경 — 가려진 이름을 고치는 게 아니라 새 이름으로 바꾼다. */
export function OrganizerNameEditor({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { pending, note, run } = useGroupAction();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-11 text-body-sm text-glow underline">
        담당자가 바뀌었어요
      </button>
    );
  }
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => changeOrganizerName({ id, name }),
          () => {
            setName("");
            setOpen(false);
          }
        );
      }}
    >
      <AdminField label="새 담당자 이름" htmlFor="org-name" hint="연락처 변경은 모임장 신청서가 생기는 단계에 들어옵니다">
        <input id="org-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" className={adminInputClass} />
      </AdminField>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={adminButtonClass("secondary")}>
          닫기
        </button>
      </div>
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </form>
  );
}
