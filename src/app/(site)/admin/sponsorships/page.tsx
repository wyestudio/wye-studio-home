import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeDotted } from "@/lib/format";

export const dynamic = "force-dynamic";

type GroupApplication = {
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
  companions: number;
  note: string | null;
  deliverable: string;
  agreements: Record<string, boolean>;
  created_at: string;
};

type DatingApplication = {
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
  note: string | null;
  deliverable: string;
  agreements: Record<string, boolean>;
  created_at: string;
};

export default async function AdminSponsorshipsPage() {
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
      <div className="p-6">
        <div className="text-red-500">
          협찬 신청 목록을 불러올 수 없습니다: {groupError?.message || datingError?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <h1 className="text-3xl font-bold mb-8">협찬 신청 목록</h1>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-3">그룹 방탈출 크리에이터 협찬 ({(groupApplications ?? []).length}건)</h2>
          <GroupApplicationsTable applications={(groupApplications as GroupApplication[]) ?? []} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">
            소개팅 방탈출 여성 크리에이터 협찬 ({(datingApplications ?? []).length}건)
          </h2>
          <DatingApplicationsTable applications={(datingApplications as DatingApplication[]) ?? []} />
        </section>
      </div>
    </div>
  );
}

function genderLabel(gender: "M" | "F"): string {
  return gender === "M" ? "남성" : "여성";
}

function AgreementBadges({ agreements }: { agreements: Record<string, boolean> }) {
  const allAgreed = Object.values(agreements).every(Boolean);
  return (
    <span className={allAgreed ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
      {allAgreed ? "전체 동의" : "미동의 항목 있음"}
    </span>
  );
}

function GroupApplicationsTable({ applications }: { applications: GroupApplication[] }) {
  if (applications.length === 0) {
    return <p className="text-muted py-4">아직 신청이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-semibold text-sm">신청일시</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">이름</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">출생연도</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">휴대폰</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">채널명</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">주력 채널</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">채널 주소</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">팔로워/도달</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">대표 후기</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">동행인</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">희망 콘텐츠</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">소개/기획</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">약관 동의</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30 align-top">
              <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDateTimeDotted(app.created_at)}</td>
              <td className="py-3 px-4 text-sm">{app.name}</td>
              <td className="py-3 px-4 text-sm">{app.birth_year}</td>
              <td className="py-3 px-4 text-sm">{genderLabel(app.gender)}</td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">{app.phone}</td>
              <td className="py-3 px-4 text-sm">{app.handle}</td>
              <td className="py-3 px-4 text-sm">{app.platform}</td>
              <td className="py-3 px-4 text-sm max-w-[220px] truncate">
                <a href={app.profile_url} target="_blank" rel="noopener" className="text-glow hover:underline">
                  {app.profile_url}
                </a>
              </td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">
                {app.followers.toLocaleString("ko-KR")} / {app.reach.toLocaleString("ko-KR")}
              </td>
              <td className="py-3 px-4 text-sm max-w-[180px] truncate">
                {app.portfolio_url ? (
                  <a href={app.portfolio_url} target="_blank" rel="noopener" className="text-glow hover:underline">
                    {app.portfolio_url}
                  </a>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm">{app.companions}명</td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">{app.deliverable}</td>
              <td className="py-3 px-4 text-sm max-w-[240px]">{app.note || <span className="text-muted">-</span>}</td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">
                <AgreementBadges agreements={app.agreements} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatingApplicationsTable({ applications }: { applications: DatingApplication[] }) {
  if (applications.length === 0) {
    return <p className="text-muted py-4">아직 신청이 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 font-semibold text-sm">신청일시</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">이름</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">출생연도</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">휴대폰</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">채널명</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">주력 채널</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">채널 주소</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">팔로워/도달</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">대표 후기</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">희망 콘텐츠</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">소개/기획</th>
            <th className="text-left py-3 px-4 font-semibold text-sm">약관 동의</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30 align-top">
              <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDateTimeDotted(app.created_at)}</td>
              <td className="py-3 px-4 text-sm">{app.name}</td>
              <td className="py-3 px-4 text-sm">{app.birth_year}</td>
              <td className="py-3 px-4 text-sm">{genderLabel(app.gender)}</td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">{app.phone}</td>
              <td className="py-3 px-4 text-sm">{app.handle}</td>
              <td className="py-3 px-4 text-sm">{app.platform}</td>
              <td className="py-3 px-4 text-sm max-w-[220px] truncate">
                <a href={app.profile_url} target="_blank" rel="noopener" className="text-glow hover:underline">
                  {app.profile_url}
                </a>
              </td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">
                {app.followers.toLocaleString("ko-KR")} / {app.reach.toLocaleString("ko-KR")}
              </td>
              <td className="py-3 px-4 text-sm max-w-[180px] truncate">
                {app.portfolio_url ? (
                  <a href={app.portfolio_url} target="_blank" rel="noopener" className="text-glow hover:underline">
                    {app.portfolio_url}
                  </a>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">{app.deliverable}</td>
              <td className="py-3 px-4 text-sm max-w-[240px]">{app.note || <span className="text-muted">-</span>}</td>
              <td className="py-3 px-4 text-sm whitespace-nowrap">
                <AgreementBadges agreements={app.agreements} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
