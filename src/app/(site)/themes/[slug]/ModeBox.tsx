import Link from "next/link";
import type { ThemeDetail } from "@/lib/themes";

/**
 * 주소에 쓸 모드 키. `/themes/baotalchul?mode=normal` 처럼 짧게 둔다.
 *
 * 변형 테마의 slug 는 **기본 테마 slug 로 시작한다**는 약속을 쓴다
 * (baotalchul → baotalchul-normal). 약속을 안 지킨 slug 면 slug 를 통째로 쓴다 —
 * 틀려도 주소만 길어질 뿐, 모드를 못 찾는 일은 없다(page.tsx 가 키·slug·id 를 다 받는다).
 *
 * ⚠️ 이 함수는 **여기 하나뿐이어야 한다.** 한때 ModePicker 에도 같은 함수가 있었고
 *    신청 페이지만 그쪽을 쓰고 있었다 — 갈라지면 "상세에서 고른 모드" 와
 *    "신청에서 찾은 모드" 가 어긋난다(2026-10-09 에 합쳤다).
 */
export function modeKey(baseSlug: string, slug: string) {
  return slug.startsWith(`${baseSlug}-`) ? slug.slice(baseSlug.length + 1) : slug;
}

export function modeHref(baseSlug: string, variants: ThemeDetail[], v: ThemeDetail) {
  // 기본 모드는 ?mode 를 안 붙인다 — 같은 화면이 주소 두 개로 갈리면 검색엔진에 중복으로 잡힌다.
  return v.id === variants[0]?.id
    ? `/themes/${baseSlug}`
    : `/themes/${baseSlug}?mode=${modeKey(baseSlug, v.slug)}`;
}

/**
 * 모드 선택 창 — 게임에서 난이도·모드를 고르는 창을 본떴다.
 * 생김새는 시안(2026-10-08 baotalchul-mode-design.html)을 그대로 따른다.
 *
 * 왜 이 모양인가
 *   테마가 도트 게임 컨셉이라, 모드 선택도 게임 UI 로 보이면 **고르는 행위 자체가
 *   재미**가 된다. 동시에 "모드를 고른다" 는 걸 설명 없이 알게 된다.
 *
 * ⚠️ 글꼴은 두 겹이다. **도트로 보여야 할 것만 갈무리11**(창 머리 · 모드 이름 ·
 *    MODE SKILLS · 항목 라벨)이고, 읽는 글은 기본 글꼴이다. 전부 갈무리로 깔면
 *    본문 가독성이 떨어지고 사이트의 다른 화면과 따로 논다.
 *    갈무리는 **Bold 한 종만** 들어 있다(layout.tsx) — 굵기를 지정해도 안 바뀐다.
 *
 * ⚠️ 강조색은 **고른 모드의 accent 를 그대로** 쓴다. 파티 민트 / 노말 시안처럼
 *    모드마다 다른 색을 줘서, 색만 보고도 지금 어느 모드인지 알게 한다.
 */
export function ModeBox({
  variants,
  active,
  baseSlug,
  accent,
  className = "",
}: {
  variants: ThemeDetail[];
  active: ThemeDetail;
  baseSlug: string;
  /** 고른 모드의 강조색. */
  accent: string;
  /** 격자 안에서의 자리. 자리는 **부르는 쪽이** 정한다. */
  className?: string;
}) {
  if (variants.length < 2) return null;

  /*
    ⚠️ `?? []` 를 지우지 말 것. 칸을 새로 만든 직후에는 **캐시에 남아 있던 옛
       응답**에 그 칸이 없다(unstable_cache 는 빌드 사이에도 디스크에 남는다).
       실제로 여기서 화면이 500 으로 떨어졌다(2026-10-08).
  */
  const highlights = active.mode_highlights ?? [];

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-fill-subtle ${className}`}>
      {/* 창 머리 — 게임 창의 타이틀바. */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <span className="font-galmuri text-micro tracking-[0.12em] text-muted">SELECT MODE</span>
        <span
          aria-hidden
          className="font-galmuri text-micro tracking-[0.2em]"
          style={{ color: accent }}
        >
          ◆ ◆
        </span>
      </div>

      <div className="px-4 pb-4 pt-5 sm:px-5">
        <p className="text-h3 font-extrabold">오늘의 플레이는?</p>
        <p className="mt-1 text-micro text-muted">모드를 눌러 비교해보세요.</p>

        <div role="group" aria-label="모드 선택" className="mt-5 grid grid-cols-2 gap-2.5">
          {variants.map((v) => {
            const on = v.id === active.id;
            const c = v.accent_color || accent;
            return (
              <Link
                key={v.id}
                href={modeHref(baseSlug, variants, v)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                /*
                  고른 쪽은 테두리가 2px 로 굵어지고 아래에 3px 그림자가 깔린다 —
                  '눌려 있는 키' 처럼 보이게 하는 게 시안의 핵심이다.
                  ⚠️ 굵어지는 만큼 안쪽 여백을 1px 줄여 **칸 크기가 안 흔들리게** 한다.
                */
                className={`group/mode min-w-0 rounded-md border text-left transition-[transform,border-color,background-color] duration-150 ${
                  on
                    ? "border-2 bg-fill-strong px-[0.6875rem] py-[0.8125rem]"
                    : "border-line bg-fill-subtle px-3 py-3.5 hover:-translate-y-0.5 hover:border-line-strong"
                }`}
                style={on ? { borderColor: c, boxShadow: `0 3px 0 ${c}` } : undefined}
              >
                <span
                  className="block font-galmuri text-h3 leading-tight"
                  style={{ color: on ? c : undefined }}
                >
                  <span
                    aria-hidden
                    className="mr-1"
                    style={{ color: on ? c : "var(--color-muted)" }}
                  >
                    {on ? "▶" : "▷"}
                  </span>
                  {v.variant_label ?? v.name}
                </span>
                <span className="mt-1.5 block text-micro text-muted">{modeTagline(v)}</span>
                <span className="mt-3 block font-mono text-h2 font-extrabold leading-none tabular-nums">
                  {v.duration_minutes}
                  <span className="ml-0.5 text-micro font-normal text-muted">분</span>
                </span>
              </Link>
            );
          })}
        </div>

        {active.mode_summary && (
          <p className="mb-4 mt-6 text-body font-extrabold">{active.mode_summary}</p>
        )}

        {highlights.length > 0 && (
          <div className="relative border-t border-line pt-6">
            {/* 게임의 '스킬 목록' 머리글. 항목이 능력치처럼 읽히게 한다. */}
            <span
              aria-hidden
              className="absolute left-0 top-2 font-galmuri text-micro tracking-[0.1em] text-muted"
            >
              ◆ MODE SKILLS
            </span>
            <ul className="flex flex-col gap-2.5">
              {highlights.map((h, i) => (
                <li
                  key={`${h.label}-${i}`}
                  // 모서리를 깎지 않고 단단한 그림자를 둔다 — 도트 게임의 칸 느낌.
                  className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 border border-line bg-fill-subtle px-3 py-2.5 shadow-[3px_3px_0_var(--color-line-subtle)]"
                >
                  <span
                    aria-hidden
                    className="absolute right-0 top-0 h-[5px] w-[5px]"
                    style={{ backgroundColor: accent }}
                  />
                  <span
                    aria-hidden
                    className="row-span-2 flex h-8 w-8 items-center justify-center border border-line"
                    style={{ color: accent, backgroundColor: `${accent}14` }}
                  >
                    <ModeIcon name={h.icon} />
                  </span>
                  <span className="font-galmuri text-micro tracking-[0.02em] text-muted">
                    {h.label}
                  </span>
                  <span className="text-label font-semibold">{h.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** 모드 버튼의 한 줄 설명. 인원 범위가 있으면 그걸, 없으면 '여러 팀과 경쟁'. */
function modeTagline(v: ThemeDetail) {
  const min = v.min_group_size ?? 1;
  const max = v.max_group_size;
  return max ? `${min}~${max}인 우리끼리` : "여러 팀과 경쟁";
}

/**
 * 차이 항목 아이콘. 시안의 lucide 아이콘(users · swords · gamepad-2 · sparkles)을
 * 같은 모양으로 직접 그렸다.
 *
 * ⚠️ **아는 키만 그린다.** 운영자가 오타를 내거나 새 키를 쓰면 아이콘 없이
 *    글자만 나온다 — 화면이 깨지는 것보다 낫다.
 * ⚠️ 외부 아이콘 라이브러리를 들이지 않는다. 네 개뿐이라 SVG 로 직접 그린다.
 */
function ModeIcon({ name }: { name: string | null }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    // users — 두 사람
    case "people":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    // swords — 교차한 두 검
    case "play":
      return (
        <svg {...common}>
          <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
          <path d="m13 19 6-6" />
          <path d="m16 16 4 4" />
          <path d="M19 21 21 19" />
          <path d="M9.5 6.5 21 18v3h-3L6.5 9.5" />
        </svg>
      );
    // gamepad-2 — 게임패드
    case "fun":
      return (
        <svg {...common}>
          <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
          <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5" />
        </svg>
      );
    // sparkles — 반짝임
    case "recommend":
      return (
        <svg {...common}>
          <path d="M9.9 3.3 11.4 7.3a1 1 0 0 0 .6.6l4 1.5-4 1.5a1 1 0 0 0-.6.6l-1.5 4-1.5-4a1 1 0 0 0-.6-.6l-4-1.5 4-1.5a1 1 0 0 0 .6-.6z" />
          <path d="M18 5v4M20 7h-4M17 16v3M18.5 17.5h-3" />
        </svg>
      );
    default:
      return null;
  }
}
