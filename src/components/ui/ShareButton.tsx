"use client";

import { useState } from "react";

/**
 * 공유 버튼.
 *
 * ⚠️ 색은 **고른 모드의 강조색**을 쓴다(2026-10-09). 모양(꽉 찬 원 + 공유 아이콘)은
 *    그대로 두고 색만 바꿨다 — 예전 브랜드 보라(#667cff)는 상세에서 색이 맡는 역할
 *    (모드 · 할인) 어디에도 속하지 않는 다섯 번째 색이라 혼자 겉돌았다.
 *    모드를 바꾸면 이 버튼도 같이 바뀌어서 "이 페이지의 색" 으로 읽힌다.
 *
 * ⚠️ 무채색 테두리 + 글자 라벨로 바꿔 봤다가 되돌렸다 — **너무 옅어서** 눌러야 할
 *    것으로 안 보였다. 작아도 꽉 찬 면이라야 눈에 들어온다.
 */

export function ShareButton({
  title,
  url,
  accent,
  className = "",
}: {
  title: string;
  url: string;
  /** 고른 모드의 강조색. */
  accent: string;
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
      title={copied ? "링크가 복사되었습니다" : "공유하기"}
      // 눌린 느낌(살짝 떴다 내려앉기)은 모드 버튼과 같게 — 같은 UI 키트로 읽히게 한다.
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-foreground transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px ${className}`}
      style={{ backgroundColor: accent }}
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
