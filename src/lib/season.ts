/**
 * 시즌 스킨 — 기간 동안만 사이트에 씌우는 장식(할로윈 등).
 *
 * 켜고 끄는 건 어드민 > 시즌 스킨이다(site_settings 'site.season', 읽기는 siteSeason.ts).
 * 켜지면 루트 레이아웃이 <html data-season="halloween"> 을 달고, 장식과 색은 전부
 * season.css 가 그 표시를 보고 바꾼다. 꺼지면 표시가 없어 원래 화면 그대로다.
 *
 * ⚠️ 이 파일은 클라이언트에서도 읽는다. 감출 값을 두지 않는다.
 */
export const SITE_SKINS = ["halloween"] as const;
export type SiteSkin = (typeof SITE_SKINS)[number];

export function isSiteSkin(v: unknown): v is SiteSkin {
  return typeof v === "string" && (SITE_SKINS as readonly string[]).includes(v);
}

export const SITE_SKIN_LABELS: Record<SiteSkin, string> = {
  halloween: "할로윈",
};

/**
 * 할로윈 동안 테마 상세의 파티모드 강조색(원래 민트).
 * 인라인 style 로 칠해지는 색이라 CSS 로는 못 바꿔서 서버에서 갈아 끼운다(themes/[slug]/page.tsx).
 */
export const HALLOWEEN_ACCENT = "#ffae49";
