// 테마/회차 2단 구조의 타입.
// 설계 근거: docs/07-architecture-domain-and-data.md §3, §4

export type Venue = {
  id: string;
  name: string;          // 상호명 (비공개 — 고객 화면에 노출하지 않음)
  address: string;       // 정확 주소 (비공개, 전날안내 SMS용)
  area_label: string;    // 공개용 대략 위치
  parking_note: string | null;
  map_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** 인원수 구간별 인당 가격. min_headcount 이상일 때 적용되며 가장 큰 구간이 이긴다. */
export type ThemePriceTier = {
  theme_id: string;
  min_headcount: number;
  unit_price_krw: number;
  original_unit_price_krw: number | null;
};

/**
 * 테마 상세 콘텐츠 — 자유 블록.
 *
 * 예전에는 for_you / steps / timetable / precautions 4칸이 고정이었다.
 * 그 구성이 안 맞는 테마(웹 방탈출 등)는 빈 칸을 남기거나 억지로 끼워야 했다.
 * 필요한 블록만 골라 쌓고 순서를 바꿀 수 있게 한다.
 *
 * DB 에는 themes.content(jsonb) 한 칸에 { blocks: [...] } 로 들어간다.
 */
/** 제목 위에 작게 깔리는 영문 라벨(FOR YOU, SCHEDULE …). 비우면 안 나온다. */
type BlockCommon = { title: string; eyebrow?: string };

export type ThemeBlock =
  /** 제목 + 문단. 대부분의 설명은 이걸로 해결된다. */
  | ({ type: "text"; body: string } & BlockCommon)
  /**
   * 목록. 이모지는 선택.
   * variant "card" = 이모지 + 제목 + 설명 카드 / "step" = STEP 1·2·3 배지가 붙은 카드.
   */
  | ({
      type: "list";
      variant?: "card" | "step";
      items: { emoji: string; title: string; desc: string }[];
    } & BlockCommon)
  /** ⭐ 절대시각이 아니라 시작 시각으로부터의 경과 분. 회차 시각이 달라도 재입력 불필요. */
  | ({ type: "timetable"; items: { offset_min: number; title: string; desc: string }[] } & BlockCommon)
  /** 눈에 띄어야 하는 안내(주의사항 등). 번호가 붙는다. */
  | ({ type: "callout"; items: { title: string; desc: string }[] } & BlockCommon)
  /** 자주 묻는 질문. 눌러서 펼치는 아코디언으로 나간다. */
  | ({ type: "faq"; items: { q: string; a: string }[] } & BlockCommon)
  /** 상세 컷. public/ 경로 또는 외부 URL. */
  | ({ type: "image"; src: string; alt: string } & BlockCommon);

export type ThemeBlockType = ThemeBlock["type"];

export type ThemeContent = {
  blocks: ThemeBlock[];
};

export const EMPTY_THEME_CONTENT: ThemeContent = { blocks: [] };

/** 블록 종류별 표시 이름. 어드민 '블록 추가' 메뉴에 쓴다. */
export const THEME_BLOCK_LABELS: Record<ThemeBlockType, string> = {
  text: "제목 + 문단",
  list: "목록",
  timetable: "타임테이블",
  callout: "강조 박스",
  faq: "자주 묻는 질문",
  image: "이미지",
};

/**
 * 옛 4칸 구조를 블록 배열로 읽어준다.
 *
 * 이미 저장된 테마가 있어 한 번에 갈아엎을 수 없다. 읽을 때 변환하고,
 * 어드민에서 저장하는 순간 새 구조로 덮인다.
 */
export function normalizeThemeContent(raw: unknown): ThemeContent {
  if (!raw || typeof raw !== "object") return EMPTY_THEME_CONTENT;
  const o = raw as Record<string, unknown>;

  if (Array.isArray(o.blocks)) return { blocks: o.blocks as ThemeBlock[] };

  const blocks: ThemeBlock[] = [];
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  if (list(o.for_you).length)
    blocks.push({ type: "list", title: "이런 분께 추천", items: list(o.for_you) as never });
  if (list(o.steps).length)
    blocks.push({ type: "list", title: "진행 방식", items: list(o.steps) as never });
  if (list(o.timetable).length)
    blocks.push({ type: "timetable", title: "타임테이블", items: list(o.timetable) as never });
  if (list(o.precautions).length)
    blocks.push({ type: "callout", title: "주의사항", items: list(o.precautions) as never });

  return { blocks };
}

export type ThemeCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type Theme = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  difficulty: number;
  duration_minutes: number;
  min_age_floor: number | null;
  capacity_confirm_line: number;
  capacity_max: number;
  capacity_min: number | null;
  max_group_size: number | null;
  venue_id: string;
  accent_color: string | null;
  hero_image_path: string | null;
  /** 행성 로고. 목록에서 원형으로 노출. 비우면 포스터로 대체한다. */
  logo_image_path: string | null;
  /** 컨텐츠 목록의 테마명에 쓸 글꼴 키. THEME_TITLE_FONTS 참고. */
  title_font: string | null;
  /** 달력에 '오픈' 으로 표시할 날짜 (YYYY-MM-DD). 없으면 표시 안 함. */
  opening_date: string | null;
  category_id: string | null;
  content: ThemeContent;
  is_active: boolean;
  is_listed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ThemeWithTiers = Theme & { tiers: ThemePriceTier[] };

/** session_view — 회차 실효값. 앱은 sessions 테이블을 직접 읽지 않고 이 뷰를 쓴다. */
export type SessionView = {
  id: string;
  theme_id: string;
  start_at: string;
  end_at: string;
  status: "open" | "closed" | "cancelled";
  min_age: number;
  legacy_format: string | null;
  legacy_slug: string | null;
  theme_slug: string;
  theme_name: string;
  difficulty: number;
  duration_minutes: number;
  accent_color: string | null;
  max_group_size: number | null;
  price_krw_override: number | null;
  min_unit_price_krw: number | null;
  max_unit_price_krw: number | null;
  capacity_confirm_line: number;
  capacity_max: number;
  venue_id: string | null;
};

/**
 * 회차 최소 연령 (D-03).
 * 시작 시각 18시 이전 → 만 16세 / 18시 이후 → 만 19세.
 * 테마에 min_age_floor 가 있으면 그보다 낮출 수 없다.
 *
 * ⚠️ DB 의 default_min_age() 와 같은 규칙이다. 한쪽만 바꾸면 어긋난다.
 */
export function defaultMinAge(startAtKstHour: number, themeFloor?: number | null): number {
  const byTime = startAtKstHour < 18 ? 16 : 19;
  return Math.max(byTime, themeFloor ?? 0);
}

/** 인원수에 적용될 인당 가격. DB 의 resolve_unit_price() 와 같은 규칙. */
export function resolveUnitPrice(tiers: ThemePriceTier[], headcount: number): number | null {
  const matched = tiers
    .filter((t) => t.min_headcount <= headcount)
    .sort((a, b) => b.min_headcount - a.min_headcount)[0];
  return matched ? matched.unit_price_krw : null;
}

/**
 * 컨텐츠 목록에서 테마명에 쓸 수 있는 글꼴.
 *
 * 테마마다 분위기가 다르다(바-ㅇ탈출은 8비트 도트 게임 컨셉). 기본 폰트를
 * 바꾸는 게 아니라 **목록의 테마명 한 줄에만** 적용한다 — 펼친 카드 안의
 * 이름까지 바뀌면 정보가 읽기 어려워진다.
 */
export const THEME_TITLE_FONTS: Record<string, { label: string; className: string }> = {
  "": { label: "기본", className: "" },
  galmuri11: { label: "갈무리11 (8비트 도트)", className: "font-galmuri" },
};

export function themeTitleFontClass(key: string | null | undefined): string {
  return THEME_TITLE_FONTS[key ?? ""]?.className ?? "";
}
