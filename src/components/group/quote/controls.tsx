"use client";

/**
 * 단체 견적 화면의 입력 조각들.
 *
 * ⚠️ + · − 는 글자가 아니라 SVG 로 그린다. 본문 글꼴 SUIT 에 '−'(U+2212)가 없어서
 *    기기 기본 글꼴로 떨어진다(wye-customer-facing). 손가락으로 누르는 칸은 44px 이상.
 */

function PlusMinusIcon({ minus = false }: { minus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {!minus && <path d="M12 5v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * 숫자 올리고 내리기. 범위가 좁고 흔한 값이 있는 칸(애프터파티 0~4시간)에 쓴다.
 * `typeable` 이면 가운데 칸에 직접 칠 수 있다 — 인원처럼 범위가 넓은 칸.
 */
export function NumberStepper({
  value,
  min,
  max,
  unit,
  label,
  onChange,
  typeable = false,
  disabled = false,
  id,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  label: string;
  onChange: (n: number) => void;
  typeable?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const btn =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-fill text-foreground transition hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        className={btn}
        aria-label={`${label} 하나 줄이기`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <PlusMinusIcon minus />
      </button>
      {typeable ? (
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ""}
          disabled={disabled}
          aria-label={label}
          // 지우고 새로 치는 중에는 빈 칸(NaN)으로 둔다 — 0 을 채워 넣으면 '015' 가 된다.
          onChange={(e) => onChange(e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)))}
          // 칸을 비우거나 범위 밖을 친 채 나가면 가까운 끝값으로 맞춘다.
          onBlur={() => onChange(Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)))}
          className="h-11 w-16 rounded-lg border border-line bg-fill text-center text-input font-semibold outline-none focus:border-[#f082f4]"
        />
      ) : (
        <span
          id={id}
          aria-live="polite"
          className="min-w-[3.5rem] text-center text-h3 font-semibold tabular-nums"
        >
          {value}
        </span>
      )}
      <button
        type="button"
        className={btn}
        aria-label={`${label} 하나 늘리기`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, (Number.isFinite(value) ? value : min - 1) + 1))}
      >
        <PlusMinusIcon />
      </button>
      <span className="text-body text-muted">{unit}</span>
    </div>
  );
}

/** 켜고 끄는 스위치. 체크박스보다 '지금 포함돼 있다' 가 한눈에 보인다. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // 바깥 칸을 44px 로 잡아 손가락 기준을 맞추고, 그림은 그 안에 작게 그린다.
      className="flex h-11 w-14 shrink-0 items-center justify-end disabled:opacity-40"
    >
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
          checked ? "bg-[#f082f4]" : "bg-fill-strong"
        }`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

/** 하나만 고르는 알약 버튼 줄. */
export function ChipGroup({
  options,
  value,
  onPick,
  label,
}: {
  options: readonly { code: string; label: string; sub?: string; disabled?: boolean }[];
  value: string | null;
  onPick: (code: string) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.code;
        return (
          <button
            key={o.code}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onPick(o.code)}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-4 py-1.5 text-body-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
              on
                ? "bg-[#f082f4] font-semibold text-[#141414]"
                : "border border-line bg-fill text-foreground hover:border-line-strong"
            }`}
          >
            {o.label}
            {o.sub && (
              <span className={`text-micro ${on ? "text-[#141414]/70" : "text-muted"}`}>{o.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 칸 이름 + 필수/선택 표시. 둘 다 적는다 — 한쪽만 적으면 나머지를 짐작하다 틀린다(Baymard). */
export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required: boolean;
  children: React.ReactNode;
}) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <Tag htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-label font-semibold text-foreground">
      {children}
      <span className={`text-micro font-normal ${required ? "text-[#f082f4]" : "text-muted"}`}>
        {required ? "필수" : "선택"}
      </span>
    </Tag>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-body-sm font-semibold text-danger">
      {message}
    </p>
  );
}

/** 동의 체크박스. 글줄 전체를 눌러도 체크된다. */
export function CheckRow({
  checked,
  onChange,
  children,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#f082f4]"
      />
      <span className="text-body-sm leading-relaxed text-foreground">{children}</span>
    </label>
  );
}
