import type { Metadata } from "next";
import { XmasGameScreen, xmasGameMetadata } from "@/components/xmas-game/XmasGameScreen";
import { parseShareRecord } from "@/components/xmas-game/xmasGameShared";

/*
  기록을 공유한 주소 — /santa-calendar/r/7-61-3-d (7라운드 61점, 랭킹 3위, 카드 그림은 루돌프).
  화면은 /santa-calendar 와 같다. 다른 것은 공유 카드뿐이다: 제목이 그 사람의 기록이 되고, 그림(opengraph-image.tsx)에
  랭킹 · 점수가 찍힌다. 게임 화면은 주소에서 같은 기록을 읽어 "친구가 … 기록했어요" 를 띄운다(xmasGameShared.ts).

  ⚠️ 주소마다 처음 한 번만 그리고 그 뒤로는 그려 둔 것을 내보낸다(generateStaticParams 가 빈 목록 = 미리 그리지는 않되
     그린 것은 쥐고 있는다). 기록을 ?칸으로 받으면 요청마다 그리게 된다 — 그래서 경로에 싣는다(wye-server-cost).
  ⚠️ 모양이 틀린 주소도 404 로 보내지 않는다. 친구가 보낸 링크가 깨져도 게임은 열려야 한다 — 기록 없는 화면으로 연다.
*/
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ record: string }> }): Promise<Metadata> {
  return xmasGameMetadata(parseShareRecord((await params).record));
}

export default function SantaCalendarSharedPage() {
  return <XmasGameScreen />;
}
