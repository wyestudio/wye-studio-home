import { InfoTooltip } from "@/components/ui/InfoTooltip";

/**
 * 테마 카테고리('파티형 방탈출') 표시 + 설명 물음표.
 *
 * 예전에는 장르 태그와 똑같은 테두리 알약이라 둘이 구분되지 않았다(2026-09-15 의견).
 * 세 가지 모양을 테스트 서버에서 비교 중이다(page.tsx 의 ?badge=1|2|3).
 *   eyebrow : 제목 위 강조색 작은 글씨
 *   solid   : 제목 옆, 강조색으로 꽉 채운 각진 태그
 *   plain   : 제목 옆, 테두리·배경 없이 작은 마름모 + 글자
 *
 * 설명(theme_categories.description)이 비어 있으면 물음표를 달지 않는다.
 */
export type CategoryVariant = "eyebrow" | "solid" | "plain";

export function CategoryLabel({
  variant,
  category,
  accent,
}: {
  variant: CategoryVariant;
  category: { name: string; description: string | null };
  accent: string;
}) {
  const tip = category.description?.trim() ? (
    <InfoTooltip text={category.description.trim()} label={`${category.name} 설명 보기`} />
  ) : null;

  if (variant === "eyebrow") {
    return (
      <p className="mb-1.5 flex items-center gap-1.5 sm:mb-2">
        <span className="text-xs font-bold tracking-[0.12em] sm:text-sm" style={{ color: accent }}>
          {category.name}
        </span>
        {tip}
      </p>
    );
  }

  if (variant === "solid") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="rounded-[4px] px-2 py-1 text-xs font-extrabold leading-none"
          style={{ backgroundColor: accent, color: "#0a0a12" }}
        >
          {category.name}
        </span>
        {tip}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75">
      <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden style={{ color: accent }}>
        <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
      </svg>
      {category.name}
      {tip}
    </span>
  );
}
