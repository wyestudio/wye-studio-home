import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSessionBySlug, getSessionById } from "@/lib/sessions";
import { formatKrw, formatSessionDateTime, formatDuration } from "@/lib/format";
import { RippleLinkButton } from "@/components/ui/RippleLinkButton";
import { ThemeTag } from "@/components/ui/ThemeTag";
import { ShareButton } from "@/components/ui/ShareButton";
import { isDatingTheme, getThemeBaseName } from "@/lib/theme";
import { eligibleBirthYearRangeLabel } from "@/lib/eligibility";

const SITE_URL = "https://wouldyouescape.com";

export async function generateMetadata(
  { params }: PageProps<"/sessions/[slug]">
): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  if (!session) {
    return {};
  }

  const title = `${session.title} | 우주이스케이프`;
  const description = session.description || "방탈출과 로테이션 소개팅을 결합한 우주이스케이프 회차입니다.";
  const url = `${SITE_URL}/sessions/${session.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "우주이스케이프",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function SessionMetaList({
  dateLabel,
  duration,
  venueArea,
  layout = "stack",
}: {
  dateLabel: string;
  duration: string;
  venueArea: string;
  layout?: "stack" | "row";
}) {
  const items = [
    { label: "날짜", value: dateLabel },
    { label: "시간", value: duration },
    { label: "장소", value: venueArea },
  ];
  return (
    <dl className={layout === "row" ? "grid grid-cols-3 gap-4 text-sm sm:text-base" : "space-y-3 text-sm sm:text-base"}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="font-semibold text-muted">{item.label}</dt>
          <dd className="text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

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
  const isDatingSession = isDatingTheme(session.theme_label);
  const themeName = getThemeBaseName(session.theme_label);
  const dateLabel = formatSessionDateTime(session.start_at);
  const duration = session.end_at ? formatDuration(session.start_at, session.end_at) : "-";
  const shareUrl = `${SITE_URL}/sessions/${session.slug}`;

  const progressSteps = isDatingSession
    ? ["로테이션 소개팅", "팀매칭", "방탈출", "포인트교환"]
    : ["아이스브레이킹", "방탈출 + 미니게임", "포인트교환"];

  const precautions = [
    { title: "정확한 주소는 추후 안내드려요", desc: "장소는 참가 확정 후 시작 24시간 전에 문자로 정확한 주소를 안내드립니다." },
    {
      title: "출생년도 제한이 있어요",
      desc: isDatingSession
        ? "또래끼리 즐기실 수 있도록 1990~1999년생만 신청 가능합니다."
        : `20대·30대가 함께하실 수 있도록 ${eligibleBirthYearRangeLabel(false)}만 신청 가능합니다.`,
    },
    { title: "활동형 콘텐츠입니다", desc: "방탈출・보드게임 등 추리/협력 중심 프로그램으로, 팀 게임에 적극적으로 참여 가능한 분만 신청 바랍니다." },
    { title: "시간 엄수 필수", desc: "노쇼 및 지각은 절대 불가합니다. 1부・2부 모두 정시 참여 및 전체 일정 참여 가능자만 신청 바랍니다." },
    { title: "휴대폰 사용 제한", desc: "1부 진행(약 2시간) 동안 휴대폰 사용이 제한되며, 사전 제출에 동의하신 분만 참여 가능합니다." },
    { title: "건강한 경쟁 매너 필수", desc: "미니게임 및 경쟁 요소가 포함되어 있습니다. 과도한 몰입 없이 즐겁게 참여 가능한 분을 지향합니다." },
    { title: "운영 방해 행위 제재", desc: "만취자 및 타인에게 불쾌감을 주는 행위 발생 시 즉시 퇴장 조치됩니다." },
    { title: "촬영 금지", desc: "행사 중 사진 및 영상 촬영은 전면 금지됩니다." },
    { title: "매너 있는 교류 필수", desc: "과도한 신체 접촉 및 불쾌감을 유발하는 언행은 엄격히 제한됩니다." },
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
          <div className="mb-3 flex items-center gap-2">
            <h1 className="text-3xl font-extrabold">{themeName}</h1>
            <ThemeTag themeLabel={session.theme_label} size="lg" />
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
            <p className="text-xs text-muted">8/29 베타 한정 할인가</p>
          </div>
          <ShareButton title={session.title} url={shareUrl} />
        </div>

        {/* 날짜/시간/장소 — 카드로 감쌈 */}
        <div className="rounded-xl glass-panel p-6">
          <SessionMetaList dateLabel={dateLabel} duration={duration} venueArea={session.venue_area} />
        </div>
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
          {/* 상단: 제목 + 뱃지 + 정보 (데스크톱만) */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h1 className="text-6xl lg:text-5xl font-extrabold">{themeName}</h1>
              <ThemeTag themeLabel={session.theme_label} size="lg" />
            </div>

            {/* 데스크톱에서만 정보 표시 */}
            <div className="hidden lg:block">
              <SessionMetaList dateLabel={dateLabel} duration={duration} venueArea={session.venue_area} />
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
              <p className="text-sm lg:text-xs text-muted">8/29 베타 한정 할인가</p>
            </div>
            <ShareButton title={session.title} url={shareUrl} />
          </div>
        </div>
      </div>

      {/* 태블릿 전용: 정보 별도 섹션 */}
      <div className="hidden sm:block lg:hidden mb-12 mt-8">
        <SessionMetaList dateLabel={dateLabel} duration={duration} venueArea={session.venue_area} layout="row" />
      </div>

      {/* 컨텐츠 소개 */}
      <section className="mt-4 border-t border-border pt-12 mb-12">
        <h2 className="mb-4 text-sm font-bold text-muted">컨텐츠 소개</h2>
        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          {isDatingSession ? (
            <>
              <p>소개팅과 방탈출을 결합한 신개념 프로그램입니다. 제한시간 안에 문제를 풀며 자연스럽게 <span className="font-bold text-brand">이성에게 매력을 어필</span>할 수 있어요.</p>
              <p>단순한 대화가 아니라 같은 팀이 되어 문제를 해결하는 방식이라 어색함은 줄이고, <span className="font-bold text-brand">몰입감과 재미는 극대화</span>했습니다.</p>
              <p>문제 풀이뿐 아니라 다양한 미니게임과 차별화된 콘텐츠로 <span className="font-bold text-brand">각자의 매력이 자연스럽게 드러나도록</span> 구성했습니다.</p>
            </>
          ) : (
            <>
              <p>방탈출과 협동 게임을 결합한 신개념 친목 프로그램입니다. 제한시간 안에 문제를 풀며 자연스럽게 <span className="font-bold text-brand">새로운 사람들과 가까워질</span> 수 있어요.</p>
              <p>단순한 대화가 아니라 같은 팀이 되어 문제를 해결하는 방식이라 어색함은 줄이고, <span className="font-bold text-brand">몰입감과 재미는 극대화</span>했습니다.</p>
              <p>문제 풀이뿐 아니라 다양한 미니게임과 차별화된 콘텐츠로 <span className="font-bold text-brand">서로 가까워질 수 있도록</span> 구성했습니다.</p>
            </>
          )}
        </div>
      </section>

      {/* 진행 순서 */}
      <section className="mb-12">
        <h2 className="mb-3 text-sm font-bold text-muted">진행 순서</h2>
        <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-4">
          {progressSteps.map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-2 px-1">
                <span className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-glow bg-brand-soft text-sm sm:text-base font-bold text-glow shadow-[0_0_10px_-2px_var(--glow)]">
                  {i + 1}
                </span>
                <span className="max-w-[76px] text-center text-xs sm:text-sm font-semibold">{step}</span>
              </div>
              {i < progressSteps.length - 1 ? <span className="mb-7 text-border">→</span> : null}
            </div>
          ))}
        </div>
      </section>

      {/* 유의사항 */}
      <section className="mb-12">
        <h2 className="mb-4 text-sm font-bold text-muted">유의사항</h2>
        <div className="space-y-0">
          {precautions.map((item, i) => (
            <div key={i} className={`flex gap-4 p-4 ${i !== precautions.length - 1 ? "border-b border-border/40" : ""}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/20 text-xs font-bold text-danger">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 고정 CTA 버튼 */}
      <div className="fixed inset-x-0 bottom-0 bg-background/90 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl sm:max-w-3xl lg:max-w-4xl">
          <RippleLinkButton href={ctaHref} disabled={session.status === "closed"}>
            {session.status === "closed" ? "모집이 마감되었습니다" : "참가하기"}
          </RippleLinkButton>
        </div>
      </div>
    </div>
  );
}
