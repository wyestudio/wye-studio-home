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
import { ThemeSpecs } from "@/components/contents/ThemeSpecs";
import { PosterImage } from "@/components/contents/PosterImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { normalizeThemeContent, tidySynopsis, type ThemeContent } from "@/types/catalog";
import { SessionPicker, type PickerSession } from "./SessionPicker";
import { DetailTabs } from "./DetailTabs";

/*
  이 페이지는 동적으로 그린다. 대신 **데이터에 캐시가 걸려 있다**
  (src/lib/themes.ts — 테마 5분 / 회차·집계 30초).

  ⚠️ 페이지에 revalidate 를 걸어봤지만 무시됐다. Supabase 서버 클라이언트가
     쿠키를 읽고, Next 는 쿠키를 건드리는 페이지를 무조건 동적으로 확정한다.
     그래서 캐시는 데이터 단위로 둔다.
*/
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
const DEFAULT_ACCENT = "#3dffb0";

export async function generateMetadata({
  params,
}: PageProps<"/themes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlug(slug);
  if (!theme) return { title: "테마를 찾을 수 없습니다" };

  // ⚠️ 브랜드는 붙이지 않는다. 루트 레이아웃이 "우주이스케이프 | %s" 템플릿으로
  //    한 번 감싸므로, 여기서 또 붙이면 "우주이스케이프 | 바-ㅇ탈출 | 우주이스케이프"
  //    가 된다(브라우저 탭·검색 결과 제목에 그대로 나갔다).
  const title = theme.name;
  // 공유 카드 제목은 템플릿을 안 타므로 여기서 직접 브랜드를 붙인다.
  const socialTitle = `${theme.name} | 우주이스케이프`;
  // 검색 결과와 공유 카드에 같이 쓰인다. 어드민의 '한 줄 소개'(tagline)가
  // 먼저고, 없으면 시놉시스(description)로 떨어진다.
  const description =
    theme.tagline?.trim() ||
    theme.description?.trim() ||
    `${theme.name} — 여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/themes/${theme.slug}` },
    openGraph: { title: socialTitle, description, url: `${SITE_URL}/themes/${theme.slug}` },
    // 잠긴 테마·목록에서 뺀 테마는 색인하지 않는다. 사이트맵에서 빼는 것만으로는
    // 부족하다 — 어디선가 링크가 걸리면 크롤러가 그 길로 들어온다.
    ...(theme.is_locked || !theme.is_listed
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default async function ThemeDetailPage({ params }: PageProps<"/themes/[slug]">) {
  const { slug } = await params;

  const theme = await getThemeBySlug(slug);
  if (!theme) notFound();

  // is_active 는 '신청 받기' 여부일 뿐이다. 꺼져 있어도 페이지는 보여준다.
  // 잠긴 테마는 신청도 받지 않는다 — 목록·홈에서 못 들어오게 막아둔 곳을
  // 주소로 직접 열고 신청까지 되면 막아둔 의미가 없다.
  const acceptingApplications = theme.is_active && !theme.is_locked;

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
  // 컬럼(p30)이 아직 없는 DB 에서 읽어도 깨지지 않게.
  const genres = theme.genres ?? [];
  const synopsis = tidySynopsis(theme.description);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20">
      {/* 모바일에서만 — 소개 / 회차 선택 / 상세 정보 사이를 오가는 탭 */}
      <DetailTabs accent={accent} />

      {/*
        ── 상단: 테마 소개 ──
        방탈출 손님이 고르는 기준(난이도 · 시간 · 장르 · 시놉시스)을 첫 화면에 크게 둔다.
        날짜 선택은 아래 별도 섹션으로 내렸다 — 포스터 옆을 달력이 차지하고 있어
        정작 테마 정보가 작은 글씨 한 줄로 밀려나 있었다.

        같은 요소를 화면 폭에 따라 다르게 배치한다(grid-template-areas):
          모바일   제목 / [포스터 | 난이도·시간·장르] / 시놉시스
          데스크톱 [포스터 | 제목 · 난이도·시간·장르 · 시놉시스]
        요소를 두 번 그리지 않으려고 순서 대신 영역 이름으로 자리를 정한다.
      */}
      <section
        id="intro"
        className="grid scroll-mt-28 grid-cols-2 gap-x-3.5 gap-y-5 pt-6
                   [grid-template-areas:'title_title'_'poster_specs'_'synopsis_synopsis']
                   md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-[auto_auto_1fr] md:gap-x-10 md:gap-y-6 md:pt-10
                   md:[grid-template-areas:'poster_title'_'poster_specs'_'poster_synopsis']
                   lg:grid-cols-[20rem_minmax(0,1fr)]"
      >
        <div className="self-start [grid-area:poster]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/15 bg-surface">
            <PosterImage
              src={theme.hero_image_path}
              alt={`${theme.name} 포스터`}
              sizes="(min-width: 1024px) 320px, (min-width: 768px) 288px, 45vw"
              priority
            />
          </div>
        </div>

        <div className="min-w-0 [grid-area:title]">
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
        </div>

        <div className="min-w-0 self-start [grid-area:specs]">
          <ThemeSpecs
            difficulty={theme.difficulty}
            durationMinutes={theme.duration_minutes}
            genres={genres}
            accent={accent}
          />
        </div>

        {synopsis && (
          <div className="min-w-0 [grid-area:synopsis]">
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.3em]"
              style={{ color: accent }}
            >
              Synopsis
            </p>
            {/*
              pre-wrap: 입력한 줄바꿈과 **띄어쓰기 개수까지** 그대로 보여준다.
              pre-line 이면 빈칸 여러 개가 한 칸으로 합쳐져 운영자가 잡은 모양이 무너진다.
              break-words: 빈칸 없이 긴 줄이 모바일 화면 밖으로 삐져나가지 않게.
            */}
            <p
              className="whitespace-pre-wrap break-words border-l-2 pl-4 text-base leading-[1.85] text-white/90 sm:pl-5 sm:text-lg lg:text-xl"
              style={{ borderColor: `${accent}80` }}
            >
              {synopsis}
            </p>
          </div>
        )}
      </section>

      {/* ── 날짜 선택 ── 상세 설명 블록과 같은 모양의 섹션으로 */}
      <section id="booking" className="mt-20 scroll-mt-28 sm:mt-28">
        <SectionHeading eyebrow="BOOKING" title="날짜 선택" className="mb-6" eyebrowColor={accent} />
        <div className="mx-auto max-w-3xl">
          <Suspense fallback={<div className="text-sm text-muted">불러오는 중…</div>}>
            <SessionPicker
              themeSlug={theme.slug}
              sessions={sessions}
              accentColor={accent}
              accepting={acceptingApplications}
              openingDate={theme.opening_date}
            />
          </Suspense>
        </div>
      </section>

      {/* ── 상세 정보 ── */}
      <div id="detail" className="mt-24 scroll-mt-28 sm:mt-32">
        {/*
          어드민에서 쌓은 블록 순서대로. 가격표도 블록 중 하나다 —
          예전에는 여기 하드코딩돼 있어서 순서를 바꾸거나 감출 수 없었다.
        */}
        <ThemeBlocks
          blocks={content.blocks}
          accent={accent}
          tiers={theme.tiers}
          maxGroupSize={theme.max_group_size}
        />
      </div>

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
