import { InfoTooltip } from "@/components/ui/InfoTooltip";

/**
 * 테마 카테고리('파티형 방탈출') — 제목 위 강조색 작은 글씨 + 설명 물음표.
 *
 * 예전에는 제목 옆 테두리 알약이라 바로 아래 장르 태그(#문제방 …)와 모양이 같아
 * 구분이 안 됐다(2026-09-15 의견). 제목 위 라벨 / 꽉 찬 네모 태그 / 아이콘+글자
 * 세 가지를 테스트 서버에서 비교한 뒤 제목 위 라벨로 정했다.
 *
 * 설명(theme_categories.description)이 비어 있으면 물음표를 달지 않는다.
 */
export function CategoryLabel({
  category,
  accent,
}: {
  category: { name: string; description: string | null };
  accent: string;
}) {
  const description = category.description?.trim();

  return (
    <p className="mb-1.5 flex items-center gap-1.5 sm:mb-2">
      <span className="text-xs font-bold tracking-[0.12em] sm:text-sm" style={{ color: accent }}>
        {category.name}
      </span>
      {description && <InfoTooltip text={description} label={`${category.name} 설명 보기`} />}
    </p>
  );
}
