export function SectionHeading({
  eyebrow,
  title,
  align = "center",
  className = "",
  eyebrowColor,
}: {
  eyebrow: string;
  /** 비우면 eyebrow 만 보인다. 제목이 군더더기인 화면에서 쓴다. */
  title?: string;
  align?: "center" | "left";
  className?: string;
  eyebrowColor?: string;
}) {
  return (
    <div className={`${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <p
        className={`text-xs font-bold uppercase tracking-[0.3em] text-muted ${title ? "mb-2" : ""}`}
        style={eyebrowColor ? { color: eyebrowColor } : undefined}
      >
        {eyebrow}
      </p>
      {title && <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>}
    </div>
  );
}
