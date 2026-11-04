import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw, formatDateTimeFull } from "@/lib/format";
import { backLabel, safeBack, withBack } from "@/lib/adminBack";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Rec = {
  application_id: string;
  confirmation_code: string;
  status: "confirmed" | "waiting" | "cancelled";
  payment_status: "pending" | "confirmed" | "cancelled";
  is_representative: boolean;
  headcount: number;
  amount_krw: number | null;
  coupons: string | null;
  session_id: string;
  session_start_at: string;
  theme_label: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  applied_at: string;
  cancelled_at: string | null;
  name: string | null;
  phone: string | null;
  nickname: string | null;
  experience_range: string | null;
  gender: string | null;
  birth_year: number | null;
  companions: string | null;
  internal: boolean;
};

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "확정", cls: "bg-glow text-black" },
  waiting: { label: "대기", cls: "bg-amber-400 text-black" },
  cancelled: { label: "취소", cls: "bg-zinc-500 text-white" },
};
const PAYMENT_TAG: Record<string, { label: string; cls: string }> = {
  pending: { label: "입금 전", cls: "bg-amber-400 text-black" },
  confirmed: { label: "입금 확인", cls: "bg-green-500 text-black" },
  cancelled: { label: "취소", cls: "bg-fill-strong text-muted" },
};
const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다(대시보드와 같은 방식). */
function getNowMs(): number {
  return Date.now();
}

/** 어디서 왔나 — utm 이 있으면 그것, 없으면 다른 사이트 주소의 도메인, 그것도 없으면 직접. */
function sourceOf(r: Rec): string {
  const utm = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ");
  if (utm) return utm;
  const host = r.referrer?.match(/:\/\/(?:www\.)?([^/:]+)/)?.[1];
  return host ? `${host} (링크)` : "직접";
}

/**
 * 고객 한 사람 — 같은 전화번호로 들어온 신청 전부를 시간 역순으로(2026-11-04 대표님).
 * ⚠️ 복호화된 이름 · 전화번호가 보인다 — 어드민 로그인을 거친 이 화면에서만.
 */
export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hash: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { hash } = await params;
  const back = safeBack((await searchParams).back, "/customers");
  const here = `/customers/${encodeURIComponent(decodeURIComponent(hash))}`;

  const supabase = createAdminClient();
  const [{ data, error }, { data: visitorRows }] = await Promise.all([
    supabase.rpc("admin_customer_detail", { p_phone_hash: decodeURIComponent(hash) }),
    // 이 사람이 대표로 신청한 브라우저들의 방문 발자취(admin_customer_visitors)
    supabase.rpc("admin_customer_visitors", { p_phone_hash: decodeURIComponent(hash) }),
  ]);
  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">고객 기록을 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }
  const recs = (data ?? []) as Rec[];
  // 같은 브라우저로 여러 번 신청했으면 한 줄로
  const visitors = [
    ...new Map(
      ((visitorRows ?? []) as { visitor_id: string; events: number; first_at: string | null; last_at: string | null }[]).map(
        (v) => [v.visitor_id, v],
      ),
    ).values(),
  ];
  if (recs.length === 0) notFound();

  // 사람 정보는 가장 최근 신청에 적은 값으로
  const latest = [...recs].sort((a, b) => b.applied_at.localeCompare(a.applied_at))[0];
  const now = getNowMs(); // force-dynamic 이라 요청마다 새로 잰다
  const joined = recs.filter((r) => r.status === "confirmed" && Date.parse(r.session_start_at) < now).length;
  const upcoming = recs.filter((r) => r.status !== "cancelled" && Date.parse(r.session_start_at) >= now).length;
  const cancelled = recs.filter((r) => r.status === "cancelled").length;
  const paid = recs
    .filter((r) => r.is_representative && r.payment_status === "confirmed" && r.status !== "cancelled")
    .reduce((s, r) => s + (r.amount_krw ?? 0), 0);

  const info: [string, React.ReactNode][] = [
    ["전화번호", latest.phone ?? "-"],
    ["닉네임", latest.nickname ?? "-"],
    ["출생년도", latest.birth_year ?? "-"],
    ["성별", latest.gender === "M" ? "남" : latest.gender === "F" ? "여" : "-"],
    ["방탈출 경험", latest.experience_range ? (EXPERIENCE_RANGE_LABELS[latest.experience_range] ?? latest.experience_range) : "-"],
    ["처음 유입", sourceOf([...recs].sort((a, b) => a.applied_at.localeCompare(b.applied_at))[0])],
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href={back} className="mb-4 inline-block text-body-sm text-glow hover:underline">
          ← {backLabel(back)}
        </Link>

        {/* ── 머리 ── 누구 · 몇 번 */}
        <header className="mb-6 rounded-xl border border-border p-4 md:p-5">
          <p className="text-h2 font-semibold">{latest.name ?? "이름 없음"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`${tag} ${joined + upcoming >= 2 ? "bg-glow text-black" : "bg-fill-strong text-foreground"}`}>
              {joined}번 참여
            </span>
            {upcoming > 0 && <span className={`${tag} bg-amber-400 text-black`}>예정 {upcoming}</span>}
            {cancelled > 0 && <span className={`${tag} bg-zinc-500 text-white`}>취소 {cancelled}</span>}
            <span className="text-body-sm text-muted">대표로 결제 {formatKrw(paid)}</span>
            {recs.some((r) => r.internal) && (
              <span className={`${tag} border border-amber-400/60 text-amber-400`}>테스트 기기 신청 있음</span>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-body">
            {info.map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-body-sm text-muted">{k}</dt>
                <dd className="min-w-0 break-words">{val}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── 신청 전 발자취 ── 신청할 때 쓴 브라우저가 지나간 길(visitTrack.ts, 2026-11-04 부터) */}
        <section className="mb-6 rounded-xl border border-border p-4 md:p-5">
          <h2 className="mb-2 text-body font-semibold">방문 발자취</h2>
          {visitors.length === 0 ? (
            <p className="text-body-sm text-muted">
              이어진 기록이 없습니다. 2026-11-04 이후 신청부터 신청한 브라우저의 발자취가 이어집니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visitors.map((v) => (
                <li key={v.visitor_id}>
                  <Link
                    href={withBack(`/visitors/${v.visitor_id}`, withBack(here, back))}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-body-sm hover:bg-fill-subtle"
                  >
                    <span>
                      브라우저 #{v.visitor_id.slice(0, 4)} · 기록 {v.events}건
                    </span>
                    <span className="tabular-nums text-muted">
                      {v.first_at ? formatDateTimeFull(v.first_at) : "-"} 부터
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 신청 기록 ── 최근 회차부터 */}
        <h2 className="mb-3 text-body font-semibold">신청 기록 {recs.length}건</h2>
        <ol className="flex flex-col gap-3">
          {recs.map((r) => (
            <li key={r.application_id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={withBack(`/sessions/${r.session_id}`, withBack(here, back))}
                  className="text-body font-semibold tabular-nums text-glow hover:underline"
                >
                  {formatDateTimeFull(r.session_start_at)}
                </Link>
                <span className="text-body-sm text-muted">{r.theme_label ?? ""}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`${tag} ${STATUS_TAG[r.status].cls}`}>{STATUS_TAG[r.status].label}</span>
                {r.status !== "cancelled" && (
                  <span className={`${tag} ${PAYMENT_TAG[r.payment_status].cls}`}>{PAYMENT_TAG[r.payment_status].label}</span>
                )}
                <span className={`${tag} bg-fill text-foreground`}>{r.is_representative ? "대표 신청" : "동행"}</span>
                <span className="text-body-sm text-muted">
                  {r.headcount}명 · 접수 {r.confirmation_code}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-sm">
                {r.companions && (
                  <>
                    <dt className="text-muted">함께 온 사람</dt>
                    <dd>{r.companions}</dd>
                  </>
                )}
                {r.is_representative && r.amount_krw != null && (
                  <>
                    <dt className="text-muted">금액</dt>
                    <dd className="tabular-nums">
                      {formatKrw(r.amount_krw)}
                      {r.coupons && <span className="text-muted"> · {r.coupons}</span>}
                    </dd>
                  </>
                )}
                <dt className="text-muted">유입</dt>
                <dd className="break-words">
                  {sourceOf(r)}
                  {r.landing_path && <span className="text-muted"> · 처음 본 화면 {r.landing_path}</span>}
                </dd>
                <dt className="text-muted">신청</dt>
                <dd className="tabular-nums">
                  {formatDateTimeFull(r.applied_at)}
                  {r.cancelled_at && <span className="text-muted"> · 취소 {formatDateTimeFull(r.cancelled_at)}</span>}
                </dd>
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
