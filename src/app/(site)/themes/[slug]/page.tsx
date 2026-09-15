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
import { ThemeSpecTiles, ThemeGenreTile } from "@/components/contents/ThemeSpecs";
import { PosterImage } from "@/components/contents/PosterImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  INTRO_SCREEN_SECTION,
  SCREEN_SECTION,
  SCREEN_SCROLL_MARGIN,
} from "@/components/contents/screenSection";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { normalizeThemeContent, tidySynopsis, type ThemeContent } from "@/types/catalog";
import { SessionPicker, type PickerSession } from "./SessionPicker";
import { DetailTabs } from "./DetailTabs";
import { PosterFit } from "./PosterFit";
import { ScreenSnap } from "./ScreenSnap";
import { ScrollToBookingButton } from "./ScrollToBookingButton";
import { CategoryLabel } from "./CategoryLabel";
import { posterFitInlineScript } from "./posterFitScript";

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
  const category =
    (theme as { theme_categories?: { name: string; description: string | null } | null })
      .theme_categories ?? null;
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
          모바일   제목 / [포스터 | 난이도·시간] / 장르 / 시놉시스
          데스크톱 [포스터 | 제목 · 난이도·시간 · 장르 · 시놉시스]
        요소를 두 번 그리지 않으려고 순서 대신 영역 이름으로 자리를 정한다.

        포스터는 **어느 화면에서도 4:5 그대로**다(잘리지 않게). 높이 맞추기는 이렇게:
          모바일   포스터 옆 난이도·시간 두 칸이 포스터 높이만큼 늘어난다.
                   장르까지 옆에 두면 포스터보다 훨씬 길어져서 장르만 아래로 내렸다.
          데스크톱 PosterFit 이 오른쪽 높이를 재서 포스터 칸 폭(--poster-w)을 정한다.
                   오른쪽 요소는 전부 md:self-start — 늘어나 있으면 잰 높이가 틀어진다.
      */}
      {/*
        첫 화면에는 소개 블록만 — 화면 가운데보다 살짝 위에 띄우고, 아래 날짜 선택이
        같이 보이지 않게 한다. 한 화면에 정보가 몰리면 피로하다는 의견(2026-09-15).
        상세 블록·날짜 선택도 같은 규칙이다(SCREEN_SECTION 참고).
      */}
      <div data-screen className={INTRO_SCREEN_SECTION}>
      <section
        id="intro"
        suppressHydrationWarning
        className="grid scroll-mt-28 grid-cols-2 gap-x-3.5 gap-y-3
                   [grid-template-areas:'title_title'_'poster_specs'_'genres_genres'_'synopsis_synopsis']
                   md:grid-cols-[var(--poster-w,18rem)_minmax(0,1fr)] md:grid-rows-[auto_auto_auto_1fr] md:gap-x-10
                   md:[grid-template-areas:'poster_title'_'poster_specs'_'poster_genres'_'poster_synopsis']
                   lg:grid-cols-[var(--poster-w,20rem)_minmax(0,1fr)]"
      >
        <PosterFit sectionId="intro" />

        {/*
          데스크톱은 크기를 맞추기 전까지 투명하게 둔다(data-poster-fit=done 이 붙으면 보임).
          맞추기는 바로 아래 인라인 스크립트가 화면이 그려지기 전에 끝내므로 기다림은 없다.
          맞추기 전 크기(기본 20rem)로 한 번 그려졌다가 커지는 모습을 보이지 않으려는 것이다.
        */}
        <div
          data-poster
          className="relative aspect-[4/5] self-start overflow-hidden rounded-xl border border-white/15 bg-surface [grid-area:poster]
                     md:opacity-0 md:[[data-poster-fit=done]_&]:opacity-100"
        >
          <PosterImage
            src={theme.hero_image_path}
            alt={`${theme.name} 포스터`}
            sizes="(min-width: 768px) 460px, 50vw"
            priority
          />
        </div>

        <div data-fit-top className="mb-2 min-w-0 self-start [grid-area:title] md:mb-3">
          {/*
            제목 위에 카테고리(강조색 작은 글씨 + 설명 물음표), 아래 줄에 테마명 / 오른쪽 끝에 공유.
            카테고리를 제목 옆 알약으로 두면 장르 태그와 구분이 안 됐다(CategoryLabel 참고).
          */}
          {category && <CategoryLabel category={category} accent={accent} />}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{theme.name}</h1>
            </div>
            <div className="shrink-0">
              <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} />
            </div>
          </div>

          {/* 장소는 여기서 뺐다. 상세 정보의 '진행 장소' 블록(ThemeBlocks)이 보여준다. */}
        </div>

        {/* 모바일은 포스터 높이만큼 늘어나야 해서 self-start 를 데스크톱에만 준다. */}
        <div data-fit-bottom className="min-w-0 [grid-area:specs] md:self-start">
          <ThemeSpecTiles
            difficulty={theme.difficulty}
            durationMinutes={theme.duration_minutes}
            accent={accent}
          />
        </div>

        <div data-fit-bottom className="min-w-0 self-start [grid-area:genres]">
          <ThemeGenreTile genres={genres} accent={accent} />
        </div>

        {synopsis && (
          <div data-fit-bottom className="mt-2 min-w-0 self-start [grid-area:synopsis] md:mt-3">
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
      {/*
        첫 로드 때 포스터 크기를 화면이 그려지기 전에 맞춘다(posterFitScript.ts).
        다른 화면에서 넘어올 때는 이 스크립트가 돌지 않아 PosterFit 이 맡는다.
      */}
      <script dangerouslySetInnerHTML={{ __html: posterFitInlineScript("intro") }} />
      {/* 스크립트가 꺼진 브라우저에서 포스터가 영영 투명하게 남지 않게 */}
      <noscript>
        <style>{`#intro [data-poster]{opacity:1!important}`}</style>
      </noscript>
      <ScrollToBookingButton accent={accent} />
      </div>

      {/* ── 날짜 선택 ── 상세 블록과 같이 한 화면에 하나. '신청하기' 로 스크롤해 오면 화면을 딱 채운다. */}
      <section id="booking" data-screen className={`${SCREEN_SECTION} ${SCREEN_SCROLL_MARGIN}`}>
        <SectionHeading
          eyebrow="BOOKING"
          // 달력 위에 이미 '날짜 선택' 이 있어 겹친다. 블록 제목은 '회차 선택'.
          title="회차 선택"
          className="mb-6 sm:mb-10"
          eyebrowColor={accent}
          size="lg"
        />
        <div className="mx-auto w-full max-w-3xl lg:max-w-4xl">
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
      <div id="detail" className={SCREEN_SCROLL_MARGIN}>
        {/*
          어드민에서 쌓은 블록 순서대로. 가격표도 블록 중 하나다 —
          예전에는 여기 하드코딩돼 있어서 순서를 바꾸거나 감출 수 없었다.
        */}
        <ThemeBlocks
          blocks={content.blocks}
          accent={accent}
          tiers={theme.tiers}
          maxGroupSize={theme.max_group_size}
          venue={theme.venue}
        />
      </div>

      {/*
        상세를 끝까지 읽은 뒤 바로 신청하러 올라갈 수 있게. 모바일은 하단 고정 버튼이 있어 뺀다
        (ScrollToBookingButton 이 sm 이상에서만 보인다).
      */}
      <div className="flex justify-center pb-16 sm:pb-24">
        <ScrollToBookingButton accent={accent} direction="up" className="mt-0 md:mt-0" />
      </div>

      {/* 휠 한 번에 다음 화면 블록으로([data-screen]) */}
      <ScreenSnap />

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
