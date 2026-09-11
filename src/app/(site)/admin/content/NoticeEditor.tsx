"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveNotice, deleteNotice, type NoticeInput } from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";

/** datetime-local 입력값(로컬 시각)을 KST 기준 ISO 로 바꾼다. 서버는 UTC 로 돈다. */
function toIso(local: string): string | null {
  return local ? new Date(`${local}:00+09:00`).toISOString() : null;
}
function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

export type NoticeRow = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
  sort_order: number;
};

export function NoticeEditor({ notice, onDone }: { notice?: NoticeRow; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<NoticeInput>({
    id: notice?.id,
    title: notice?.title ?? "",
    body: notice?.body ?? "",
    is_pinned: notice?.is_pinned ?? false,
    published_at: notice?.published_at ?? null,
    sort_order: notice?.sort_order ?? 0,
  });
  const [published, setPublished] = useState(toLocal(notice?.published_at ?? null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await saveNotice({ ...form, published_at: toIso(published) });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onDone?.();
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    const result = await deleteNotice(form.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onDone?.();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <input
        className={field}
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="제목"
      />
      <textarea
        className={`${field} min-h-32`}
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        placeholder="내용 — 줄바꿈은 그대로 보이고, https:// 로 시작하는 주소는 자동으로 링크가 됩니다."
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">게시일</span>
          <input
            type="datetime-local"
            className={`${field} w-56`}
            value={published}
            onChange={(e) => setPublished(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
          />
          상단 고정
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">순서</span>
          <input
            type="number"
            className={`${field} w-20`}
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <p className="text-xs text-muted">
        게시일을 비우면 공개되지 않습니다(초안). 미래 시각을 넣으면 그때부터 보입니다.
      </p>

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "저장 중…" : form.id ? "저장" : "공지 추가"}
        </button>
        {form.id && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded border border-red-500/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
          >
            삭제
          </button>
        )}
        {onDone && (
          <button onClick={onDone} disabled={busy} className="rounded border border-border px-4 py-2 text-sm text-muted">
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
