import { AdminNav } from "@/components/admin/AdminNav";
import { getSettlement, COMMISSION_RATE } from "@/lib/settlement";
import { SettlementPanel } from "./SettlementPanel";

export const dynamic = "force-dynamic";

/** 계약기간(제3조) 안의 달만 고른다. 밖의 달은 정산 대상이 아니다. */
const CONTRACT_MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];

/** 오늘(KST)이 속한 달. 계약기간 밖이면 가장 가까운 달로 맞춘다. */
function defaultMonth(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const m = kst.toISOString().slice(0, 7);
  if (CONTRACT_MONTHS.includes(m)) return m;
  return m < CONTRACT_MONTHS[0] ? CONTRACT_MONTHS[0] : CONTRACT_MONTHS[CONTRACT_MONTHS.length - 1];
}

export default async function SettlementPage({
  searchParams,
}: PageProps<"/admin/settlement">) {
  const params = await searchParams;
  const raw = typeof params.month === "string" ? params.month : "";
  const month = CONTRACT_MONTHS.includes(raw) ? raw : defaultMonth();

  // ⚠️ 실패를 조용히 0건으로 보여주면 안 된다. 정산에서 0건은 '줄 돈이 없다'로
  //    읽히기 때문에, 못 불러온 것과 정말 없는 것을 반드시 구분해야 한다.
  let data: Awaited<ReturnType<typeof getSettlement>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getSettlement(month);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/settlement" />

        <header className="mb-5">
          <h1 className="text-2xl font-bold">잼핏 정산</h1>
          <p className="mt-1 text-sm text-muted">
            잼핏(ZAMFIT) 제휴계약에 따른 성과형 예약 수수료입니다. 정산기간은 매월 1일~말일,
            지급은 <strong className="text-foreground">익월 10일까지</strong>입니다(제8조).
            수수료는 실입금액의 {Math.round(COMMISSION_RATE * 100)}%(부가세 포함, 제7조)입니다.
          </p>
        </header>

        {loadError || !data ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-6">
            <p className="font-semibold text-red-400">정산 자료를 불러오지 못했습니다.</p>
            <p className="mt-1 text-sm text-muted">{loadError}</p>
            <p className="mt-3 text-sm text-amber-300">
              ⚠️ 이 화면이 비어 있다고 해서 정산할 건이 없는 것이 아닙니다. 문제를 해결한 뒤 다시
              확인해주세요.
            </p>
          </div>
        ) : (
          <SettlementPanel data={data} months={CONTRACT_MONTHS} />
        )}

        <div className="mt-10 space-y-1.5 border-t border-border pt-6 text-xs text-muted">
          <p>
            · <strong className="text-foreground">정산 대상</strong>: 잼핏 쿠폰을 쓴 예약 중 입금이
            완료된 건. 쿠폰 없이 유입경로(utm)만 잼핏인 건은 대상이 아닙니다(제2조).
          </p>
          <p>
            · <strong className="text-foreground">취소 건도 수수료가 날 수 있습니다</strong>. 우리
            환불 규정은 4일 전까지 100%, 3일 전 50%, 2일 전부터 0%입니다. 환불하고 남은 금액(보유액)이
            수수료의 기준입니다(제7조 8항). 전액 환불된 건만 0원입니다.
          </p>
          <p>
            · <strong className="text-foreground">개인정보는 넣지 않습니다</strong>. 이름·연락처 없이
            예약번호·인원·금액만 넘깁니다(제8조 4항·제14조 3항).
          </p>
          <p>
            · 환불 <strong className="text-foreground">금액</strong>은 따로 저장하지 않아 규정대로
            계산합니다. 규정과 다르게 환불한 건은 ⚠️ 로 표시되니 직접 확인해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
