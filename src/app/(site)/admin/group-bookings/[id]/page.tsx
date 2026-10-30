import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateFull, formatDateTimeFull } from "@/lib/format";
import { contactMethodLabel, inquiryStatusLabel, preferredTimeLabel } from "@/lib/groupBooking";
import { BASE_MINUTES, HHMM, addMinutes } from "@/lib/groupPricing";
import { InquiryRow } from "../InquiryRow";
import { ContactLink, ExtrasCell, OptionsCell, SourceCell, suggestedBooking, type Inquiry } from "../inquiryParts";

export const dynamic = "force-dynamic";

/** 상태 꼬리표 — 대시보드 · 회차 상세와 같은 꽉 찬 색. */
const STATUS_TAG: Record<string, string> = {
  new: "bg-brand text-brand-foreground",
  contacted: "bg-amber-400 text-black",
  quoted: "bg-amber-400 text-black",
  booked: "bg-green-500 text-black",
  dropped: "bg-zinc-500 text-white",
};

const dateLabel = (ymd: string) => formatDateFull(`${ymd}T12:00:00+09:00`);

/**
 * 단체 예약 문의 한 건(2026-10-30 대표님).
 *
 * 대시보드 달력 · 문의 목록에서 눌러 들어온다. 회차 상세처럼 위에 언제 · 누가 · 지금 상태를
 * 크게 두고, 아래에 진행 상태 · 메모 · 확정 일시를 고치는 칸을 둔다.
 * ⚠️ 복호화된 연락처가 보인다 — 어드민 로그인을 거친 이 화면에서만.
 */
export default async function AdminGroupBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data, error }, { data: closure }] = await Promise.all([
    supabase.from("admin_group_booking_inquiries_view").select("*").eq("id", id).maybeSingle(),
    supabase.from("group_booking_closures").select("date, start_time, minutes").eq("inquiry_id", id).maybeSingle(),
  ]);
  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">문의를 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }
  if (!data) notFound();

  const r = data as Inquiry;
  const c = closure as { date: string; start_time: string | null; minutes: number | null } | null;
  const booking = c?.start_time ? { date: c.date, time: c.start_time, minutes: c.minutes ?? BASE_MINUTES } : null;
  const suggested = suggestedBooking(r);
  const wishTime = HHMM.test(r.preferred_time) ? r.preferred_time : null;

  const rows: [string, React.ReactNode][] = [
    [
      "연락처",
      <>
        <span className="text-muted">{contactMethodLabel(r.contact_method)}</span> <ContactLink r={r} />
      </>,
    ],
    ["견적", <OptionsCell key="o" r={r} />],
    ["모임", <ExtrasCell key="e" r={r} />],
    ["유입", <SourceCell key="s" r={r} />],
    ["접수", formatDateTimeFull(r.created_at)],
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/group-bookings" className="mb-4 inline-block text-body-sm text-glow hover:underline">
          ← 단체 예약 문의
        </Link>

        {/* ── 머리 ── 확정이면 확정 일시를, 아니면 희망 일시를 크게 */}
        <header className="mb-6 rounded-xl border border-border p-4 md:p-5">
          {booking ? (
            <>
              <p className="text-h2 font-semibold tabular-nums">
                {dateLabel(booking.date)} {booking.time} ~ {addMinutes(booking.time, booking.minutes)}
              </p>
              {(booking.date !== r.preferred_date || booking.time !== wishTime) && (
                <p className="mt-1 text-body-sm text-muted">
                  희망은 {r.preferred_date ? dateLabel(r.preferred_date) : "날짜 미정"} {preferredTimeLabel(r.preferred_time)}
                </p>
              )}
            </>
          ) : (
            <p className="text-h2 font-semibold tabular-nums">
              {r.preferred_date ? dateLabel(r.preferred_date) : "날짜 미정"}{" "}
              {wishTime ? `${wishTime} ~ ${addMinutes(wishTime, suggested.minutes)}` : preferredTimeLabel(r.preferred_time)}
              <span className="ml-2 text-body font-normal text-muted">희망</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold">{r.group_name ?? r.organizer_name ?? "이름 없음"}</span>
            {r.group_name && r.organizer_name && <span className="text-body-sm text-muted">{r.organizer_name}</span>}
            <span className="rounded-md bg-muted/20 px-2 py-0.5 text-micro text-muted">{r.headcount}명</span>
            <span
              className={`rounded-md px-2 py-0.5 text-micro font-semibold ${STATUS_TAG[r.status] ?? "bg-fill-strong text-muted"}`}
            >
              {inquiryStatusLabel(r.status)}
            </span>
          </div>
        </header>

        {/* ── 신청 내용 ── */}
        <section className="mb-6 rounded-xl border border-border p-4 md:p-5">
          <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-body-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 응대 ── 상태 · 확정 일시 · 메모 */}
        <section className="rounded-xl border border-border p-4 md:p-5">
          <h2 className="mb-3 text-body font-semibold">진행 상태 · 메모</h2>
          <InquiryRow
            id={r.id}
            status={r.status}
            memo={r.admin_memo ?? ""}
            booking={booking}
            suggested={suggested}
          />
        </section>
      </div>
    </div>
  );
}
