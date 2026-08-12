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
    orbitWidth: 60,
    orbitHeight: 48,
    orbitScale: 1,
    cursorSrc: "/mascot-kape-cursor.png",
    cursorWidth: 45,
    cursorHeight: 36,
  },
};

export const DEFAULT_MASCOT_ID: MascotId = "kape";

export function isMascotId(value: string | null): value is MascotId {
  return value === "woodju" || value === "is" || value === "kape";
}
