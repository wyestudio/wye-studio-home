"use client";

import { useRef, useState } from "react";
import { RichText } from "@/components/ui/RichText";

/*
  RichText 로 그려질 평문을 쓰는 여러 줄 입력칸 — 굵게 · 링크 버튼과 미리보기가 붙는다.
  공지 페이지 자주 묻는 질문(FaqEditor)과 테마 상세 자주 묻는 질문(ContentBlocksEditor)이 같이 쓴다.
  답변은 평문이라 **…** · [문구](주소) 모양으로 저장된다.
*/

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

export function RichTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // 링크를 걸 글자 범위 — 주소 칸으로 포커스가 옮겨가도 잃지 않게 열 때 잡아 둔다
  const [linkRange, setLinkRange] = useState<{ start: number; end: number } | null>(null);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** 고른 글자를 앞뒤로 감싸고, 감싼 글자를 다시 골라 둔다 */
  function wrap(start: number, end: number, before: string, after: string) {
    onChange(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function selection() {
    const el = ref.current;
    return el ? { start: el.selectionStart, end: el.selectionEnd } : { start: 0, end: 0 };
  }

  function bold() {
    const { start, end } = selection();
    if (start === end) {
      setError("굵게 할 글자를 먼저 드래그해서 고르세요.");
      return;
    }
    setError(null);
    wrap(start, end, "**", "**");
  }

  function openLink() {
    const { start, end } = selection();
    if (start === end) {
      setError("링크를 걸 글자를 먼저 드래그해서 고르세요. 예: 바-ㅇ탈출 예약 바로가기");
      return;
    }
    setError(null);
    setHref("");
    setLinkRange({ start, end });
  }

  function applyLink(next = href) {
    const v = next.trim();
    if (!linkRange) return;
    if (!SAFE_HREF.test(v)) {
      setError("https:// 로 시작하는 주소나, 사이트 안 주소(/group 처럼 / 로 시작)만 넣을 수 있습니다.");
      return;
    }
    if (/[\[\]\n]/.test(value.slice(linkRange.start, linkRange.end))) {
      setError("링크 글자에는 줄바꿈이나 대괄호를 넣을 수 없습니다.");
      return;
    }
    wrap(linkRange.start, linkRange.end, "[", `](${v})`);
    setLinkRange(null);
    setError(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          // 눌러도 입력칸의 선택 영역이 풀리지 않게
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
          <p className="text-micro text-muted">「{value.slice(linkRange.start, linkRange.end)}」에 걸 주소</p>
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
      {error && <p className="text-micro text-red-400">{error}</p>}

      <textarea
        ref={ref}
        // field-sizing-content: 쓴 만큼 칸이 늘어난다(지원 안 하는 브라우저는 min-h 그대로)
        className={`${field} min-h-28 field-sizing-content`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />

      {value.trim() && (
        <div className="rounded-md bg-fill-subtle px-3 py-2">
          <p className="mb-1 text-micro text-muted">미리보기</p>
          <div className="text-body-sm text-muted">
            <RichText text={value} />
          </div>
        </div>
      )}
    </div>
  );
}
