import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "outline";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold px-5 py-3 transition-all disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-foreground shadow-[0_0_20px_-4px_var(--glow)] hover:shadow-[0_0_28px_-2px_var(--glow)] hover:opacity-95",
  ghost: "bg-transparent text-foreground hover:bg-white/5",
  outline: "bg-surface border border-glass-border text-foreground hover:bg-white/5",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
