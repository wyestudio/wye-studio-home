"use client";

import { useState } from "react";

export function ShareButton({
  title,
  url,
  className = "",
}: {
  title: string;
  url: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // 공유 취소 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? "링크가 복사되었습니다" : "공유하기"}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90 ${className}`}
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        </svg>
      )}
    </button>
  );
}
