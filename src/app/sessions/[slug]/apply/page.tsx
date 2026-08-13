import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionBySlug, getSessionById } from "@/lib/sessions";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { formatSessionDateShort } from "@/lib/format";
import { ThemeTag } from "@/components/ui/ThemeTag";

const SITE_URL = "https://wouldyouescape.com";

export async function generateMetadata(
  { params }: PageProps<"/sessions/[slug]/apply">
): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  if (!session) {
    return {};
  }

  const title = `${session.title} 참가 신청 | 우주이스케이프`;
  const description = session.description || "우주이스케이프 회차에 참가 신청하세요.";
  const url = `${SITE_URL}/sessions/${session.slug}/apply`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
    },
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

export default async function ApplyPage({ params }: PageProps<"/sessions/[slug]/apply">) {
  const { slug } = await params;

  let session = await getSessionBySlug(slug);

  if (!session) {
    // Fallback: check if slug is a legacy UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(slug)) {
      session = await getSessionById(slug);
      if (session) {
        // Redirect to canonical slug URL
        redirect(`/sessions/${session.slug}/apply`);
      }
    }
    notFound();
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">참가 신청</h1>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <ThemeTag themeLabel={session.theme_label} />
        <span className="text-muted">바-ㅇ탈출</span>
        <span className="text-muted">{formatSessionDateShort(session.start_at)}</span>
      </div>

      {session.status === "closed" ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-glass-border bg-surface p-6 text-center">
          <p className="text-lg font-bold">정원이 다 차서 마감되었습니다.</p>
          <p className="text-sm text-muted">다음 정식 오픈 때 뵙겠습니다.</p>
          <p className="text-sm text-muted">신청해주셔서 감사합니다.</p>
        </div>
      ) : (
        <ApplyForm
          sessionId={session.id}
          priceKrw={session.price_krw}
          sessionTitle={session.title}
          eventDate={session.event_date}
          themeLabel={session.theme_label}
          maleClosed={session.male_closed}
          femaleClosed={session.female_closed}
        />
      )}
    </div>
  );
}
