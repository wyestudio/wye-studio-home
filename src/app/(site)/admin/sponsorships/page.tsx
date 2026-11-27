import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { AdminBadge, AdminEmpty, AdminPage, AdminTabs } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";

export const dynamic = "force-dynamic";

/** 그룹 · 소개팅 신청서가 같은 칸을 쓴다. 동행인(companions)은 그룹 신청서에만 있다. */
type SponsorApplication = {
  id: string;
  name: string;
  birth_year: number;
  gender: "M" | "F";
  phone: string;
  handle: string;
  platform: string;
  profile_url: string;
  followers: number;
  reach: number;
  portfolio_url: string | null;
  companions?: number;
  note: string | null;
  deliverable: string;
  agreements: Record<string, boolean>;
  created_at: string;
};

/**
 * 신청서 종류 탭(2026-11-27 대표님: 상태 탭 없이 모양만 — 그룹 / 소개팅 탭, 표 6열 이하, 휴대폰 카드).
 * 조회 · 보이는 값은 예전과 같다. 탭은 ?tab= 으로 고른다(없으면 그룹).
 */
const TABS = [
  { key: "group", label: "그룹 방탈출", full: "그룹 방탈출 크리에이터 협찬" },
  { key: "dating", label: "소개팅 방탈출", full: "소개팅 방탈출 여성 크리에이터 협찬" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminSponsorshipsPage({ searchParams }: PageProps<"/admin/sponsorships">) {
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "group";

  const supabase = createAdminClient();

  const { data: groupApplications, error: groupError } = await supabase
    .from("admin_sponsorship_group_applications_view")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: datingApplications, error: datingError } = await supabase
    .from("admin_sponsorship_dating_applications_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (groupError || datingError) {
    return (
      <AdminPage title="협찬 신청">
        <p role="alert" className="text-body-sm text-danger">
          협찬 신청 목록을 불러올 수 없습니다: {groupError?.message || datingError?.message}
        </p>
      </AdminPage>
    );
  }

  const byTab: Record<TabKey, SponsorApplication[]> = {
    group: (groupApplications as SponsorApplication[]) ?? [],
    dating: (datingApplications as SponsorApplication[]) ?? [],
  };
  const applications = byTab[tab];
  const current = TABS.find((t) => t.key === tab)!;
  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: t.key === "group" ? "/sponsorships" : `/sponsorships?tab=${t.key}`,
    count: byTab[t.key].length,
  }));

  return (
    <AdminPage title="협찬 신청" description="크리에이터 협찬 신청서로 들어온 건입니다. 그룹 방탈출과 소개팅 방탈출을 따로 봅니다.">
      <AdminTabs tabs={tabs} current={tab} />

      <p className="mb-3 text-body-sm text-muted">
        {current.full} · 총 <strong className="text-foreground">{applications.length}</strong>건
      </p>

      {applications.length === 0 ? (
        <AdminEmpty title="아직 신청이 없어요" hint="크리에이터 협찬 신청서가 들어오면 여기에 보입니다." />
      ) : (
        <>
          {/* 휴대폰: 카드 */}
          <ul className="flex flex-col gap-2 md:hidden">
            {applications.map((app) => (
              <li key={app.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-body font-semibold">{app.name}</span>
                  <span className="text-body-sm text-muted">{personLine(app)}</span>
                  <AgreementBadge agreements={app.agreements} />
                </div>
                <div className="mt-1 text-body-sm tabular-nums text-muted">{app.phone}</div>
                <div className="mt-2 text-body-sm">
                  <ExternalLink href={app.profile_url}>{app.handle}</ExternalLink>
                  <span className="text-muted"> · {app.platform}</span>
                </div>
                <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                  팔로워 {app.followers.toLocaleString("ko-KR")} · 도달 {app.reach.toLocaleString("ko-KR")}
                </div>
                <div className="mt-0.5 text-body-sm text-muted">
                  희망 콘텐츠 {app.deliverable}
                  {app.companions != null && ` · 동행인 ${app.companions}명`}
                </div>
                <div className="mt-0.5 text-body-sm tabular-nums text-muted">{formatDateTimeFull(app.created_at)} 신청</div>
                <ApplicationDetail app={app} />
              </li>
            ))}
          </ul>

          {/* 컴퓨터: 표 — 열은 6개(docs/01 5장 원칙 3). 채널 주소 · 대표 후기 · 소개/기획은 줄 아래에 접어 둔다 */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-left text-label text-muted">
                <tr>
                  <th className="px-3 py-2.5">신청자</th>
                  <th className="px-3 py-2.5">채널</th>
                  <th className="px-3 py-2.5 text-right">팔로워 / 도달</th>
                  <th className="px-3 py-2.5">희망 콘텐츠</th>
                  <th className="px-3 py-2.5">약관 동의</th>
                  <th className="px-3 py-2.5">신청일시</th>
                </tr>
              </thead>
              {/* 한 건 = 줄 둘(요약 + 접힌 상세)이라 tbody 로 묶는다 */}
              {applications.map((app) => (
                <tbody key={app.id} className="border-b border-border/50 last:border-0 hover:bg-fill-subtle">
                  <tr className="align-top">
                    <td className="px-3 pt-3">
                      <span className="whitespace-nowrap font-semibold text-foreground">{app.name}</span>
                      <span className="block whitespace-nowrap text-muted">{personLine(app)}</span>
                      <span className="block whitespace-nowrap tabular-nums text-muted">{app.phone}</span>
                    </td>
                    <td className="px-3 pt-3">
                      {/* 긴 채널명이 표를 밀지 않게 한 줄로 자른다 — 전체 주소는 아래 「자세히」 에 있다 */}
                      <ExternalLink href={app.profile_url} className="block max-w-56 truncate">
                        {app.handle}
                      </ExternalLink>
                      <span className="block text-muted">{app.platform}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 pt-3 text-right tabular-nums">
                      {app.followers.toLocaleString("ko-KR")} / {app.reach.toLocaleString("ko-KR")}
                    </td>
                    <td className="whitespace-nowrap px-3 pt-3">
                      {app.deliverable}
                      {app.companions != null && <span className="block text-muted">동행인 {app.companions}명</span>}
                    </td>
                    <td className="px-3 pt-3">
                      <AgreementBadge agreements={app.agreements} />
                    </td>
                    <td className="whitespace-nowrap px-3 pt-3 tabular-nums text-muted">{formatDateTimeFull(app.created_at)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-3 pb-3">
                      <ApplicationDetail app={app} />
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
    </AdminPage>
  );
}

function genderLabel(gender: "M" | "F"): string {
  return gender === "M" ? "남성" : "여성";
}

function personLine(app: SponsorApplication): string {
  return `${genderLabel(app.gender)} · ${app.birth_year}년생`;
}

/** 색만으로 가르지 않는다 — 배지에 글자가 같이 있다. */
function AgreementBadge({ agreements }: { agreements: Record<string, boolean> }) {
  const allAgreed = Object.values(agreements).every(Boolean);
  return <AdminBadge tone={allAgreed ? "done" : "danger"}>{allAgreed ? "전체 동의" : "미동의 항목 있음"}</AdminBadge>;
}

function ExternalLink({ href, className = "", children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={`text-glow hover:underline ${className}`}>
      {children}
    </a>
  );
}

/** 덜 쓰는 것은 접는다(docs/01 5장 원칙 5) — 채널 주소 · 대표 후기 · 소개/기획. */
function ApplicationDetail({ app }: { app: SponsorApplication }) {
  return (
    <details className="group/detail mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-body-sm text-muted hover:text-foreground md:min-h-0 [&::-webkit-details-marker]:hidden">
        소개 · 링크 자세히 보기
        <Chevron dir="down" className="h-4 w-4 transition-transform group-open/detail:rotate-180" />
      </summary>
      <dl className="mt-2 grid gap-3 text-body-sm md:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-label text-muted">채널 주소</dt>
          <dd>
            <ExternalLink href={app.profile_url} className="break-all">
              {app.profile_url}
            </ExternalLink>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-muted">대표 후기</dt>
          <dd>
            {app.portfolio_url ? (
              <ExternalLink href={app.portfolio_url} className="break-all">
                {app.portfolio_url}
              </ExternalLink>
            ) : (
              <span className="text-muted">-</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 md:col-span-2">
          <dt className="text-label text-muted">소개 / 기획</dt>
          <dd className="whitespace-pre-wrap break-words text-foreground">{app.note || <span className="text-muted">-</span>}</dd>
        </div>
      </dl>
    </details>
  );
}
