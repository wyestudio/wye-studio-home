"use client";

export function ApplyStepper({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  const steps = [
    { label: "정보입력", index: 0 },
    { label: "약관동의", index: 1 },
    { label: "제출", index: 2 },
  ];

  return (
    <div className="sticky top-[var(--header-height)] z-10 bg-background border-b border-border p-4 sm:p-6">
      <div className="flex gap-2">
        {steps.map((step) => {
          const isCompleted = step.index < currentStep;
          const isCurrent = step.index === currentStep;
          const isPending = step.index > currentStep;

          return (
            <div
              key={step.index}
              className="flex-1 flex flex-col gap-2 cursor-pointer"
              onClick={() => isCompleted && onStepChange(step.index)}
              role={isCompleted ? "button" : "presentation"}
              tabIndex={isCompleted ? 0 : -1}
              onKeyDown={(e) => {
                if (isCompleted && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onStepChange(step.index);
                }
              }}
            >
              <div
                className={`h-1 rounded-full transition-colors ${
                  isCurrent || isCompleted
                    ? "bg-glow"
                    : "bg-border"
                }`}
              />
              <span
                className={`text-xs font-semibold transition-colors ${
                  isCurrent || isCompleted
                    ? "text-glow"
                    : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
