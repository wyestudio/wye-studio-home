"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminCard, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { CHECKLIST_TEMPLATE_MAX, cleanChecklistTemplate, type ChecklistTemplateItem } from "@/lib/groupToolRules";
import { saveChecklistTemplate } from "../actions";

/**
 * 체크리스트 양식 편집 — 항목 등록 · 수정 · 삭제 · 순서 바꾸기. 고친 뒤 「저장」 을 눌러야 반영된다.
 * 순서는 위 · 아래 버튼으로 바꾼다(끌기 없이도 키보드 · 터치로 된다).
 */
type Row = ChecklistTemplateItem & { id: number };

export function ChecklistTemplateEditor({ initial }: { initial: ChecklistTemplateItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initial.map((it, i) => ({ ...it, id: i })));
  const [nextId, setNextId] = useState(initial.length);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const plain = rows.map(({ label, owner }) => ({ label, owner }));
  const dirty = JSON.stringify(plain.map((r) => ({ label: r.label.trim(), owner: r.owner.trim() }))) !== saved;

  const edit = (id: number, key: "label" | "owner", value: string) => {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setNote(null);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    setRows((cur) => {
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setNote(null);
  };
  const add = () => {
    if (rows.length >= CHECKLIST_TEMPLATE_MAX) return setNote({ ok: false, text: `항목은 ${CHECKLIST_TEMPLATE_MAX}개까지 둘 수 있어요.` });
    setRows((cur) => [...cur, { id: nextId, label: "", owner: "" }]);
    setNextId(nextId + 1);
    setNote(null);
  };
  const save = () => {
    const res = cleanChecklistTemplate(plain);
    if ("error" in res) return setNote({ ok: false, text: res.error });
    startTransition(async () => {
      const out = await saveChecklistTemplate({ items: res.items });
      if ("error" in out) return setNote({ ok: false, text: out.error });
      setRows(res.items.map((it, i) => ({ ...it, id: i })));
      setNextId(res.items.length);
      setSaved(JSON.stringify(res.items));
      setNote({ ok: true, text: out.message ?? "저장했습니다." });
      router.refresh();
    });
  };

  return (
    <AdminCard title={`항목 ${rows.length}개`}>
      {rows.length === 0 && <p className="text-body-sm text-muted">항목이 없어요. 「항목 등록」 으로 넣어주세요. 비워 두면 확정된 단체에 체크리스트가 만들어지지 않습니다.</p>}
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <span className="w-6 shrink-0 pb-3 text-center text-body-sm tabular-nums text-muted" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <label htmlFor={`cl-label-${r.id}`} className="text-body-sm font-semibold text-foreground">
                  {i + 1}번 항목
                </label>
                <input
                  id={`cl-label-${r.id}`}
                  value={r.label}
                  onChange={(e) => edit(r.id, "label", e.target.value)}
                  maxLength={120}
                  placeholder="예) 명찰 출력"
                  autoComplete="off"
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <div className="w-full md:w-40">
                <label htmlFor={`cl-owner-${r.id}`} className="text-body-sm font-semibold text-foreground">
                  담당자 <span className="font-normal text-muted">(선택)</span>
                </label>
                <input
                  id={`cl-owner-${r.id}`}
                  value={r.owner}
                  onChange={(e) => edit(r.id, "owner", e.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  className={`${adminInputClass} mt-1`}
                />
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${i + 1}번 항목 위로`} className={adminButtonClass("secondary")}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`${i + 1}번 항목 아래로`}
                  className={adminButtonClass("secondary")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRows((cur) => cur.filter((x) => x.id !== r.id));
                    setNote(null);
                  }}
                  aria-label={`${i + 1}번 항목 삭제`}
                  className={adminButtonClass("danger")}
                >
                  삭제
                </button>
              </div>
            </div>
            <p className={`mt-1 pl-8 text-micro tabular-nums ${Array.from(r.label.trim()).length > 60 ? "text-danger" : "text-muted"}`}>
              {Array.from(r.label.trim()).length} / 60
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={add} className={adminButtonClass("secondary")}>
          항목 등록
        </button>
        <button type="button" onClick={save} disabled={pending || !dirty} className={adminButtonClass("primary")}>
          {pending ? "저장 중…" : "저장"}
        </button>
        {dirty && !pending && <span className="text-body-sm text-wait">저장하지 않은 변경이 있어요.</span>}
      </div>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`mt-2 text-body-sm ${note.ok ? "text-confirm" : "font-semibold text-danger"}`}>
          {note.ok ? note.text : `저장하지 못했습니다 — ${note.text}`}
        </p>
      )}
    </AdminCard>
  );
}
