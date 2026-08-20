import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSessionBySlug, getSessionById } from "@/lib/sessions";
import { formatKrw, formatSessionDateDotted, formatDuration, formatShortDate } from "@/lib/format";
import { RippleLinkButton } from "@/components/ui/RippleLinkButton";
import { ThemeTag } from "@/components/ui/ThemeTag";
import { ShareButton } from "@/components/ui/ShareButton";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PlanetDot, type Planet } from "@/components/ui/PlanetDot";
import { isDatingTheme } from "@/lib/theme";
import { eligibleBirthYearRangeLabel } from "@/lib/eligibility";
import { FlatFaqAccordion, type FaqItem } from "./FlatFaqAccordion";

const SITE_URL = "https://wouldyouescape.com";

export async function generateMetadata(
  { params }: PageProps<"/sessions/[slug]">
): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  if (!session) {
    return {};
  }

  const pageTitle = `${session.theme_name}(${session.session_type})·${formatShortDate(session.start_at)}`;
  const socialTitle = `우주이스케이프 | ${pageTitle}`;
  const description = session.description || "방탈출과 로테이션 소개팅을 결합한 우주이스케이프 회차입니다.";
  const url = `${SITE_URL}/sessions/${session.slug}`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: socialTitle,
      description,
      url,
      type: "website",
      siteName: "우주이스케이프",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}

function SessionMetaList({
  dateLabel,
  duration,
  venueArea,
}: {
  dateLabel: string;
  duration: string;
  venueArea: string;
}) {
  const items = [
    { emoji: "📅", label: "날짜", value: dateLabel },
    { emoji: "📍", label: "장소", value: `${venueArea} (신청자 개별 안내)` },
    { emoji: "🕐", label: "시간", value: duration },
    { emoji: "💳", label: "결제", value: "무통장입금" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.label} className="text-xs text-muted sm:text-sm">
          <span aria-hidden>{item.emoji}</span> {item.label}
          <strong className="mt-1 block text-sm font-bold text-foreground sm:text-base">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EligibilityCard({ isDatingSession }: { isDatingSession: boolean }) {
  const accentColor = isDatingSession ? "#ff5ec4" : "#3dffb0";
  const eligibilityText = isDatingSession
    ? `${eligibleBirthYearRangeLabel(true)}만 신청 가능`
    : "20·30대 남녀만 신청 가능";
  return (
    <div
      className="rounded-xl p-6 text-sm sm:text-base border"
      style={{ borderColor: accentColor, backgroundColor: `${accentColor}26` }}
    >
      <span style={{ color: accentColor }}>신청 가능 대상</span>
      <span className="mx-2 text-muted">·</span>
      <span className="font-bold text-foreground">{eligibilityText}</span>
    </div>
  );
}

function PreOpenCard({ originalPriceKrw, priceKrw }: { originalPriceKrw: number; priceKrw: number }) {
  const emphasisColor = "var(--danger)";
  return (
    <div
      className="mt-6 rounded-xl border-2 p-6"
      style={{
        background: "linear-gradient(135deg, rgba(140,42,58,0.55), rgba(200,80,90,0.55))",
        borderColor: "var(--danger)",
        boxShadow:
          "0 16px 36px -14px rgba(0,0,0,0.55), 0 0 32px -6px var(--danger), inset 0 0 0 1px rgba(255,107,107,0.3)",
      }}
    >
      <span className="mb-3 inline-block rounded-full bg-danger px-3 py-1 text-[11px] font-extrabold tracking-wide text-white">
        PRE-OPEN ONLY
      </span>
      <h3 className="mb-3 text-lg font-extrabold text-foreground">프리오픈 참여자 혜택</h3>
      <ul className="flex flex-col gap-2 text-sm font-semibold text-foreground">
        <li className="flex gap-2">
          <span aria-hidden>✔</span>
          <span>
            프리오픈 한정 참가비{" "}
            <span className="font-extrabold" style={{ color: emphasisColor }}>
              24,000원
            </span>{" "}
            할인
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>✔</span>
          <span>
            SNS 리뷰 인증 시{" "}
            <span className="font-extrabold" style={{ color: emphasisColor }}>
              5,000원
            </span>{" "}
            페이백 제공 (SNS 리뷰 업로드 후 7일 유지 시)
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>✔</span>
          <span>
            다음 테마{" "}
            <span className="font-extrabold" style={{ color: emphasisColor }}>
              할인 쿠폰
            </span>{" "}
            + 지인 선물용{" "}
            <span className="font-extrabold" style={{ color: emphasisColor }}>
              할인 쿠폰
            </span>{" "}
            (총 2종) 제공
          </span>
        </li>
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4">
        <span className="text-sm text-foreground/70">참가비</span>
        <span className="text-right">
          <span className="mr-2 text-xs text-foreground/50 line-through">{formatKrw(originalPriceKrw)}</span>
          <span className="text-2xl font-extrabold" style={{ color: emphasisColor }}>
            {formatKrw(priceKrw)}
          </span>
          <span className="ml-1 text-xs text-foreground/70">/ 인</span>
        </span>
      </div>
    </div>
  );
}

const DATING_FOR_YOU_CARDS = [
  {
    emoji: "🙋",
    title: "어색한 1:1 대화가 부담스러운 분",
    desc: "방탈출이라는 공통 목표가 있어 자연스럽게 말이 트여요",
  },
  {
    emoji: "🔍",
    title: "조건만이 아닌 사람 자체를 알아가고 싶은 분",
    desc: "스펙이나 프로필이 아니라, 방탈출 속 행동과 대화 속에서 그 사람의 진짜 모습을 볼 수 있어요",
  },
  {
    emoji: "🧩",
    title: "방탈출・이색 액티비티를 좋아하는 분",
    desc: "게임하듯 즐기다 보면 시간이 어느새 훌쩍 지나가요",
  },
  {
    emoji: "🎉",
    title: "새로운 형태의 만남을 시도해보고 싶은 분",
    desc: "뻔한 술자리 소개팅 말고, 콘텐츠가 있는 만남을 즐길 수 있어요",
  },
];

const GROUP_FOR_YOU_CARDS = [
  {
    emoji: "🙋",
    title: "새로운 사람들과 편하게 어울리고 싶은 분",
    desc: "혼자 와도 팀 배정으로 자연스럽게 어울릴 수 있어요",
  },
  {
    emoji: "🤝",
    title: "낯가림 없이 자연스럽게 친해지고 싶은 분",
    desc: "방탈출이라는 공통 목표 덕분에 어색함 없이 금방 가까워져요",
  },
  {
    emoji: "🧩",
    title: "방탈출・이색 액티비티를 좋아하는 분",
    desc: "게임하듯 즐기다 보면 시간이 어느새 훌쩍 지나가요",
  },
  {
    emoji: "🎉",
    title: "친구・지인과 색다른 모임을 즐기고 싶은 분",
    desc: "뻔한 술자리 모임 말고, 콘텐츠가 있는 만남을 즐길 수 있어요",
  },
];

export default async function SessionDetailPage({ params }: PageProps<"/sessions/[slug]">) {
  const { slug } = await params;

  let session = await getSessionBySlug(slug);

  if (!session) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(slug)) {
      session = await getSessionById(slug);
      if (session) {
        redirect(`/sessions/${session.slug}`);
      }
    }
    notFound();
  }

  const ctaHref = `/sessions/${session.slug}/apply`;
  const isDatingSession = isDatingTheme(session.session_type);
  const themeAccentColor = isDatingSession ? "#ff5ec4" : "#3dffb0";
  const forYouCards = isDatingSession ? DATING_FOR_YOU_CARDS : GROUP_FOR_YOU_CARDS;
  const themeName = session.theme_name;
  const dateLabel = formatSessionDateDotted(session.start_at);
  const duration = session.end_at ? formatDuration(session.start_at, session.end_at) : "-";
  const shareUrl = `${SITE_URL}/sessions/${session.slug}`;

  const contentSteps = isDatingSession
    ? [
        {
          emoji: "💘",
          title: "단체 소개팅 & 팀 매칭",
          desc: "단체 소개팅 시간 동안 방탈출을 같이 할 팀원을 탐색해요. 짧은 대화만으로도 은근히 나와 잘 맞는 사람이 누군지 감이 올 거예요.",
        },
        {
          emoji: "🚪",
          title: "방탈출 플레이",
          desc: "팀별로 제한 시간 안에 함께 문제를 풀며 포인트를 수집합니다. 협동 과정에서 자연스럽게 서로의 성향이 드러나요.",
        },
        {
          emoji: "💬",
          title: "프리토킹 & 상품교환",
          desc: "1부 컨텐츠 종료 후 다과와 함께하는 자유 대화 시간. 마음에 든 상대와 연락처를 교환할 수 있어요. 추가로, 방탈출을 하며 수집했던 포인트로 여러가지 상품을 교환해보세요!",
        },
      ]
    : [
        {
          emoji: "🧊",
          title: "아이스브레이킹",
          desc: "배정된 팀원과 간단한 스몰토크로 친해지는 시간. 팀은 저희가 방탈출 경험수 밸런스 조정해서 정해드려요.",
        },
        {
          emoji: "🚪",
          title: "방탈출 플레이",
          desc: "팀별로 제한 시간 안에 함께 문제를 풀며 포인트를 수집합니다. 협동 과정에서 자연스럽게 팀워크가 발휘돼요.",
        },
        {
          emoji: "💬",
          title: "프리토킹 & 상품교환",
          desc: "1부 컨텐츠 종료 후 다과와 함께하는 자유 대화 시간. 마음에 든 사람과 수다떨며 교류할 수 있어요. 추가로, 방탈출을 하며 수집했던 포인트로 여러가지 상품을 교환해보세요!",
        },
      ];

  const schedule: { planet: Planet; time: string; title: string; desc: string }[] = isDatingSession
    ? [
        { planet: "mercury", time: "19:00", title: "현장 접수 & 단체 소개팅", desc: "참여 확인 후 이름표 배부, 단체 소개팅 진행" },
        { planet: "venus", time: "20:00", title: "팀 매칭 및 1부 컨텐츠 안내", desc: "방탈출 진행 규칙 안내 및 설명" },
        { planet: "earth", time: "20:30", title: "방탈출 진행 + 미니게임", desc: "팀별 방탈출 진행. 돌발 미니게임 발생" },
        { planet: "mars", time: "22:00", title: "2부 다과 타임 & 상품교환", desc: "자유롭게 대화하며 수집한 포인트로 상품 교환. (22:30부터 자율 퇴장 가능)" },
      ]
    : [
        { planet: "mercury", time: "13:00", title: "현장 접수 & 팀별 배치 확인", desc: "참여 확인 후 이름표 배부, 팀별 좌석 안내에 따라 착석" },
        { planet: "venus", time: "13:40", title: "1부 컨텐츠 안내", desc: "방탈출 진행 규칙 안내 및 설명" },
        { planet: "earth", time: "14:00", title: "방탈출 진행 + 미니게임", desc: "팀별 방탈출 진행. 돌발 미니게임 발생" },
        { planet: "mars", time: "15:30", title: "2부 다과 타임 & 상품교환", desc: "자유롭게 대화하며 수집한 포인트로 상품 교환 후 자율 퇴장" },
      ];

  const precautions: { title: ReactNode; desc: ReactNode }[] = [
    {
      title: (
        <>
          시작 24시간 이내 <span style={{ color: themeAccentColor }}>환불 불가</span>
        </>
      ),
      desc: (
        <>
          테마 시작 <span className="text-foreground">24시간 전</span> 이후부터는 환불이 불가합니다. 추가로,{" "}
          <span className="text-foreground">노쇼 및 지각 시 입금액은 환불드리지 않으며</span> 추후 이용이 제한될 수 있습니다.
        </>
      ),
    },
    {
      title: (
        <>
          참가 가능 <span style={{ color: themeAccentColor }}>나이 제한</span>
        </>
      ),
      desc: isDatingSession ? (
        <>
          소개팅 회차: 비슷한 연령끼리 즐기실 수 있도록{" "}
          <span className="text-foreground">{eligibleBirthYearRangeLabel(true)}만</span> 신청 가능합니다.
        </>
      ) : (
        <>
          그룹 회차: 비슷한 연령끼리 즐기실 수 있도록{" "}
          <span className="text-foreground">{eligibleBirthYearRangeLabel(false)}만</span> 신청 가능합니다.
        </>
      ),
    },
    {
      title: (
        <>
          결제는 <span style={{ color: themeAccentColor }}>무통장입금</span>만 가능
        </>
      ),
      desc: (
        <>
          신청 후 <span className="text-foreground">30분 내 미입금 시 자동 취소</span>됩니다.
        </>
      ),
    },
    {
      title: (
        <>
          진행 장소는 <span style={{ color: themeAccentColor }}>추후 안내</span>
        </>
      ),
      desc: "정확한 참여 장소는 참여 확정 후 테마 시작 24시간 전에 문자로 안내드립니다.",
    },
    {
      title: (
        <>
          동일 테마 <span style={{ color: themeAccentColor }}>중복 참여 불가</span>
        </>
      ),
      desc: (
        <>
          동일 테마로 진행되는 회차들은 <span className="text-foreground">1인 1번만 참여 가능</span>합니다. (그룹, 소개팅 무관)
        </>
      ),
    },
    {
      title: (
        <>
          휴대폰 <span style={{ color: themeAccentColor }}>사용 제한</span>
        </>
      ),
      desc: (
        <>
          1부 진행 동안 사진 촬영을 포함한 <span className="text-foreground">모든 전자기기 사용이 제한</span>됩니다. 사전 휴대폰 제출에
          동의하신 분만 참여 가능합니다.
        </>
      ),
    },
    {
      title: (
        <>
          건강한 경쟁 <span style={{ color: themeAccentColor }}>매너 필수</span>
        </>
      ),
      desc: (
        <>
          1부 전반적으로 경쟁 요소가 포함되어 있습니다. 과한 몰입보다 <span className="text-foreground">즐겁게 참여</span> 부탁드립니다.
        </>
      ),
    },
    {
      title: (
        <>
          매너 있는 <span style={{ color: themeAccentColor }}>교류 필수</span>
        </>
      ),
      desc: (
        <>
          타 참여자 및 진행자에게{" "}
          <span className="text-foreground">과도한 신체 접촉 및 불쾌감을 유발하는 언행은 즉시 퇴장</span>됩니다.
        </>
      ),
    },
  ];

  const faqItems: FaqItem[] = isDatingSession
    ? [
        {
          q: "혼자 또는 친구와 신청해도 되나요?",
          a: "1인 개별 신청만 가능합니다. 지인과 개별 신청해도 팀 편성 시 랜덤으로 흩어질 수 있어요.",
        },
        {
          q: "방탈출을 못 해봤는데 참여할 수 있나요?",
          a: "전혀 문제없어요! 난이도는 초보자도 즐길 수 있는 수준으로 구성되며, 방탈출만이 아닌 미니게임들도 구성되어 있어 아쉬움 없이 모두 참여 가능합니다.",
        },
        {
          q: "남녀 비율은 어떻게 되나요?",
          a: "최대한 1:1 비율에 가깝게 팀을 편성하며, 신청 현황에 따라 조정될 수 있습니다.",
        },
        {
          q: "옷차림이나 준비물이 있나요?",
          a: "단정한 옷차림과 신분증만 지참해주세요.",
        },
        {
          q: "식사 제공 되나요?",
          a: "식사는 별도로 제공되지 않지만, 커피 또는 아이스티와 함께 간단한 다과가 준비됩니다. 원활한 참여를 위해 식사를 미리 하고 오시는 것을 권장드립니다.",
        },
      ]
    : [
        {
          q: "혼자 또는 친구와 신청해도 되나요?",
          a: "혼자 또는 친구와 함께 모두 가능합니다. 친구와 함께 신청 시 같은 팀으로 편성되고 싶으신 분들은 비고란에 작성해주시면 최대한 반영해드리겠습니다.",
        },
        {
          q: "방탈출을 못 해봤는데 참여할 수 있나요?",
          a: "전혀 문제없어요! 난이도는 초보자도 즐길 수 있는 수준으로 구성되며, 방탈출만이 아닌 미니게임들도 구성되어 있어 아쉬움 없이 모두 참여 가능합니다.",
        },
        {
          q: "옷차림이나 준비물이 있나요?",
          a: "단정한 옷차림과 신분증만 지참해주세요.",
        },
        {
          q: "식사 제공 되나요?",
          a: "식사는 별도로 제공되지 않지만, 커피 또는 아이스티와 함께 간단한 다과가 준비됩니다. 원활한 참여를 위해 식사를 미리 하고 오시는 것을 권장드립니다.",
        },
      ];

  return (
    <div className="mx-auto max-w-2xl sm:max-w-3xl lg:max-w-4xl px-5 py-10 sm:px-8 sm:py-14 lg:py-20 pb-32">
      {/* 모바일 레이아웃 */}
      <div className="sm:hidden mb-12 flex flex-col gap-6">
        {/* 포스터 가운데 정렬 */}
        <div className="flex justify-center">
          <div className="relative aspect-[4/5] w-56 overflow-hidden border border-glass-border bg-surface">
            <Image
              src="/bar-o-title.png"
              alt="우주이스케이프 바-오 탈출 테마 아트웍"
              fill
              className="object-contain"
              sizes="224px"
              priority
            />
          </div>
        </div>

        {/* 제목 + 뱃지 */}
        <div>
          <div className="mb-3 flex flex-col items-start gap-1">
            <h1 className="text-2xl font-extrabold text-foreground">{themeName}</h1>
            <ThemeTag sessionType={session.session_type} label={`${session.session_type} 파티형 방탈출`} className="text-xl font-bold" />
          </div>
        </div>

        {/* 참가비 + 공유버튼 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-danger line-through decoration-2">{formatKrw(session.original_price_krw)}</p>
            <p className="font-bold text-lg">
              {formatKrw(session.price_krw)}
              <span className="ml-1 text-xs font-normal text-muted">/ 인당</span>
            </p>
            <p className="text-xs text-muted">8/29 pre-open 한정 할인가</p>
          </div>
          <ShareButton title={session.title} url={shareUrl} />
        </div>

        {/* 날짜/시간/장소 — 카드로 감쌈 */}
        <div className="rounded-xl glass-panel p-6">
          <SessionMetaList dateLabel={dateLabel} duration={duration} venueArea={session.venue_area} />
        </div>
        <EligibilityCard isDatingSession={isDatingSession} />
      </div>

      {/* 태블릿+데스크톱 레이아웃: 포스터 좌 + 정보 우 */}
      <div className="hidden sm:flex gap-8 lg:gap-10 mb-12">
        {/* 포스터 */}
        <div className="relative aspect-[4/5] w-64 lg:w-80 flex-shrink-0 overflow-hidden border border-glass-border bg-surface">
          <Image
            src="/bar-o-title.png"
            alt="우주이스케이프 바-오 탈출 테마 아트웍"
            fill
            className="object-contain"
            sizes="(min-width: 1024px) 320px, 256px"
            priority
          />
        </div>

        {/* 우측 컬럼 */}
        <div className="flex flex-1 flex-col justify-between">
          {/* 상단: 제목 + 뱃지 */}
          <div>
            <div className="mb-3 flex flex-col items-start gap-1">
              <h1 className="text-3xl font-extrabold text-foreground">{themeName}</h1>
              <ThemeTag sessionType={session.session_type} label={`${session.session_type} 파티형 방탈출`} className="text-3xl lg:text-4xl font-bold" />
            </div>
          </div>

          {/* 하단: 참가비 + 공유버튼 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base lg:text-sm text-danger line-through decoration-2">{formatKrw(session.original_price_krw)}</p>
              <p className="font-bold text-4xl lg:text-4xl">
                {formatKrw(session.price_krw)}
                <span className="ml-1 text-sm lg:text-xs font-normal text-muted">/ 인당</span>
              </p>
              <p className="text-sm lg:text-xs text-muted">8/29 pre-open 한정 할인가</p>
            </div>
            <ShareButton title={session.title} url={shareUrl} />
          </div>
        </div>
      </div>

      {/* 태블릿+데스크톱: 정보 별도 섹션 (포스터/가격 블록 아래) */}
      <div className="hidden sm:block mb-12 mt-8">
        <div className="rounded-xl glass-panel p-6">
          <SessionMetaList dateLabel={dateLabel} duration={duration} venueArea={session.venue_area} />
        </div>
        <div className="mt-4">
          <EligibilityCard isDatingSession={isDatingSession} />
        </div>
      </div>

      {/* PRE-OPEN ONLY 혜택 카드 */}
      <PreOpenCard originalPriceKrw={session.original_price_krw} priceKrw={session.price_krw} />

      {/* 추천 대상 */}
      <section className="mt-12 mb-12">
        <SectionHeading eyebrow="FOR YOU" title="이런 분들에게 추천드려요" align="left" className="mb-6" eyebrowColor={themeAccentColor} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {forYouCards.map((card) => (
            <div key={card.title} className="flex gap-3 rounded-xl border border-border bg-surface p-5">
              <span className="text-2xl" aria-hidden>
                {card.emoji}
              </span>
              <div>
                <p className="font-bold text-foreground">{card.title}</p>
                <p className="mt-1 text-xs text-muted">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 컨텐츠 구성 */}
      <section className="mb-12">
        <SectionHeading eyebrow="CONTENTS" title="컨텐츠 구성" align="left" className="mb-8" eyebrowColor={themeAccentColor} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {contentSteps.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-border bg-surface p-5 pt-6">
              <span className="absolute -top-3 left-4 rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold text-brand-foreground">
                STEP {i + 1}
              </span>
              <p className="mb-2 font-bold text-foreground">
                {step.emoji} {step.title}
              </p>
              <p className="text-xs leading-relaxed text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 진행 순서 */}
      <section className="mb-12">
        <SectionHeading eyebrow="SCHEDULE" title="진행 순서" align="center" className="mb-8" eyebrowColor={themeAccentColor} />
        <div className="mx-auto flex max-w-xl flex-col">
          {schedule.map((item, i) => (
            <div key={item.time} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <PlanetDot planet={item.planet} className="mt-1" />
                {i < schedule.length - 1 ? <div className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="pb-1">
                <p className="text-xs font-extrabold text-brand">{item.time}</p>
                <p className="mt-0.5 font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted">*자세한 타임테이블은 현장 상황에 따라 상이할 수 있습니다.</p>
      </section>

      {/* 참가 전 꼭 확인해주세요 */}
      <section className="mb-12">
        <SectionHeading eyebrow="PLEASE CHECK" title="참가 전 꼭 확인해주세요" align="left" className="mb-8" eyebrowColor={themeAccentColor} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {precautions.map((item, i) => (
            <div key={i} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/20 text-xs font-bold text-danger">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-bold text-foreground">{item.title}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 자주 묻는 질문 */}
      <section className="mb-12">
        <SectionHeading eyebrow="FAQ" title="자주 묻는 질문" align="left" className="mb-6" eyebrowColor={themeAccentColor} />
        <FlatFaqAccordion items={faqItems} />
      </section>

      {/* 고정 CTA 버튼 */}
      <div className="fixed inset-x-0 bottom-0 bg-background/90 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl sm:max-w-3xl lg:max-w-4xl">
          <RippleLinkButton href={ctaHref} disabled={session.status !== "open"}>
            {session.status === "cancelled" ? "취소된 회차입니다" : session.status === "closed" ? "모집이 마감되었습니다" : "참여하기"}
          </RippleLinkButton>
        </div>
      </div>
    </div>
  );
}
