"use client";

import { useEffect } from "react";
import { isProductionHost } from "@/lib/hosts";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * 게임 화면에 GTM 을 싣는다 — GA4 가 게임 화면의 방문과 xmas_game_* 이벤트를 받게 된다(2026-11-26 대표님).
 * 이벤트는 범용 태그(`wye_ga4`)로 나가므로 GTM 쪽에서 새로 만들 것은 없다(ANALYTICS.md).
 *
 * 왜 (site) 레이아웃처럼 서버에서 싣지 않나
 *   거기는 요청의 호스트를 읽어(headers) 운영 호스트에서만 싣는다. 게임 화면은 미리 그려 두는 화면이라 서버에서
 *   호스트를 읽을 수 없다(읽으면 요청마다 그리는 화면이 된다 — wye-server-cost). 그래서 브라우저에서 주소를 보고 싣는다.
 *   기준은 같은 목록이다(hosts.ts 의 운영 호스트) — 테스트 서버 · 미리보기 주소 · 로컬에서는 싣지 않는다.
 *
 * ⚠️ dataLayer 를 **먼저** 만든다. pushGa4Event 는 dataLayer 가 없으면 아무것도 안 쌓는다 — 만들어 두면 gtm.js 가
 *    늦게 와도 그 사이의 이벤트가 쌓여 있다가 나간다.
 * ⚠️ 어드민 표(참여 현황)는 이것과 상관없이 방문 발자취로 센다. GA4 는 광고 차단 · 사파리에서 일부가 빠져서
 *    숫자가 더 적게 나온다 — 사람 수는 어드민 표를 기준으로 본다.
 */
export function XmasGameGtm() {
  useEffect(() => {
    if (!GTM_ID || !isProductionHost(window.location.host) || document.getElementById("gtm-xmas-game")) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.id = "gtm-xmas-game";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    document.head.appendChild(script);
  }, []);
  return null;
}
