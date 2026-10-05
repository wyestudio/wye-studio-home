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

    const update = () => {
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
    mobile.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      mobile.removeEventListener("change", update);
      // 되돌려 둔다 — 다음 화면에서 숨은 채로 남으면 버튼이 영영 안 보인다.
      el.style.transform = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      el.style.transition = "";
    };
  }, []);

  return null;
}
