"use client";

import { useState } from "react";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { RichText } from "@/components/ui/RichText";
import type { Notice } from "@/lib/content";

const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\s/g, "")
    .replace(/\.$/, "");

/**
 * 공지사항 — 제목 목록 + 상세 모달.
 *
 * 본문을 목록에 다 펼치면 공지가 쌓일수록 스크롤이 길어진다.
 * 제목만 보여주고 누른 것만 연다.
 */
export function NoticeSection({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState<Notice | null>(null);

  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">공지사항</h2>

      {notices.length === 0 ? (
        <HudPlaceholder label="등록된 공지가 없습니다." />
      ) : (
        <ul className="divide-y divide-glass-border overflow-hidden rounded-xl border border-glass-border">
          {notices.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setOpen(n)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/5"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {n.is_pinned && <span className="mr-1.5 text-glow">📌</span>}
                  {n.title}
                </span>
                {n.published_at && (
                  <span className="shrink-0 text-xs text-muted">{kstDate(n.published_at)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <NoticeModal notice={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function NoticeModal({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={notice.title}
    >
      {/* 안쪽을 눌렀을 때 닫히면 본문을 읽다가 실수로 닫힌다. */}
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-glass-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold">
              {notice.is_pinned && <span className="mr-1.5 text-glow">📌</span>}
              {notice.title}
            </h3>
            {notice.published_at && (
              <p className="mt-1 text-xs text-muted">{kstDate(notice.published_at)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded px-2 py-1 text-lg leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        <RichText text={notice.body} className="block text-sm leading-relaxed text-muted" />

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg border border-glass-border py-2.5 text-sm"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
