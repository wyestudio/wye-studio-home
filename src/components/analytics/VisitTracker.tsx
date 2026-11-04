"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initVisitTrack, trackClick, trackPage } from "@/lib/visitTrack";

/**
 * 방문 발자취 — 페이지 이동과 버튼 · 링크 클릭을 남긴다(src/lib/visitTrack.ts). 화면을 그리지 않는다.
 * 레이아웃이 고객 화면에서만 단다(어드민 호스트 제외).
 *
 * 클릭은 버튼 · 링크의 **글자**만 남긴다. 입력칸은 보지 않는다.
 * ⚠️ 가려진 영역(data-clarity-mask — 신청서 · 조회 결과 · 단체 연락처)에서는 글자도 빼고
 *    data-track · aria-label 만 쓴다. 그 안의 버튼 글자에 이름이 들어갈 수 있다.
 */
/**
 * 버튼 글자 — 화면 낭독기에서 숨긴 글자(aria-hidden)는 뺀다.
 * ⚠️ 머리 메뉴는 글자 애니메이션용 복제 글자를 aria-hidden 으로 겹쳐 둔다. 그대로 읽으면
 *    "신청조회신신신청청청…" 이 된다.
 */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const stop = initVisitTrack();
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const el = target?.closest("a, button, summary, [role='button'], [data-track]");
      if (!el) return;
      const masked = !!el.closest("[data-clarity-mask]");
      const text = masked ? "" : visibleText(el);
      const label =
        el.getAttribute("data-track") || el.getAttribute("aria-label") || text || (masked ? "(가려진 영역)" : el.tagName.toLowerCase());
      const meta: Record<string, string> = {};
      const href = el instanceof HTMLAnchorElement ? el.href : null;
      if (href) {
        try {
          const u = new URL(href);
          meta.to = u.origin === window.location.origin ? u.pathname : u.hostname;
        } catch {
          /* 이상한 주소는 버린다 */
        }
      }
      trackClick(label.slice(0, 60), window.location.pathname, Object.keys(meta).length ? meta : undefined);
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      stop();
    };
  }, []);

  useEffect(() => {
    trackPage(pathname);
  }, [pathname]);

  return null;
}
