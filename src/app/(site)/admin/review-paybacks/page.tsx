import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { AdminEmpty, AdminPage } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type ReviewPaybackApplication = {
  id: string;
  name: string;
  phone: string;
  session_slug: string;
  channel: string;
  post_url: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  agreements: Record<string, boolean>;
  created_at: string;
};

const SESSION_LABELS: Record<string, string> = {
  "0829-meeting": "8/29 프리오픈 · 그룹 방탈출 (낮)",
  "0829-dating": "8/29 프리오픈 · 소개팅 방탈출 (저녁)",
};

const CHANNEL_LABELS: Record<string, string> = {
  "instagram-feed": "인스타그램 피드",
  "instagram-reels": "인스타그램 릴스",
  "naver-blog": "네이버 블로그",
  threads: "스레드",
  youtube: "유튜브 (쇼츠 포함)",
};

/**
 * 후기 페이백 신청 목록.
 * 2026-11-27 대표님: 상태 탭 없이 모양만 정리한다(표 6열 이하, 휴대폰 카드). 조회 · 보이는 값은 예전과 같다.
 */
export default async function AdminReviewPaybacksPage() {
  const supabase = createAdminClient();

  const { data: applications, error } = await supabase
    .from("admin_review_payback_applications_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AdminPage title="후기 페이백">
        <p role="alert" className="text-body-sm text-danger">
          후기 페이백 신청 목록을 불러올 수 없습니다: {error.message}
        </p>
      </AdminPage>
    );
  }

  const rows = (applications as ReviewPaybackApplication[]) ?? [];

  return (
    <AdminPage title="후기 페이백" description="후기를 남기고 페이백을 신청한 건입니다. 게시물을 확인한 뒤 적힌 계좌로 보냅니다.">
      <p className="mb-3 text-body-sm text-muted">
        총 <strong className="text-foreground">{rows.length}</strong>건
      </p>

      {rows.length === 0 ? (
        <AdminEmpty title="아직 신청이 없어요" hint="후기 페이백 신청서가 들어오면 여기에 보입니다." />
      ) : (
        <>
          {/* 휴대폰: 카드 */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((app) => (
              <li key={app.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-body font-semibold">{app.name}</span>
                  <span className="text-body-sm tabular-nums text-muted">{app.phone}</span>
                </div>
                <div className="mt-1 text-body-sm text-muted">{sessionLabel(app)}</div>
                <div className="mt-2 text-body-sm">
                  <span className="text-muted">{channelLabel(app)}</span>
                  <PostLink url={app.post_url} className="block break-all" />
                </div>
                <div className="mt-2 text-body-sm tabular-nums">
                  {app.bank_name} {app.account_number}
                  <span className="text-muted"> · 예금주 {app.account_holder}</span>
                </div>
                <div className="mt-1 text-body-sm tabular-nums text-muted">{formatDateTimeFull(app.created_at)} 신청</div>
              </li>
            ))}
          </ul>

          {/* 컴퓨터: 표 — 열은 5개(docs/01 5장 원칙 3). 휴대폰은 신청자 칸, 은행 · 계좌번호 · 예금주는 한 칸에 모은다 */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-left text-label text-muted">
                <tr>
                  <th className="px-3 py-2.5">신청자</th>
                  <th className="px-3 py-2.5">참가 회차</th>
                  <th className="px-3 py-2.5">후기</th>
                  <th className="px-3 py-2.5">입금 계좌</th>
                  <th className="px-3 py-2.5">신청일시</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <tr key={app.id} className="border-b border-border/50 align-top last:border-0 hover:bg-fill-subtle">
                    <td className="px-3 py-3">
                      <span className="font-semibold text-foreground">{app.name}</span>
                      <span className="block whitespace-nowrap tabular-nums text-muted">{app.phone}</span>
                    </td>
                    <td className="px-3 py-3">{sessionLabel(app)}</td>
                    <td className="px-3 py-3">
                      {channelLabel(app)}
                      {/* 긴 주소가 표를 밀지 않게 한 줄로 자른다 — 전체 주소는 누르면 열린다 */}
                      <PostLink url={app.post_url} className="block max-w-56 truncate" />
                    </td>
                    <td className="px-3 py-3">
                      <span className="whitespace-nowrap tabular-nums">
                        {app.bank_name} {app.account_number}
                      </span>
                      <span className="block text-muted">예금주 {app.account_holder}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted">{formatDateTimeFull(app.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminPage>
  );
}

function sessionLabel(app: ReviewPaybackApplication): string {
  return SESSION_LABELS[app.session_slug] ?? app.session_slug;
}

function channelLabel(app: ReviewPaybackApplication): string {
  return CHANNEL_LABELS[app.channel] ?? app.channel;
}

function PostLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener" title={url} className={`text-glow hover:underline ${className}`}>
      {url}
    </a>
  );
}
