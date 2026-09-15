/**
 * 날짜 선택(#booking)으로 **부드럽게** 스크롤한다.
 *
 * 링크(href="#booking")만 두면 그 자리로 뚝 떨어져 어디로 옮겨졌는지 감이 안 온다
 * (2026-09-15 의견). 스크롤 모션을 보여줘 '아래로 내려왔다' 는 느낌을 준다.
 * 섹션의 scroll-mt(헤더 높이만큼 여백)는 scrollIntoView 도 지킨다.
 *
 * 링크의 href 는 그대로 둔다 — 스크립트가 안 돌아도 이동은 된다.
 */
export function scrollToBooking(e?: { preventDefault: () => void }) {
  const target = document.getElementById("booking");
  if (!target) return;
  e?.preventDefault();
  // 움직임 줄이기를 켠 사용자에게는 모션 없이 옮긴다.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // ⚠️ 주소창에 #booking 을 붙이지 않는다. 날짜를 고르면 ?d= 를 router.replace 로
  //    바꾸는데, 직접 history 를 건드리면 Next 라우터 상태와 어긋날 수 있다.
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
