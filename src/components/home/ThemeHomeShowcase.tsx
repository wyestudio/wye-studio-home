import Link from "next/link";
import { SpinningPlanet } from "@/components/home/SpinningPlanet";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { PosterImage, FALLBACK_LOGO } from "@/components/contents/PosterImage";
import { formatKrw } from "@/lib/format";
import { themeTitleFontClass, type ThemeWithTiers } from "@/types/catalog";

const DEFAULT_ACCENT = "#3dffb0";

export type HomeThemeCard = ThemeWithTiers & {
  upcomingCount: number;
};

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 홈 — Planets to Escape.
 *
 * 컨텐츠 목록과 같은 '행성'을 쓰되, 여기서는 자전하듯 계속 돌고 있다가
 * 커서를 올리면 멈추고 **오른쪽에** 지령 패널이 열린다(우주선 계기판에서
 * 미션 브리핑을 받는 느낌). 컨텐츠 목록처럼 행성이 카드로 펼쳐지지는 않는다.
 *
 * ⚠️ 자리는 패널이 열린 크기로 미리 잡아둔다. hover 때 폭이 늘면 옆 행성들이
 *    밀려 출렁인다 — 컨텐츠 목록에서 같은 실수를 한 적이 있다.
 *
 * 터치 기기에는 hover 가 없으므로 패널을 항상 펼쳐 둔다. 눌러야만 보이는
 * 정보는 모바일에서 영영 안 보인다.
 */
export function ThemeHomeShowcase({ themes }: { themes: HomeThemeCard[]; dense?: boolean }) {
  if (themes.length === 0) {
    return (
      <div className="rounded-xl border border-white/15 bg-white/5 p-8 text-center">
        <p className="font-semibold">준비 중인 컨텐츠가 곧 공개됩니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {themes.map((theme) => {
        const accent = theme.accent_color || DEFAULT_ACCENT;
        const prices = theme.tiers.map((t) => t.unit_price_krw);
        const minPrice = prices.length ? Math.min(...prices) : null;
        const maxPrice = prices.length ? Math.max(...prices) : null;
        const logo = theme.logo_image_path || FALLBACK_LOGO;

        return (
          <Link
            key={theme.id}
            href={`/themes/${theme.slug}`}
            className="group flex items-center gap-4 sm:gap-6"
          >
            {/* ── 행성 ── */}
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full sm:h-36 sm:w-36">
              {/*
                자전은 SpinningPlanet 이 캔버스로 그린다. 그림을 옆으로 미는
                방식은 구면 눌림이 없어 "그림이 지나간다" 로만 보였다.
              */}
              <SpinningPlanet
                src={logo}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              />

              {/*
                구체 음영 — 표면과 달리 **움직이지 않는다**. 빛이 한쪽에서
                고정으로 들어오고 그 아래로 지형이 흘러가야 공이 도는 것처럼 보인다.
              */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.28) 0%, transparent 42%), " +
                    "radial-gradient(circle at 50% 50%, transparent 54%, rgba(0,0,0,0.45) 84%, rgba(0,0,0,0.78) 100%)",
                }}
              />

              {/* 멈춘 순간 '조준됨' 을 알리는 테두리 */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full border opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ borderColor: accent, boxShadow: `0 0 24px -6px ${accent}` }}
              />
            </div>

            {/* ── 지령 패널 ── */}
            <div
              className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/12 bg-white/[0.04] p-4
                         opacity-100 transition-all duration-500
                         [@media(hover:hover)]:-translate-x-3 [@media(hover:hover)]:opacity-0
                         [@media(hover:hover)]:group-hover:translate-x-0
                         [@media(hover:hover)]:group-hover:opacity-100
                         [@media(hover:hover)]:group-hover:border-white/25"
              style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
            >
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h3
                      className={`text-lg font-extrabold ${themeTitleFontClass(theme.title_font)}`}
                      style={{ color: accent }}
                    >
                      {theme.name}
                    </h3>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted">
                      {theme.is_active && theme.upcomingCount > 0 ? "OPEN" : "STANDBY"}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <DifficultyLocks rating={theme.difficulty} />
                    <span>⏱ {durationLabel(theme.duration_minutes)}</span>
                  </div>

                  {minPrice !== null && maxPrice !== null && (
                    <p className="mt-1.5 text-sm">
                      <span className="text-muted">1인 </span>
                      <strong>
                        {minPrice === maxPrice
                          ? formatKrw(minPrice)
                          : `${formatKrw(minPrice)}~${formatKrw(maxPrice)}`}
                      </strong>
                    </p>
                  )}

                  <p className="mt-1.5 text-xs text-muted">
                    {!theme.is_active
                      ? "현재 신청을 받지 않습니다"
                      : theme.upcomingCount > 0
                        ? `신청 가능한 회차 ${theme.upcomingCount}개`
                        : "예정된 회차 준비 중"}
                  </p>
                </div>

                {/* 포스터는 '미션 파일' 처럼 패널 한쪽에 끼워둔다. 잘리지 않게 세로 비율 그대로. */}
                <div className="relative hidden aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg border border-white/12 sm:block">
                  <PosterImage
                    src={theme.hero_image_path}
                    alt={`${theme.name} 포스터`}
                    sizes="80px"
                  />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
