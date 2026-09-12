import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PosterImage } from "@/components/contents/PosterImage";
import { themeTitleFontClass, type ThemeWithTiers } from "@/types/catalog";

/**
 * 잠긴 테마 위에 올리는 자물쇠.
 * 홈(ThemeHomeShowcase)의 자물쇠와 같은 모양·같은 크기 규칙을 쓴다 —
 * 같은 "아직 못 여는 것" 인데 목록과 홈이 다르게 생기면 안 된다.
 */
function LockIcon({ px = 34 }: { px?: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      shapeRendering="crispEdges"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}
      aria-hidden
    >
      <rect x="4" y="9" width="16" height="14" fill="#fff" />
      <path d="M9 9V4.5h6V9" stroke="#fff" strokeWidth="2.2" strokeLinecap="butt" fill="none" />
      <rect x="11" y="13" width="2" height="5" fill="#0a0a12" />
    </svg>
  );
}

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
            const locked = !theme.is_active;

            const body = (
              <>
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/[0.02]">
                  <PosterImage
                    src={theme.hero_image_path}
                    alt={`${theme.name} 포스터`}
                    sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                  />
                  {/*
                    잠긴 테마는 홈의 'Planets to Escape' 와 같은 방식으로 가린다 —
                    포스터 전체에 어두운 베일을 덮고 자물쇠를 올린다.
                  */}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]/70">
                      <LockIcon />
                    </div>
                  )}
                </div>

                <div className="border-t border-white/12 p-3">
                  {/* 글꼴은 테마마다 다르다 — 어드민에서 고른다. */}
                  <p className={`truncate text-base font-bold text-white ${themeTitleFontClass(theme.title_font)}`}>
                    {theme.name}
                  </p>
                  {/* 0 은 '미정' 이라 감춘다 — "난이도 0 · 0분" 은 고장으로 읽힌다. */}
                  {(theme.difficulty > 0 || theme.duration_minutes > 0) && (
                    <p className="mt-1.5 text-xs text-muted">
                      {[
                        theme.difficulty > 0 ? `🔒 난이도 ${theme.difficulty}` : null,
                        theme.duration_minutes > 0 ? `⏱ ${theme.duration_minutes}분` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {locked && (
                    <p className="mt-1 text-xs text-muted">아직 탐사되지 않은 행성입니다</p>
                  )}
                </div>
              </>
            );

            /* 모서리는 둥글리지 않는다 — 각진 쪽이 더 정제돼 보인다는 결정. */
            const base =
              "basis-[calc((100%-1.25rem)/2)] overflow-hidden border border-white/12 bg-white/[0.03] " +
              "sm:basis-[calc((100%-2.5rem)/3)] lg:basis-[calc((100%-3.75rem)/4)]";

            // ⚠️ 잠긴 테마는 Link 로 감싸지 않는다. pointer-events 로만 막으면
            //    키보드 Tab 이동이나 우클릭 '새 탭에서 열기' 로 그대로 들어가진다.
            //    아예 링크가 아니어야 확실히 막힌다(홈의 잠긴 행성과 같은 처리).
            return locked ? (
              <div
                key={theme.id}
                className={`${base} cursor-not-allowed select-none`}
                aria-disabled="true"
                aria-label={`${theme.name} — 아직 탈출할 수 없는 행성입니다`}
              >
                {body}
              </div>
            ) : (
              <Link
                key={theme.id}
                href={`/themes/${theme.slug}`}
                className={`group ${base} transition-colors duration-200 hover:border-white/30`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
