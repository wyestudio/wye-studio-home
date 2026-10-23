import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getThemeBySlug,
  getThemeVariants,
  getPublicSessionsForTheme,
  attachStats,
  remainingSeats,
  isBookable,
  isPastSession,
  getMonthlyRankings,
} from "@/lib/themes";
import { ThemeBlocks } from "@/components/contents/ThemeBlocks";
import { SitePopupMount } from "@/components/promo/SitePopupMount";
import { getActivePromotion, promotionTiersForTheme } from "@/lib/promotions";
import {
  isEarlyBirdSession,
  maxDiscountLabel,
  promotionUnitPrice,
} from "@/lib/promotion";
import {
  ThemeSpecs,
} from "@/components/contents/ThemeSpecs";
import { PosterImage } from "@/components/contents/PosterImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  INTRO_SCREEN_SECTION,
  SCREEN_SECTION,
  SCREEN_SCROLL_MARGIN,
} from "@/components/contents/screenSection";
import { RichText } from "@/components/ui/RichText";
import { ShareButton } from "@/components/ui/ShareButton";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import {
  blocksForMode,
  normalizeThemeContent,
  tidySynopsis,
  type ThemeContent,
} from "@/types/catalog";
import { GROUP_ENTRY, hasGroupBooking } from "@/lib/groupBooking";
import { PrivateRoomPanel } from "@/components/group/PrivateRoomPanel";
import { SessionPicker, type CalendarMode, type PickerSession } from "./SessionPicker";
import { DetailTabs } from "./DetailTabs";
import { SectionNav } from "./SectionNav";
import { ScrollToBookingButton } from "./ScrollToBookingButton";
import { CategoryLabel } from "./CategoryLabel";
import { ModeBox, modeHref, modeKey } from "./ModeBox";
import { ModeHud } from "./ModeHud";
import { getSiteSkin } from "@/lib/siteSeason";
import { HalloweenEventSection } from "./HalloweenEventSection";
import { HALLOWEEN_ACCENT } from "@/lib/season";
import { PosterSeasonDecor, SeasonArt } from "@/components/season/SeasonArt";
import { SectionViewTracker } from "./SectionViewTracker";

/*
  이 페이지는 동적으로 그린다. 대신 **데이터에 캐시가 걸려 있다**
  (src/lib/themes.ts — 테마 5분 / 회차·집계 30초).

  ⚠️ 페이지에 revalidate 를 걸어봤지만 무시됐다. Supabase 서버 클라이언트가
     쿠키를 읽고, Next 는 쿠키를 건드리는 페이지를 무조건 동적으로 확정한다.
     그래서 캐시는 데이터 단위로 둔다.
*/
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
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
  // 어드민의 '한 줄 소개'(tagline)가 먼저고, 없으면 시놉시스(description)로 떨어진다.
  const synopsis = theme.tagline?.trim() || theme.description?.trim() || "";
  const fallback = `${theme.name} — 여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출`;

  // 공유 카드(og)는 줄바꿈까지 적은 그대로 내보낸다 — 카카오톡 카드에서는
  // 선택지 아트웍(`> [YES]  [NO]`)이 살아 있어야 한다.
  const shareDescription = synopsis || fallback;

  // ⚠️ 검색 결과용은 따로 만든다(2026-09-19). '한 줄 소개'는 실제로는 시놉시스라
  //    "미남아, 소개팅 받아볼래?" 처럼 극중 대사로 시작한다. 그대로 내보내면
  //    우리가 팔지 않는 소개팅을 파는 것처럼 읽혀서 앞에 '시놉시스'를 붙인다
  //    (소개팅·커플매칭은 2026-09-13부터 운영하지 않는다 — layout.tsx 참고).
  //    선택지 아트웍 줄은 검색에선 잡음이라 빼고, 줄바꿈은 한 칸으로 접는다.
  //    ⚠️ 화면 문구는 건드리지 않는다. 페이지에는 적은 그대로 나가야 한다.
  const searchBody = synopsis
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const searchDescription = searchBody ? `시놉시스 · ${searchBody}` : fallback;

  return {
    title,
    description: searchDescription,
    alternates: { canonical: `${SITE_URL}/themes/${theme.slug}` },
    openGraph: {
      title: socialTitle,
      description: shareDescription,
      url: `${SITE_URL}/themes/${theme.slug}`,
    },
    // 잠긴 테마·목록에서 뺀 테마는 색인하지 않는다. 사이트맵에서 빼는 것만으로는
    // 부족하다 — 어디선가 링크가 걸리면 크롤러가 그 길로 들어온다.
    ...(theme.is_locked || !theme.is_listed
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default async function ThemeDetailPage({
  params,
  searchParams,
}: PageProps<"/themes/[slug]">) {
  const { slug } = await params;
  /*
    주소의 ?d=(처음 열 날짜)를 **서버에서** 읽어 SessionPicker 에 내려준다.

    ⚠️ 클라이언트에서 next/navigation 훅으로 읽으면 Suspense 경계가 필요한데,
       그 경계가 운영 빌드에서 postponed 로 남아 달력이 '불러오는 중…' 에서
       멈췄다(2026-10-07). 개발 빌드에서는 재현되지 않아 더 늦게 발견됐다.
  */
  const sp = await searchParams;
  const dParam = typeof sp?.d === "string" ? sp.d : null;

  const base = await getThemeBySlug(slug);
  if (!base) notFound();

  /*
    모드(바-ㅇ탈출 파티/노말).

    한 테마를 모드로 나눌 때 **테마 행을 하나 더** 만들었다(마이그레이션
    20261008063528). 주소는 /themes/baotalchul 하나로 두고 ?mode= 로 오간다.

    ⚠️ 아래 전부 — 스펙·장르·시놉시스·가격표·상세블록·회차·프로모션 — 가 고른
       모드의 테마를 본다. 그래서 여기서 theme 을 바꿔 두고, 밑에서는 모드를
       다시 신경 쓰지 않는다.
    ⚠️ ?mode 가 이 묶음에 없는 값이면 **기본 모드로 떨어뜨린다.** 주소는 누구나
       고칠 수 있어서, 모르는 값에 404 를 주면 공유 링크가 깨진 것처럼 보인다.
  */
  const variants = base.variant_group ? await getThemeVariants(base.variant_group) : [];

  /*
    대표 모드가 아닌 모드의 주소(/themes/baotalchul-normal)로 들어오면 대표 주소 +
    ?mode= 로 보낸다(2026-10-18). 이 주소로 그리면 아래 모드 찾기가 대표 모드(파티)로
    떨어져, **노말을 보던 사람이 파티 화면을 받는다** — 조회 결과의 '테마 보기',
    예전 회차 선택이 남긴 주소가 이 길로 들어왔다.
  */
  if (variants.length >= 2 && variants[0].id !== base.id && variants.some((v) => v.id === base.id)) {
    const q = new URLSearchParams({ mode: modeKey(variants[0].slug, base.slug) });
    if (dParam) q.set("d", dParam);
    redirect(`/themes/${variants[0].slug}?${q.toString()}`);
  }

  const modeParam = typeof sp?.mode === "string" ? sp.mode : null;
  const theme =
    (modeParam
      ? variants.find(
          (v) =>
            modeKey(base.slug, v.slug) === modeParam ||
            v.slug === modeParam ||
            v.id === modeParam
        )
      : null) ??
    variants[0] ??
    base;

  // is_active 는 '신청 받기' 여부일 뿐이다. 꺼져 있어도 페이지는 보여준다.
  // 잠긴 테마는 신청도 받지 않는다 — 목록·홈에서 못 들어오게 막아둔 곳을
  // 주소로 직접 열고 신청까지 되면 막아둔 의미가 없다.
  const acceptingApplications = theme.is_active && !theme.is_locked;

  const rawSessions = await getPublicSessionsForTheme(theme.id);

  // 이달의 랭킹(theme_rankings). 랭킹 블록이 없는 테마도 읽지만 가볍다(이달치 몇 줄).
  const rankingMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })
    .format(new Date())
    .slice(0, 7);
  const rankings = await getMonthlyRankings(theme.id, rankingMonth);
  const withStats = await attachStats(rawSessions);

  /*
    프로모션(얼리버드).

    ⚠️ 어느 회차가 대상인지는 **여기 서버에서** 판정해 화면에 내려준다.
       브라우저에서 다시 계산하면 시계가 틀어진 기기에서 "화면엔 얼리버드,
       제출하면 기본가" 가 된다. 실제 청구액은 신청 순간 DB 가 또 한 번
       판정한다(submit_application_v3 → resolve_promotion_price).
  */
  const activePromo = await getActivePromotion();
  const promoTiers = promotionTiersForTheme(activePromo, theme.id);
  const now = new Date();

  const sessions: PickerSession[] = withStats.map((s) => ({
    ...s,
    remaining: remainingSeats(s, s.stats),
    bookable: isBookable(s, s.stats),
    // 화면에는 자리가 없는 회차와 똑같이 '마감' 으로 나간다. 이 값이 따로
    // 필요한 건 마감 클릭 지표에서 빼기 위해서다(SessionPicker 의 onClick).
    past: isPastSession(s.start_at),
    earlyBird:
      activePromo !== null &&
      promoTiers.length > 0 &&
      isEarlyBirdSession(activePromo.promo, s.start_at, now),
  }));

  /*
    실제로 **지금 얼리버드로 신청할 수 있는 회차가 하나라도 있을 때만** 프로모션
    화면을 켠다. 기간은 열려 있는데 남은 회차가 전부 마감일(days_before) 안쪽이면,
    받을 수 없는 할인가를 표에 세워 두는 꼴이 된다.
  */
  const promoUsable =
    activePromo !== null &&
    promoTiers.length > 0 &&
    sessions.some((s) => s.earlyBird && s.bookable);

  // 배너의 '최대 N% OFF'. 운영자가 문구를 직접 적었으면 그게 이긴다.
  const promoHighlight = promoUsable
    ? maxDiscountLabel(
        activePromo!.promo,
        theme.tiers
          .map((t) => ({
            base: t.unit_price_krw,
            promo: promotionUnitPrice(promoTiers, t.min_headcount),
          }))
          .filter(
            (p): p is { base: number; promo: number } => p.promo !== null,
          ),
      )
    : null;

  const accent = theme.accent_color || DEFAULT_ACCENT;

  /*
    한 달력에 모든 모드의 회차를 찍는다(2026-10-19 대표님) — 파티(기본) 화면으로 들어온
    손님에게 노말 회차가 안 열린 것처럼 보였다. 지금 모드는 위에서 만든 sessions 를 쓰고,
    다른 모드는 같은 규칙(bookable · earlyBird)으로 날짜별 상태만 만든다.
    ⚠️ 회차·집계는 30초 캐시라(src/lib/themes.ts) 모드를 하나 더 읽어도 가볍다.
  */
  const kstDay = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
  const calendarModes: CalendarMode[] | null =
    variants.length >= 2
      ? await Promise.all(
          variants.map(async (v) => {
            const tiers = promotionTiersForTheme(activePromo, v.id);
            const list =
              v.id === theme.id
                ? sessions.map((s) => ({ start_at: s.start_at, bookable: s.bookable, earlyBird: s.earlyBird }))
                : (await attachStats(await getPublicSessionsForTheme(v.id))).map((s) => ({
                    start_at: s.start_at,
                    bookable: isBookable(s, s.stats),
                    earlyBird:
                      activePromo !== null &&
                      tiers.length > 0 &&
                      isEarlyBirdSession(activePromo.promo, s.start_at, now),
                  }));
            const days: CalendarMode["days"] = {};
            for (const s of list) {
              const d = kstDay(s.start_at);
              const prev = days[d];
              days[d] = {
                hasOpen: (prev?.hasOpen ?? false) || s.bookable,
                hasEarlyBird: (prev?.hasEarlyBird ?? false) || s.earlyBird,
              };
            }
            // 배너·가격표와 같은 규칙 — 지금 얼리버드로 신청할 수 있는 회차가 있을 때만 노랑.
            const usable = list.some((s) => s.earlyBird && s.bookable);
            return {
              id: v.id,
              label: v.variant_label ?? v.name,
              accent: v.accent_color || DEFAULT_ACCENT,
              href: modeHref(base.slug, variants, v),
              promoColor: usable ? activePromo!.promo.accent_color : null,
              promoLabel: activePromo?.promo.badge_label ?? "얼리버드",
              days,
            };
          }),
        )
      : null;
  /*
    모드가 둘 이상일 때만 첫 화면을 두 칸으로 쪼갠다.

    ⚠️ 이 판정을 빼면 **모드가 없는 테마에서 오른쪽 칸이 통째로 빈다.** 운영에는
       아직 variant_group 이 없어서 전 테마가 여기에 걸린다 — 격자만 깔고 채울 게
       없으면 포스터가 화면 왼쪽 절반에 혼자 남는다.
  */
  const hasModes = variants.length >= 2;
  /*
    **테마에 딸린 것**과 **모드에 딸린 것**을 가른다.

    시놉시스·포스터는 테마의 것이다 — 같은 「바-ㅇ탈출」인 이상 모드를 바꿨다고
    이야기와 그림이 달라질 리 없다(2026-10-08 대표님). 그래서 **대표 모드(첫 번째)
    것을 두 모드가 같이 쓴다.**

    ⚠️ DB 의 노말 행에 같은 글을 복사해 넣지 않는다. 두 벌이 되면 **반드시 한쪽만
       고치는 날이 온다.** 어드민에서 시놉시스를 고칠 자리는 파티(대표) 행 하나다.
    ⚠️ 카테고리·장르·난이도·소요시간·가격·인원은 반대로 **모드의 것**이라
       theme 에서 그대로 읽는다.
    ⚠️ 상세블록은 둘 다다 — 모드의 블록에 대표 모드가 '두 모드 공통' 으로 켠
       블록을 붙인다(blocksForMode).
  */
  const themeLevel = variants[0] ?? base;
  // 조인 결과라 타입에 없다. 없으면 카테고리 줄을 통째로 생략한다.
  const category =
    (
      theme as {
        theme_categories?: { name: string; description: string | null } | null;
      }
    ).theme_categories ?? null;
  // 옛 4칸 구조(for_you/steps/timetable/precautions)로 저장된 테마도 읽어준다.
  // 어드민에서 저장하는 순간 새 블록 구조로 덮인다.
  const ownContent: ThemeContent = normalizeThemeContent(theme.content);
  const content: ThemeContent =
    theme.id === themeLevel.id
      ? ownContent
      : {
          ...ownContent,
          blocks: blocksForMode(ownContent.blocks, normalizeThemeContent(themeLevel.content).blocks),
        };
  // 컬럼(p30)이 아직 없는 DB 에서 읽어도 깨지지 않게.
  const genres = theme.genres ?? [];
  const synopsis = tidySynopsis(themeLevel.description);

  /*
    시즌 스킨(할로윈) 동안 파티모드 강조색(민트)을 주황으로 바꾼다 — 승인 시안.
    강조색은 인라인 style 로 칠해져 CSS 로는 못 바꾼다.
    ⚠️ **달력(SessionPicker)만은 원래 색**이다. 달력은 파티(초록) · 얼리버드(노랑) ·
       노말(파랑)을 색으로 가르는데, 파티가 주황이 되면 얼리버드 노랑과 헷갈린다.
    ⚠️ 노말모드(시안)는 그대로다. 모드를 색으로 구분하는 건 시즌에도 유지한다.
  */
  const halloween = (await getSiteSkin()) === "halloween";
  const seasonAccent = halloween && theme.id === themeLevel.id ? HALLOWEEN_ACCENT : accent;
  const modeVariants = halloween
    ? variants.map((v) => (v.id === themeLevel.id ? { ...v, accent_color: HALLOWEEN_ACCENT } : v))
    : variants;
  // 칸(p38)이 아직 없는 DB 에서 읽어도 깨지지 않게.
  const introNotice = theme.intro_notice?.trim() || "";
  // 노말모드는 '예약'(themes.booking_verb). 칸이 생기기 전 캐시 응답에는 없다.
  const verb = theme.booking_verb ?? "신청";

  // 자리가 두 군데(모드 있을 때 왼쪽 / 없을 때 오른쪽)라 한 번만 만들어 돌려 쓴다.
  const specs = (
    <ThemeSpecs
      difficulty={theme.difficulty}
      durationMinutes={theme.duration_minutes}
      genres={genres}
      accent={seasonAccent}
    />
  );

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20">
      {/* 모바일에서만 — 소개 / 회차 선택 / 상세 정보 사이를 오가는 탭 */}
      <DetailTabs accent={seasonAccent} />

      {/*
        ── 상단: 테마 소개 ──
        방탈출 손님이 고르는 기준(난이도 · 시간 · 장르 · 시놉시스)을 첫 화면에 크게 둔다.
        날짜 선택은 아래 별도 섹션으로 내렸다 — 포스터 옆을 달력이 차지하고 있어
        정작 테마 정보가 작은 글씨 한 줄로 밀려나 있었다.

        배치(2026-10-08 시안):
          데스크톱  왼쪽 = 테마가 무엇인지(포스터·시놉시스·스펙·장르)
                   오른쪽 = 어떻게 플레이할지(게임식 모드 선택 창)
          모바일    같은 순서로 세로. 포스터와 시놉시스만 가로로 나란히.

        포스터는 **어느 화면에서도 4:5 그대로**다(잘리지 않게).
      */}
      {/*
        첫 화면: 소개 블록. 높이는 내용에 맡기고 아래 여백만 둔다 — 예전에는 화면
        높이를 채우고 안 들어가면 줄였는데(ScreenSnap·ScreenFit), 내용이 적은
        블록이 비어 보여 2026-10-04 에 걷어냈다(screenSection.ts 참고).
      */}
      <div
        id="intro-screen"
        data-screen
        data-nav-label="테마 소개"
        // 어디까지 읽고 나가는지 세는 집계용 키(SectionViewTracker). 라벨과 달리 안 바뀐다.
        data-section-key="intro"
        className={INTRO_SCREEN_SECTION}
      >
        <section
          id="intro"
          className={`grid ${SCREEN_SCROLL_MARGIN} gap-5 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] md:items-start md:gap-x-7 md:gap-y-5`}
        >
          {/*
            제목 줄 — 두 칸 위에 걸친다.
            카테고리(강조색 작은 글씨 + 설명 물음표)를 위에, 테마명을 아래, 공유를 오른쪽 끝에.
            카테고리를 제목 옆 알약으로 두면 장르 태그와 구분이 안 됐다(CategoryLabel 참고).
          */}
          <div className="min-w-0 md:col-span-2">
            {category && <CategoryLabel category={category} accent={seasonAccent} />}
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {/*
                  ⚠️ **base.name 이다.** 테마명 자체는 모드를 달고 있을 수 있는데
                     (문자·어드민·정산이 그 이름을 쓴다), 화면에서는 모드 창이 이미
                     모드를 말하므로 제목에까지 넣으면 같은 말이 두 번 나온다.
                */}
                <h1 className="text-h1 font-extrabold">{base.name}</h1>
              </div>
              <div className="shrink-0">
                <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} accent={seasonAccent} />
              </div>
            </div>
          </div>

          {/*
            왼쪽 — 테마가 무엇인지. 포스터·시놉시스·난이도/시간·장르.

            ⚠️ 예전에는 포스터 높이를 오른쪽 칸 높이에 맞췄다(PosterFit). 오른쪽이
               '제목+스펙+시놉시스' 라 길이가 들쭉날쭉했기 때문이다. 지금은 오른쪽이
               모드 창 하나라 맞출 대상이 없고, 포스터는 제 칸 폭을 그냥 채운다.
               그래서 PosterFit 과 인라인 스크립트를 걷어냈다(2026-10-08).
            ⚠️ 모바일은 포스터와 시놉시스를 가로로 나란히 둔다. 세로로 쌓으면
               첫 화면이 포스터만으로 꽉 찬다.
          */}
          {/*
            왼쪽 묶음 — 포스터 · 시놉시스 · 스펙.

            ⚠️ **칸마다 묶음 하나씩**이다. 예전에는 네 조각을 격자에 직접 넣고
               col-start/row-start 로 자리를 줬는데, 행 높이가 **가장 큰 조각**에
               맞춰지는 바람에 모드 창 아래로 83px 이 비었다(2026-10-09 지적).
               묶음으로 싸면 각자 제 내용만큼만 쌓인다.
          */}
          <div className="flex min-w-0 flex-col gap-4">
            {/*
              포스터 + 시놉시스.

              ⚠️ 폭에 따라 방향이 **반대**다 — 시안도 그렇다.
                 좁을 때  : 포스터 7rem 을 왼쪽에, 시놉시스를 오른쪽에 가로로.
                            세로로 쌓으면 포스터(4:5)만 436px 이라 첫 화면이 포스터
                            하나로 꽉 찬다(2026-10-09 실측).
                 sm 이상  : 포스터가 칸 전체 폭, 시놉시스는 그 아래.
              ⚠️ 데스크톱 포스터 폭은 격자 비율이 정한다. 여기서 max-w 로 묶지 말 것 —
                 묶으면 오른쪽 모드 창과 높이가 안 맞는다.
              ⚠️ 시안은 0.85fr(포스터 404px)인데 **0.65fr(309px)로 줄였다.** 시안대로
                 두면 왼쪽이 741px 이라 오른쪽 모드 창(610)보다 131px 길고, 소개
                 섹션이 983px 이 된다. 0.65 에서 좌우가 621 : 610 으로 맞는다
                 (2026-10-09 실측, 대표님이 "시안보다 살짝 작아도 무방" 하다 하심).
            */}
            <div
              className={
                synopsis
                  ? "grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-1 sm:gap-3"
                  : "max-w-[7rem] sm:max-w-none"
              }
            >
              <div className="season-poster-frame relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface">
                <PosterImage
                  src={themeLevel.hero_image_path}
                  alt={`${theme.name} 포스터`}
                  sizes="(min-width: 640px) 420px, 7rem"
                  priority
                />
                {/*
                  시즌 장식 — 테마 목록 카드와 같은 것. 모바일에서 시놉시스 옆 7rem 포스터일
                  때는 태그가 안 들어가 작은 쪽(compact)을 쓴다.
                */}
                {themeLevel.hero_image_path && (
                  <>
                    <span className={synopsis ? "sm:hidden" : ""}>
                      <PosterSeasonDecor compact />
                    </span>
                    <span className={synopsis ? "hidden sm:inline" : "hidden"}>
                      <PosterSeasonDecor />
                    </span>
                  </>
                )}
              </div>

              {synopsis && (
                <div className="min-w-0">
                  <p
                    className="mb-1.5 font-galmuri text-micro tracking-[0.2em]"
                    style={{ color: seasonAccent }}
                  >
                    SYNOPSIS
                  </p>
                  <SynopsisText text={synopsis} accent={seasonAccent} />
                </div>
              )}
            </div>

            {hasModes && specs}
          </div>

          {/*
            오른쪽 묶음 — 어떻게 플레이할지.
            모드가 하나뿐인 테마에서는 ModeBox 가 null 이라 스펙이 그 자리를 메운다.
          */}
          <div className="flex min-w-0 flex-col gap-4">
            <ModeBox variants={modeVariants} active={theme} baseSlug={base.slug} accent={seasonAccent} />
            {!hasModes && specs}
          </div>
        </section>

        <ScrollToBookingButton accent={seasonAccent} themeName={theme.name} verb={verb} />
      </div>

      {/*
        단체 예약 — 포스터와 모드 창 **둘 다의 아래**, 가로로 길게(2026-10-09 대표님).
        ⚠️ 첫 화면(intro-screen) **밖**이다. 안에 두면 소개 섹션이 한 화면을 넘긴다.
           여기까지는 스크롤해서 봐도 된다고 정했다.
        ⚠️ 모드가 아니라 **base 테마** 기준으로 판정한다. 변형 테마의 slug 는
           `baotalchul-normal` 이라 그대로 넣으면 노말모드에서만 사라진다.
      */}
      {hasGroupBooking(base.slug) && (
        <PrivateRoomPanel entry={GROUP_ENTRY.intro} className="mt-6" />
      )}

      {/*
        강조 안내(themes.intro_notice).

        ⚠️ **첫 화면(intro-screen) 밖**에 둔다. 안에 두면 공지 + 위아래 여백으로
           92px 을 먹어 소개 섹션이 한 화면을 넘겼다(2026-10-09 실측).
           내용도 "정식 오픈 회차는 …" 처럼 **회차 이야기**라 여기가 제 자리다.
      */}
      {introNotice && (
        <div
          className="mt-6 rounded-xl border px-4 py-3 sm:px-5 sm:py-3.5"
          style={{
            borderColor: `${accent}59`,
            backgroundColor: `${accent}14`,
          }}
        >
          <RichText
            text={introNotice}
            className="block text-body-sm leading-relaxed text-foreground"
          />
        </div>
      )}

      {/* ── 날짜 선택 ── '신청하기' 로 스크롤해 오면 헤더 밑에 붙는다(SCREEN_SCROLL_MARGIN). */}
      <section
        id="booking"
        data-screen
        data-nav-label="회차 선택"
        // 퍼널의 '회차 선택까지 내려옴' 칸이 이 키를 센다. 바꾸면 ga4.ts 도 같이.
        data-section-key="booking"
        className={`${SCREEN_SECTION} ${SCREEN_SCROLL_MARGIN}`}
      >
        <SectionHeading
          eyebrow="BOOKING"
          // 달력 위에 이미 '날짜 선택' 이 있어 겹친다. 블록 제목은 '회차 선택'.
          title="회차 선택"
          titleDecor={<SeasonArt art="ghost" className="season-heading-ghost" />}
          className="mb-6 sm:mb-10"
          eyebrowColor={seasonAccent}
          size="lg"
        />
        <div className="mx-auto w-full max-w-4xl">
          {/*
            ⚠️ key 는 모드마다 다르게 둔다. 모드 전환은 주소만 바꾸는 이동이라 key 가
               없으면 이 컴포넌트가 그대로 남아, 앞 모드에서 고른 날(파티 토요일)을
               들고 노말모드로 넘어가 "이 날짜에는 회차가 없습니다" 가 뜬다. 새로
               그려지면 그 모드에서 신청 가능한 가장 가까운 날이 선택된다.
          */}
          <SessionPicker
            key={theme.id}
            initialDateParam={dParam}
            themeSlug={theme.slug}
            themeName={theme.name}
            sessions={sessions}
            accentColor={accent}
            accepting={acceptingApplications}
            openingDate={theme.opening_date}
            modeLabel={hasModes ? theme.variant_label : null}
            calendarModes={calendarModes}
            activeModeId={theme.id}
            verb={verb}
            promo={
              promoUsable
                ? {
                    badgeLabel: activePromo!.promo.badge_label,
                    accentColor: activePromo!.promo.accent_color,
                    bannerTitle:
                      activePromo!.promo.banner_title ||
                      activePromo!.promo.name,
                    bannerBody: activePromo!.promo.banner_body,
                    bannerHighlight: promoHighlight,
                    bannerNote: activePromo!.promo.banner_note,
                  }
                : null
            }
          />
        </div>
      </section>

      {/*
        ── 할로윈 이벤트 안내 ── 회차 선택과 CONTENTS 사이. 스킨이 켜져 있으면 바-ㅇ탈출
        파티·노말 두 모드 모두(2026-10-23 대표님). 스킨을 끄면 같이 사라진다.
        모드는 같은 주소(?mode=)라 묶음 대표(base)의 slug 로 가른다.
      */}
      {halloween && base.slug === "baotalchul" && (
        <div className={`mx-auto w-full max-w-4xl ${SCREEN_SECTION}`}>
          <HalloweenEventSection />
        </div>
      )}

      {/* ── 상세 정보 ── */}
      <div id="detail" className={SCREEN_SCROLL_MARGIN}>
        {/*
          어드민에서 쌓은 블록 순서대로. 가격표도 블록 중 하나다 —
          예전에는 여기 하드코딩돼 있어서 순서를 바꾸거나 감출 수 없었다.
        */}
        <ThemeBlocks
          blocks={content.blocks}
          accent={seasonAccent}
          tiers={theme.tiers}
          maxGroupSize={theme.max_group_size}
          minGroupSize={theme.min_group_size}
          recommendedGroupSize={theme.recommended_group_size}
          venue={theme.venue}
          // 단체 예약을 받는 테마만 가격표 아래에 안내 카드를 붙인다 —
          // 안내 페이지의 조건(3시간·6~24명·단독 진행)이 테마별로 다르다.
          // base 기준이다. 변형 테마의 slug(baotalchul-normal)로 보면
          // 노말모드에서만 단체 안내가 사라진다.
          groupBooking={hasGroupBooking(base.slug)}
          verb={verb}
          rankings={rankings}
          rankingMonth={rankingMonth}
          promo={
            promoUsable
              ? {
                  label: activePromo!.promo.badge_label,
                  accentColor: activePromo!.promo.accent_color,
                  tiers: promoTiers,
                  note: activePromo!.promo.banner_note,
                }
              : null
          }
        />
      </div>

      {/*
        상세를 끝까지 읽은 뒤 바로 신청하러 올라갈 수 있게. 모바일은 하단 고정 버튼이 있어 뺀다
        (ScrollToBookingButton 이 sm 이상에서만 보인다).
      */}
      <div className="flex justify-center pb-16 sm:pb-24">
        <ScrollToBookingButton
          accent={seasonAccent}
          themeName={theme.name}
          direction="up"
          className="mt-0 md:mt-0"
          verb={verb}
        />
      </div>

      {/*
        스크롤을 따라다니는 모드 전환 패드.
        예전에는 회차 선택 위·가격표 위에 토글을 따로 박아 뒀는데, 블록이 늘 때마다
        또 박아야 했다. 하나로 띄워 두고 어디서든 바꾼다(2026-10-09 대표님).
        ⚠️ 모드를 바꾸면 고른 날짜(?d=)는 버린다 — 모드마다 여는 요일이 달라
           넘겨봐야 없는 날이고, 남겨 두면 '마감' 뿐인 달력이 된다.
      */}
      <ModeHud variants={modeVariants} activeId={theme.id} baseSlug={base.slug} accent={seasonAccent} />

      {/* 넓은 화면 왼쪽 목차 — 지금 보는 블록 표시 + 눌러서 이동 */}
      <SectionNav accent={seasonAccent} />
      {/* 어느 블록까지 내려가고 멈추는지 기록한다(화면에 아무것도 그리지 않는다) */}
      <SectionViewTracker themeLabel={theme.name} />

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />

      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="theme_detail" />
    </main>
  );
}

/**
 * 시놉시스.
 *
 * ⚠️ `>` 로 시작하는 줄은 **아트웍**이다(`> [YES]   [NO]`). 도트 글꼴에 강조색으로
 *    따로 그린다 — 본문과 같이 흘리면 그냥 깨진 문장으로 보인다.
 *    같은 규칙을 generateMetadata 도 쓴다(검색 설명에서 이 줄을 뺀다).
 * ⚠️ pre-wrap: 입력한 줄바꿈과 **띄어쓰기 개수까지** 그대로 보여준다. pre-line 이면
 *    빈칸 여러 개가 한 칸으로 합쳐져 운영자가 잡은 모양이 무너진다.
 */
function SynopsisText({ text, accent }: { text: string; accent: string }) {
  const lines = text.split("\n");
  const isArt = (line: string) => line.trim().startsWith(">");
  const body = lines.filter((l) => !isArt(l)).join("\n").trim();
  const art = lines.filter(isArt).join("\n").trim();

  return (
    <div className="border-l-2 pl-3 sm:pl-4" style={{ borderColor: `${accent}80` }}>
      {body && (
        <p className="whitespace-pre-wrap break-words text-body leading-[1.7] text-muted">
          {body}
        </p>
      )}
      {art && (
        <p
          className="mt-2 whitespace-pre-wrap break-words font-galmuri text-label leading-[1.6]"
          style={{ color: accent }}
        >
          {art}
        </p>
      )}
    </div>
  );
}
