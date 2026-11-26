import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, renderShareImage } from "@/components/xmas-game/share/xmasShareImage";

// 게임 주소를 그대로 공유했을 때의 카드 그림(기록 없음). 빌드할 때 한 번 그린다.
export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderShareImage(null);
}
