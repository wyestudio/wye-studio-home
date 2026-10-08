import Link from "next/link";
import type { ThemeDetail } from "@/lib/themes";
import { modeHref } from "./ModeBox";

/**
 * 모드 전환 토글 — 상단 모드 창의 **작은 판**.
 *
 * 왜 따로 있나 — 상세는 9,000px 이 넘는다. 가격표·회차 선택처럼 **아래쪽에서
 * 두 모드를 비교하고 싶은 자리**가 있는데, 거기까지 와서 맨 위로 돌아가 모드를
 * 바꾸고 다시 내려오는 건 못 할 짓이다(2026-10-08 요청).
 *
 * ⚠️ 모양은 상단 창과 **같은 언어**를 쓴다(▶/▷, 고른 쪽 아래 3px 그림자,
 *    모드별 강조색). 다른 모양을 주면 같은 일을 하는 두 물건으로 보인다.
 * ⚠️ 여기서는 소요시간·가격을 **안 적는다.** 아래쪽에서는 이미 테마를 읽은
 *    뒤라 요약이 필요 없고, 짧아야 자리를 덜 먹는다.
 *
 * ⚠️ **anchor 를 반드시 준다.** 두 모드는 문서 길이가 다르다 — 파티는 상세블록이
 *    있고 노말은 없어서 2,900px 대 9,000px 이다. 그래서 스크롤 위치(px)를 그대로
 *    두면 **전혀 다른 섹션에 떨어진다**(2026-10-08 에 실제로 가격표에서 눌렀더니
 *    '이런 분께 추천' 한가운데로 갔다). 보고 있던 **섹션**으로 돌아와야 한다.
 */
export function ModeToggle({
  variants,
  activeId,
  baseSlug,
  accent,
  className = "",
  label = "모드",
  anchor,
}: {
  variants: ThemeDetail[];
  activeId: string;
  baseSlug: string;
  accent: string;
  className?: string;
  /** 왼쪽에 붙는 작은 글씨. 자리에 따라 바꿔 쓴다. */
  label?: string;
  /** 전환 뒤 돌아올 자리의 id. 이 토글을 감싸거나 바로 위에 있는 요소여야 한다. */
  anchor?: string;
}) {
  if (variants.length < 2) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="shrink-0 font-mono text-micro tracking-[0.18em] text-muted">
        {label}
      </span>
      <div
        role="group"
        aria-label="모드 전환"
        className="flex min-w-0 flex-1 gap-2 sm:flex-none"
      >
        {variants.map((v) => {
          const on = v.id === activeId;
          const c = v.accent_color || accent;
          return (
            <Link
              key={v.id}
              href={
                anchor
                  ? `${modeHref(baseSlug, variants, v)}#${anchor}`
                  : modeHref(baseSlug, variants, v)
              }
              // 앵커가 있으면 Next 가 그 자리로 옮겨 준다. 앵커가 없을 때만
              // 스크롤을 막는다 — 안 막으면 맨 위로 튄다.
              scroll={anchor ? undefined : false}
              aria-current={on ? "true" : undefined}
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-center font-mono text-body-sm font-extrabold transition-[transform,border-color] duration-150 sm:flex-none sm:px-5 ${
                on
                  ? "bg-fill-strong"
                  : "border-line bg-fill-subtle text-muted hover:-translate-y-0.5 hover:border-line-strong"
              }`}
              style={on ? { borderColor: c, color: c, boxShadow: `0 3px 0 ${c}` } : undefined}
            >
              <span aria-hidden className="mr-1">{on ? "▶" : "▷"}</span>
              {v.variant_label ?? v.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
