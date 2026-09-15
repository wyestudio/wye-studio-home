/**
 * 데스크톱에서 화면 블록([data-screen])이 **한 화면 안에 들어오게** 맞추는 계산.
 *
 * 왜 필요한가 (2026-09-15)
 *   넓은 모니터(높이 1000px 안팎)에 맞춰 블록 글자·폭을 키웠더니, 노트북(보이는 높이
 *   650~800px)에서는 블록 위아래가 잘려 '한 화면에 블록 하나' 가 깨졌다. 재 보니
 *   블록 내용 높이는 화면 높이와 상관없이 고정(소개 620 · 진행 순서 666 · 장소 714 ·
 *   주의사항 800px)이라, 화면이 낮으면 넘칠 수밖에 없었다.
 *
 * 순서
 *   0. **화면 높이에 비례해 모든 블록을 먼저 줄인다**(기본 배율). 넓은 모니터(헤더 뺀 높이
 *      860px 이상)는 1 — 지금 모양 그대로다. 노트북은 그만큼 작아진다.
 *      처음에는 넘칠 때만 줄였더니, 노트북에서 '들어가긴 하지만 여전히 크다' 는 의견(2026-09-16).
 *   1. 기본 배율로 들어가면 그대로 둔다.
 *   2. 아래 여백(기본 화면 높이의 10%)을 줄여서 들어가면 여백만 줄인다.
 *   3. 그래도 넘치면 들어갈 만큼 더 줄인다(transform: scale).
 *   4. 너무 작아져야 들어가는 블록(후기처럼 원래 긴 것)은 기본 배율까지만 줄이고 둔다 —
 *      글씨가 읽기 힘들어진다. 평소처럼 스크롤된다.
 *
 * 왜 zoom 이 아니라 transform 인가
 *   zoom 은 브라우저마다 요소 크기를 재는 값이 달라(확대 전/후) 계산이 어긋난다.
 *   transform 은 레이아웃 크기(offsetHeight)는 그대로, 보이는 크기만 줄어서 원래
 *   높이를 언제든 정확히 잴 수 있다. 대신 줄어든 만큼 자리를 비워 두지 않으므로
 *   바깥 칸 높이(--screen-body-h)를 직접 정해 준다.
 *
 * ⚠️ 이 함수는 toString() 으로 HTML 에 인라인으로도 들어간다(첫 화면이 그려지기 전에
 *    소개 블록을 맞추려고). **바깥 변수·import 를 쓰면 안 된다**(posterFitScript.ts 와 같다).
 * ⚠️ 모바일(768px 미만)은 손대지 않는다. 모바일 화면은 지금이 좋다는 의견.
 */
export function fitScreen(section: HTMLElement): void {
  const PB_RATIO = 0.1;
  const PB_MIN = 28;
  const MIN_SCALE = 0.7;
  // 이 높이(헤더 뺀 화면 높이) 이상이면 원래 크기. 1920×1080 모니터의 크롬은 약 820~860px.
  const REF_AVAIL = 820;
  // 화면이 낮아질수록 비례보다 조금 더 줄인다(1.5제곱). 그냥 비례로 하면 노트북(보이는
  // 높이 약 740px)에서 90% 로 거의 그대로라 여전히 커 보인다.
  const CURVE = 1.5;

  const inner = section.querySelector<HTMLElement>("[data-screen-inner]");
  if (!inner) return;

  const clear = function () {
    section.style.removeProperty("--screen-pb");
    section.style.removeProperty("--screen-body-h");
    section.style.removeProperty("--screen-transform");
  };

  if (!window.matchMedia("(min-width: 768px)").matches) {
    clear();
    return;
  }

  const header = document.querySelector<HTMLElement>("header");
  const vh = window.innerHeight;
  const avail = vh - (header ? header.offsetHeight : 100);
  const pt = parseFloat(getComputedStyle(section).paddingTop) || 0;
  const natural = inner.offsetHeight;
  if (natural === 0) return;

  const base = Math.max(MIN_SCALE, Math.min(1, Math.pow(avail / REF_AVAIL, CURVE)));
  const shown = natural * base;
  let scale = base;
  let pb = -1;
  if (shown + pt + vh * PB_RATIO <= avail) {
    // 1. 기본 배율 그대로
  } else if (shown + pt + PB_MIN <= avail) {
    pb = avail - shown - pt;
  } else {
    const s = (avail - pt - PB_MIN) / natural;
    if (s >= MIN_SCALE) {
      scale = s;
      pb = PB_MIN;
    }
  }

  if (scale === 1 && pb < 0) {
    clear();
    return;
  }
  if (pb >= 0) section.style.setProperty("--screen-pb", Math.floor(pb) + "px");
  else section.style.removeProperty("--screen-pb");
  if (scale < 1) {
    section.style.setProperty("--screen-body-h", Math.ceil(natural * scale) + "px");
    section.style.setProperty("--screen-transform", "scale(" + scale.toFixed(4) + ")");
  } else {
    section.style.removeProperty("--screen-body-h");
    section.style.removeProperty("--screen-transform");
  }
}

/** 페이지 HTML 에 넣을 인라인 스크립트. 대상 블록 바로 뒤에 둔다. */
export function screenFitInlineScript(elementId: string): string {
  return (
    "(function(){var s=document.getElementById(" +
    JSON.stringify(elementId) +
    ");if(!s)return;(" +
    fitScreen.toString() +
    ")(s);})();"
  );
}
