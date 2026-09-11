"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveFaq, deleteFaq, type FaqInput } from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  is_visible: boolean;
  sort_order: number;
};

export function FaqEditor({ faq, onDone }: { faq?: FaqRow; onDone?: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<FaqInput>({
    id: faq?.id,
    question: faq?.question ?? "",
    answer: faq?.answer ?? "",
    category: faq?.category ?? "",
    is_visible: faq?.is_visible ?? true,
    sort_order: faq?.sort_order ?? 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await saveFaq(form);
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
    const result = await deleteFaq(form.id);
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
        value={form.question}
        onChange={(e) => setForm({ ...form, question: e.target.value })}
        placeholder="질문"
      />
      <textarea
        className={`${field} min-h-28`}
        value={form.answer}
        onChange={(e) => setForm({ ...form, answer: e.target.value })}
        placeholder="답변 — 줄바꿈은 그대로 보이고, https:// 로 시작하는 주소는 자동으로 링크가 됩니다."
      />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_visible}
            onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
          />
          공개
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

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "저장 중…" : form.id ? "저장" : "질문 추가"}
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
