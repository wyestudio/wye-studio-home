"use client";

import { useState } from "react";

/**
 * 공유 버튼.
 *
 * ⚠️ **색을 쓰지 않는다**(2026-10-09). 예전엔 브랜드 보라(#667cff) 꽉 찬 원이었는데,
 *    도트 게임 톤의 상세에서 **혼자만 떠 있는 둥근 덩어리**였고, 상세에서 색이 맡는
 *    역할(모드 · 할인) 어디에도 속하지 않는 다섯 번째 색이었다.
 *    지금은 모드 토글·PRIVATE ROOM 과 같은 언어 — 테두리 · 모노 라벨 · 무채색이다.
 */

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
      // 눌린 느낌(살짝 내려앉기)은 모드 버튼과 같게 — 같은 UI 키트로 읽히게 한다.
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-fill-subtle px-3 py-2 font-mono text-micro tracking-[0.08em] text-muted transition-[transform,color,border-color] duration-150 hover:border-line-strong hover:text-foreground active:translate-y-px ${className}`}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        </svg>
      )}
      {/* 글자 폭이 달라도 버튼이 들썩이지 않게 최소 폭을 준다. */}
      <span className="min-w-[2.5rem] text-center">{copied ? "복사됨" : "공유"}</span>
    </button>
  );
}
