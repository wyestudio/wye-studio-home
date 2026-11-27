import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminBadge, AdminEmpty, AdminPage, AdminTabs, adminButtonClass, adminInputClass, type AdminTone } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";
import { formatKrw, formatDateTimeFull, formatDateFull } from "@/lib/format";
import { getInternalApplicationIds } from "@/lib/internalTraffic";
import { withBack } from "@/lib/adminBack";
import { SortLink, nextSort, type SortDir } from "@/components/admin/SortLink";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  id: string;
  confirmation_code: string;
  status: "confirmed" | "waiting" | "cancelled";
  payment_status: "pending" | "confirmed" | "cancelled";
  headcount: number;
  amount_krw: number | null;
  discount_krw: number | null;
  /** 이 신청에 붙은 쿠폰들 '캠페인명 코드, …'. 없으면 null */
  coupons: string | null;
  created_at: string;
  session_id: string;
  session_start_at: string;
  theme_name: string | null;
  theme_mode: string | null;
  format_label: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  depositor_name: string | null;
  total_count: number;
};

// 색만으로 가르지 않는다 — 배지에는 항상 글자가 같이 있다.
const STATUS_TAG: Record<string, { label: string; tone: AdminTone }> = {
  confirmed: { label: "확정", tone: "progress" },
  waiting: { label: "대기", tone: "warn" },
  cancelled: { label: "취소", tone: "idle" },
};
const PAYMENT_TAG: Record<string, { label: string; tone: AdminTone }> = {
  pending: { label: "입금 전", tone: "warn" },
  confirmed: { label: "입금 확인", tone: "done" },
  cancelled: { label: "취소", tone: "idle" },
};

/**
 * 상태 탭(관리자 개편 docs/01 5장 — 거르기는 탭으로). 새 주소를 만들지 않는다:
 * 탭은 예전부터 쓰던 ?status= · ?payment= 를 그대로 쓴다(홈 할 일 · 슬랙 알림의 링크가 이 주소로 들어온다).
 */
const STATUS_TABS = [
  { key: "all", label: "전체", status: "", payment: "" },
  { key: "unpaid", label: "입금 대기", status: "confirmed", payment: "pending" },
  { key: "confirmed", label: "확정", status: "confirmed", payment: "confirmed" },
  { key: "waiting", label: "대기", status: "waiting", payment: "" },
  { key: "cancelled", label: "취소", status: "cancelled", payment: "" },
] as const;

/** 표 머리를 눌러 정렬하는 칸과 처음 누를 때의 방향. 이름 · 회차는 앞에서부터, 나머지는 큰 것부터. */
const SORT_KEYS: Record<string, { label: string; dir: SortDir }> = {
  name: { label: "신청자", dir: "asc" },
  headcount: { label: "인원", dir: "desc" },
  session: { label: "회차", dir: "asc" },
  amount: { label: "금액", dir: "desc" },
  created: { label: "신청일", dir: "desc" },
};

/** 검색 칸 — 주소(?name=&phone=…)에 담긴다. 새로고침 · 뒤로가기 · 링크 공유가 그대로 된다. */
const FIELDS = ["q", "name", "phone", "theme", "status", "payment", "from", "to", "time", "sort", "dir", "session"] as const;

/** 전화번호 뒤 4자리만 노출한다. 목록에서 전체 번호를 흘릴 이유가 없다. */
function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `···${d.slice(-4)}` : "-";
}


/**
 * 신청 목록 — 모든 회차의 신청을 한 곳에서 찾는다.
 *
 * 조건을 넣고 「검색」 을 눌러야 조회한다(2026-10-30 대표님). 칸을 바꿀 때마다 바로 조회하면
 * 여러 조건을 넣는 동안 화면이 계속 바뀐다. 그래서 그냥 GET 폼이다 — 클라이언트 코드가 없다.
 * 검색은 DB 의 admin_search_applications_v2(이름 · 전화는 참여자 누구든, 회차 날짜 · 시각, 정렬).
 */
export default async function AdminApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const v = Object.fromEntries(FIELDS.map((k) => [k, get(k) ?? ""])) as Record<(typeof FIELDS)[number], string>;
  // 정렬은 표 머리로 고른다(?sort=칸&dir=asc|desc). 없으면 신청 최신순.
  const sortKey = v.sort in SORT_KEYS ? v.sort : "created";
  const sortDir: SortDir = v.dir === "asc" || v.dir === "desc" ? v.dir : SORT_KEYS[sortKey].dir;
  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const ymd = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

  const supabase = createAdminClient();

  // 상태 · 입금을 뺀 검색 조건 — 목록과 탭별 건수가 같은 조건을 쓴다.
  const filters = {
    p_query: v.q || null,
    p_name: v.name || null,
    p_phone: v.phone || null,
    p_session_id: v.session || null,
    p_theme_id: v.theme || null,
    p_date_from: ymd(v.from),
    p_date_to: ymd(v.to),
    p_time: /^\d{2}:\d{2}$/.test(v.time) ? v.time : null,
  };
  // 지금 주소가 어느 탭인가. 탭에 없는 조합(예전 링크의 ?status=confirmed 만)이면 고른 탭이 없다.
  const currentTab = STATUS_TABS.find((t) => t.status === v.status && t.payment === v.payment)?.key ?? "";
  // 다른 탭의 건수 — 같은 검색 함수를 한 줄만 받아 total_count 를 읽는다(2026-11-27 대표님: 탭마다 건수 표시).
  const otherTabs = STATUS_TABS.filter((t) => t.key !== currentTab);

  const [rowsRes, themesRes, sessionRes, ...countRes] = await Promise.all([
    supabase.rpc("admin_search_applications_v2", {
      ...filters,
      p_status: v.status || null,
      p_payment: v.payment || null,
      p_sort: `${sortKey}_${sortDir}`,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("themes").select("id, name, variant_label").order("sort_order").order("created_at"),
    // 회차 상세 · 대시보드에서 '이 회차만' 으로 들어왔을 때 무슨 회차인지 보여 준다.
    v.session
      ? supabase.from("session_display").select("start_at, theme_name, theme_mode").eq("id", v.session).maybeSingle()
      : Promise.resolve({ data: null }),
    ...otherTabs.map((t) =>
      supabase.rpc("admin_search_applications_v2", {
        ...filters,
        p_status: t.status || null,
        p_payment: t.payment || null,
        p_sort: "created_desc",
        p_limit: 1,
        p_offset: 0,
      })
    ),
  ]);

  if (rowsRes.error) {
    return (
      <AdminPage title="신청 (파티 · 노말)">
        <p role="alert" className="text-body-sm text-danger">
          신청 목록을 불러올 수 없습니다: {rowsRes.error.message}
        </p>
      </AdminPage>
    );
  }

  const rows = (rowsRes.data ?? []) as Row[];
  // 우리 기기에서 넣은 신청. 분석에서는 빠지지만 여기서는 그대로 보이니 배지로 구분한다.
  const internalIds = await getInternalApplicationIds(rows.map((r) => r.id));
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const themes = (themesRes.data ?? []) as { id: string; name: string; variant_label: string | null }[];
  const onlySession = sessionRes.data as { start_at: string; theme_name: string | null; theme_mode: string | null } | null;
  // 상태 · 입금은 탭으로 고른다 — 「검색 조건」 의 적용 개수에는 넣지 않는다.
  const applied = FIELDS.filter((k) => !["sort", "dir", "status", "payment"].includes(k) && v[k]).length;

  const pageHref = (n: number, sort?: { key: string; dir: SortDir }, tab?: { status: string; payment: string }) => {
    const next = new URLSearchParams();
    for (const k of FIELDS) if (v[k] && k !== "sort" && k !== "dir" && !(tab && (k === "status" || k === "payment"))) next.set(k, v[k]);
    if (tab?.status) next.set("status", tab.status);
    if (tab?.payment) next.set("payment", tab.payment);
    const srt = sort ?? { key: sortKey, dir: sortDir };
    if (srt.key !== "created" || srt.dir !== "desc") {
      next.set("sort", srt.key);
      next.set("dir", srt.dir);
    }
    if (n > 1) next.set("page", String(n));
    return `/applications?${next.toString()}`;
  };
  // 머리 칸 하나 — 누르면 1쪽부터 그 칸으로 정렬
  const sortProps = (key: string) => ({
    label: SORT_KEYS[key].label,
    active: sortKey === key,
    dir: sortDir,
    href: pageHref(1, nextSort({ key: sortKey, dir: sortDir }, key, SORT_KEYS[key].dir)),
  });
  // 탭 — 검색 조건과 정렬은 그대로 두고 상태만 바꾼다. 건수를 못 읽은 탭은 숫자를 비워 둔다(0 으로 속이지 않는다).
  const tabs = STATUS_TABS.map((t) => {
    const i = otherTabs.findIndex((o) => o.key === t.key);
    const res = i >= 0 ? (countRes[i] as { data: { total_count: number }[] | null; error: unknown }) : null;
    const count = t.key === currentTab ? total : res && !res.error ? Number(res.data?.[0]?.total_count ?? 0) : undefined;
    return { key: t.key, label: t.label, href: pageHref(1, undefined, t), count };
  });
  // 한 건을 누르면 그 회차 화면의 그 신청 카드로 간다(처리 버튼은 거기 있다).
  const rowHref = (r: Row) => `${withBack(`/sessions/${r.session_id}?app=${r.id}`, pageHref(page))}#app-${r.id}`;

  return (
    <AdminPage title="신청 (파티 · 노말)" description="파티모드 신청과 노말모드 예약을 한 목록에서 찾습니다. 한 건을 누르면 그 회차 화면의 그 신청으로 갑니다. 입금 확인 · 취소 · 수정은 거기서 합니다.">
      <>

        {/* ── 검색 조건 ── 조건이 걸려 있으면 펼쳐 둔다 */}
        <AdminTabs tabs={tabs} current={currentTab} />

        <details open={applied > 0 || undefined} className="group mb-5 rounded-xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
            검색 조건
            {applied > 0 && <AdminBadge tone="progress">{applied}개 적용</AdminBadge>}
            <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form action="/applications" className="grid grid-cols-2 gap-3 border-t border-border p-4 md:grid-cols-4">
            {v.session && <input type="hidden" name="session" value={v.session} />}
            {/* 상태는 위의 탭으로 고른다 — 검색해도 지금 탭에 머문다 */}
            {v.status && <input type="hidden" name="status" value={v.status} />}
            {v.payment && <input type="hidden" name="payment" value={v.payment} />}
            <Labeled label="이름 (참여자 · 입금자)">
              <input name="name" defaultValue={v.name} placeholder="예: 김하나" className={adminInputClass} />
            </Labeled>
            <Labeled label="전화번호">
              <input name="phone" defaultValue={v.phone} inputMode="numeric" placeholder="뒤 4자리도 돼요" className={adminInputClass} />
            </Labeled>
            <Labeled label="접수번호">
              <input name="q" defaultValue={v.q} inputMode="numeric" placeholder="6자리" className={adminInputClass} />
            </Labeled>
            <Labeled label="테마 · 모드">
              <select name="theme" defaultValue={v.theme} className={adminInputClass}>
                <option value="">전체</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.variant_label ? ` ${t.variant_label}` : ""}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="회차 날짜 (부터)">
              <input type="date" name="from" defaultValue={v.from} className={adminInputClass} />
            </Labeled>
            <Labeled label="회차 날짜 (까지)">
              <input type="date" name="to" defaultValue={v.to} className={adminInputClass} />
            </Labeled>
            <Labeled label="회차 시각">
              <input type="time" name="time" defaultValue={v.time} className={adminInputClass} />
            </Labeled>
            {/* 정렬은 표 머리로 고른다 — 검색해도 지금 정렬을 그대로 둔다 */}
            {v.sort && <input type="hidden" name="sort" value={v.sort} />}
            {v.dir && <input type="hidden" name="dir" value={v.dir} />}
            <div className="col-span-2 flex justify-end gap-2 border-t border-border pt-4 md:col-span-4">
              <Link href="/applications" className={adminButtonClass("secondary")}>
                초기화
              </Link>
              <button type="submit" className={`${adminButtonClass("primary")} min-w-28`}>
                검색
              </button>
            </div>
          </form>
        </details>

        {onlySession && (
          <p className="mb-3 text-body-sm">
            <AdminBadge>
              이 회차만: {formatDateTimeFull(onlySession.start_at)} {onlySession.theme_mode ?? onlySession.theme_name}
            </AdminBadge>
          </p>
        )}

        <p className="mb-3 text-body-sm text-muted">
          총 <strong className="text-foreground">{total}</strong>건
          {totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
        </p>

        {rows.length === 0 ? (
          <AdminEmpty
            title="조건에 맞는 신청이 없어요"
            hint={applied > 0 ? "검색 조건을 줄이거나 「초기화」 를 눌러 보세요." : "다른 탭을 눌러 보세요."}
          />
        ) : (
          <>
            {/* 휴대폰: 표 머리가 없어 정렬 칸을 한 줄로 둔다 */}
            <div className="-mx-4 mb-2 flex gap-3 overflow-x-auto px-4 text-body-sm text-muted [scrollbar-width:none] md:hidden">
              {Object.keys(SORT_KEYS).map((k) => (
                <SortLink key={k} {...sortProps(k)} />
              ))}
            </div>
            {/* 휴대폰: 카드 — 누르면 그 회차 상세로 */}
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={rowHref(r)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-fill-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-body font-semibold">{r.representative_name ?? "-"}</span>
                        <span className="text-body-sm text-muted">{r.headcount}명</span>
                        <StatusBadges r={r} />
                        {internalIds.has(r.id) && <TestBadge />}
                      </div>
                      <div className="mt-1 text-body-sm tabular-nums text-muted">
                        {formatDateTimeFull(r.session_start_at)} {r.theme_mode ?? r.format_label ?? ""}
                      </div>
                      <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                        {r.confirmation_code} · {maskPhone(r.representative_phone)}
                        {r.amount_krw != null && ` · ${formatKrw(r.amount_krw)}`}
                        {r.discount_krw != null && r.discount_krw > 0 && ` (쿠폰 −${formatKrw(r.discount_krw)})`}
                      </div>
                      {r.depositor_name && r.depositor_name !== r.representative_name && (
                        <div className="mt-0.5 text-body-sm text-wait">입금자 {r.depositor_name}</div>
                      )}
                    </div>
                    <Chevron className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* 컴퓨터: 표 — 열은 6개(docs/01 5장 원칙 3). 접수번호 · 입금자는 신청자 칸 아래에 작게 둔다 */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
              <table className="w-full text-body-sm">
                <thead className="border-b border-border text-left text-label text-muted">
                  <tr>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("name")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("session")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("headcount")} /></th>
                    <th className="px-3 py-2.5">상태</th>
                    <th className="px-3 py-2.5 text-right"><SortLink {...sortProps("amount")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("created")} /></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-fill-subtle">
                      <td className="px-3 py-3">
                        <Link href={rowHref(r)} className="font-semibold text-foreground hover:underline">
                          {r.representative_name ?? "-"}
                        </Link>
                        <span className="ml-1.5 text-muted tabular-nums">{maskPhone(r.representative_phone)}</span>
                        <span className="block text-muted tabular-nums">
                          {r.confirmation_code}
                          {internalIds.has(r.id) && <TestBadge />}
                        </span>
                        {r.depositor_name && r.depositor_name !== r.representative_name && (
                          <span className="block text-wait" title="입금자명이 신청자와 다릅니다">
                            입금자 {r.depositor_name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={rowHref(r)} className="text-glow hover:underline">
                          {formatDateTimeFull(r.session_start_at)}
                        </Link>
                        {(r.theme_mode ?? r.format_label) && (
                          <span className="block text-muted">{r.theme_mode ?? r.format_label}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{r.headcount}명</td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap gap-1">
                          <StatusBadges r={r} />
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.amount_krw != null ? formatKrw(r.amount_krw) : "-"}
                        {/*
                          쿠폰 중복 적용이 되면서 같은 회차라도 결제액이 제각각이다.
                          왜 이 금액인지 목록에서 바로 알 수 있어야 한다.
                        */}
                        {r.discount_krw != null && r.discount_krw > 0 && (
                          <span className="block text-glow" title={r.coupons ?? undefined}>
                            쿠폰 −{formatKrw(r.discount_krw)}
                          </span>
                        )}
                        {r.coupons && <span className="block text-muted">{r.coupons}</span>}
                      </td>
                      <td className="px-3 py-3 text-muted">{formatDateFull(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={adminButtonClass("secondary")}>
                이전
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className={adminButtonClass("secondary")}>
                다음
              </Link>
            )}
          </div>
        )}
      </>
    </AdminPage>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-body-sm text-muted">
      {label}
      {children}
    </label>
  );
}

/** 신청 상태 + 입금 상태. 취소 건은 입금 배지를 붙이지 않는다. */
function StatusBadges({ r }: { r: Row }) {
  return (
    <>
      <AdminBadge tone={STATUS_TAG[r.status].tone}>{STATUS_TAG[r.status].label}</AdminBadge>
      {r.status !== "cancelled" && (
        <AdminBadge tone={PAYMENT_TAG[r.payment_status].tone}>{PAYMENT_TAG[r.payment_status].label}</AdminBadge>
      )}
    </>
  );
}

function TestBadge() {
  return (
    <span
      className="ml-1.5 rounded-md border border-wait px-1 py-0.5 font-sans text-micro font-semibold text-wait"
      title="테스트 기기(/internal)에서 넣은 신청 — 분석에서 빠집니다"
    >
      테스트
    </span>
  );
}
