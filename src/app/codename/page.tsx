import type { Metadata } from "next";
import { CodenameReport } from "./CodenameReport";
import { currentRound, daysLeft } from "./content";

export const metadata: Metadata = {
  title: { absolute: "요원 J 신원 조회" },
  description: "남겨진 단서에서 찾아낸 코드네임을 보고하세요.",
  // 외부 게시물의 링크·QR 로만 도달하는 이벤트 페이지. 검색에 걸릴 필요가 없고,
  // 걸리면 문제를 풀지 않은 사람이 답안 제출 화면부터 보게 된다.
  robots: { index: false, follow: false },
};

// 회차·남은 기간은 날짜로 정해진다. 정적으로 굳어 버리면 마감이 지나도 옛 회차가
// 그대로 보이므로 짧게 재검증한다.
export const revalidate = 60;

export default function CodenamePage() {
  const round = currentRound();
  // 마감된 회차는 D-day 를 계산하지 않는다 — 남은 날이 없다.
  return <CodenameReport round={round} dday={round.closed ? null : daysLeft(round)} />;
}
