import type { Session, SessionStats } from "@/types/domain";

// 소개팅 회차는 성비를 맞춰야 해서 남/여 각각 정원(10명씩)을 따로 관리한다 —
// 세션 전체 합계가 아니라 성별별 확정/대기 인원 기준으로 표를 그린다.
function GenderCapacityPolicyTable({ session, stats }: { session: Session; stats: SessionStats }) {
  const rows = [
    {
      gender: "남성",
      confirmedCount: stats.male_confirmed_count,
      waitingCount: stats.male_waiting_count,
      line: session.capacity_confirm_line_male ?? 0,
    },
    {
      gender: "여성",
      confirmedCount: stats.female_confirmed_count,
      waitingCount: stats.female_waiting_count,
      line: session.capacity_confirm_line_female ?? 0,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.gender} className="[&:last-child>td]:border-b-0">
              <td className="border-b border-border px-4 py-3 font-semibold">{row.gender}</td>
              <td className="border-b border-border px-4 py-3 text-muted">
                1~{row.line}명 신청 즉시 참가확정, 이후 참가대기
                <br />
                현재 확정 {row.confirmedCount}명
                {row.waitingCount > 0 ? ` · 대기 ${row.waitingCount}명` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CapacityPolicyTable({ session, stats }: { session: Session; stats: SessionStats }) {
  if (session.theme_label === "소개팅") {
    return <GenderCapacityPolicyTable session={session} stats={stats} />;
  }

  const total = stats.confirmed_count + stats.waiting_count;
  const rows = [
    {
      label: `1~${session.capacity_confirm_line}명`,
      desc: "신청 즉시 무조건 참가확정",
      active: total <= session.capacity_confirm_line,
    },
    {
      label: `${session.capacity_confirm_line + 1}~${session.capacity_max - 1}명`,
      desc: "참가대기 (정원이 찰 때까지 대기)",
      active: total > session.capacity_confirm_line && total < session.capacity_max,
    },
    {
      label: `${session.capacity_max}명 (정원)`,
      desc: "대기자 전원 참가확정 + 모집 마감",
      active: total >= session.capacity_max,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={`${row.active ? "bg-brand-soft" : ""} [&:last-child>td]:border-b-0`}>
              <td className="border-b border-border px-4 py-3 font-semibold">
                {row.label}
              </td>
              <td className="border-b border-border px-4 py-3 text-muted">
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
