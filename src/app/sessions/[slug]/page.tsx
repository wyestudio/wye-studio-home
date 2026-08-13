import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSessionBySlug, getSessionById, getSessionStats } from "@/lib/sessions";
import { formatKrw, formatSessionDate, formatSessionDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { HudCard } from "@/components/ui/HudCard";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { ELIGIBLE_BIRTH_YEAR_MAX, ELIGIBLE_BIRTH_YEAR_MIN } from "@/lib/eligibility";
import { isDatingTheme } from "@/lib/theme";

const INCLUDED_ITEMS_BASE = ["방탈출 1회 플레이", "테마 맞춤 조 편성"];
const INCLUDED_ITEMS_NON_DATING = [...INCLUDED_ITEMS_BASE, "4인 1조 랜덤 편성"];
const INCLUDED_ITEMS_DATING = [...INCLUDED_ITEMS_BASE, "성비 맞춤 참가자 매칭"];

function sessionFaqs(isDatingSession: boolean) {
  const common = [
    {
      q: "확정 여부는 어떻게 확인하나요?",
      a: "신청 직후 화면에 바로 표시되고, 접수번호와 전화번호로 언제든 다시 조회할 수 있어요.",
    },
    { q: "정확한 장소는 언제 알려주나요?", a: "참가가 확정된 분께 개별로 안내드려요." },
  ];
  const themed = isDatingSession
    ? [
        {
          q: "대기 중인데 정원이 안 차면 어떻게 되나요?",
          a: "성비를 맞추기 위해 자동으로 확정하지 않고, 상황을 보고 운영진이 직접 안내드려요.",
        },
      ]
    : [{ q: "혼자 신청해도 되나요?", a: "네, 1인부터 최대 8인까지 원하는 인원으로 신청할 수 있어요." }];
  return [...common, ...themed];
}

export default async function SessionDetailPage({ params }: PageProps<"/sessions/[slug]">) {
  const { slug } = await params;

  let session = await getSessionBySlug(slug);

  if (!session) {
    // Fallback: check if slug is a legacy UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(slug)) {
      session = await getSessionById(slug);
      if (session) {
        // Redirect to canonical slug URL
        redirect(`/sessions/${session.slug}`);
      }
    }
    notFound();
  }

  const stats = await getSessionStats(session.id);
  const ctaHref = `/sessions/${session.slug}/apply`;
  const isDatingSession = isDatingTheme(session.theme_label);
  const includedItems = isDatingSession ? INCLUDED_ITEMS_DATING : INCLUDED_ITEMS_NON_DATING;
  const faqs = sessionFaqs(isDatingSession);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 pb-28">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-bold text-brand">{session.theme_label}</span>
        {session.status === "closed" ? <Badge tone="danger">모집 마감</Badge> : <Badge tone="neutral">모집중</Badge>}
      </div>

      <div className="mb-8">
        <div className="flex gap-4">
          {isDatingSession ? (
            <div className="relative aspect-square w-32 flex-shrink-0 overflow-hidden rounded-xl border border-glass-border bg-surface sm:w-40">
              <Image
                src="/bar-o-title.png"
                alt="바-오 탈출 테마 아트웍"
                fill
                className="object-contain"
                sizes="160px"
                priority
              />
            </div>
          ) : (
            <div className="flex aspect-square w-32 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-glass-border bg-brand-soft text-center text-xs text-muted sm:w-40">
              대표 이미지
              <br />
              준비 중
            </div>
          )}
          <div className="flex flex-col justify-center">
            <h1 className="mb-2 text-2xl font-extrabold">{session.title}</h1>
            <p className="text-sm text-muted">{session.description}</p>
          </div>
        </div>
        {isDatingSession ? (
          <p className="mt-2 text-xs text-muted">테마 아트웍 이미지 · 실제 진행 공간은 회차마다 달라질 수 있어요.</p>
        ) : null}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-muted">포함사항</h2>
        <div className="flex flex-wrap gap-2">
          {includedItems.map((item) => (
            <span
              key={item}
              className="rounded-full border border-glass-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </section>


      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-muted">진행 순서</h2>
        <HudCard as="ol" className="flex flex-col gap-3 p-5 text-sm">
          {[
            { text: `${formatSessionDateTime(session.start_at)} 현장 도착 및 접수`, muted: false },
            { text: "조 편성 안내", muted: false },
            { text: "방탈출 진행", muted: false },
            { text: "(확장 예정) 애프터", muted: true },
          ].map((step, i) => (
            <li key={step.text} className={`flex items-baseline gap-2 ${step.muted ? "text-muted" : ""}`}>
              <span className="text-xs font-bold text-brand">{i + 1}</span>
              <span>{step.text}</span>
            </li>
          ))}
        </HudCard>
      </section>

      <section className="mb-8">
        <HudCard className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 font-semibold text-muted">일시</p>
            <p>{formatSessionDateTime(session.start_at)}</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-muted">장소</p>
            <p>{session.venue_area}</p>
            <p className="text-xs text-muted">정확한 주소는 참가확정자에게 개별 안내됩니다.</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-muted">참가비</p>
            <p>{formatKrw(session.price_krw)} / 인당</p>
            <p className="text-xs text-muted">무통장입금만 가능합니다.</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-muted">신청 자격</p>
            <p className="text-xs text-muted">
              비슷한 또래끼리 더 즐겁게 즐기실 수 있도록,
              <br />
              {ELIGIBLE_BIRTH_YEAR_MIN}~{ELIGIBLE_BIRTH_YEAR_MAX}년생만 참여하실 수 있어요. 그 외 세부 자격 조건은 확정 후 안내 예정입니다.
            </p>
          </div>
        </HudCard>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-muted">자주 묻는 질문</h2>
        <FaqAccordion items={faqs} />
      </section>

      <Link href="/about" className="mb-8 block">
        <HudCard className="flex items-center justify-between p-4 text-sm">
          <span>
            <span className="font-semibold">우주이스케이프를 만드는 사람들</span>
            <span className="ml-1 text-muted">이 궁금하다면</span>
          </span>
          <span className="text-brand">About →</span>
        </HudCard>
      </Link>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-muted">참가자 후기</h2>
        <p className="rounded-xl border border-dashed border-glass-border bg-surface/40 p-5 text-center text-sm text-muted">
          아직 등록된 후기가 없어요. 첫 시즌이 끝나면 이 자리에 참가자들의 후기가 채워질 예정이에요.
        </p>
      </section>

      <p className="mb-24 text-xs text-muted">
        본 행사는 {formatSessionDate(session.event_date)} 진행되며, 행사 전날부터는 환불이 불가합니다.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t border-glass-border bg-background/90 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          {session.status === "closed" ? (
            <LinkButton href="#" className="pointer-events-none w-full opacity-50">
              모집이 마감되었습니다
            </LinkButton>
          ) : (
            <LinkButton href={ctaHref} className="w-full">
              참가하기
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
