"use client";

import { useEffect, useState } from "react";

/**
 * 우하단 인스타 버튼 위에 붙는 이벤트 말풍선.
 *
 * 쇼핑몰들이 플로팅 버튼 옆·위에 다는 그 말풍선이다(무신사·에이블리 류). 규칙도 같게 뒀다.
 *   - 버튼을 가리지 않고 **위에** 뜬다. 꼬리로 어느 버튼 이야기인지 가리킨다.
 *   - 본문 위로 떠 있지만 작고 구석이라 상세 내용을 가리지 않는다.
 *   - 한 번 닫으면 다시 안 뜬다(브라우저에 기억). 계속 따라다니면 광고처럼 느껴진다.
 *   - 화면이 뜨자마자가 아니라 잠깐 뒤에 나타난다 — 첫 화면을 읽는 걸 방해하지 않는다.
 *   - 말풍선을 누르면 버튼과 같은 곳(인스타)으로 간다.
 *
 * 이벤트가 끝나면 아래 EVENT 의 enabled 를 false 로 바꾸면 된다(문구도 여기서 고친다).
 */
const EVENT = {
  enabled: true,
  /** 한 줄로 읽히는 길이까지만. 자세한 조건은 인스타 게시물에서 본다. */
  text: "오픈기념 할인쿠폰 이벤트",
};

/** 닫았다는 표시를 남기는 자리. 문구를 바꾸면 값을 올려 다시 보이게 한다. */
const DISMISS_KEY = "wye.instaEventBubble.v1";

export function InstagramEventBubble({ href }: { href: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!EVENT.enabled) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // 사생활 보호 모드 등 — 기억은 못 해도 말풍선은 띄운다.
    }
    // 첫 화면을 읽는 동안은 조용히 있는다.
    const t = window.setTimeout(() => setShown(true), 1600);
    return () => window.clearTimeout(t);
  }, []);

  if (!EVENT.enabled || !shown) return null;

  const close = () => {
    setShown(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 못 적어도 이번 화면에서는 닫힌다.
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-full right-0 mb-2.5 flex justify-end">
      <div className="event-bubble pointer-events-auto relative flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-background/95 py-1.5 pl-3 pr-1.5 shadow-lg shadow-black/40 backdrop-blur">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-bold text-foreground sm:text-xs"
        >
          <span aria-hidden>🎁</span>
          {EVENT.text}
        </a>
        <button
          type="button"
          onClick={close}
          aria-label="이벤트 안내 닫기"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>

        {/* 꼬리 — 아래 버튼을 가리킨다. 말풍선과 같은 배경·테두리로 이어 붙인다. */}
        <span
          aria-hidden
          className="absolute -bottom-[5px] right-5 h-2.5 w-2.5 rotate-45 border-b border-r border-white/15 bg-background/95"
        />
      </div>
    </div>
  );
}
