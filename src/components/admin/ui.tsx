import Link from "next/link";

/**
 * 관리자 공통 부품(2026-11-27 관리자 개편) — 화면마다 따로 디자인하지 않으려고 한곳에 둔다.
 *
 * 색은 전부 역할 이름(bg-surface · border-border · text-muted …)이다. 관리자 범위에서는
 * admin.css 가 그 값을 라이트 / 다크로 바꾸므로, 여기서 모드를 가를 필요가 없다.
 * 크기 · 굵기 · 둥글기는 wye-design-system 의 토큰만 쓴다(수치를 직접 박지 않는다).
 *
 * 서버 컴포넌트에서도 쓸 수 있게 상태(useState)를 두지 않는다.
 */

/**
 * 화면 맨 위 — 제목 한 줄과 그 화면의 주요 버튼 **하나**(docs/01 5장 원칙 1).
 * 좁은 화면에서는 버튼이 제목 아래로 내려간다.
 */
export function AdminPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** 이 화면의 주요 버튼. 하나만 둔다. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h2 font-extrabold text-foreground">{title}</h1>
          {description && <p className="mt-1 text-body-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** 흰 카드. 한 탭에 3~4개를 넘기지 않는다(docs/01 5장 원칙 2). */
export function AdminCard({
  title,
  aside,
  className = "",
  children,
}: {
  title?: string;
  /** 제목 줄 오른쪽에 놓는 작은 버튼 · 링크 */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-5 md:p-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-h3 font-semibold text-foreground">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * 상태 배지. 색만으로 구분하지 않는다 — 반드시 글자를 같이 쓴다.
 *   done 초록(확정 · 완료) · progress 파랑(진행) · warn 주황(확인 필요) · danger 빨강(문제 · 취소) · idle 회색(대기)
 */
export type AdminTone = "done" | "progress" | "warn" | "danger" | "idle";

const BADGE_TONE: Record<AdminTone, string> = {
  done: "bg-confirm-soft text-confirm",
  progress: "bg-brand-soft text-brand",
  warn: "bg-wait-soft text-wait",
  danger: "bg-danger-soft text-danger",
  idle: "bg-fill-strong text-muted",
};

export function AdminBadge({ tone = "idle", children }: { tone?: AdminTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-micro font-semibold ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

/** 확인이 필요한 일 — 연한 주황 카드. "무엇이 다른지" 한 줄 + 버튼 1~2개. */
export function AdminNotice({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-wait bg-wait-soft p-4">
      <p className="text-body-sm font-semibold text-wait">{title}</p>
      {children && <div className="mt-1 text-body-sm text-foreground">{children}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** 빈 상태 — "아직 없어요" 와 다음에 할 행동 한 줄. */
export function AdminEmpty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <p className="text-body font-semibold text-foreground">{title}</p>
      {hint && <p className="mt-1 text-body-sm text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * 버튼 모양. primary = 그 화면의 주요 동작(거의 검정 · 다크에서는 거의 흰색), secondary = 그 밖, danger = 삭제 · 취소.
 * 누르는 영역은 44px(min-h-11) — 휴대폰에서도 쓴다.
 * 글자는 「수정 · 저장 · 등록 · 삭제」 넷 중에서 고른다(wye-design-system).
 */
export type AdminButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_VARIANT: Record<AdminButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary: "border border-line bg-surface text-foreground hover:bg-fill",
  danger: "border border-danger bg-surface text-danger hover:bg-danger-soft",
};

export function adminButtonClass(variant: AdminButtonVariant = "secondary"): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-body-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${BUTTON_VARIANT[variant]}`;
}

export function AdminButton({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: AdminButtonVariant }) {
  return <button type="button" {...props} className={`${adminButtonClass(variant)} ${className}`} />;
}

/**
 * 입력칸 모양. 글자는 text-input(16px) — 그보다 작으면 아이폰이 포커스 때 화면을 확대한다.
 * input · select · textarea 에 className 으로 붙인다.
 */
export const adminInputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-input text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/** 입력 라벨 + 입력칸 + 도움말 / 오류 한 묶음. */
export function AdminField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-label font-semibold text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-body-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-body-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * 거르기 탭(전체 / 처리 필요 / 진행 중 …)과 개수. 주소(?tab=)로 고르는 링크라 서버 화면에서 그대로 쓴다.
 * 좁은 화면에서는 줄이 넘치면 옆으로 민다(탭 줄만 — 페이지 전체가 밀리지 않는다).
 */
export function AdminTabs({
  tabs,
  current,
}: {
  tabs: { key: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="mb-4 overflow-x-auto border-b border-border">
      <div role="tablist" className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={`-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-label font-semibold transition-colors ${
                active ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 text-micro ${active ? "bg-foreground text-background" : "bg-fill-strong text-muted"}`}>
                  {t.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
