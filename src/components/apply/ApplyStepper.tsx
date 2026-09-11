"use client";

const STEPS = ["정보입력", "약관동의", "제출"];

/**
 * 3단계 진행 표시줄.
 *
 * 다음 단계로는 못 넘어가지만 **이미 지나온 단계는 눌러서 돌아갈 수 있다.**
 * 예전에는 그게 눌린다는 걸 알 방법이 없었다(막대와 글자 색만 달랐다).
 * 글로 안내하는 대신 모양으로 알린다 —
 *   · 지나온 단계는 ✓ 가 찍힌 채워진 원, 커서가 손가락, 밑줄이 예약돼 있고
 *   · 마우스를 올리면 ✓ 가 ← 로 바뀌고 살짝 떠오른다.
 */
export function ApplyStepper({
  currentStep,
  onStepChange,
}: {
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <div className="sticky top-[var(--header-height,0px)] z-20 -mx-5 border-b border-border bg-background px-5 py-4">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const done = index < currentStep;
          const current = index === currentStep;

          return (
            <li key={label} className="flex-1">
              <button
                type="button"
                disabled={!done}
                onClick={() => done && onStepChange(index)}
                aria-current={current ? "step" : undefined}
                aria-label={done ? `${label} 단계로 돌아가기` : label}
                className={`group flex w-full flex-col gap-2 text-left transition-transform ${
                  done ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"
                }`}
              >
                <span
                  className={`h-1 rounded-full transition-colors ${
                    done || current ? "bg-glow" : "bg-border"
                  } ${done ? "group-hover:bg-foreground" : ""}`}
                />
                <span className="flex items-center gap-1.5">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors ${
                      done
                        ? "bg-glow text-glow-foreground"
                        : current
                          ? "bg-glow text-glow-foreground"
                          : "border border-border text-muted"
                    }`}
                  >
                    {/* 마우스를 올리면 '돌아갈 수 있다' 는 뜻으로 화살표가 된다 */}
                    {done ? (
                      <>
                        <span className="group-hover:hidden">✓</span>
                        <span className="hidden group-hover:inline">←</span>
                      </>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={`text-xs font-semibold transition-colors ${
                      done
                        ? "text-glow underline decoration-dotted underline-offset-4 group-hover:decoration-solid group-hover:text-foreground"
                        : current
                          ? "text-glow"
                          : "text-muted"
                    }`}
                  >
                    {label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
