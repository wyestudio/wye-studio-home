import { cookies } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getThemeBySlug, getUpcomingSessionsForTheme, attachStats, isBookable } from "@/lib/themes";
// 날짜 형식은 완료 화면·참여내역 조회와 같아야 한다. 한 화면 안에서 회차 일시와
// 신청일이 다른 모양이면 같은 종류의 값으로 읽히지 않는다.
import { formatDateTimeFull } from "@/lib/format";
import { ApplyForm } from "./ApplyForm";
import { getActivePromotion, promotionTiersForTheme } from "@/lib/promotions";
import { isEarlyBirdSession } from "@/lib/promotion";

export const dynamic = "force-dynamic";

const DEFAULT_ACCENT = "#3dffb0";

export const metadata: Metadata = {
  title: "참가 신청",
  robots: { index: false },
};

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

  // 잠긴 테마는 신청 자체를 받지 않는다(테마 상세의 신청 버튼과 같은 기준).
  if (!theme.is_active || theme.is_locked) {
    return <Fallback slug={slug} accent={accent} message="현재 이 테마는 신청을 받지 않습니다." />;
  }

  if (!isBookable(target, target.stats)) {
    return <Fallback slug={slug} accent={accent} message="선택하신 회차는 마감되었습니다. 다른 날짜를 골라주세요." />;
  }

  /*
    프로모션(얼리버드).

    ⚠️ 적용 여부는 **고른 회차 하나에 대해 서버가** 판정한다. 폼은 그 판정을
       받아 쓰기만 하고 다시 계산하지 않는다 — 브라우저 시계가 틀어진 기기에서
       화면 금액과 실제 청구액이 갈린다. 인원이 바뀔 때 가격을 고르는 것만
       폼이 한다(구간표를 같이 내려주는 이유).
    ⚠️ 회차에 price_krw_override 가 박혀 있으면 프로모션을 쓰지 않는다 —
       submit_application_v3 도 같은 순서로 판단한다. 두 곳이 어긋나면
       화면에 뜬 할인이 제출에서 사라진다.
  */
  const activePromo = await getActivePromotion();
  const promoTiers = promotionTiersForTheme(activePromo, theme.id);
  const earlyBird =
    activePromo !== null &&
    promoTiers.length > 0 &&
    target.price_krw_override === null &&
    isEarlyBirdSession(activePromo.promo, target.start_at);

  return (
    // 폭·위 여백은 넓은 화면에서 키운다(테마 상세 비율). 하단 고정 버튼 폭도 ApplyForm 에서 같이 맞춘다.
    <main className="mx-auto max-w-2xl px-5 pb-12 pt-8 sm:pt-12 lg:max-w-3xl">
      <ApplyForm
        themeId={theme.id}
        initialCouponCode={couponCode}
        categoryName={
          (theme as { theme_categories?: { name: string } | null }).theme_categories?.name ?? null
        }
        backHref={`/themes/${slug}`}
        sessionId={target.id}
        themeName={theme.name}
        sessionLabel={formatDateTimeFull(target.start_at)}
        minAge={target.min_age}
        maxGroupSize={theme.max_group_size}
        tiers={theme.tiers}
        accentColor={accent}
        promo={
          earlyBird
            ? {
                label: activePromo!.promo.badge_label,
                accentColor: activePromo!.promo.accent_color,
                tiers: promoTiers,
              }
            : null
        }
      />
    </main>
  );
}

function Fallback({ slug, accent, message }: { slug: string; accent: string; message: string }) {
  return (
    <main className="mx-auto max-w-lg px-5 py-24 text-center sm:max-w-xl sm:py-32">
      <p className="font-semibold sm:text-lg lg:text-xl">{message}</p>
      <Link
        href={`/themes/${slug}`}
        className="mt-6 inline-block rounded-lg px-5 py-3 text-sm font-bold sm:mt-8 sm:px-7 sm:py-4 sm:text-base lg:text-lg"
        style={{ backgroundColor: accent, color: "#0a0a12" }}
      >
        날짜 선택하러 가기
      </Link>
    </main>
  );
}
