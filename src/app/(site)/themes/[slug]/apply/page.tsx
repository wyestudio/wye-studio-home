import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getThemeBySlug, getUpcomingSessionsForTheme, attachStats, isBookable } from "@/lib/themes";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { ApplyForm } from "./ApplyForm";

export const dynamic = "force-dynamic";

const DEFAULT_ACCENT = "#3dffb0";

export const metadata: Metadata = {
  title: "참가 신청",
  robots: { index: false },
};

const sessionLabel = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export default async function ApplyPage({
  params,
  searchParams,
}: PageProps<"/themes/[slug]/apply">) {
  const { slug } = await params;
  const { session: sessionId } = await searchParams;

  const theme = await getThemeBySlug(slug);

  // 쿠폰 링크(/c/{코드})로 들어왔으면 쿠키에 코드가 담겨 있다. 손으로 칠 일이 없다.
  const couponCode = (await cookies()).get("wye_coupon")?.value ?? "";

  if (!theme) notFound();

  const accent = theme.accent_color || DEFAULT_ACCENT;

  // 회차를 안 골랐거나 잘못된 회차면 선택 화면으로 돌려보낸다.
  if (typeof sessionId !== "string" || !sessionId) {
    return <Fallback slug={slug} accent={accent} message="먼저 날짜와 시간을 선택해주세요." />;
  }

  const sessions = await attachStats(await getUpcomingSessionsForTheme(theme.id));
  const target = sessions.find((s) => s.id === sessionId);

  if (!target) {
    return (
      <Fallback slug={slug} accent={accent} message="선택하신 회차를 찾을 수 없습니다. 다시 선택해주세요." />
    );
  }

  if (!theme.is_active) {
    return <Fallback slug={slug} accent={accent} message="현재 이 테마는 신청을 받지 않습니다." />;
  }

  if (!isBookable(target, target.stats)) {
    return <Fallback slug={slug} accent={accent} message="선택하신 회차는 마감되었습니다. 다른 날짜를 골라주세요." />;
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-12 pt-8">
      <div className="mb-4">
        <Link href={`/themes/${slug}`} className="text-sm text-muted underline">
          ← 날짜 다시 선택
        </Link>
      </div>
      <h1 className="mb-4 text-2xl font-extrabold">참여 신청</h1>

      <ApplyForm
        themeId={theme.id}
        initialCouponCode={couponCode}
        sessionId={target.id}
        themeName={theme.name}
        sessionLabel={sessionLabel(target.start_at)}
        minAge={target.min_age}
        maxGroupSize={theme.max_group_size}
        tiers={theme.tiers}
        accentColor={accent}
        bankInfo={BANK_ACCOUNT}
      />
    </main>
  );
}

function Fallback({ slug, accent, message }: { slug: string; accent: string; message: string }) {
  return (
    <main className="mx-auto max-w-lg px-5 py-24 text-center">
      <p className="font-semibold">{message}</p>
      <Link
        href={`/themes/${slug}`}
        className="mt-6 inline-block rounded-lg px-5 py-3 text-sm font-bold"
        style={{ backgroundColor: accent, color: "#0a0a12" }}
      >
        날짜 선택하러 가기
      </Link>
    </main>
  );
}
