import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getThemeBySlug,
  getThemeVariants,
  getPublicSessionsForTheme,
  attachStats,
  remainingSeats,
  isBookable,
  isPastSession,
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
  ThemeSpecTiles,
  ThemeGenreTile,
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
  normalizeThemeContent,
  tidySynopsis,
  type ThemeContent,
} from "@/types/catalog";
import { GROUP_ENTRY, hasGroupBooking } from "@/lib/groupBooking";
import { PrivateRoomPanel } from "@/components/group/PrivateRoomPanel";
import { SessionPicker, type PickerSession } from "./SessionPicker";
import { DetailTabs } from "./DetailTabs";
import { SectionNav } from "./SectionNav";
import { ScrollToBookingButton } from "./ScrollToBookingButton";
import { CategoryLabel } from "./CategoryLabel";
import { ModeBox, modeKey } from "./ModeBox";
import { ModeToggle } from "./ModeToggle";
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
    ⚠️ 카테고리·장르·난이도·소요시간·가격·인원·상세블록은 반대로 **모드의 것**이라
       theme 에서 그대로 읽는다.
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
  const content: ThemeContent = normalizeThemeContent(theme.content);
  // 컬럼(p30)이 아직 없는 DB 에서 읽어도 깨지지 않게.
  const genres = theme.genres ?? [];
  const synopsis = tidySynopsis(themeLevel.description);
  // 칸(p38)이 아직 없는 DB 에서 읽어도 깨지지 않게.
  const introNotice = theme.intro_notice?.trim() || "";

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20">
      {/* 모바일에서만 — 소개 / 회차 선택 / 상세 정보 사이를 오가는 탭 */}
      <DetailTabs accent={accent} />

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
          className={`grid ${SCREEN_SCROLL_MARGIN} gap-5 ${
            hasModes
              ? "md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start md:gap-x-10 md:gap-y-5"
              : "md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start md:gap-x-10 md:gap-y-5"
          }`}
        >
          {/*
            제목 줄 — 두 칸 위에 걸친다.
            카테고리(강조색 작은 글씨 + 설명 물음표)를 위에, 테마명을 아래, 공유를 오른쪽 끝에.
            카테고리를 제목 옆 알약으로 두면 장르 태그와 구분이 안 됐다(CategoryLabel 참고).
          */}
          <div className="min-w-0 md:col-span-2">
            {category && <CategoryLabel category={category} accent={accent} />}
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
                <ShareButton url={`${SITE_URL}/themes/${theme.slug}`} title={theme.name} />
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
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            <div
              className={
                synopsis
                  ? "grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-1 sm:gap-4"
                  : // 시놉시스가 없으면 옆자리가 비어 포스터만 혼자 쪼그라든다.
                    // 좁은 화면에서는 적당히 키우되 **화면을 다 먹지는 않게** 묶어 둔다.
                    "max-w-[14rem] sm:max-w-none"
              }
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface">
                <PosterImage
                  src={themeLevel.hero_image_path}
                  alt={`${theme.name} 포스터`}
                  sizes="(min-width: 768px) 420px, 40vw"
                  priority
                />
              </div>

              {synopsis && (
                <div className="min-w-0">
                  <p
                    className="mb-2 text-micro font-semibold uppercase tracking-[0.3em]"
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
                    className="whitespace-pre-wrap break-words border-l-2 pl-3 text-body leading-[1.7] text-foreground sm:pl-4"
                    style={{ borderColor: `${accent}80` }}
                  >
                    {synopsis}
                  </p>
                </div>
              )}
            </div>

          </div>


          {/*
            고른 모드의 스펙 — 난이도·소요시간 두 칸, 그 아래 장르 한 줄.

            ⚠️ **모드 창보다 앞에 둔다.** 좁은 화면에서는 소스 순서가 곧 화면
               순서인데, 포스터 바로 뒤가 아니면 '테마가 무엇인가' 가 모드 선택에
               끊긴다(2026-10-09 시안). 데스크톱 자리는 아래 class 가 따로 정한다.
            모드가 있으면 포스터 아래(1열 3행), 없으면 옛 배치대로 포스터 오른쪽.
          */}
          <div
            className={`flex min-w-0 flex-col gap-4 ${
              hasModes ? "md:col-start-1 md:row-start-3" : "md:col-start-2 md:row-start-2"
            }`}
          >
            <ThemeSpecTiles
              difficulty={theme.difficulty}
              durationMinutes={theme.duration_minutes}
              accent={accent}
            />
            <ThemeGenreTile genres={genres} accent={accent} />
          </div>

          {/*
            오른쪽 — 어떻게 플레이할지. 게임에서 모드를 고르는 창을 본떴다.
            모드가 하나뿐인 테마에서는 아무것도 안 그린다(ModeBox 가 null 을 낸다).

            ⚠️ 자리는 class 로 정한다(2행 오른쪽 칸). 좁은 화면에서는 포스터·스펙
               **뒤**에 와서, 테마를 먼저 보고 모드를 고르는 순서가 된다.
          */}
          <ModeBox
            variants={variants}
            active={theme}
            baseSlug={base.slug}
            accent={accent}
            className="md:col-start-2 md:row-start-2"
          />

          {/*
            단체 예약 — 모드 옆에 세우는 **세 번째 선택지**. 모드 창 바로 아래에
            둬야 "고를 수 있는 길" 로 읽힌다(2026-10-08 시안).
            ⚠️ 모드가 아니라 **base 테마** 기준으로 판정한다. 변형 테마의 slug 는
               `baotalchul-normal` 이라 그대로 넣으면 노말모드에서만 사라진다.
          */}
          {hasGroupBooking(base.slug) && (
            <PrivateRoomPanel
              entry={GROUP_ENTRY.intro}
              className={hasModes ? "md:col-start-2 md:row-start-3" : "md:col-span-2"}
            />
          )}
        </section>

        {/*
        강조 안내(themes.intro_notice). 포스터·정보 묶음 **바깥 아래**에 가로로 길게 둔다.
        읽히는 순서는 그대로다: 시놉시스 → 이 안내 → 신청하기.
      */}
        {introNotice && (
          <div
            className="mt-4 rounded-xl border px-4 py-3 sm:px-5 sm:py-3.5"
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
        <ScrollToBookingButton accent={accent} themeName={theme.name} />
      </div>

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
          className="mb-6 sm:mb-10"
          eyebrowColor={accent}
          size="lg"
        />
        {/*
          회차 선택에서도 모드를 오간다. 토요일 1회차(파티) ↔ 일요일 6회차(노말)를
          달력에서 바로 비교할 수 있어야 한다는 요청(2026-10-08).
          ⚠️ 모드를 바꾸면 고른 날짜(?d=)는 버린다 — 모드마다 여는 요일이 달라
             넘겨봐야 없는 날이고, 남겨 두면 '마감' 뿐인 첫 화면이 된다.
        */}
        <ModeToggle
          variants={variants}
          activeId={theme.id}
          baseSlug={base.slug}
          accent={accent}
          className="mx-auto mb-5 w-full max-w-4xl sm:mb-6"
          anchor="booking"
        />
        <div className="mx-auto w-full max-w-4xl">
          <SessionPicker
            initialDateParam={dParam}
            themeSlug={theme.slug}
            themeName={theme.name}
            sessions={sessions}
            accentColor={accent}
            accepting={acceptingApplications}
            openingDate={theme.opening_date}
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
          priceModeToggle={
            /*
              id 를 **여기서** 붙인다. ThemeBlocks 안에 두면 신청 3단계처럼
              가격표를 쓰는 다른 화면에도 같은 id 가 생긴다.
            */
            <div id="price" className={SCREEN_SCROLL_MARGIN}>
              <ModeToggle
                variants={variants}
                activeId={theme.id}
                baseSlug={base.slug}
                accent={accent}
                className="mb-4"
                label="가격 비교"
                anchor="price"
              />
            </div>
          }
          // 단체 예약을 받는 테마만 가격표 아래에 안내 카드를 붙인다 —
          // 안내 페이지의 조건(3시간·10~24명·단독 진행)이 테마별로 다르다.
          // base 기준이다. 변형 테마의 slug(baotalchul-normal)로 보면
          // 노말모드에서만 단체 안내가 사라진다.
          groupBooking={hasGroupBooking(base.slug)}
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
          accent={accent}
          themeName={theme.name}
          direction="up"
          className="mt-0 md:mt-0"
        />
      </div>

      {/* 넓은 화면 왼쪽 목차 — 지금 보는 블록 표시 + 눌러서 이동 */}
      <SectionNav accent={accent} />
      {/* 어느 블록까지 내려가고 멈추는지 기록한다(화면에 아무것도 그리지 않는다) */}
      <SectionViewTracker themeLabel={theme.name} />

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />

      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="theme_detail" />
    </main>
  );
}
