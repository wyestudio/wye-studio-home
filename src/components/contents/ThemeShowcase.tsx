import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PosterImage } from "@/components/contents/PosterImage";
import { themeTitleFontClass, type ThemeWithTiers } from "@/types/catalog";

export type ThemeCardData = ThemeWithTiers & {
  /** 앞으로 남은 회차 수 */
  upcomingCount: number;
  /** 가장 가까운 회차 시작 시각 (없으면 null) */
  nextStartAt: string | null;
};

/**
 * 테마 목록 — 포스터 카드.
 *
 * 예전에는 행성 로고가 떠 있다가 hover 하면 카드로 펼쳐졌는데, 목록에서는
 * 포스터만 보이는 게 낫다는 결정이 나서 걷어냈다. 행성 로고 자체는 홈의
 * 'Planets to Escape' 와 어드민 설정에 그대로 남아 있다 — 목록에 다시
 * 쓰고 싶어지면 `themes.logo_image_path` 를 그대로 쓰면 된다.
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
        /*
          격자 대신 flex — 테마가 열 수보다 적을 때 왼쪽에 붙지 않고 가운데로
          모인다. 폭은 gap(1.25rem)을 뺀 뒤 열 수로 나눠 격자와 똑같이 맞춘다.
        */
        <div className="mt-10 flex flex-wrap justify-center gap-5">
          {themes.map((theme) => {
            return (
              <Link
                key={theme.id}
                href={`/themes/${theme.slug}`}
                /* 모서리는 둥글리지 않는다 — 각진 쪽이 더 정제돼 보인다는 결정. */
                className="group basis-[calc((100%-1.25rem)/2)] overflow-hidden border border-white/12
                           bg-white/[0.03] transition-colors duration-200 hover:border-white/30
                           sm:basis-[calc((100%-2.5rem)/3)] lg:basis-[calc((100%-3.75rem)/4)]"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/[0.02]">
                  <PosterImage
                    src={theme.hero_image_path}
                    alt={`${theme.name} 포스터`}
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                  />
                </div>

                <div className="border-t border-white/12 p-3">
                  {/* 글꼴은 테마마다 다르다 — 어드민에서 고른다. */}
                  <p className={`truncate text-base font-bold text-white ${themeTitleFontClass(theme.title_font)}`}>
                    {theme.name}
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    🔒 난이도 {theme.difficulty} · ⏱ {theme.duration_minutes}분
                  </p>
                  {!theme.is_active && (
                    <p className="mt-1 text-xs text-muted">현재 신청을 받지 않습니다</p>
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
