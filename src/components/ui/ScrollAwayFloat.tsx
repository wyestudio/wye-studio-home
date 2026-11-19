"use client";

import { useEffect } from "react";

/**
 * 스크롤을 내리는 동안 우하단 플로팅 버튼(인스타·카카오)을 옆으로 치운다.
 *
 * 왜 — 버튼 묶음이 **본문 글자를 40px 폭만큼 덮고 있었다**(390px 실측,
 * 2026-10-05 접근성 진단 A9). 읽는 동안 가리는 게 가장 거슬리므로, 내릴 때는
 * 치우고 올리거나 맨 위로 가면 다시 보인다.
 *
 * 버튼을 없애거나 합치지 않은 이유 — 인스타 버튼은 "어떤 곳인지 보러 갈 창구"로
 * 일부러 추가한 것이다(KakaoChannelButton 주석, 2026-09-16). 가리는 문제만 푼다.
 *
 * ⚠️ 헤더(Header.tsx)와 **같은 규칙**이다. 내리면 숨고 올리면 나온다 — 한 화면에서
 *    두 요소가 다르게 움직이면 어지럽다. 임계값도 같은 값을 쓴다.
 * ⚠️ 모바일에서만 치운다. 1024px 이상은 버튼이 본문 바깥(lg:right-20)이라 안 가린다.
 * ⚠️ CSS 클래스가 아니라 **인라인 스타일**로 준다. globals.css 에 규칙을 두면
 *    Tailwind 유틸리티와 우선순위가 엉켜 적용되지 않았다(2026-10-05 확인).
 *
 * 푸터가 화면에 들어오면 묶음을 그 위로 밀어 올린다 — 그냥 두면 푸터 오른쪽의
 * 약관 링크(환불정책·개인정보처리방침)를 덮어 누를 수 없었다. 하단 CTA 막대도 같은 식으로 비켜 간다.
 * ⚠️ 숨기지 않고 올린다. 짧은 페이지(/lookup 등)는 들어오자마자 푸터가 보여서,
 *    숨기면 문의 창구가 처음부터 없는 화면이 된다.
 * ⚠️ 올리는 건 transform 이 아니라 margin-bottom 이다. transform 에는 치우기용
 *    transition 이 걸려 있어 스크롤을 0.3초씩 늦게 따라온다.
 */
export function ScrollAwayFloat() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".kakao-float");
    if (!el) return;

    const mobile = window.matchMedia("(max-width: 1023px)");
    /** 이 위에서는 치우지 않는다 — 막 들어온 사람에게 문의 창구는 보여야 한다. */
    const REVEAL_ZONE = 160;
    /** 손가락 떨림으로 깜빡이지 않게, 이만큼 한 방향으로 움직여야 바꾼다. */
    const THRESHOLD = 8;

    el.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";

    let anchorY = window.scrollY;
    let hidden = false;
    let raf = 0;

    const apply = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      el.style.transform = next ? "translateX(calc(100% + 1.5rem))" : "";
      el.style.opacity = next ? "0" : "";
      el.style.pointerEvents = next ? "none" : "";
    };

    /** 푸터 위로 띄울 간격. */
    const FOOTER_GAP = 12;

    const liftAboveFooter = () => {
      // 비켜 갈 것: 푸터 + 화면 아래에 붙은 CTA 막대.
      // ⚠️ 막대는 페이지마다 숨는 폭이 다르다(테마 상세 sm:hidden · 단체 견적 lg:hidden).
      //    globals.css 의 `body:has(.mobile-cta-bar)` 규칙은 639px 이하만 올려서
      //    640~1023px 에서 단체 견적 막대를 덮었다. 그래서 폭 대신 **지금 보이는지**로 판단한다.
      const tops = [document.querySelector(".site-footer"), document.querySelector(".mobile-cta-bar")]
        .map((node) => node?.getBoundingClientRect())
        .filter((r): r is DOMRect => !!r && r.height > 0)
        .map((r) => r.top);
      if (tops.length === 0) return;
      const overlap = window.innerHeight - Math.min(...tops);
      // 기준 bottom 은 화면마다 다르다(bottom-5 · bottom-36 · 하단 CTA 막대가 있으면 5.5rem).
      const base = parseFloat(getComputedStyle(el).bottom) || 0;
      const lift = Math.max(0, overlap + FOOTER_GAP - base);
      el.style.marginBottom = lift > 0 ? `${lift}px` : "";
    };

    const update = () => {
      liftAboveFooter();
      const y = Math.max(0, window.scrollY);
      if (!mobile.matches || y < REVEAL_ZONE) {
        apply(false);
        anchorY = y;
        return;
      }
      const dy = y - anchorY;
      if (dy > THRESHOLD) {
        apply(true);
        anchorY = y;
      } else if (dy < -THRESHOLD) {
        apply(false);
        anchorY = y;
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    // 창 크기·본문 높이가 바뀌면 푸터 위치도 바뀐다(스크롤 없이도).
    window.addEventListener("resize", onScroll);
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(document.body);
    // CTA 막대는 스크롤 없이도 생기고 사라진다(단체 견적에서 단계를 누를 때). 갱신은 rAF 로 한 번에 묶인다.
    const mutationObserver = new MutationObserver(onScroll);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    mobile.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      mobile.removeEventListener("change", update);
      // 되돌려 둔다 — 다음 화면에서 숨은 채로 남으면 버튼이 영영 안 보인다.
      el.style.marginBottom = "";
      el.style.transform = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      el.style.transition = "";
    };
  }, []);

  return null;
}
