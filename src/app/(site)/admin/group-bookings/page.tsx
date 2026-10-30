import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { INQUIRY_STATUSES, contactMethodLabel, inquiryStatusLabel, preferredTimeLabel } from "@/lib/groupBooking";
import { BASE_MINUTES, addMinutes } from "@/lib/groupPricing";
import { InquiryRow, type Booking } from "./InquiryRow";
import { ExtrasCell, OptionsCell, SourceCell, suggestedBooking, type Inquiry } from "./inquiryParts";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 문의 접수함.
 *
 * ⚠️ 이 화면에는 **복호화된 연락처가 그대로 보인다.** 슬랙 알림에 연락처를 싣지 않는
 *    이유가 이것이다 — 개인정보는 어드민 로그인을 거친 이 화면에서만 보여야 한다.
 *
 * 접수는 예약이 아니다. 상태(접수 → 연락 완료 → 견적 안내 → 예약 확정)로 어디까지
 * 응대했는지 적어 둬야 둘이 나눠 볼 때 겹치지 않는다.
 */

/**
 * 상태 탭. 진행 중 = 연락 완료 · 견적 안내 — 아직 결론이 안 난 건을 한데 본다.
 * 탭 · 검색 · 쪽은 주소(?tab=&q=&page=)에 담는다 — 새로고침하거나 링크를 넘겨도 같은 목록이 보인다.
 */
const TABS = [
  { key: "all", label: "전체", match: () => true },
  { key: "new", label: "미응대", match: (s: string) => s === "new" },
  { key: "ongoing", label: "진행 중", match: (s: string) => s === "contacted" || s === "quoted" },
  { key: "booked", label: "확정", match: (s: string) => s === "booked" },
  { key: "dropped", label: "종료", match: (s: string) => s === "dropped" },
] as const;
const PAGE_SIZE = 20;

/** 탭 · 검색 · 쪽을 바꾼 주소. 바꾸지 않은 값은 그대로 둔다. */
function listHref(cur: { tab: string; q: string; page: number }, next: Partial<{ tab: string; q: string; page: number }>) {
  const v = { ...cur, ...next };
  const sp = new URLSearchParams();
  if (v.tab !== "all") sp.set("tab", v.tab);
  if (v.q) sp.set("q", v.q);
  if (v.page > 1) sp.set("page", String(v.page));
  const qs = sp.toString();
  return `/group-bookings${qs ? `?${qs}` : ""}#list`;
}

const th = "px-3 py-3 text-left text-body-sm font-semibold";
const td = "px-3 py-3 align-top text-body-sm";

export default async function AdminGroupBookingsPage({ searchParams }: PageProps<"/admin/group-bookings">) {
  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "all";
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : "all";
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 40);
  // 대시보드 달력에서 눌러 들어온 한 건.
  const onlyId = typeof params.id === "string" ? params.id : "";
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("admin_group_booking_inquiries_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">단체 예약 문의를 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }

  const rows = (data as Inquiry[]) ?? [];

  // 예약 확정으로 걸어 둔 마감(신청 건 하나에 하나). 지난 날짜도 신청 건 옆에 보여야 해서 따로 읽는다.
  const { data: bookingData } = await supabase
    .from("group_booking_closures")
    .select("inquiry_id, date, start_time, minutes")
    .not("inquiry_id", "is", null);
  const bookings = new Map<string, Booking>(
    ((bookingData as { inquiry_id: string; date: string; start_time: string | null; minutes: number | null }[]) ?? [])
      .filter((b) => b.start_time)
      .map((b) => [b.inquiry_id, { date: b.date, time: b.start_time!, minutes: b.minutes ?? BASE_MINUTES }])
  );
  // 아직 아무도 손대지 않은 건수. 접수함은 "오늘 볼 게 몇 건인가" 가 먼저다.
  const pending = rows.filter((r) => r.status === "new").length;

  // 검색 — 이름 · 모임 이름 · 연락처(숫자만 비교해 하이픈 유무와 상관없이). 건수가 적어 서버에서 거른다.
  const qLower = q.toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const searched = onlyId
    ? rows.filter((r) => r.id === onlyId)
    : q
    ? rows.filter(
        (r) =>
          [r.organizer_name, r.group_name, r.contact].some((v) => v?.toLowerCase().includes(qLower)) ||
          (qDigits.length >= 3 && r.contact.replace(/\D/g, "").includes(qDigits))
      )
    : rows;
  const tabCounts = Object.fromEntries(
    TABS.map((t) => [t.key, searched.filter((r) => t.match(r.status)).length])
  ) as Record<string, number>;
  const filtered = searched.filter((r) => TABS.find((t) => t.key === tab)!.match(r.status));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rawPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Math.min(pageCount, Math.max(1, Number.isInteger(rawPage) ? rawPage : 1));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cur = { tab, q, page };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="mb-4 inline-block text-glow hover:underline">
          ← 돌아가기
        </Link>

        <h1 className="mb-2 text-h2 font-semibold">단체 예약 문의</h1>
        <p className="mb-8 text-body-sm text-muted">
          전체 {rows.length}건 · 미응대 {pending}건 ·{" "}
          <Link href="/group" className="text-glow hover:underline">
            고객 화면(/group)
          </Link>
        </p>

        <p className="mb-6 rounded-lg border border-border px-4 py-3 text-body-sm text-muted">
          단체를 막아 둔 일정은{" "}
          <Link href="/" className="font-semibold text-glow underline">
            대시보드 일정 달력
          </Link>
          에서 봅니다. 예약 확정 건은 아래에서 확정 일시를 넣으면 자동으로 막힙니다.
        </p>
        {onlyId && (
          <p className="mb-4 text-body-sm">
            달력에서 고른 한 건만 보는 중 ·{" "}
            <Link href="/group-bookings#list" className="text-glow underline">
              전체 보기
            </Link>
          </p>
        )}

        {/* 상태 탭 · 검색 */}
        <div id="list" className="mb-4 flex scroll-mt-4 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" aria-label="상태">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={listHref(cur, { tab: t.key, page: 1 })}
                aria-current={tab === t.key ? "page" : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-body-sm font-semibold whitespace-nowrap ${
                  tab === t.key ? "bg-glow text-glow-foreground" : "border border-border text-muted hover:text-foreground"
                }`}
              >
                {t.label} <span className="tabular-nums opacity-70">{tabCounts[t.key]}</span>
              </Link>
            ))}
          </nav>
          <form action="/group-bookings#list" className="flex gap-2">
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="이름 · 모임 · 연락처"
              className="min-w-0 flex-1 rounded-lg border border-border bg-panel px-3 py-2 text-input md:w-60"
            />
            <button type="submit" className="shrink-0 rounded-lg border border-border px-3 py-2 text-body-sm font-semibold">
              검색
            </button>
            {q && (
              <Link
                href={listHref(cur, { q: "", page: 1 })}
                className="shrink-0 self-center text-body-sm text-muted underline"
              >
                지우기
              </Link>
            )}
          </form>
        </div>

        {pageRows.length === 0 ? (
          <p className="py-4 text-muted">{rows.length === 0 ? "아직 접수된 문의가 없습니다." : "조건에 맞는 문의가 없습니다."}</p>
        ) : (
          <>
          {/*
            휴대폰은 카드 한 장씩 — 표는 가로로 밀려서 정작 자주 쓰는 진행 상태 · 저장 칸이
            화면 밖에 있었다(2026-10-30 대표님).
          */}
          {/* 카드는 한 줄 요약 — 누르면 그 건의 상세로 간다(회차 상세와 같은 방식). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {pageRows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/group-bookings/${r.id}`}
                  className={`flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-fill-subtle ${
                    r.status === "new" ? "bg-brand-soft/30" : "bg-panel"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="text-body font-semibold">{r.organizer_name ?? "이름 없음"}</span>
                      {r.group_name && <span className="ml-2 text-body-sm text-muted">{r.group_name}</span>}
                    </div>
                    <div className="mt-0.5 text-body-sm text-muted tabular-nums">
                      {r.headcount}명 ·{" "}
                      {bookings.has(r.id)
                        ? `확정 ${bookings.get(r.id)!.date.slice(5)} ${bookings.get(r.id)!.time}`
                        : `${r.preferred_date?.slice(5) ?? "날짜 미정"} ${preferredTimeLabel(r.preferred_time)}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-micro font-semibold ${
                      r.status === "new" ? "bg-brand text-brand-foreground" : "bg-fill text-muted"
                    }`}
                  >
                    {inquiryStatusLabel(r.status)}
                  </span>
                  <Chevron className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>접수일시</th>
                  <th className={th}>담당자 · 모임</th>
                  <th className={th}>인원</th>
                  <th className={th}>희망 일시</th>
                  <th className={th}>옵션 · 예상 금액</th>
                  <th className={th}>연락처</th>
                  <th className={th}>참고 · 요청사항</th>
                  <th className={th}>유입</th>
                  <th className={th}>진행 상태 · 메모</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/50 ${
                      r.status === "new" ? "bg-brand-soft/30" : ""
                    }`}
                  >
                    <td className={`${td} whitespace-nowrap text-micro`}>
                      {formatDateTimeFull(r.created_at)}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/group-bookings/${r.id}`} className="font-semibold text-glow hover:underline">
                        {r.organizer_name ?? "이름 없음"}
                      </Link>
                      {r.group_name && <div className="text-micro text-muted">{r.group_name}</div>}
                    </td>
                    <td className={`${td} whitespace-nowrap font-semibold`}>{r.headcount}명</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.preferred_date ?? <span className="text-muted">날짜 미정</span>}
                      <br />
                      <span className="text-micro text-muted">
                        {preferredTimeLabel(r.preferred_time)}
                      </span>
                      {bookings.has(r.id) && (
                        <div className="mt-1 text-micro font-semibold text-glow">
                          확정 {bookings.get(r.id)!.date}
                          <br />
                          {bookings.get(r.id)!.time} ~ {addMinutes(bookings.get(r.id)!.time, bookings.get(r.id)!.minutes)}
                        </div>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-micro`}>
                      <OptionsCell r={r} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="text-micro text-muted">
                        {contactMethodLabel(r.contact_method)}
                      </span>
                      <br />
                      {r.contact}
                    </td>
                    <td className={`${td} max-w-[300px] text-micro`}>
                      <ExtrasCell r={r} />
                    </td>
                    <td className={`${td} max-w-[180px] text-micro text-muted`}>
                      <SourceCell r={r} />
                    </td>
                    <td className={td}>
                      <InquiryRow
                        id={r.id}
                        status={r.status}
                        memo={r.admin_memo ?? ""}
                        booking={bookings.get(r.id) ?? null}
                        suggested={suggestedBooking(r)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-1" aria-label="쪽">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={listHref(cur, { page: n })}
                  aria-current={n === page ? "page" : undefined}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-body-sm tabular-nums ${
                    n === page ? "bg-glow font-semibold text-glow-foreground" : "border border-border text-muted"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
          </>
        )}

        <p className="mt-8 text-micro leading-relaxed text-muted">
          진행 상태: {INQUIRY_STATUSES.map((s) => s.label).join(" → ")}
        </p>
      </div>
    </div>
  );
}
