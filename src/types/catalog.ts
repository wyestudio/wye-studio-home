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

/** 테마 상세 콘텐츠 4블록. DB 에는 themes.content(jsonb) 한 칸에 들어간다. */
export type ThemeContent = {
  for_you: { emoji: string; title: string; desc: string }[];
  steps: { emoji: string; title: string; desc: string }[];
  /** ⭐ 절대시각이 아니라 시작 시각으로부터의 경과 분. 회차 시각이 달라도 재입력 불필요. */
  timetable: { offset_min: number; title: string; desc: string }[];
  precautions: { title: string; desc: string }[];
};

export const EMPTY_THEME_CONTENT: ThemeContent = {
  for_you: [],
  steps: [],
  timetable: [],
  precautions: [],
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
