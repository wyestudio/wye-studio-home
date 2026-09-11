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
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { HudCard } from "@/components/ui/HudCard";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { EMPTY_THEME_CONTENT, type ThemeContent } from "@/types/catalog";
import { SessionPicker, type PickerSession } from "./SessionPicker";

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
  const content: ThemeContent = { ...EMPTY_THEME_CONTENT, ...(theme.content ?? {}) };

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
      {/* ── 헤더 ── */}
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{theme.name}</h1>
        {theme.tagline && <p className="mt-2 text-muted">{theme.tagline}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          <DifficultyLocks rating={theme.difficulty} />
          <span>⏱ {durationLabel}</span>
          {minUnit !== null && maxUnit !== null && (
            <span>
              💳 1인 {minUnit === maxUnit ? formatKrw(minUnit) : `${formatKrw(minUnit)}~${formatKrw(maxUnit)}`}
            </span>
          )}
        </div>

        {theme.description && (
          <p className="mt-6 whitespace-pre-line leading-relaxed">{theme.description}</p>
        )}

        <div className="mt-6 flex gap-2">
          <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} />
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

      {/* ── 이런 분께 추천 ── */}
      {content.for_you.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="FOR YOU" title="이런 분께 추천해요" align="left" eyebrowColor={accent} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {content.for_you.map((c, i) => (
              <HudCard key={i} className="p-4">
                <p className="text-lg">{c.emoji}</p>
                <p className="mt-1 font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-muted">{c.desc}</p>
              </HudCard>
            ))}
          </div>
        </section>
      )}

      {/* ── 진행 방식 ── */}
      {content.steps.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="HOW IT WORKS" title="이렇게 진행돼요" align="left" eyebrowColor={accent} />
          <ol className="mt-5 space-y-3">
            {content.steps.map((s, i) => (
              <li key={i} className="flex gap-4 rounded-lg border border-white/12 bg-white/[0.03] p-4">
                <span className="text-2xl leading-none">{s.emoji}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 타임테이블 ── */}
      {content.timetable.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="TIMETABLE" title="진행 순서" align="left" eyebrowColor={accent} />
          {sampleSession && (
            <p className="mt-2 text-xs text-muted">
              아래 시각은 선택하신 회차 시작 시간에 맞춰 자동으로 조정됩니다.
              (예시: {new Intl.DateTimeFormat("ko-KR", {
                timeZone: "Asia/Seoul",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(sampleSession.start_at))} 시작 기준)
            </p>
          )}
          <ol className="mt-5 space-y-2">
            {content.timetable.map((t, i) => (
              <li key={i} className="flex gap-4 border-l-2 pl-4" style={{ borderColor: accent }}>
                <span className="w-14 shrink-0 font-mono text-sm font-bold" style={{ color: accent }}>
                  {sampleSession ? offsetToTime(sampleSession.start_at, t.offset_min) : `+${t.offset_min}분`}
                </span>
                <div className="pb-3">
                  <p className="font-semibold">{t.title}</p>
                  {t.desc && <p className="mt-0.5 text-sm text-muted">{t.desc}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 주의사항 ── */}
      {content.precautions.length > 0 && (
        <section className="mb-14">
          <SectionHeading eyebrow="NOTICE" title="꼭 확인해주세요" align="left" eyebrowColor={accent} />
          <ul className="mt-5 space-y-3">
            {content.precautions.map((p, i) => (
              <li key={i} className="rounded-lg border border-white/12 bg-white/[0.03] p-4">
                <p className="font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-muted">{p.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 하단 안내 ── */}
      <section className="rounded-xl border border-white/15 bg-white/5 p-6 text-center">
        <p className="font-semibold">궁금한 점이 있으신가요?</p>
        <p className="mt-1 text-sm text-muted">
          오른쪽 아래 카카오톡 버튼으로 편하게 문의해주세요.
        </p>
        <a
          href="#booking"
          className="mt-4 inline-block rounded-lg px-5 py-3 text-sm font-bold"
          style={{ backgroundColor: accent, color: "#0a0a12" }}
        >
          날짜 선택하러 가기
        </a>
      </section>

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
