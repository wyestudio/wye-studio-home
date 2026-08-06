type Tone = "wait" | "confirm" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  wait: "bg-wait-soft text-wait",
  confirm: "bg-confirm-soft text-confirm",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-brand-soft text-brand",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
