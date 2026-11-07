"use client";

import { useRef } from "react";
import { NOTICE_GUIDE } from "@/lib/noticeGuide";

/** 공지 작성 규칙을 팝업으로 — 전문은 src/lib/noticeGuide.ts */
export function NoticeGuideButton() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md border border-border px-3 py-1.5 text-body-sm text-muted hover:bg-fill"
      >
        작성 규칙
      </button>
      <dialog
        ref={ref}
        aria-labelledby="notice-guide-title"
        // 바깥(어두운 배경)을 누르면 닫는다
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
        // 높이 · 배경은 사이트 팝업(SitePopup · NoticeSection)과 같게, 폭은 좁은 창에서 양옆 1rem 을 남긴다
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="notice-guide-title" className="text-h3 font-extrabold">
            공지 작성 규칙
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md px-2 py-1 text-body-sm text-muted hover:bg-fill"
          >
            닫기
          </button>
        </div>
        <div className="space-y-5 px-5 py-4">
          {NOTICE_GUIDE.map((s) => (
            <section key={s.title}>
              <h3 className="mb-1.5 text-body font-semibold">{s.title}</h3>
              <ul className="list-disc space-y-1 pl-5 text-body-sm text-muted">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
