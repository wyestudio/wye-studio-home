"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveNotice, deleteNotice, type NoticeInput } from "./actions";
import { NoticeBodyEditor } from "./NoticeBodyEditor";
import { NOTICE_CATEGORIES, NOTICE_GREETING, composeNoticeTitle, splitNoticeTitle } from "@/lib/noticeTitle";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-body-sm";

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
    body: notice?.body ?? `<p>${NOTICE_GREETING}</p><p></p>`,
    is_pinned: notice?.is_pinned ?? false,
    published_at: notice?.published_at ?? null,
    sort_order: notice?.sort_order ?? 0,
  });
  const initial = splitNoticeTitle(notice?.title ?? "");
  const [category, setCategory] = useState<string>(initial.category);
  const [headline, setHeadline] = useState(initial.headline);
  const [published, setPublished] = useState(toLocal(notice?.published_at ?? null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!category) {
      setError("분류를 골라주세요.");
      return;
    }
    if (!headline.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const title = composeNoticeTitle(category, headline);
    const result = await saveNotice({ ...form, title, published_at: toIso(published) });
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
      <div className="flex gap-2">
        <select
          className="w-32 shrink-0 rounded-md border border-border bg-background px-3 py-2 text-body-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="분류"
        >
          <option value="">분류 선택</option>
          {NOTICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className={`${field} min-w-0 flex-1`}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="핵심 내용 — 예: 11월 회차 오픈 일정 변경"
        />
      </div>
      <p className="text-micro text-muted">
        제목 미리보기: {category && headline.trim() ? composeNoticeTitle(category, headline) : "분류와 핵심 내용을 채워주세요"}
      </p>
      <NoticeBodyEditor value={form.body} onChange={(body) => setForm((f) => ({ ...f, body }))} />

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-body-sm">
          <span className="text-muted">게시일</span>
          <input
            type="datetime-local"
            className={`${field} w-56`}
            value={published}
            onChange={(e) => setPublished(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
          />
          상단 고정
        </label>
        <label className="flex items-center gap-2 text-body-sm">
          <span className="text-muted">순서</span>
          <input
            type="number"
            className={`${field} w-20`}
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <ul className="list-disc space-y-0.5 pl-4 text-micro text-muted">
        <li>본문은 「{NOTICE_GREETING}」로 시작합니다.</li>
        <li>안내는 ~합니다 / ~드립니다 체로 씁니다.</li>
        <li>이모지는 이벤트 공지의 본문에만 조금 씁니다. 제목에는 쓰지 않습니다.</li>
      </ul>

      <p className="text-micro text-muted">
        게시일을 비우면 공개되지 않습니다(초안). 미래 시각을 넣으면 그때부터 보입니다.
      </p>

      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-body-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-glow px-4 py-2 text-body-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "저장 중…" : form.id ? "저장" : "공지 추가"}
        </button>
        {form.id && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-red-500/40 px-4 py-2 text-body-sm text-red-400 disabled:opacity-50"
          >
            삭제
          </button>
        )}
        {onDone && (
          <button onClick={onDone} disabled={busy} className="rounded-md border border-border px-4 py-2 text-body-sm text-muted">
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
