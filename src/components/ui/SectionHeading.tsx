export function SectionHeading({
  eyebrow,
  title,
  align = "center",
  className = "",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={`${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-muted">{eyebrow}</p>
      <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
    </div>
  );
}
