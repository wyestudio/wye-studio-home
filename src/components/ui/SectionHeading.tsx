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
   * ⚠️ **이제 크기를 바꾸지 않는다.** 섹션 제목은 어디서나 `text-h2` 한 가지다.
   *
   * 예전에는 lg 가 테마 상세용으로 제목을 키웠다 — 블록 하나가 한 화면을 차지하던
   * 시절(스냅 구조)이라 화면이 비어 보여서였다. 2026-10-04 에 그 구조를 걷어내
   * **전제가 사라졌고**, 남은 건 "모든 섹션이 페이지 제목(H1)만큼 큰" 상태뿐이었다
   * (상세에서 H1·H2 가 똑같이 36px 이었다 — UX 진단 지적).
   *
   * 값은 남겨 둔다. 호출부 13곳을 한꺼번에 고치는 것보다, 받되 무시하는 쪽이
   * 되돌리기 쉽다.
   */
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div className={`${align === "center" ? "text-center" : "text-left"} ${className}`}>
      <p
        className={`text-micro font-semibold uppercase tracking-[0.3em] text-muted ${title ? (lg ? "mb-2 sm:mb-3" : "mb-2") : ""}`}
        style={eyebrowColor ? { color: eyebrowColor } : undefined}
      >
        {eyebrow}
      </p>
      {title && (
        <h2 className="text-h2 font-extrabold">
          {title}
        </h2>
      )}
    </div>
  );
}
