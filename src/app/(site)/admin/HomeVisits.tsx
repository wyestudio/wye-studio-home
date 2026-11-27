import Link from "next/link";
import { adminButtonClass } from "@/components/admin/ui";
import { duration, pct } from "./insights/parts";

/**
 * 홈 — 오늘 방문 한 줄과 분석 화면 바로가기(2026-11-27 대표님).
 *
 * 숫자는 방문 분석의 「오늘」 과 같다(admin_visit_overview, 한국 시간 0시 ~ 지금, 우리 기기 제외).
 * 홈은 할 일이 먼저라 여기에는 네 개만 둔다 — 비교 · 추이 · 단계별 이탈은 방문 분석에서 본다.
 */
export type VisitsToday = {
  visitors: number;
  new_visitors: number;
  mobile: number;
  applied_db: number;
  funnel: Record<string, number>;
  engagement: { median_secs: number; pages_per_visit: number; bounce: number; visits: number };
};

const LINKS = [
  { href: "/insights", label: "방문 분석" },
  { href: "/visitors", label: "방문 발자취" },
  { href: "/analytics", label: "GA4 상세" },
];

export function HomeVisits({ visits }: { visits: VisitsToday | null }) {
  const done = visits?.funnel?.done ?? 0;
  const eng = visits?.engagement;
  return (
    <section className="mt-8" aria-labelledby="home-visits">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="home-visits" className="text-h3 font-semibold text-foreground">
          오늘 방문
        </h2>
        <Link href="/insights" className="flex min-h-11 items-center text-body-sm text-glow underline">
          자세히 보기
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
        {visits && eng ? (
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="방문자" value={`${visits.visitors}명`} sub={`처음 온 사람 ${pct(visits.new_visitors, visits.visitors)}% · 휴대폰 ${pct(visits.mobile, visits.visitors)}%`} />
            <Stat label="신청 완료" value={`${done}명`} sub={`전환율 ${pct(done, visits.visitors)}% · 실제 신청 ${visits.applied_db}건`} />
            <Stat label="체류 시간" value={duration(eng.median_secs)} sub={`방문 한 번에 화면 ${eng.pages_per_visit}개`} />
            <Stat label="이탈률" value={`${pct(eng.bounce, eng.visits)}%`} sub={`방문 ${eng.visits}번 중 ${eng.bounce}번은 첫 화면에서 나감`} />
          </dl>
        ) : (
          <p role="alert" className="text-body-sm text-danger">
            오늘 방문 숫자를 불러오지 못했습니다. 아래 「방문 분석」 에서 확인해주세요.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={adminButtonClass("secondary")}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="block text-h2 font-semibold tabular-nums text-foreground">{value}</span>
        <span className="mt-0.5 block text-body-sm text-muted">{sub}</span>
      </dd>
    </div>
  );
}
