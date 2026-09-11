import Link from "next/link";
import Image from "next/image";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { ThemeWithTiers } from "@/types/catalog";

const DEFAULT_ACCENT = "#3dffb0";
/** 대표 이미지가 없을 때 쓰는 기본 아트웍. */
const FALLBACK_POSTER = "/bar-o-title.png";

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
 * 테마 목록 — 행성에서 카드로.
 *
 * 우주 컨셉에 맞춰 평소에는 동그란 행성으로 떠 있다가, 마우스를 올리면
 * 네모난 카드로 펼쳐지며 정보가 드러난다.
 *
 * ⚠️ 자리(공간)는 펼쳐진 크기로 미리 잡아둔다. hover 때 높이가 커지면
 *    격자 전체가 밀려 다른 카드들이 출렁인다.
 *
 * 터치 기기에는 hover 가 없으므로 원형 그대로 두고 이름만 보여준다.
 * 눌러야 알 수 있는 정보는 모바일에서 영영 안 보이기 때문이다.
 */
export function ThemeShowcase({ themes }: { themes: ThemeCardData[] }) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14">
      <SectionHeading eyebrow="CONTENTS" />

      {themes.length === 0 ? (
        <div className="mt-10 rounded-xl border border-white/15 bg-white/5 p-10 text-center">
          <p className="font-semibold">현재 공개된 컨텐츠가 없습니다.</p>
          <p className="mt-2 text-sm text-muted">새 컨텐츠가 준비되면 안내드릴게요.</p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {themes.map((theme) => {
            const accent = theme.accent_color || DEFAULT_ACCENT;

            return (
              <Link key={theme.id} href={`/themes/${theme.slug}`} className="group block">
                {/* 펼쳐진 크기로 자리를 잡아둔다 (모바일은 원형이라 정사각) */}
                <div className="relative aspect-square [@media(hover:hover)]:aspect-[4/5]">
                  <div
                    className="absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2
                               overflow-hidden rounded-full border border-white/15
                               transition-[width,border-radius,aspect-ratio] duration-500 ease-out
                               [@media(hover:hover)]:w-[86%]
                               [@media(hover:hover)]:group-hover:aspect-[4/5]
                               [@media(hover:hover)]:group-hover:w-full
                               [@media(hover:hover)]:group-hover:rounded-xl"
                  >
                    <Image
                      src={theme.hero_image_path || FALLBACK_POSTER}
                      alt={`${theme.name} 포스터`}
                      fill
                      className="object-cover"
                      sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                    />
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <h3 className="text-sm font-bold" style={{ color: accent }}>
                    {theme.name}
                  </h3>

                  {/* 난이도·시간은 펼쳤을 때만. 모바일에서는 이름만 남는다. */}
                  <div
                    className="mt-1.5 hidden flex-col items-center gap-1 text-xs text-muted
                               opacity-0 transition-opacity duration-300
                               [@media(hover:hover)]:flex [@media(hover:hover)]:group-hover:opacity-100"
                  >
                    <DifficultyLocks rating={theme.difficulty} />
                    <span>⏱ {durationLabel(theme.duration_minutes)}</span>
                  </div>

                  {!theme.is_active && (
                    <p className="mt-1 text-[11px] text-muted">현재 신청을 받지 않습니다</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
