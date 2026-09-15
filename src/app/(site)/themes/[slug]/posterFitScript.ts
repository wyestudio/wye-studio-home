/**
 * 데스크톱에서 포스터를 **비율(4:5) 그대로** 오른쪽 정보 높이만큼 키우는 계산.
 *
 * 왜 스크립트인가
 *   포스터 칸을 늘려 object-cover 로 채웠더니 그림이 확대돼 양옆이 잘렸다
 *   (2026-09-15). 비율을 지키며 높이를 맞추려면 **폭을 오른쪽 높이에서 거꾸로**
 *   정해야 하는데, 오른쪽 높이는 글자가 줄바꿈된 뒤에야 정해진다. CSS 만으로는
 *   '옆 칸 높이 → 내 폭' 을 표현할 수 없어서 그려진 뒤 재서 맞춘다.
 *
 * 두 군데서 쓴다
 *   1. 페이지 HTML 에 인라인 스크립트로 박아 **첫 화면이 그려지기 전에** 돌린다.
 *      React 가 뜬 뒤(useLayoutEffect)에 맞추면 포스터가 한 번 커지는 게 보였다.
 *   2. PosterFit(클라이언트) — 다른 화면에서 넘어올 때(인라인 스크립트가 안 돈다),
 *      창 크기·글꼴이 바뀔 때.
 *
 * ⚠️ 이 파일의 두 함수는 toString() 으로 HTML 에 그대로 들어간다. **바깥 변수·
 *    import·서로의 이름을 쓰면 안 된다**(상수도 안에 둔다). 빌드가 이름을 줄이면
 *    인라인에서 그 이름을 못 찾는다 — 그래서 fitPosterAndReveal 은 계산 함수를
 *    인자로 받는다. 스프레드 같은 문법도 피했다(도우미 함수로 바뀔 수 있다).
 * ⚠️ 오른쪽 요소들은 md:self-start 여야 한다. 칸 높이만큼 늘어나 있으면 포스터가
 *    커질수록 잰 높이도 같이 커져 끝없이 커진다.
 */
export function fitPoster(section: HTMLElement): void {
  const MIN_W = 240;
  const MAX_W = 460;
  // 포스터 칸이 섹션 폭에서 차지할 수 있는 최대 비율. 오른쪽 글이 너무 좁아지지 않게.
  const MAX_SHARE = 0.46;

  if (!window.matchMedia("(min-width: 768px)").matches) {
    section.style.removeProperty("--poster-w");
    return;
  }

  // 포스터가 넓어지면 오른쪽이 좁아져 줄이 늘 수 있어 몇 번 더 잰다.
  // 폭이 늘면 높이는 줄지 않으니 값이 한쪽으로만 움직여 금방 멈춘다.
  for (let i = 0; i < 8; i++) {
    const top = section.querySelector("[data-fit-top]");
    const bottoms = section.querySelectorAll("[data-fit-bottom]");
    if (!top || bottoms.length === 0) return;

    let bottom = 0;
    for (let j = 0; j < bottoms.length; j++) {
      bottom = Math.max(bottom, bottoms[j].getBoundingClientRect().bottom);
    }
    const height = bottom - top.getBoundingClientRect().top;
    const max = Math.min(MAX_W, section.clientWidth * MAX_SHARE);
    const next = Math.round(Math.max(MIN_W, Math.min(max, height * 0.8)));

    const current = parseFloat(section.style.getPropertyValue("--poster-w")) || 0;
    if (Math.abs(next - current) < 1) break;
    section.style.setProperty("--poster-w", next + "px");
  }
}

/**
 * 맞춘 뒤 바로 포스터를 드러내고(data-poster-fit=done), 글꼴이 다 오면 한 번 더 맞춘다.
 *
 * ⚠️ 글꼴을 기다렸다 드러내지 않는다. 스크립트가 도는 순간엔 캐시가 있어도 글꼴이 늘
 *    '받는 중' 으로 잡혀서, 기다리게 했더니 매번 포스터가 0.3초 늦게 서서히 나타났다.
 *    재 보니 대체 글꼴(next/font 가 크기를 맞춰 둔 것)과 SUIT 로 잰 포스터 폭이
 *    1400·1100·900px 폭 모두 같았다(2026-09-15). 다시 맞출 일이 거의 없다.
 */
export function fitPosterAndReveal(
  section: HTMLElement,
  fit: (section: HTMLElement) => void
): void {
  fit(section);
  section.setAttribute("data-poster-fit", "done");
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts && fonts.status !== "loaded") {
    fonts.ready.then(function () {
      fit(section);
    });
  }
}

/** 페이지 HTML 에 넣을 인라인 스크립트. section 바로 뒤에 둔다. */
export function posterFitInlineScript(sectionId: string): string {
  return (
    "(function(){var s=document.getElementById(" +
    JSON.stringify(sectionId) +
    ");if(!s)return;(" +
    fitPosterAndReveal.toString() +
    ")(s," +
    fitPoster.toString() +
    ");})();"
  );
}
