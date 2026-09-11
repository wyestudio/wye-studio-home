import Image from "next/image";
import Link from "next/link";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { formatKrw } from "@/lib/format";
import type { ThemeWithTiers } from "@/types/catalog";

const DEFAULT_ACCENT = "#3dffb0";
/** 테마에 대표 이미지가 없을 때 쓰는 기본 아트웍. */
const FALLBACK_POSTER = "/bar-o-title.png";

export type HomeThemeCard = ThemeWithTiers & {
  upcomingCount: number;
};

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 홈 스크롤스테이지의 컨텐츠 씬.
 *
 * 기존에는 회차 카드를 나열해 매주 카드가 늘어났다. 테마 단위로 묶어
 * 회차가 쌓여도 홈 구성이 변하지 않게 한다.
 * 포스터는 테마의 hero_image_path 를 쓰고, 없으면 기본 아트웍으로 떨어진다.
 */
export function ThemeHomeShowcase({
  themes,
  dense = false,
}: {
  themes: HomeThemeCard[];
  dense?: boolean;
}) {
  if (themes.length === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-surface/60 p-8 text-center">
        <p className="font-semibold">준비 중인 컨텐츠가 곧 공개됩니다.</p>
      </div>
    );
  }

  // 테마가 하나면 기존 홈 레이아웃(포스터 + 정보)을 그대로 유지한다.
  const single = themes.length === 1;

  return (
    <div className={single ? "" : `flex flex-col ${dense ? "gap-4" : "gap-8"}`}>
      {themes.map((theme) => {
        const accent = theme.accent_color || DEFAULT_ACCENT;
        const prices = theme.tiers.map((t) => t.unit_price_krw);
        const minPrice = prices.length ? Math.min(...prices) : null;
        const maxPrice = prices.length ? Math.max(...prices) : null;

        return (
          <div
            key={theme.id}
            className={`flex flex-col sm:flex-row sm:items-center sm:gap-8 lg:gap-10 ${
              dense ? "gap-3" : "gap-6"
            }`}
          >
            {/* 포스터 */}
            <div
              className={`mx-auto sm:mx-0 sm:w-64 sm:flex-shrink-0 lg:w-80 ${
                dense ? "w-36" : "w-56"
              }`}
            >
              <Link href={`/themes/${theme.slug}`} className="block">
                <div className="relative aspect-[4/5] overflow-hidden border border-glass-border bg-surface">
                  <Image
                    src={theme.hero_image_path || FALLBACK_POSTER}
                    alt={`${theme.name} 테마 아트웍`}
                    fill
                    className="object-contain"
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 256px, 224px"
                  />
                </div>
              </Link>
            </div>

            {/* 정보 */}
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <h3
                  className={`font-extrabold ${dense ? "text-lg" : "text-xl sm:text-2xl"}`}
                  style={{ color: accent }}
                >
                  {theme.name}
                </h3>
                {theme.tagline && (
                  <p className={`mt-1 text-muted ${dense ? "text-xs" : "text-sm"}`}>
                    {theme.tagline}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <DifficultyLocks rating={theme.difficulty} />
                <span>⏱ {durationLabel(theme.duration_minutes)}</span>
              </div>

              {minPrice !== null && maxPrice !== null && (
                <p className={dense ? "text-sm" : "text-base"}>
                  <span className="text-muted">1인 </span>
                  <strong>
                    {minPrice === maxPrice
                      ? formatKrw(minPrice)
                      : `${formatKrw(minPrice)}~${formatKrw(maxPrice)}`}
                  </strong>
                  {minPrice !== maxPrice && (
                    <span className="ml-1 text-xs text-muted">(인원수에 따라 다름)</span>
                  )}
                </p>
              )}

              <p className="text-xs text-muted">
                {!theme.is_active
                  ? "현재 신청을 받지 않습니다"
                  : theme.upcomingCount > 0
                    ? `신청 가능한 회차 ${theme.upcomingCount}개`
                    : "예정된 회차 준비 중"}
              </p>

              <Link
                href={`/themes/${theme.slug}`}
                className={`mt-1 inline-block self-start rounded-lg font-bold transition-opacity hover:opacity-90 ${
                  dense ? "px-4 py-2 text-sm" : "px-5 py-3 text-sm"
                }`}
                style={{ backgroundColor: accent, color: "#0a0a12" }}
              >
                {theme.is_active ? "날짜 보고 신청하기" : "자세히 보기"}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
