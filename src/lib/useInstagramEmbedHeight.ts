"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 인스타 임베드 iframe 의 실제 높이를 받아온다.
 *
 * 임베드는 높이를 스스로 재서 부모창에 postMessage 로 알려준다
 * (`{"type":"MEASURE","details":{"height":…}}`). 인스타가 배포하는 embed.js 가
 * 하는 일이 바로 이걸 받아 iframe 높이를 맞추는 것이다. 스크립트를 통째로
 * 불러올 이유는 없으니 이 메시지만 직접 듣는다.
 *
 * ⚠️ 고정 높이로 두면 **캡션이 잘린다.** 실제로 520px 로 박아뒀다가 아래가
 *    잘린다는 제보를 받았다(2026-09-14). 게시물마다 캡션 길이가 달라서
 *    어떤 고정값을 골라도 누군가는 잘린다.
 *
 * 메시지가 안 오는 경우(차단·실패)를 대비해 초기값을 넉넉히 준다.
 */
const FALLBACK_HEIGHT = 640;

export function useInstagramEmbedHeight(): {
  ref: React.RefObject<HTMLIFrameElement | null>;
  height: number;
} {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!/(^|\.)instagram\.com$/.test(new URL(e.origin).hostname)) return;
      // 내 iframe 이 보낸 메시지만 받는다. 한 화면에 여러 개가 떠 있다.
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const h = Number(data?.details?.height);
        if (data?.type === "MEASURE" && Number.isFinite(h) && h > 100) setHeight(Math.ceil(h));
      } catch {
        // 인스타가 아닌 형식의 메시지. 무시한다.
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return { ref, height };
}
