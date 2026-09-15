export function SectionHeading({
  eyebrow,
  title,
  align = "center",
  className = "",
  eyebrowColor,
  size = "md",
}: {
  eyebrow: string;
  /** 비우면 eyebrow 만 보인다. 제목이 군더더기인 화면에서 쓴다. */
  title?: string;
  align?: "center" | "left";
  className?: string;
  eyebrowColor?: string;
  /**
   * lg: 테마 상세처럼 블록 하나가 한 화면을 차지하는 곳. 화면이 크게 비는 만큼 제목도 키운다.
   * 다른 페이지는 기본(md) 그대로.
   */
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div className={`${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <p
        className={`${lg ? "text-xs sm:text-sm" : "text-xs"} font-bold uppercase tracking-[0.3em] text-muted ${title ? (lg ? "mb-2 sm:mb-3" : "mb-2") : ""}`}
        style={eyebrowColor ? { color: eyebrowColor } : undefined}
      >
        {eyebrow}
      </p>
      {title && (
        <h2
          className={
            lg
              ? "text-2xl font-extrabold sm:text-3xl lg:text-4xl"
              : "text-xl font-extrabold sm:text-2xl"
          }
        >
          {title}
        </h2>
      )}
    </div>
  );
}
