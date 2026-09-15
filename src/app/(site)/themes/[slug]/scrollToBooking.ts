import { scrollToScreen } from "./screenScroll";

/**
 * 날짜 선택(#booking)으로 **부드럽게** 스크롤한다.
 *
 * 링크(href="#booking")만 두면 그 자리로 뚝 떨어져 어디로 옮겨졌는지 감이 안 온다
 * (2026-09-15 의견). 스크롤 모션을 보여줘 '아래로 내려왔다' 는 느낌을 준다.
 *
 * 링크의 href 는 그대로 둔다 — 스크립트가 안 돌아도 이동은 된다.
 */
export function scrollToBooking(e?: { preventDefault: () => void }) {
  const target = document.getElementById("booking");
  if (!target) return;
  e?.preventDefault();
  // ⚠️ 주소창에 #booking 을 붙이지 않는다. 날짜를 고르면 ?d= 를 router.replace 로
  //    바꾸는데, 직접 history 를 건드리면 Next 라우터 상태와 어긋날 수 있다.
  // scrollIntoView(scroll-mt) 대신 도착 위치를 계산한다 — 모바일은 내려갈 때 헤더가
  // 숨어서, 고정 여백으로는 헤더 높이만큼 빈 띠가 남는다(screenScroll.ts).
  // 움직임 줄이기를 켠 사용자에게는 모션 없이 옮긴다(animateScrollTo 가 처리).
  scrollToScreen(target);
}
