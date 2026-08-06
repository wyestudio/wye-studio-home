import { Badge } from "@/components/ui/Badge";
import { formatKrw } from "@/lib/format";
import type { Application } from "@/types/domain";

const STATUS_LABEL: Record<Application["status"], string> = {
  confirmed: "참가확정",
  waiting: "참가대기",
  cancelled: "취소됨",
};

export function ApplyComplete({ application, priceKrw }: { application: Application; priceKrw: number }) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6">
      <div>
        <p className="mb-1 text-sm text-muted">접수번호</p>
        <p className="text-lg font-extrabold">{application.confirmation_code}</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone={application.status === "confirmed" ? "confirm" : "wait"}>
          {STATUS_LABEL[application.status]}
        </Badge>
        <span className="text-sm text-muted">
          {application.status === "confirmed"
            ? "참가가 확정되었습니다. 아래 계좌로 입금해주세요."
            : "정원이 차면 자동으로 참가확정으로 전환됩니다. 확정 여부와 관계없이 아래 계좌로 입금해주세요."}
        </span>
      </div>

      <div className="rounded-lg bg-brand-soft p-4 text-sm">
        <p className="mb-1 font-bold">무통장입금 안내 (간이)</p>
        <p>은행: 준비 중</p>
        <p>계좌번호: 준비 중</p>
        <p>예금주: wye studio</p>
        <p>입금액: {formatKrw(priceKrw)}</p>
        <p>입금자명: {application.depositor_name}</p>
        <p className="mt-2 text-xs text-muted">
          자세한 계좌 정보와 입금 기한은 신청확인 문자로 안내드립니다. 행사 전날부터는 환불이 불가합니다.
        </p>
      </div>
    </div>
  );
}
