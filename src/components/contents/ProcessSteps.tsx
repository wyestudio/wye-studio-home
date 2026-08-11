const STEPS = [
  { label: "참가 신청", desc: "온라인으로 3분" },
  { label: "조 편성", desc: "신청 확정 시 자동 안내" },
  { label: "방탈출 참가", desc: "회차 시간에 현장 참여" },
  { label: "(확장) 애프터", desc: "추후 도입 예정" },
];

export function ProcessSteps() {
  return (
    <section className="border-t border-border px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-center text-xl font-extrabold">진행 방식</h2>
        <div className="flex flex-wrap items-start justify-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1 px-1">
                <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
                  {step.label}
                </span>
                <span className="text-xs text-muted">{step.desc}</span>
              </div>
              {i < STEPS.length - 1 ? <span className="mb-5 text-border">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
