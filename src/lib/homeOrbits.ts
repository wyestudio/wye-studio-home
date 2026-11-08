import "server-only";
import { getThemeVariants, type ThemeDetail } from "@/lib/themes";
import { modeHref } from "@/app/(site)/themes/[slug]/ModeBox";
import { BASE_MINUTES } from "@/lib/groupPricing";
import type { HomeOrbit, HomeThemeCard } from "@/components/home/space/types";
import type { ThemeWithTiers } from "@/types/catalog";

/**
 * 단체 대관을 받는 테마 묶음(variant_group). DB 에 칸이 없다 — 지금은 바-ㅇ탈출 하나라
 * 여기 적는다. 두 번째 테마가 대관을 받게 되면 어드민 칸으로 옮긴다.
 */
const GROUP_RENTAL_GROUPS = new Set(["baotalchul"]);

/** 단체 대관 위성 색. 모드 색(초록 · 하늘)과 겹치지 않게 흰빛으로 둔다. */
const GROUP_RENTAL_COLOR = "#f2f2f7";

/**
 * 모드마다 한 마디 — 홈 패널에서 "몇 분, 어떤 방식" 을 한눈에. 테마 행(slug)에 붙인다.
 * DB 에 칸이 없어 여기 적는다. 새 모드를 만들면 여기에도 한 줄 넣는다(없으면 시간만 나온다).
 * 문구는 대표님이 정했다(2026-11-08).
 */
const MODE_STYLE: Record<string, string> = {
  baotalchul: "팀 경쟁",
  "baotalchul-normal": "단독 플레이",
};

function modeOrbit(baseSlug: string, variants: ThemeDetail[], v: ThemeDetail): HomeOrbit {
  return {
    key: v.slug,
    label: v.variant_label ?? v.name,
    href: modeHref(baseSlug, variants, v),
    color: v.accent_color || "#3dffb0",
    // 가운데점 없이 "180분 팀 경쟁" 처럼 — 0 은 '미정' 이라 시간을 뺀다
    spec: [v.duration_minutes > 0 ? `${v.duration_minutes}분` : null, MODE_STYLE[v.slug] ?? null]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * 홈 Planets to Escape 의 위성 — 모드마다 하나, 단체 대관을 받으면 하나 더.
 * 테마 목록(/contents) 카드의 모드 줄도 같은 값을 쓴다.
 *
 * 노말모드는 목록에서 빠지려고 is_listed 가 꺼져 있어 getListedThemes() 에 안 잡힌다.
 * 그래서 묶음을 따로 읽는다(getThemeVariants 는 5분 캐시 — 상세 페이지와 같은 캐시를 쓴다).
 * 잠긴 테마 · 모드가 하나뿐이고 대관도 없는 테마는 위성이 없다(패널에 모드 줄 없이 테마 버튼만 나온다).
 */
export async function attachOrbits(themes: ThemeWithTiers[]): Promise<HomeThemeCard[]> {
  return Promise.all(
    themes.map(async (t) => {
      if (t.is_locked || !t.variant_group) return t;
      const variants = (await getThemeVariants(t.variant_group)).filter((v) => !v.is_locked);
      const orbits = variants.length >= 2 ? variants.map((v) => modeOrbit(t.slug, variants, v)) : [];
      if (GROUP_RENTAL_GROUPS.has(t.variant_group)) {
        orbits.push({
          key: "group",
          label: "단체 대관",
          href: "/group",
          color: GROUP_RENTAL_COLOR,
          // 단체 대관 기본 진행 시간은 견적 계산(groupPricing.ts)과 같은 값을 쓴다
          spec: `기본 ${BASE_MINUTES}분 팀빌딩/워크숍`,
        });
      }
      return orbits.length > 0 ? { ...t, orbits } : t;
    })
  );
}
