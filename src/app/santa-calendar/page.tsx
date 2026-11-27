import { XmasGameScreen, xmasGameMetadata } from "@/components/xmas-game/XmasGameScreen";

/*
  크리스마스 게임 「산타의 어드벤트 캘린더」 — 테마 상세의 이벤트 블록에서 새 창으로 여는 화면.
  기록을 실은 공유 주소는 r/[record] 가 받는다(같은 화면, 공유 카드만 다르다).
  ⚠️ 미리 그려 두는 화면이다 — 왜, 무엇을 읽으면 안 되는지는 XmasGameScreen.tsx 에.
*/
export const metadata = xmasGameMetadata(null);

export const revalidate = 60;

export default function SantaCalendarPage() {
  return <XmasGameScreen />;
}
