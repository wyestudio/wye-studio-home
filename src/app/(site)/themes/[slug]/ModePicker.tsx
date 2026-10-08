import Link from "next/link";
import type { ThemeWithTiers } from "@/types/catalog";
import { hoursLabel } from "@/components/contents/ThemeSpecs";

/**
 * 주소에 쓸 모드 키. `/themes/baotalchul?mode=normal` 처럼 짧게 둔다.
 *
 * 변형 테마의 slug 는 **기본 테마 slug 로 시작한다**는 약속을 쓴다
 * (baotalchul → baotalchul-normal). 그 접두사를 떼면 'normal' 이 된다.
 * 약속을 안 지킨 slug 면 slug 를 통째로 쓴다 — 틀려도 주소만 길어질 뿐
 * 모드를 못 찾는 일은 없다(page.tsx 의 해석이 키·slug·id 를 다 받는다).
 */
export function modeKey(baseSlug: string, slug: string) {
  return slug.startsWith(`${baseSlug}-`) ? slug.slice(baseSlug.length + 1) : slug;
}

/**
 * 테마 상단의 모드 선택(바-ㅇ탈출 파티/노말).
 *
 * 왜 여기에 — 포스터와 테마명 **아래**, 스펙 타일 **위**에 둔다.
 *   처음 온 사람은 "이게 무슨 테마인가" 를 먼저 알아야 하고, 모드는 그다음이다.
 *   맨 위에 모드 비교표를 두면 테마를 모르는 사람에게 선택부터 시키는 꼴이 된다.
 *
 * 왜 탭 안에 시간·가격을 적나 — 고르기 **전에** 차이가 보여야 한다. 토글 하나만
 *   두면 처음 온 사람은 다른 모드가 있다는 걸 모르고 나간다(2026-10-08 논의).
 *
 * ⚠️ 전환은 **주소(?mode=)** 로 한다. 클라이언트 상태로 하면 공유·뒤로가기·새로고침이
 *    깨지고, 서버에서 그리던 가격·회차를 전부 클라이언트로 내려야 한다.
 * ⚠️ 기본 모드(variants[0])는 ?mode 를 **붙이지 않는다**. 같은 화면이 주소 두 개로
 *    갈리면 검색엔진에 중복으로 잡힌다.
 * ⚠️ 탭 이름은 themes.variant_label 이다. 테마명에서 괄호 안을 꺼내 쓰려다
 *    괄호가 없는 파티모드가 '기본' 으로 나왔다 — 이름 생김새에 기대지 않는다.
 */
export function ModePicker({
  variants,
  activeId,
  baseSlug,
  accent,
  className = "",
}: {
  /** 같은 묶음의 모드들. sort_order 순이고 [0] 이 기본 모드다. */
  variants: ThemeWithTiers[];
  activeId: string;
  /** 기본 테마의 slug (예: baotalchul). 주소와 모드 키를 여기서 만든다. */
  baseSlug: string;
  accent: string;
  /**
   * 바깥 배치는 **쓰는 쪽이 정한다.** 여기서 [grid-area:…] 를 들고 있으면
   * 그리드가 아닌 자리(회차 선택 섹션)에서는 죽은 클래스가 되고, 그리드
   * 안에서도 한 겹 더 감싸는 순간 효과가 사라진다 — 실제로 그렇게 안 보였다.
   */
  className?: string;
}) {
  // 모드가 하나뿐인 테마에서는 선택지를 아예 그리지 않는다.
  if (variants.length < 2) return null;

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-1.5 text-label font-semibold text-muted">모드 선택</p>
      <div
        role="group"
        aria-label="진행 모드 선택"
        className="grid grid-cols-2 gap-2 sm:gap-3"
      >
        {variants.map((v, i) => {
          const on = v.id === activeId;
          // 가장 싼 구간 = '얼마부터' 로 보여줄 값.
          const from = v.tiers.length
            ? Math.min(...v.tiers.map((t) => t.unit_price_krw))
            : null;
          return (
            <Link
              key={v.id}
              href={
                i === 0
                  ? `/themes/${baseSlug}`
                  : `/themes/${baseSlug}?mode=${modeKey(baseSlug, v.slug)}`
              }
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 transition-colors sm:px-4 sm:py-3 ${
                on
                  ? "border-transparent bg-fill-strong"
                  : "border-line bg-fill-subtle text-muted hover:border-line-strong"
              }`}
              style={on ? { borderColor: accent } : undefined}
            >
              <span
                className="text-h3 font-extrabold"
                style={on ? { color: accent } : undefined}
              >
                {v.variant_label ?? v.name}
              </span>
              <span className="text-micro tabular-nums">
                {hoursLabel(v.duration_minutes)}
                {from !== null && ` · ${from.toLocaleString("ko-KR")}원~`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
