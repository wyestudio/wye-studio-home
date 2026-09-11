import Link from "next/link";
import Image from "next/image";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { ThemeWithTiers } from "@/types/catalog";

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
 * 평소에는 테마 전용 행성 로고가 떠 있고, 마우스를 올리면 세로 카드로
 * 펼쳐지며 포스터와 정보가 드러난다.
 *
 * ⚠️ 변형은 높이와 모서리만 움직인다. 예전에는 aspect-ratio 를 같이 전환해
 *    폭이 먼저 끝나고 비율이 뒤늦게 따라오며 중간에 한 번 멈춘 것처럼 보였다.
 *    모서리도 rounded-full(9999px) 이 아니라 50%→4% 로 준다 — px 로 주면 값이
 *    너무 커서 애니메이션 내내 둥글다가 끝에서만 각이 진다.
 *
 * ⚠️ 격자 자리는 행성 크기로만 잡고, 펼쳐진 카드(가로 100% · 세로 4:5)는 그
 *    위로 떠서 아래로 자란다. 자리를 카드 크기로 잡으면 행성 아래 여백이 너무
 *    커져 이름이 멀어지고, 자리를 hover 때 늘리면 격자 전체가 출렁인다.
 *
 * 터치 기기에는 hover 가 없으므로 행성과 이름만 남는다.
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
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {themes.map((theme) => {
            const poster = theme.hero_image_path || FALLBACK_POSTER;
            // 행성 로고가 없으면 포스터로 때운다. 포스터는 꽉 채워야 원이 되고,
            // 로고는 배경이 비어 있는 그림이라 잘리지 않게 담아야 한다.
            const logo = theme.logo_image_path;

            return (
              <Link key={theme.id} href={`/themes/${theme.slug}`} className="group block">
                {/* 자리는 행성 크기(가로의 70%)로만 잡는다. 펼친 카드는 그 위로 뜬다. */}
                <div className="relative aspect-[10/7]">
                  <div
                    className="absolute left-1/2 top-0 h-full w-[70%] -translate-x-1/2
                               overflow-hidden rounded-[50%] border border-transparent
                               transition-[width,height,border-radius,border-color,box-shadow]
                               duration-500 ease-out
                               [@media(hover:hover)]:group-hover:z-10
                               [@media(hover:hover)]:group-hover:h-[179%]
                               [@media(hover:hover)]:group-hover:w-full
                               [@media(hover:hover)]:group-hover:rounded-[4%]
                               [@media(hover:hover)]:group-hover:border-white/15
                               [@media(hover:hover)]:group-hover:shadow-2xl
                               [@media(hover:hover)]:group-hover:shadow-black/60"
                  >
                    <Image
                      src={logo || poster}
                      alt={`${theme.name} 로고`}
                      fill
                      className={`transition-opacity duration-300
                                  ${logo ? "object-contain" : "object-cover"}
                                  [@media(hover:hover)]:group-hover:opacity-0`}
                      sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                    />

                    {/* 펼쳐졌을 때만 보이는 포스터 + 정보. 터치 기기에서는 영영 안 보인다. */}
                    <div className="hidden [@media(hover:hover)]:block">
                      <Image
                        src={poster}
                        alt={`${theme.name} 포스터`}
                        fill
                        className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                      />
                      <div
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent
                                   p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      >
                        <p className="truncate text-base font-bold text-white">{theme.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-white/70">
                          <DifficultyLocks rating={theme.difficulty} />
                          <span>⏱ {durationLabel(theme.duration_minutes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 평소 이름. 펼쳐지면 카드 안 정보로 대체된다. */}
                <p
                  className="mt-2 text-center text-base font-bold text-white transition-opacity duration-300
                             [@media(hover:hover)]:group-hover:opacity-0"
                >
                  {theme.name}
                </p>
                {!theme.is_active && (
                  <p className="mt-0.5 text-center text-xs text-muted">현재 신청을 받지 않습니다</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
