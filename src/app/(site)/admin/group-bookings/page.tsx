import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROUP_KINDS } from "@/lib/groupBooking";
import { addDays, dateLabel, kstToday } from "@/lib/groupPricing";
import { withBack } from "@/lib/adminBack";
import { SortLink, nextSort, type SortDir } from "@/components/admin/SortLink";
import { AdminBadge, AdminEmpty, AdminPage, AdminTabs, adminButtonClass, adminInputClass, type AdminTone } from "@/components/admin/ui";
import { daysLeftOf, loadGroups, settlementFor, type AdjustmentRow, type GroupRow } from "@/lib/groupAdmin";
import { ddayLabel, effectiveStage, listTabOf, maskName, nextAction, scheduleOf, stageLabel, type GroupListTab } from "@/lib/groupStage";
import { NewGroupForm } from "./NewGroupForm";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 목록(관리자 개편 4단계 — 예전 이름 「단체 예약 문의」, 주소는 그대로 /group-bookings).
 *
 * 홈페이지 단체 견적(/group)으로 들어온 건과 운영자가 직접 등록한 건이 여기서 시작한다.
 * 목록에서는 **고르기만** 한다 — 한 줄에 행사일 · 모임 · 인원 · 단계 · 다음 할 일 · 금액 상태. 처리는 상세에서.
 *
 * 예전 목록에 있던 것은 전부 남아 있다(자리만 옮겼다):
 *   검색 조건 7개 · 정렬 · 쪽 나눔 · 고객 화면 링크는 이 화면에, 연락처 · 참고/요청사항 · 유입 · 메모는 상세에.
 *   「진행 상태」 선택 상자는 없앴다 — 단계는 동작에 따라 자동으로 넘어간다(2026-11-27 대표님).
 *
 * ⚠️ 연락처는 목록에 내려가지 않는다. 연락처로 **검색**할 때만 서버가 복호화해 대조하고, 값은 화면에 싣지 않는다.
 */

const TABS: { key: "all" | GroupListTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "new", label: "새 견적" },
  { key: "wait", label: "입금 대기" },
  { key: "confirmed", label: "확정" },
  { key: "past", label: "지난 행사" },
  { key: "cancelled", label: "취소" },
];
const PAGE_SIZE = 20;

const SORT_KEYS: Record<string, { label: string; dir: SortDir }> = {
  date: { label: "행사일", dir: "asc" },
  name: { label: "모임", dir: "asc" },
  headcount: { label: "인원", dir: "desc" },
  amount: { label: "금액", dir: "desc" },
  created: { label: "접수일", dir: "desc" },
};

/** 검색 조건 칸 + 정렬(sort · dir). 탭(tab) · 쪽(page)과 같이 주소에 담는다 — 상세에 갔다 와도 그대로다. */
const FIELDS = ["name", "contact", "from", "to", "time", "min", "kind", "sort", "dir"] as const;
type Cond = Record<(typeof FIELDS)[number] | "tab", string> & { page: number };

function listHref(cur: Cond, next: Partial<Cond>) {
  const v = { ...cur, ...next };
  const sp = new URLSearchParams();
  if (v.tab !== "all") sp.set("tab", v.tab);
  for (const k of FIELDS) if (v[k]) sp.set(k, v[k]);
  if (v.page > 1) sp.set("page", String(v.page));
  const qs = sp.toString();
  return `/group-bookings${qs ? `?${qs}` : ""}`;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function stageBadge(g: GroupRow, today: string): { tone: AdminTone; label: string } {
  if (g.cancelled_at) return { tone: "danger", label: "취소" };
  const s = effectiveStage(g, today);
  const tone: AdminTone = s === "new" ? "warn" : s === "contacted" ? "progress" : s === "report" ? "idle" : "done";
  return { tone, label: stageLabel(s) };
}

/** 금액 상태 한 줄 — 예약금 얼마 / 잔금 얼마 / 완납. */
function moneyLine(g: GroupRow, adjustments: AdjustmentRow[], today: string): string {
  const s = settlementFor(g, adjustments, today);
  if (g.cancelled_at) return g.refund_amount ? `환불 ${won(g.refund_amount)}` : "-";
  if (!s.priced && s.total <= 0) return "별도 상담";
  if (g.deposit_amount == null) return `총 ${won(s.total)} · 예약금 전`;
  if (g.balance_paid_at) return `완납 ${won(s.total)}`;
  return `예약금 ${won(g.deposit_amount)} · 잔금 ${won(s.balance)}`;
}

export default async function AdminGroupBookingsPage({ searchParams }: PageProps<"/admin/group-bookings">) {
  const params = await searchParams;
  const rawTab = typeof params.tab === "string" ? params.tab : "all";
  const tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "all") as "all" | GroupListTab;
  const c = Object.fromEntries(
    FIELDS.map((k) => [k, (typeof params[k] === "string" ? (params[k] as string) : "").trim().slice(0, 40)])
  ) as Record<(typeof FIELDS)[number], string>;
  const sortKey = c.sort in SORT_KEYS ? c.sort : "date";
  const sortDir: SortDir = c.dir === "asc" || c.dir === "desc" ? c.dir : SORT_KEYS[sortKey].dir;
  const today = kstToday();
  const isDefaultSort = sortKey === "date" && sortDir === "asc";

  let rows: GroupRow[];
  let adjustments: Map<string, AdjustmentRow[]>;
  try {
    ({ rows, adjustments } = await loadGroups());
  } catch (err) {
    return (
      <AdminPage title="단체 예약">
        <p role="alert" className="text-danger">
          단체 예약을 불러올 수 없습니다: {err instanceof Error ? err.message : String(err)}
        </p>
      </AdminPage>
    );
  }

  // 연락처로 찾을 때만 연락처를 읽는다(복호화). 맞는 단체의 id 만 남기고 값은 버린다 — 화면으로 내려가지 않는다.
  let contactHit: Set<string> | null = null;
  if (c.contact) {
    const q = c.contact.toLowerCase();
    const qDigits = c.contact.replace(/\D/g, "");
    const { data } = await createAdminClient().from("admin_group_booking_inquiries_view").select("id, contact");
    contactHit = new Set(
      ((data ?? []) as { id: string; contact: string }[])
        .filter((r) => r.contact.toLowerCase().includes(q) || (qDigits.length >= 3 && r.contact.replace(/\D/g, "").includes(qDigits)))
        .map((r) => r.id)
    );
  }

  const nameQ = c.name.toLowerCase();
  const minPeople = Number(c.min) || 0;
  const totalOf = (g: GroupRow) => settlementFor(g, adjustments.get(g.id) ?? [], today).total;
  const searched = rows
    .filter((r) => !nameQ || [r.organizer_name, r.group_name].some((x) => x?.toLowerCase().includes(nameQ)))
    .filter((r) => !contactHit || contactHit.has(r.id))
    .filter((r) => !c.from || (scheduleOf(r).date ?? "") >= c.from)
    .filter((r) => !c.to || (scheduleOf(r).date != null && scheduleOf(r).date! <= c.to))
    .filter((r) => !c.time || scheduleOf(r).time === c.time)
    .filter((r) => r.headcount >= minPeople)
    .filter((r) => !c.kind || r.group_kind === c.kind)
    .sort((a, b) => {
      const name = (r: GroupRow) => r.group_name ?? r.organizer_name ?? "";
      // 날짜 없는 건(옛 접수)은 방향과 상관없이 맨 뒤로.
      const when = (r: GroupRow) => (scheduleOf(r).date ? `${scheduleOf(r).date} ${scheduleOf(r).time ?? ""}` : null);
      let d = 0;
      switch (sortKey) {
        case "name":
          d = name(a).localeCompare(name(b), "ko");
          break;
        case "headcount":
          d = a.headcount - b.headcount;
          break;
        case "amount":
          d = totalOf(a) - totalOf(b);
          break;
        case "created":
          d = a.created_at.localeCompare(b.created_at);
          break;
        default: {
          const wa = when(a);
          const wb = when(b);
          if (!wa || !wb) return wa ? -1 : wb ? 1 : 0;
          // 기본 정렬(행사일이 가까운 순): 다가오는 행사를 가까운 순으로 먼저, 지난 행사는 최근 것부터 그 뒤에.
          // 머리 칸을 눌러 방향을 바꾸면 그냥 날짜순이다.
          if (isDefaultSort) {
            const pa = wa.slice(0, 10) < today;
            const pb = wb.slice(0, 10) < today;
            if (pa !== pb) return pa ? 1 : -1;
            return pa ? wb.localeCompare(wa) : wa.localeCompare(wb);
          }
          d = wa.localeCompare(wb);
        }
      }
      return sortDir === "asc" ? d : -d;
    });

  const applied = FIELDS.filter((k) => k !== "sort" && k !== "dir" && c[k]).length;
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, searched.filter((r) => t.key === "all" || listTabOf(r, today) === t.key).length])
  ) as Record<string, number>;
  const filtered = searched.filter((r) => tab === "all" || listTabOf(r, today) === tab);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rawPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Math.min(pageCount, Math.max(1, Number.isInteger(rawPage) ? rawPage : 1));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cur: Cond = { ...c, sort: isDefaultSort ? "" : sortKey, dir: isDefaultSort ? "" : sortDir, tab, page };
  const sortProps = (key: string) => {
    const n = nextSort({ key: sortKey, dir: sortDir }, key, SORT_KEYS[key].dir);
    const def = n.key === "date" && n.dir === "asc";
    return {
      label: SORT_KEYS[key].label,
      active: sortKey === key,
      dir: sortDir,
      href: listHref(cur, { sort: def ? "" : n.key, dir: def ? "" : n.dir, page: 1 }),
    };
  };

  const view = pageRows.map((g) => {
    const sch = scheduleOf(g);
    const left = daysLeftOf(g, today);
    return {
      g,
      href: withBack(`/group-bookings/${g.id}`, listHref(cur, {})),
      when: sch.date ? `${dateLabel(sch.date)}${sch.time ? ` ${sch.time}` : ""}` : "날짜 미정",
      wish: !sch.fixed,
      dday: left != null && !g.cancelled_at ? ddayLabel(left) : null,
      name: g.group_name ?? `${maskName(g.organizer_name)} 님`,
      badge: stageBadge(g, today),
      next: nextAction(g, today, left),
      money: moneyLine(g, adjustments.get(g.id) ?? [], today),
      fresh: !g.cancelled_at && g.stage === "new",
    };
  });

  const th = "px-3 py-3 text-left text-label font-semibold text-muted";
  const td = "px-3 py-3 align-middle text-body-sm";

  return (
    <AdminPage
      title="단체 예약"
      description={
        <>
          전체 {rows.length}건 · 새 견적 {rows.filter((r) => listTabOf(r, today) === "new").length}건 ·{" "}
          <Link href="/group" className="text-glow underline">
            고객 화면(/group)
          </Link>
        </>
      }
      action={<NewGroupForm defaultDate={addDays(today, 14)} />}
    >
      {/* ── 검색 조건 ── 접어 둔다. 걸려 있으면 펼쳐 둔다 */}
      <details open={applied > 0 || undefined} className="group mb-4 rounded-xl border border-border bg-surface">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-body-sm font-semibold [&::-webkit-details-marker]:hidden">
          자세히 거르기
          {applied > 0 && <AdminBadge tone="progress">{applied}개 적용</AdminBadge>}
          <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form action="/group-bookings" className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <Labeled label="이름 (담당자 · 모임)">
            <input name="name" defaultValue={c.name} className={adminInputClass} />
          </Labeled>
          <Labeled label="연락처">
            <input name="contact" defaultValue={c.contact} placeholder="번호 · 카카오 ID · 메일" className={adminInputClass} />
          </Labeled>
          <Labeled label="날짜 (부터)">
            <input type="date" name="from" defaultValue={c.from} className={adminInputClass} />
          </Labeled>
          <Labeled label="날짜 (까지)">
            <input type="date" name="to" defaultValue={c.to} className={adminInputClass} />
          </Labeled>
          <Labeled label="시각">
            <input type="time" name="time" defaultValue={c.time} className={adminInputClass} />
          </Labeled>
          <Labeled label="인원 (이상)">
            <input type="number" inputMode="numeric" name="min" min={1} defaultValue={c.min} className={adminInputClass} />
          </Labeled>
          <Labeled label="모임 성격">
            <select name="kind" defaultValue={c.kind} className={adminInputClass}>
              <option value="">전체</option>
              {GROUP_KINDS.map((k) => (
                <option key={k.code} value={k.code}>
                  {k.label}
                </option>
              ))}
            </select>
          </Labeled>
          {cur.sort && <input type="hidden" name="sort" value={cur.sort} />}
          {cur.dir && <input type="hidden" name="dir" value={cur.dir} />}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <p className="mr-auto text-body-sm text-muted">날짜 · 시각은 확정 건이면 확정 일시, 아니면 희망 일시로 찾아요.</p>
            <Link href={tab === "all" ? "/group-bookings" : `/group-bookings?tab=${tab}`} className={adminButtonClass("secondary")}>
              초기화
            </Link>
            <button type="submit" className={adminButtonClass("primary")}>
              검색
            </button>
          </div>
        </form>
      </details>

      <AdminTabs current={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: listHref(cur, { tab: t.key, page: 1 }) }))} />

      {view.length === 0 ? (
        <AdminEmpty
          title={rows.length === 0 ? "아직 단체 예약이 없어요" : "조건에 맞는 단체가 없어요"}
          hint={rows.length === 0 ? "홈페이지 단체 견적이 들어오거나 「단체 등록」 으로 넣으면 여기에 나옵니다." : "탭이나 거르기 조건을 바꿔 보세요."}
        />
      ) : (
        <>
          {/* 휴대폰: 카드 한 장씩. 표는 가로로 밀려서 쓰기 어렵다 */}
          <div className="mb-2 flex gap-4 overflow-x-auto text-body-sm text-muted lg:hidden">
            {Object.keys(SORT_KEYS).map((k) => (
              <SortLink key={k} {...sortProps(k)} className="min-h-11" />
            ))}
          </div>
          <ul className="flex flex-col gap-2 lg:hidden">
            {view.map((v) => (
              <li key={v.g.id}>
                <Link href={v.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-fill-subtle">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-body font-semibold text-foreground">{v.name}</span>
                      <AdminBadge tone={v.badge.tone}>{v.badge.label}</AdminBadge>
                    </div>
                    <div className="mt-1 text-body-sm text-muted tabular-nums">
                      {v.when}
                      {v.wish && " (희망)"}
                      {v.dday && ` · ${v.dday}`} · {v.g.headcount}명
                    </div>
                    {v.next && <div className="mt-1 text-body-sm font-semibold text-foreground">{v.next}</div>}
                    <div className="mt-0.5 text-body-sm text-muted tabular-nums">{v.money}</div>
                  </div>
                  <Chevron className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>

          {/* 컴퓨터: 표 — 열은 6개. 왼쪽 메뉴가 폭을 쓰므로 넓은 화면(lg)부터 표로 보여준다 */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface lg:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}><SortLink {...sortProps("date")} /></th>
                  <th className={th}><SortLink {...sortProps("name")} /></th>
                  <th className={th}><SortLink {...sortProps("headcount")} /></th>
                  <th className={th}>단계</th>
                  <th className={th}>다음 할 일</th>
                  <th className={th}><SortLink {...sortProps("amount")} /></th>
                </tr>
              </thead>
              <tbody>
                {view.map((v) => (
                  <tr key={v.g.id} className={`border-b border-border last:border-b-0 ${v.fresh ? "bg-wait-soft" : ""}`}>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      <span className="font-semibold text-foreground">{v.when}</span>
                      {v.wish && <span className="ml-1 text-muted">희망</span>}
                      {v.dday && <div className="text-micro text-muted">{v.dday}</div>}
                    </td>
                    <td className={td}>
                      <Link href={v.href} className="flex min-h-11 items-center font-semibold text-glow underline">
                        {v.name}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>{v.g.headcount}명</td>
                    <td className={td}><AdminBadge tone={v.badge.tone}>{v.badge.label}</AdminBadge></td>
                    <td className={`${td} whitespace-nowrap font-semibold text-foreground`}>{v.next ?? <span className="font-normal text-muted">-</span>}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-muted`}>{v.money}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 hidden text-right text-body-sm text-muted lg:block">
            <SortLink {...sortProps("created")} />
          </p>

          {pageCount > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-1" aria-label="쪽">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={listHref(cur, { page: n })}
                  aria-current={n === page ? "page" : undefined}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-body-sm tabular-nums ${
                    n === page ? "bg-foreground font-semibold text-background" : "border border-border text-muted"
                  }`}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </AdminPage>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-label font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}
