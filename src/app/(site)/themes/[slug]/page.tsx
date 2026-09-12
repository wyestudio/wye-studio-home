import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getThemeBySlug,
  getUpcomingSessionsForTheme,
  attachStats,
  remainingSeats,
  isBookable,
} from "@/lib/themes";
import { ThemeBlocks } from "@/components/contents/ThemeBlocks";
import { PosterImage } from "@/components/contents/PosterImage";
import { PriceTable } from "@/components/contents/PriceTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { normalizeThemeContent, type ThemeContent } from "@/types/catalog";
import { SessionPicker, type PickerSession } from "./SessionPicker";
import { DetailTabs } from "./DetailTabs";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
const DEFAULT_ACCENT = "#3dffb0";

export async function generateMetadata({
  params,
}: PageProps<"/themes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlug(slug);
  if (!theme) return { title: "테마를 찾을 수 없습니다" };

  const title = `${theme.name} | 우주이스케이프`;
  const description =
    theme.tagline ?? theme.description ?? `${theme.name} — 우주이스케이프의 파티형 방탈출`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/themes/${theme.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/themes/${theme.slug}` },
  };
}

export default async function ThemeDetailPage({ params }: PageProps<"/themes/[slug]">) {
  const { slug } = await params;

  const theme = await getThemeBySlug(slug);
  if (!theme) notFound();

  // is_active 는 '신청 받기' 여부일 뿐이다. 꺼져 있어도 페이지는 보여준다.
  const acceptingApplications = theme.is_active;

  const rawSessions = await getUpcomingSessionsForTheme(theme.id);
  const withStats = await attachStats(rawSessions);

  const sessions: PickerSession[] = withStats.map((s) => ({
    ...s,
    remaining: remainingSeats(s, s.stats),
    bookable: isBookable(s, s.stats),
  }));

  const accent = theme.accent_color || DEFAULT_ACCENT;
  // 조인 결과라 타입에 없다. 없으면 카테고리 줄을 통째로 생략한다.
  const categoryName =
    (theme as { theme_categories?: { name: string } | null }).theme_categories?.name ?? null;
  // 옛 4칸 구조(for_you/steps/timetable/precautions)로 저장된 테마도 읽어준다.
  // 어드민에서 저장하는 순간 새 블록 구조로 덮인다.
  const content: ThemeContent = normalizeThemeContent(theme.content);

  const hours = Math.floor(theme.duration_minutes / 60);
  const mins = theme.duration_minutes % 60;
  const durationLabel = mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20">
      {/* 모바일에서만 — 회차 선택 / 상세 정보 사이를 오가는 탭 */}
      <DetailTabs accent={accent} />

      {/*
        ── 상단: 좌 포스터 / 우 정보 + 예약 ──
        예약을 아래 별도 섹션으로 내리면 첫 화면에서 "언제 갈 수 있는지"가
        안 보인다. 포스터 옆 빈 공간이 그 자리다.
      */}
      <div className="grid gap-6 pt-6 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-8 md:pt-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/*
          넓은 화면에서는 포스터를 오른쪽 칸 높이에 맞춰 늘린다. 그래야
          포스터 아래끝 = 달력 아래끝 = 신청 버튼 아래끝이 한 선에 놓인다.
          칸 너비(20rem)를 4:5 에 가깝게 잡아 잘려나가는 부분은 거의 없다.
        */}
        <div className="mx-auto w-44 shrink-0 sm:w-52 md:mx-0 md:w-full lg:h-full">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/15 bg-surface lg:aspect-auto lg:h-full">
            <PosterImage
              src={theme.hero_image_path}
              alt={`${theme.name} 포스터`}
              sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, 208px"
              priority
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div>
            {/*
              제목 줄: 테마명 + 카테고리 배지 / 오른쪽 끝에 공유.
              카테고리를 아래 줄에 크게 두면 부제처럼 읽혀서 분류라는 게 안 보인다.
            */}
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{theme.name}</h1>
                {categoryName && (
                  <span
                    className="rounded-full border px-2.5 py-1 text-xs font-bold"
                    style={{
                      color: accent,
                      borderColor: `${accent}59`,
                      backgroundColor: `${accent}1f`,
                    }}
                  >
                    {categoryName}
                  </span>
                )}
              </div>
              <div className="shrink-0">
                <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <DifficultyLocks rating={theme.difficulty} />
              <span>⏱ {durationLabel}</span>
            </div>

            {/*
              장소는 대략 위치만 내보낸다. 정확한 주소는 진행 이틀 전 문자로만
              간다 — 매번 파티룸을 대관하는 구조라 미리 공개할 수 없다.
            */}
            {theme.venue && (
              <p className="mt-2 text-sm text-muted">
                📍 {theme.venue.area_label}
                <span className="text-xs"> · 정확한 주소는 진행 이틀 전 문자로 안내드려요</span>
              </p>
            )}

            {theme.description && (
              <p className="mt-4 whitespace-pre-line leading-relaxed">{theme.description}</p>
            )}
          </div>

          <section id="booking" className="mt-6 flex flex-1 scroll-mt-28 flex-col">
            <Suspense fallback={<div className="text-sm text-muted">불러오는 중…</div>}>
              <SessionPicker
                themeSlug={theme.slug}
                sessions={sessions}
                accentColor={accent}
                accepting={acceptingApplications}
                openingDate={theme.opening_date}
              />
            </Suspense>
          </section>
        </div>
      </div>

      {/* ── 상세 정보 ── */}
      <div id="detail" className="mt-24 scroll-mt-28 sm:mt-32">
        {theme.tiers.length > 0 && (
          <section className="mb-24 sm:mb-32">
            <SectionHeading eyebrow="PRICE" title="인원별 참가비" eyebrowColor={accent} />
            {/* 폭은 아래 블록들과 맞춘다. 좁게 잡았더니 혼자만 쪼그라들어 보였다. */}
            <div className="mt-5 w-full">
              <PriceTable tiers={theme.tiers} maxGroupSize={theme.max_group_size} accent={accent} />
            </div>
          </section>
        )}

        {/* 어드민에서 쌓은 블록 순서대로 */}
        <ThemeBlocks blocks={content.blocks} accent={accent} />
      </div>

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
