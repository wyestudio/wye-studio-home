import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

/**
 * 라벨 + 입력칸 + 오류 한 줄.
 *
 * ⚠️ 오류 문구에 **id 를 달고 입력칸이 그 id 를 가리키게** 한다(aria-describedby).
 *    연결하지 않으면 화면에는 빨간 글씨가 보이는데 스크린리더는 "무엇이 잘못됐는지"
 *    를 읽어주지 못한다 — 2026-10-04 접근성 진단에서 공개 폼 전체에 이 연결이
 *    하나도 없었다.
 *
 * 연결은 `htmlFor`(= 입력칸 id)에서 만들어내므로, **Field 에 htmlFor 를 주고
 * 자식 Input 에 같은 id 를 주면** 자동으로 걸린다. Input 에 errorId/invalid 를
 * 따로 넘길 필요는 없다 — 아래 describedBy 참고.
 */
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
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-label font-semibold text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        /*
          role="alert" — 제출 후 오류가 생겼을 때 스크린리더가 바로 알린다.
          id 는 입력칸의 aria-describedby 가 가리킨다(describedBy 헬퍼).
        */
        <p id={errorId} role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 입력칸이 자기 오류 문구를 가리키게 하는 속성 묶음.
 *
 * `<Input {...describedBy("phone", !!phoneError)} />` 처럼 쓴다.
 * Field 가 만드는 오류 id 규칙(`<id>-error`)과 **같은 규칙**이어야 한다.
 */
export function describedBy(id: string, hasError: boolean) {
  return {
    id,
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? `${id}-error` : undefined,
  } as const;
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
      // invalid 를 넘겼으면 보조기기에도 알린다. 호출부가 aria-invalid 를 직접
      // 넘겼으면(describedBy) 그쪽이 이긴다.
      aria-invalid={props["aria-invalid"] ?? (invalid || undefined)}
      className={`${baseClass} ${stateClass} ${props.className ?? ""}`}
    />
  );
}
