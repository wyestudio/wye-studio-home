import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";

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

export default async function AdminReviewPaybacksPage() {
  const supabase = createAdminClient();

  const { data: applications, error } = await supabase
    .from("admin_review_payback_applications_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">후기 페이백 신청 목록을 불러올 수 없습니다: {error.message}</div>
      </div>
    );
  }

  const rows = (applications as ReviewPaybackApplication[]) ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <h1 className="text-3xl font-bold mb-8">후기 페이백 신청 목록 ({rows.length}건)</h1>

        {rows.length === 0 ? (
          <p className="text-muted py-4">아직 신청이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm">신청일시</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">이름</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">휴대폰</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">참가 회차</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">후기 채널</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">게시물 링크</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">은행</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">계좌번호</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">예금주</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30 align-top">
                    <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDateTimeFull(app.created_at)}</td>
                    <td className="py-3 px-4 text-sm">{app.name}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{app.phone}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{SESSION_LABELS[app.session_slug] ?? app.session_slug}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{CHANNEL_LABELS[app.channel] ?? app.channel}</td>
                    <td className="py-3 px-4 text-sm max-w-[220px] truncate">
                      <a href={app.post_url} target="_blank" rel="noopener" className="text-glow hover:underline">
                        {app.post_url}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{app.bank_name}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{app.account_number}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{app.account_holder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
