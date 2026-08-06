import type { Session, SessionStats } from "@/types/domain";

export function CapacityPolicyTable({ session, stats }: { session: Session; stats: SessionStats }) {
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
    <div className="overflow-hidden rounded-xl border border-border">
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
