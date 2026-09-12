import Link from "next/link";
import { SpinningPlanet } from "@/components/home/SpinningPlanet";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { PosterImage, FALLBACK_LOGO } from "@/components/contents/PosterImage";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-8 sm:gap-10">
      {themes.map((theme) => {
        const accent = theme.accent_color || DEFAULT_ACCENT;
        const logo = theme.logo_image_path || FALLBACK_LOGO;

        return (
          <Link
            key={theme.id}
            href={`/themes/${theme.slug}`}
            className="flex items-center gap-6 sm:gap-10"
          >
            {/*
              ── 행성 ──
              hover 판정은 **행성에만** 건다. 카드 전체에 걸면 옆의 빈 자리에
              커서를 올려도 패널이 떠서, 무엇을 가리키고 있는지가 흐려진다.
              peer 로 오른쪽 형제(패널)를, group 으로 내부(조준 테두리)를 연다.
            */}
            <div className="group peer relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
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
                    "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.26) 0%, transparent 44%), " +
                    "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 74%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0.95) 100%)",
                }}
              />

              {/* 멈춘 순간 '조준됨' 을 알리는 테두리 */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full border opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ borderColor: accent, boxShadow: `0 0 24px -6px ${accent}` }}
              />
            </div>

            {/*
              ── 지령 패널 ──
              모바일에서는 hover 가 없으니 늘 펼쳐 두고 가로를 다 쓴다.
              넓은 화면에서는 내용 크기만큼만 차지한다 — 가로로 길게 늘어나면
              오른쪽이 텅 비어 보인다.
            */}
            <div
              className="min-w-0 flex-1 overflow-hidden rounded-xl border border-white/12 bg-white/[0.04] p-4
                         opacity-100 transition-all duration-500 sm:flex-none
                         [@media(hover:hover)]:-translate-x-3 [@media(hover:hover)]:opacity-0
                         [@media(hover:hover)]:peer-hover:translate-x-0
                         [@media(hover:hover)]:peer-hover:opacity-100
                         [@media(hover:hover)]:peer-hover:border-white/25"
              style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
            >
              <div className="flex gap-4 sm:gap-5">
                {/*
                  포스터는 '미션 파일' 처럼 패널 왼쪽에 끼워둔다.
                  비율은 4:5 그대로 — 원본이 그 비율이라 더 세로로 늘리면 잘린다.
                  키우면 높이도 같이 자란다.
                */}
                <div className="relative hidden aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-lg border border-white/12 sm:block lg:w-44">
                  <PosterImage
                    src={theme.hero_image_path}
                    alt={`${theme.name} 포스터`}
                    sizes="176px"
                  />
                </div>

                <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:justify-center">
                  <h3
                    className={`text-lg font-extrabold ${themeTitleFontClass(theme.title_font)}`}
                    style={{ color: accent }}
                  >
                    {theme.name}
                  </h3>

                  {/* 넓은 화면에서는 테마명 / 난이도 / 시간 세 줄로 선다. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted sm:mt-2 sm:flex-col sm:items-start sm:gap-y-1.5">
                    <DifficultyLocks rating={theme.difficulty} />
                    <span>⏱ {durationLabel(theme.duration_minutes)}</span>
                  </div>

                  {!theme.is_active && (
                    <p className="mt-1.5 text-xs text-muted">현재 신청을 받지 않습니다</p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
