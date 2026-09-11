import Link from "next/link";
import { HudCard } from "@/components/ui/HudCard";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { formatKrw } from "@/lib/format";
import type { ThemeWithTiers } from "@/types/catalog";

const DEFAULT_ACCENT = "#3dffb0";

export type ThemeCardData = ThemeWithTiers & {
  /** 앞으로 남은 회차 수 */
  upcomingCount: number;
  /** 가장 가까운 회차 시작 시각 (없으면 null) */
  nextStartAt: string | null;
};

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 테마 목록.
 *
 * 기존에는 회차 카드가 매주 쌓여 "이 회차랑 저 회차랑 뭐가 다른데?" 가 됐다.
 * 테마 단위로 묶으면 회차가 늘어도 목록은 그대로다.
 * 설계 근거: docs/08-architecture-screens-and-admin.md §1-1
 */
export function ThemeShowcase({ themes }: { themes: ThemeCardData[] }) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14">
      <SectionHeading eyebrow="CONTENTS" title="우주이스케이프의 컨텐츠" />

      {themes.length === 0 ? (
        <div className="mt-10 rounded-xl border border-white/15 bg-white/5 p-10 text-center">
          <p className="font-semibold">현재 공개된 컨텐츠가 없습니다.</p>
          <p className="mt-2 text-sm text-muted">새 컨텐츠가 준비되면 안내드릴게요.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {themes.map((theme) => {
            const accent = theme.accent_color || DEFAULT_ACCENT;
            const prices = theme.tiers.map((t) => t.unit_price_krw);
            const minPrice = prices.length ? Math.min(...prices) : null;
            const maxPrice = prices.length ? Math.max(...prices) : null;

            return (
              <Link key={theme.id} href={`/themes/${theme.slug}`} className="group block">
                <HudCard className="flex h-full flex-col p-6 transition-transform group-hover:-translate-y-0.5">
                  <div className="flex-1">
                    <h3 className="text-xl font-extrabold" style={{ color: accent }}>
                      {theme.name}
                    </h3>
                    {theme.tagline && (
                      <p className="mt-1.5 text-sm text-muted">{theme.tagline}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                      <DifficultyLocks rating={theme.difficulty} />
                      <span>⏱ {durationLabel(theme.duration_minutes)}</span>
                    </div>

                    {minPrice !== null && maxPrice !== null && (
                      <p className="mt-3 text-sm">
                        <span className="text-muted">1인 </span>
                        <strong className="text-base">
                          {minPrice === maxPrice
                            ? formatKrw(minPrice)
                            : `${formatKrw(minPrice)}~${formatKrw(maxPrice)}`}
                        </strong>
                        {minPrice !== maxPrice && (
                          <span className="ml-1 text-xs text-muted">(인원수에 따라 다름)</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-white/12 pt-4">
                    {!theme.is_active ? (
                      <p className="text-sm text-muted">현재 신청을 받지 않습니다</p>
                    ) : theme.upcomingCount > 0 ? (
                      <p className="text-sm">
                        <span style={{ color: accent }}>●</span> 신청 가능한 회차{" "}
                        <strong>{theme.upcomingCount}개</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-muted">예정된 회차 준비 중</p>
                    )}
                    <p className="mt-2 text-sm font-semibold" style={{ color: accent }}>
                      {theme.is_active ? "자세히 보고 날짜 선택하기 →" : "자세히 보기 →"}
                    </p>
                  </div>
                </HudCard>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
