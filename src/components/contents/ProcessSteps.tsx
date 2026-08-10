const STEPS = ["참가 신청", "조 편성", "방탈출 참가", "(확장) 애프터"];

export function ProcessSteps() {
  return (
    <section className="border-t border-border px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-center text-xl font-extrabold">진행 방식</h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
                {step}
              </span>
              {i < STEPS.length - 1 ? <span className="text-border">→</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
