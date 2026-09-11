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
import { formatKrw } from "@/lib/format";
import Image from "next/image";
import { ThemeBlocks } from "@/components/contents/ThemeBlocks";
import { PriceTable } from "@/components/contents/PriceTable";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { HudCard } from "@/components/ui/HudCard";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { normalizeThemeContent, type ThemeContent } from "@/types/catalog";
import { SessionPicker, type PickerSession } from "./SessionPicker";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
const FALLBACK_POSTER = "/bar-o-title.png";
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

/** 시작 시각 + 경과 분 → 표시용 시각. 회차 시각이 몇 시든 자동 계산된다. */
function offsetToTime(startAt: string, offsetMin: number): string {
  const t = new Date(new Date(startAt).getTime() + offsetMin * 60_000);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(t);
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

  // 타임테이블은 "첫 신청 가능 회차"를 기준으로 보여준다.
  // 시각이 달라도 offset_min 으로 저장돼 있어 자동으로 다시 계산된다.
  const sampleSession = sessions.find((s) => s.bookable) ?? sessions[0] ?? null;

  const minUnit = theme.tiers.length ? Math.min(...theme.tiers.map((t) => t.unit_price_krw)) : null;
  const maxUnit = theme.tiers.length ? Math.max(...theme.tiers.map((t) => t.unit_price_krw)) : null;
  const hours = Math.floor(theme.duration_minutes / 60);
  const mins = theme.duration_minutes % 60;
  const durationLabel = mins === 0 ? `${hours}시간` : `${hours}시간 ${mins}분`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      {/* ── 헤더: 좌 포스터 / 우 정보 ── */}
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="mx-auto w-56 shrink-0 sm:mx-0 sm:w-64">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/15 bg-surface">
            <Image
              src={theme.hero_image_path || FALLBACK_POSTER}
              alt={`${theme.name} 포스터`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 256px, 224px"
              priority
            />
          </div>
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{theme.name}</h1>
          {categoryName && (
            <p className="mt-1.5 text-xl font-bold sm:text-2xl" style={{ color: accent }}>
              {categoryName}
            </p>
          )}
          {theme.tagline && <p className="mt-3 text-muted">{theme.tagline}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <DifficultyLocks rating={theme.difficulty} />
            <span>⏱ {durationLabel}</span>
          </div>

          {theme.description && (
            <p className="mt-5 whitespace-pre-line leading-relaxed">{theme.description}</p>
          )}

          <div className="mt-6">
            <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} />
          </div>
        </div>
      </header>

      {/* ── 날짜 선택 (핵심) ── */}
      <section className="mb-14 scroll-mt-20" id="booking">
        <SectionHeading eyebrow="BOOKING" title="날짜를 선택해주세요" align="left" eyebrowColor={accent} />
        <div className="mt-5">
          <Suspense fallback={<div className="text-sm text-muted">불러오는 중…</div>}>
            <SessionPicker
              themeSlug={theme.slug}
              sessions={sessions}
              tiers={theme.tiers}
              accentColor={accent}
              accepting={acceptingApplications}
            />
          </Suspense>
        </div>
      </section>

      {/* ── 참가비 ── */}
      {theme.tiers.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="PRICE" title="인원별 참가비" align="left" eyebrowColor={accent} />
          <div className="mt-5">
            <PriceTable tiers={theme.tiers} maxGroupSize={theme.max_group_size} accent={accent} />
          </div>
        </section>
      )}

      {/* ── 상세 콘텐츠 (어드민에서 쌓은 블록 순서대로) ── */}
      <ThemeBlocks
        blocks={content.blocks}
        accent={accent}
        sampleStartAt={sampleSession?.start_at ?? null}
      />



      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
