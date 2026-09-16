"use client";

import { useState } from "react";

/**
 * 우하단 인스타 버튼 위에 붙는 이벤트 말풍선.
 *
 * 쇼핑몰들이 플로팅 버튼에 다는 그 말풍선이다. 규칙도 같게 뒀다.
 *   - 버튼을 가리지 않고 위에 뜨고, 꼬리로 어느 버튼 이야기인지 가리킨다
 *   - 눌러도 되고 무시해도 되는 크기. 본문 위를 덮지 않는 구석 자리
 *   - 닫으면 **그 방문 동안**은 다시 안 뜬다(sessionStorage). 페이지를 옮겨 다닐 때마다
 *     다시 뜨면 성가시고, 사이트를 나갔다 다시 오면 다시 보여주는 게 맞다는 판단(2026-09-16)
 *
 * ⚠️ 나타나는 데 시간을 두지 않는다. 처음부터 떠 있어야 한다는 요청이라 서버가 그린
 *    HTML 에 그대로 들어간다. 이미 닫은 사람에게 깜빡 보였다 사라지지 않도록,
 *    화면이 그려지기 전에 인라인 스크립트가 <html> 에 표시를 달고 CSS 가 감춘다
 *    (eventBubbleDismissScript / globals.css).
 *
 * 문구와 노출 여부는 어드민 > 공지·FAQ 에서 고친다(site_settings.public.event_bubble).
 */
export const EVENT_BUBBLE_DISMISS_KEY = "wye.eventBubbleDismissed";
export const EVENT_BUBBLE_HIDE_ATTR = "data-event-bubble-off";

/** 화면이 그려지기 전에 '이번 방문에 이미 닫았는지' 를 <html> 에 표시한다. */
export const eventBubbleDismissScript = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(
  EVENT_BUBBLE_DISMISS_KEY
)})==="1"){document.documentElement.setAttribute(${JSON.stringify(
  EVENT_BUBBLE_HIDE_ATTR
)},"");}}catch(e){}})();`;

export function InstagramEventBubble({ href, text }: { href: string; text: string }) {
  const [closed, setClosed] = useState(false);
  if (!text.trim() || closed) return null;

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(EVENT_BUBBLE_DISMISS_KEY, "1");
    } catch {
      // 사생활 보호 모드 등 — 기억은 못 해도 이번 화면에서는 닫힌다.
    }
    document.documentElement.setAttribute(EVENT_BUBBLE_HIDE_ATTR, "");
  };

  return (
    // ⚠️ w-max 가 없으면 말풍선이 **버튼 폭(56px)** 안에 갇혀 글자가 세로로 쪼개진다.
    //    바깥 묶음이 좁아서 자리 기준(containing block)도 그만큼 좁기 때문이다.
    <div className="pointer-events-none absolute bottom-full right-0 mb-3 flex w-max justify-end">
      <div className="event-bubble pointer-events-auto relative flex max-w-[16rem] items-start gap-2 rounded-2xl bg-white py-2.5 pl-3.5 pr-2 shadow-xl shadow-black/30 sm:max-w-[19rem] sm:py-3 sm:pl-4">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-[13px] font-bold leading-snug text-[#191919] sm:text-sm"
        >
          <span className="shrink-0 text-base leading-tight sm:text-lg" aria-hidden>
            🎁
          </span>
          {/* 줄바꿈을 그대로 — 어드민에서 두 줄로 적으면 두 줄로 보인다. */}
          <span className="whitespace-pre-line break-keep">{text}</span>
        </a>
        <button
          type="button"
          onClick={close}
          aria-label="이벤트 안내 닫기"
          className="-mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-black/35 transition-colors hover:bg-black/5 hover:text-black/70"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
          </svg>
        </button>

        {/* 꼬리 — 아래 인스타 버튼을 가리킨다. 말풍선과 같은 흰색. */}
        <span
          aria-hidden
          className="absolute -bottom-[5px] right-6 h-3 w-3 rotate-45 rounded-[2px] bg-white"
        />
      </div>
    </div>
  );
}
