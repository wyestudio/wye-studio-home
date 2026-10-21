import type { SiteSkin } from "@/lib/season";

export type MascotId = "woodju" | "is" | "kape";

export type MascotMeta = {
  id: MascotId;
  name: string;
  alt: string;
  orbitSrc: string;
  orbitWidth: number;
  orbitHeight: number;
  orbitScale: number;
  cursorSrc: string;
  cursorWidth: number;
  cursorHeight: number;
};

export const MASCOT_ORDER: MascotId[] = ["woodju", "is", "kape"];

// mascot-woodju.png / mascot-kape-hero.png were mislabeled from the start —
// the file named "woodju" actually shows 케이프's blob art, and the file named
// "kape-hero" actually shows 우쥬's cloud art. Confirmed against user-supplied
// reference cutouts (2026-08-11) and fixed here without renaming the on-disk
// files (other places, e.g. Header.tsx, already reference mascot-kape.png
// correctly since that one was never mislabeled).
export const MASCOTS: Record<MascotId, MascotMeta> = {
  woodju: {
    id: "woodju",
    name: "우쥬",
    alt: "",
    orbitSrc: "/mascot-kape-hero.png",
    orbitWidth: 90,
    orbitHeight: 72,
    orbitScale: 1,
    cursorSrc: "/mascot-woodju-cursor.png",
    cursorWidth: 45,
    cursorHeight: 36,
  },
  is: {
    id: "is",
    name: "이스",
    alt: "",
    // 2026-08-11: 이스 캐릭터 디자인이 교체됨(파랑 혜성 → 빨강 혜성), 정사각(1:1) 비율.
    orbitSrc: "/mascot-is.png",
    orbitWidth: 65,
    orbitHeight: 65,
    orbitScale: 1,
    cursorSrc: "/mascot-is-cursor.png",
    cursorWidth: 38,
    cursorHeight: 38,
  },
  kape: {
    id: "kape",
    name: "케이프",
    alt: "",
    orbitSrc: "/mascot-woodju.png",
    orbitWidth: 72,
    orbitHeight: 58,
    orbitScale: 1,
    cursorSrc: "/mascot-kape-cursor.png",
    cursorWidth: 54,
    cursorHeight: 44,
  },
};

export const DEFAULT_MASCOT_ID: MascotId = "kape";

export function isMascotId(value: string | null): value is MascotId {
  return value === "woodju" || value === "is" || value === "kape";
}

/*
  시즌 스킨(할로윈) 동안 홈 궤도·자유이동에 쓰는 그림 (2026-10-21 대표님 선택).
    우쥬 — 꼬마 유령 · 이스 — 뱀파이어 · 케이프 — 미라
  원본 시안(우쥬·이스·케이프 할로윈 시트)에서 잘라 배경을 지웠다(public/season/halloween/).
  크기는 원래 그림과 눈으로 비슷한 덩치가 되게 잡았다 — 그림마다 가로세로 비율이 달라
  원래 값을 그대로 쓰면 이스(망토)가 작아 보인다.
  마우스 커서(마스코트를 눌러 고르는 것)도 같은 그림을 작게 쓴다.
*/
type MascotArt = Pick<
  MascotMeta,
  "orbitSrc" | "orbitWidth" | "orbitHeight" | "cursorSrc" | "cursorWidth" | "cursorHeight"
>;
const HALLOWEEN_ART: Record<MascotId, MascotArt> = {
  woodju: {
    orbitSrc: "/season/halloween/mascot-wooju-ghost.png",
    orbitWidth: 96,
    orbitHeight: 67,
    cursorSrc: "/season/halloween/mascot-wooju-ghost.png",
    cursorWidth: 50,
    cursorHeight: 35,
  },
  is: {
    orbitSrc: "/season/halloween/mascot-is-vampire.png",
    orbitWidth: 100,
    orbitHeight: 59,
    cursorSrc: "/season/halloween/mascot-is-vampire.png",
    cursorWidth: 58,
    cursorHeight: 34,
  },
  kape: {
    orbitSrc: "/season/halloween/mascot-kape-mummy.png",
    orbitWidth: 70,
    orbitHeight: 62,
    cursorSrc: "/season/halloween/mascot-kape-mummy.png",
    cursorWidth: 48,
    cursorHeight: 42,
  },
};

// 매번 새 객체를 만들지 않게 한 번만 만든다(effect 의존성·메모가 흔들리지 않게).
const HALLOWEEN_MASCOTS: Record<MascotId, MascotMeta> = {
  woodju: { ...MASCOTS.woodju, ...HALLOWEEN_ART.woodju },
  is: { ...MASCOTS.is, ...HALLOWEEN_ART.is },
  kape: { ...MASCOTS.kape, ...HALLOWEEN_ART.kape },
};

/**
 * 홈 자유이동(MascotFreeRoam)에서 마스코트마다 다르게 움직이는 방식.
 *   top · bottom — 돌아다닐 세로 띠(화면 높이 대비, 마스코트 중심 기준). 없으면 어디든.
 *   speed        — 기본 걷기 속도 대비 배율. 없으면 1.
 *   noPause      — 목표에 닿아도 멈추지 않고 바로 다음 곳으로.
 */
export type RoamStyle = {
  top?: number;
  bottom?: number;
  speed?: number;
  noPause?: boolean;
  /**
   * 그림이 원래 바라보는 쪽. 주면 가는 방향에 맞춰 좌우를 뒤집는다 —
   * 바라보는 쪽으로 갈 때는 그대로, 반대로 갈 때는 뒤집어서.
   */
  faces?: "left" | "right";
};

/*
  할로윈 (2026-10-21 대표님)
    뱀파이어 이스 — 하늘을 날듯 맨 위에서만, 초당 약 131px
    미라 케이프   — 맨 아래를 기어다니듯, 초당 약 31px
    유령 우쥬     — 어디든, 멈추지 않고 스르륵, 초당 약 81px (기준)
  속도는 기본 걷기 속도(초당 80px) 대비 배율이다. 실측 평균은 도착 때 잠깐 쉬는 시간만큼
  조금 낮게 나온다 — 그만큼 얹어 맞췄다(1280×800 에서 30초 실측).
*/
export const HALLOWEEN_ROAM: Partial<Record<MascotId, RoamStyle>> = {
  // 바라보는 쪽(2026-10-21 대표님): 우쥬는 오른쪽, 이스·케이프는 왼쪽을 보고 있는 그림이다.
  is: { top: 0, bottom: 0.2, speed: 1.78, faces: "left" },
  // 1 까지 두면 마스코트(이름표 자리만큼 아래로 치우쳐 있다)가 화면 밑에 잘린다.
  kape: { top: 0.84, bottom: 0.9, speed: 0.39, faces: "left" },
  woodju: { noPause: true, speed: 1, faces: "right" },
};

/** 지금 스킨에 맞는 마스코트 목록. 스킨이 없으면 원래 것. */
export function mascotsForSkin(skin: SiteSkin | null): Record<MascotId, MascotMeta> {
  return skin === "halloween" ? HALLOWEEN_MASCOTS : MASCOTS;
}
