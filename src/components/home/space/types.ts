import type { ThemeWithTiers } from "@/types/catalog";

/** 행성 둘레를 도는 위성 하나 — 모드 또는 단체 대관. 서버(src/lib/homeOrbits.ts)가 만든다. */
export type HomeOrbit = {
  key: string;
  label: string;
  /** 좁은 자리용 짧은 이름 — 파티 · 노말 · 단체(테마 목록 휴대폰 카드) */
  short: string;
  href: string;
  color: string;
  /** 시간과 진행 방식 한 줄. 예: 180분 팀 경쟁 */
  spec: string;
};

export type HomeThemeCard = ThemeWithTiers & { orbits?: HomeOrbit[] };

/**
 * 장면에 놓이는 행성 한 자리. 테마 행성 + 맨 끝의 '출시 예정' 자리.
 * 출시 예정은 DB 에 없는 자리표시라 화면이 붙인다.
 */
export type PlanetSlot =
  | { kind: "theme"; theme: HomeThemeCard }
  | { kind: "soon" };
