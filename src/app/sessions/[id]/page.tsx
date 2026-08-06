import { notFound } from "next/navigation";
import { getSessionById, getSessionStats } from "@/lib/sessions";
import { formatKrw, formatSessionDate, formatSessionDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CapacityPolicyTable } from "@/components/session/CapacityPolicyTable";
import { getCurrentUser } from "@/lib/profile";

export default async function SessionDetailPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();

  const [stats, user] = await Promise.all([getSessionStats(id), getCurrentUser()]);

  const ctaHref = user
    ? `/sessions/${id}/apply`
    : `/login?redirect=${encodeURIComponent(`/sessions/${id}/apply`)}`;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 pb-28">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-bold text-brand">{session.theme_label}</span>
        {session.status === "closed" ? <Badge tone="danger">모집 마감</Badge> : <Badge tone="neutral">모집중</Badge>}
      </div>

      <h1 className="mb-2 text-2xl font-extrabold">{session.title}</h1>
      <p className="mb-8 text-muted">{session.description}</p>

      <div className="mb-6 flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-brand-soft text-sm text-muted">
        대표 이미지 준비 중
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-muted">조편성 정책</h2>
        <CapacityPolicyTable session={session} stats={stats} />
      </section>

      <section className="mb-8 grid gap-4 rounded-xl border border-border bg-surface p-5 text-sm sm:grid-cols-2">
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
          <p className="text-xs text-muted">만 19세 이상 (가입 시 확인). 그 외 세부 자격 조건은 확정 후 안내 예정입니다.</p>
        </div>
      </section>

      <p className="mb-24 text-xs text-muted">
        본 행사는 {formatSessionDate(session.event_date)} 진행되며, 행사 전날부터는 환불이 불가합니다.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-4">
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
