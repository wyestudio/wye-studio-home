import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, renderShareImage } from "@/components/xmas-game/share/xmasShareImage";
import { parseShareRecord } from "@/components/xmas-game/xmasGameShared";

// 기록을 공유했을 때의 카드 그림 — 그 사람의 랭킹 · 점수와 뽑힌 캐릭터. 주소마다 처음 한 번만 그린다.
export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

// 페이지와 같이 "미리 그리지는 않되 한 번 그린 것은 쥐고 있는다". 이 둘이 없으면 그림을 요청마다 다시 그린다 —
// 그림 한 장이 페이지 한 장보다 훨씬 비싸다(wye-server-cost). 빌드 결과에서 이 경로가 ● 로 찍히는지 본다(ƒ 면 풀린 것).
export const dynamic = "force-static";

export function generateStaticParams() {
  return [];
}

export default async function Image({ params }: { params: Promise<{ record: string }> }) {
  return renderShareImage(parseShareRecord((await params).record));
}
