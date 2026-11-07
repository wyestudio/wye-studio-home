"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveFaq, deleteFaq, type FaqInput } from "./actions";
import { RichText } from "@/components/ui/RichText";

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-body-sm";

/** 사이트 안 주소만 · 밖은 http(s) 만 — RichText 가 받는 모양과 같다 */
const SAFE_HREF = /^(https?:\/\/|\/)[^\s)]*$/;

/** 자주 거는 주소 — 눌러서 바로 채운다 */
const QUICK_LINKS = [
  { label: "바-ㅇ탈출 (파티모드)", href: "/themes/baotalchul" },
  { label: "바-ㅇ탈출 노말모드", href: "/themes/baotalchul?mode=normal" },
  { label: "단체 예약", href: "/group" },
  { label: "공지", href: "/notice" },
];

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
  const answerRef = useRef<HTMLTextAreaElement>(null);
  // 링크를 걸 글자 범위 — 주소 칸으로 포커스가 옮겨가도 잃지 않게 열 때 잡아 둔다
  const [linkRange, setLinkRange] = useState<{ start: number; end: number } | null>(null);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  /** 고른 글자를 앞뒤로 감싼다(굵게 · 링크). 답변은 평문이라 **…** · [문구](주소) 모양으로 남는다 */
  function wrap(start: number, end: number, before: string, after: string) {
    const a = form.answer;
    const next = a.slice(0, start) + before + a.slice(start, end) + after + a.slice(end);
    setForm({ ...form, answer: next });
    requestAnimationFrame(() => {
      const el = answerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function selection() {
    const el = answerRef.current;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : { start: 0, end: 0 };
  }

  function bold() {
    const { start, end } = selection();
    if (start === end) {
      setLinkError("굵게 할 글자를 먼저 드래그해서 고르세요.");
      return;
    }
    setLinkError(null);
    wrap(start, end, "**", "**");
  }

  function openLink() {
    const { start, end } = selection();
    if (start === end) {
      setLinkError("링크를 걸 글자를 먼저 드래그해서 고르세요. 예: 바-ㅇ탈출 예약 바로가기");
      return;
    }
    setLinkError(null);
    setHref("");
    setLinkRange({ start, end });
  }

  function applyLink(value = href) {
    const v = value.trim();
    if (!linkRange) return;
    if (!SAFE_HREF.test(v)) {
      setLinkError("https:// 로 시작하는 주소나, 사이트 안 주소(/group 처럼 / 로 시작)만 넣을 수 있습니다.");
      return;
    }
    if (/[\[\]\n]/.test(form.answer.slice(linkRange.start, linkRange.end))) {
      setLinkError("링크 글자에는 줄바꿈이나 대괄호를 넣을 수 없습니다.");
      return;
    }
    wrap(linkRange.start, linkRange.end, "[", `](${v})`);
    setLinkRange(null);
    setLinkError(null);
  }

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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            // 눌러도 답변 칸의 선택 영역이 풀리지 않게
            onMouseDown={(e) => e.preventDefault()}
            onClick={bold}
            className="rounded-md border border-border px-3 py-1 text-body-sm font-extrabold"
          >
            굵게
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openLink}
            className="rounded-md border border-border px-3 py-1 text-body-sm"
          >
            링크
          </button>
          <span className="ml-1 text-micro text-muted">글자를 드래그해서 고른 뒤 누릅니다.</span>
        </div>

        {linkRange && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <p className="text-micro text-muted">
              「{form.answer.slice(linkRange.start, linkRange.end)}」에 걸 주소
            </p>
            <div className="flex flex-wrap gap-1">
              {QUICK_LINKS.map((q) => (
                <button
                  key={q.href}
                  type="button"
                  onClick={() => applyLink(q.href)}
                  className="rounded-md bg-fill px-2.5 py-1 text-body-sm hover:bg-fill-strong"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                className={`${field} min-w-0 flex-1`}
                value={href}
                onChange={(e) => setHref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                  if (e.key === "Escape") setLinkRange(null);
                }}
                placeholder="또는 직접 입력 — https://… 또는 /group"
              />
              <button
                type="button"
                onClick={() => applyLink()}
                className="rounded-md bg-glow px-3 py-1.5 text-body-sm font-semibold text-glow-foreground"
              >
                적용
              </button>
              <button
                type="button"
                onClick={() => setLinkRange(null)}
                className="rounded-md border border-border px-3 py-1.5 text-body-sm text-muted"
              >
                취소
              </button>
            </div>
          </div>
        )}
        {linkError && <p className="text-micro text-red-400">{linkError}</p>}

        <textarea
          ref={answerRef}
          className={`${field} min-h-28`}
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          placeholder="답변 — 줄바꿈은 그대로 보이고, https:// 로 시작하는 주소는 자동으로 링크가 됩니다."
        />

        {form.answer.trim() && (
          <div className="rounded-md bg-fill-subtle px-3 py-2">
            <p className="mb-1 text-micro text-muted">미리보기</p>
            <div className="text-body-sm text-muted">
              <RichText text={form.answer} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={form.is_visible}
            onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
          />
          공개
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

      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-body-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-glow px-4 py-2 text-body-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "저장 중…" : form.id ? "저장" : "질문 추가"}
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
