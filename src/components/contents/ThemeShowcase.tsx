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
 * 테마 목록 — 포스터 중심.
 *
 * 카드에 정보를 늘어놓으면 포스터가 묻힌다. 포스터만 보여주고 정보는
 * 마우스를 올렸을 때(터치 기기는 항상) 위에 겹쳐 띄운다.
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
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {themes.map((theme) => {
            const accent = theme.accent_color || DEFAULT_ACCENT;

            return (
              <Link
                key={theme.id}
                href={`/themes/${theme.slug}`}
                className="group relative block overflow-hidden rounded-xl border border-white/15"
              >
                <div className="relative aspect-[4/5] bg-surface">
                  <Image
                    src={theme.hero_image_path || FALLBACK_POSTER}
                    alt={`${theme.name} 포스터`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />

                  {/*
                    정보 오버레이.
                    마우스가 없는 기기(터치)에서는 hover 가 일어나지 않으므로
                    항상 보이게 한다 — 안 그러면 모바일에서 정보가 영영 안 보인다.
                  */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-5 text-center opacity-100 transition-opacity duration-300
                               [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  >
                    <h3 className="text-2xl font-extrabold" style={{ color: accent }}>
                      {theme.name}
                    </h3>
                    <DifficultyLocks rating={theme.difficulty} />
                    <span className="text-sm text-white/80">
                      ⏱ {durationLabel(theme.duration_minutes)}
                    </span>
                    {!theme.is_active && (
                      <span className="text-xs text-white/60">현재 신청을 받지 않습니다</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
