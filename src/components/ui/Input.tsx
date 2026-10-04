import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
} & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label font-semibold text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * 모든 입력칸.
 *
 * ⚠️ 글자는 `text-input`(16px 고정)이다. 14px 이었을 때 아이폰에서 입력칸을
 *    누를 때마다 화면이 확대됐다(2026-10-04 UX 진단 P0). 줄이지 말 것.
 * ⚠️ 높이 48px(h-12)은 터치 영역 기준이다(Apple HIG 44pt · Material 48dp).
 * 어드민도 같은 크기를 쓴다 — 어드민에서도 아이폰 확대는 똑같이 일어난다.
 */
export function Input({
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const baseClass =
    "h-12 w-full rounded-lg border px-4 text-input outline-none transition-shadow";
  const stateClass = invalid
    ? "border-danger bg-danger-soft text-danger"
    : "border-border bg-surface text-foreground focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)]";

  return (
    <input
      {...props}
      className={`${baseClass} ${stateClass} ${props.className ?? ""}`}
    />
  );
}
