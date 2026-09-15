/**
 * 테마 상세의 화면 블록([data-screen]) 사이를 오가는 스크롤 도우미.
 * 휠 넘기기(ScreenSnap) · 목차(SectionNav) · 모바일 탭(DetailTabs) · 신청하기 버튼이 같이 쓴다.
 * 제각각 계산하면 도착 위치가 몇 px 씩 달라져, 같은 블록인데 누른 곳마다 다르게 멈춘다.
 */

const DURATION = 650;

let raf = 0;
let animating = false;

export function isScrollAnimating() {
  return animating;
}

/**
 * 화면 위에 붙어 따라오는 줄(헤더, 모바일은 섹션 이동 탭까지)의
 *   bottom : 지금 화면에서의 아래끝 — '지금 블록' 을 찾는 기준선
 *   height : 붙어 있을 때의 높이 합 — 블록이 한 화면에 들어오는지 재는 기준
 * ⚠️ 둘을 나눈 이유: 테스트 서버는 맨 위에 'TEST 환경' 띠가 있어 페이지 맨 위에서만
 *    헤더 아래끝이 띠 높이만큼 내려가 있다. 그 값으로 화면 높이를 재면 첫 화면이
 *    '화면보다 긴 블록' 으로 잘못 판정돼 휠이 넘어가지 않았다.
 * ⚠️ 모바일에서 스크롤로 숨긴 헤더(data-header-hidden)는 화면에 없으니 빼고 센다.
 */
export function stickyEdge() {
  let bottom = 0;
  let height = 0;
  const headerHidden = document.documentElement.hasAttribute("data-header-hidden");
  document.querySelectorAll<HTMLElement>("header, nav[aria-label='섹션 이동']").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && getComputedStyle(el).position === "sticky") {
      if (el.tagName === "HEADER" && headerHidden) return;
      bottom = Math.max(bottom, r.bottom);
      height += r.height;
    }
  });
  return { bottom: Math.max(0, bottom), height };
}

export function animateScrollTo(target: number) {
  cancelAnimationFrame(raf);
  const start = window.scrollY;
  const dist = target - start;
  if (Math.abs(dist) < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, target);
    return;
  }
  animating = true;
  const t0 = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / DURATION);
    window.scrollTo(0, start + dist * ease(t));
    if (t < 1) raf = requestAnimationFrame(step);
    else animating = false;
  };
  raf = requestAnimationFrame(step);
}

export function cancelScrollAnimation() {
  cancelAnimationFrame(raf);
  animating = false;
}

/**
 * 블록 윗끝이 위에 붙은 줄 바로 밑에 오게 하는 스크롤 위치.
 *
 * 모바일은 헤더가 스크롤 방향에 따라 숨는다(Header.tsx). **도착했을 때** 헤더가
 * 보일지로 여백을 정한다 — 아래로 가면 숨고, 위로 가면(또는 맨 위 근처면) 보인다.
 * 지금 상태로 재면 아래로 내려갈 때 헤더 높이만큼 빈 띠가 남는다.
 */
export function screenTargetOf(el: HTMLElement) {
  const absTop = window.scrollY + el.getBoundingClientRect().top;
  const header = document.querySelector<HTMLElement>("header");
  const tabs = document.querySelector<HTMLElement>("nav[aria-label='섹션 이동']");
  const tabsH = tabs && getComputedStyle(tabs).display !== "none" ? tabs.offsetHeight : 0;
  const headerH = header?.offsetHeight ?? 0;

  if (tabsH === 0) return Math.max(0, absTop - headerH); // 데스크톱: 헤더는 늘 보인다.

  const goingDown = absTop - tabsH > window.scrollY;
  const nearTop = absTop - tabsH - headerH < HEADER_REVEAL_ZONE;
  const headerShown = !goingDown || nearTop;
  return Math.max(0, absTop - tabsH - (headerShown ? headerH : 0));
}

/** 이 위치보다 위에서는 모바일 헤더를 숨기지 않는다(Header.tsx 와 같은 값). */
export const HEADER_REVEAL_ZONE = 120;

export function scrollToScreen(el: HTMLElement) {
  animateScrollTo(screenTargetOf(el));
}
