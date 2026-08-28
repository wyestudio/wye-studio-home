type Tone = "wait" | "confirm" | "danger" | "neutral" | "danger-outline";

const tones: Record<Tone, string> = {
  wait: "bg-wait-soft text-wait",
  confirm: "bg-confirm-soft text-confirm",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-brand-soft text-brand",
  // 카드 배경이 비쳐 보이도록 배경은 투명하게, 테두리만 선명한 빨간색으로.
  "danger-outline": "border-2 border-danger bg-transparent text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
