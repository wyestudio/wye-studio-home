// 테마/회차 2단 구조의 타입.
// 설계 근거: docs/07-architecture-domain-and-data.md §3, §4

export type Venue = {
  id: string;
  name: string;          // 상호명 (테마 상세 진행 장소 블록에 공개)
  address: string;       // 정확 주소 (테마 상세 공개 + 장소안내 SMS)
  area_label: string;    // 대략 위치 (목록·카드용 짧은 표기)
  parking_note: string | null;
  map_url: string | null;
  /** 위도·경도. 둘 다 있을 때만 테마 상세에 지도가 뜬다 (p35). */
  lat: number | null;
  lng: number | null;
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
type BlockCommon = {
  title: string;
  eyebrow?: string;
  /**
   * 숨김. 고객 화면에만 안 나오고 어드민에는 그대로 남는다.
   *
   * 블록을 잠깐 내리고 싶을 때 삭제밖에 방법이 없으면, 되살릴 때 내용을 다시
   * 타이핑해야 한다. 실제로 '컨텐츠 구성' 을 잠깐 내리려다 그럴 뻔했다.
   */
  hidden?: boolean;
};

export type ThemeBlock =
  /** 제목 + 문단. 대부분의 설명은 이걸로 해결된다. */
  | ({ type: "text"; body: string } & BlockCommon)
  /**
   * 인원별 참가비 표.
   *
   * 숫자는 이 블록이 아니라 **테마의 '요금 구간'(theme_price_tiers)** 에서 온다.
   * 블록이 들고 있는 건 자리·제목·라벨·숨김뿐이다 — 가격을 두 곳에 적어두면
   * 반드시 한쪽만 고치는 날이 온다.
   */
  | ({ type: "price" } & BlockCommon)
  /**
   * 진행 장소 안내.
   *
   * 가격표처럼 **값은 블록이 아니라 테마에 연결된 장소(venues)** 에서 온다.
   * 상호명·주소·주차 안내와 네이버 지도/카카오맵 링크를 보여준다.
   * 2026-09-15 까지는 대략 위치만 공개하고 주소는 이틀 전 문자로만 보냈는데,
   * 네이버 플레이스 등록에 홈페이지의 상세 장소가 필요해 공개로 바꿨다(p34).
   *
   * 예전에는 제목 아래 📍 한 줄이었는데(2026-09-15 까지), 난이도·시간·장르 자리를
   * 비우려고 블록으로 내렸다.
   */
  | ({ type: "venue" } & BlockCommon)
  /**
   * 목록. 이모지는 선택.
   *   "card"     = 이모지 + 제목 + 설명 카드 (2열)
   *   "step"     = STEP 1·2·3 배지가 붙은 카드 (3열)
   *   "included" = 참가비에 포함된 것. 한 판에 줄줄이 — 영수증처럼 읽힌다.
   *
   * ⚠️ included 는 **가격표 바로 아래**에 두라고 만든 모양이다. 가격을 보고
   *    "비싸다" 고 느끼는 순간에 받아가는 것을 세어줘야 한다. 세 섹션 뒤에
   *    있으면 닿지 않는다.
   */
  | ({
      type: "list";
      variant?: "card" | "step" | "included";
      /**
       * included 전용 — 판 안의 큰 문구.
       *
       * ⚠️ 바깥 제목(title)과 다른 자리다. v2 까지는 이 문구를 title 에 담았는데,
       *    그래서 included 블록만 라벨·제목을 달 수 없었다(제목 칸이 이미 쓰였으므로).
       *    v3 에서 분리했다 — normalizeThemeContent 가 읽을 때 옮겨준다.
       */
      headline?: string;
      /** included 전용 — 제목 아래 한 줄 */
      subtitle?: string;
      /** included 전용 — 카드 아래 강조 띠 */
      highlight?: string;
      /** included 전용 — 맨 아래 작은 단서 */
      footnote?: string;
      items: { emoji: string; title: string; desc: string }[];
    } & BlockCommon)
  /**
   * 진행 순서. 1·2·3… 으로만 매긴다.
   * ⚠️ 시각은 일부러 뺐다. "현장 상황에 따라 다를 수 있다" 고 적어둬도 적힌 시각과
   *    다르면 항의가 들어온다(실제로 그랬다). 순서만 약속한다.
   */
  | ({ type: "timetable"; items: { title: string; desc: string }[] } & BlockCommon)
  /** 눈에 띄어야 하는 안내(주의사항 등). 번호가 붙는다. */
  | ({ type: "callout"; items: { title: string; desc: string }[] } & BlockCommon)
  /** 자주 묻는 질문. 눌러서 펼치는 아코디언으로 나간다. */
  | ({ type: "faq"; items: { q: string; a: string }[] } & BlockCommon)
  /** 상세 컷. public/ 경로 또는 외부 URL. */
  | ({ type: "image"; src: string; alt: string } & BlockCommon)
  /**
   * 후기. 설문 요약 수치 + 한 줄 후기 + 인스타 게시물 세 덩어리다.
   *
   * ⚠️ 수치는 **자동 집계가 아니라 운영자가 적는 값**이다. 설문이 구글 폼·
   *    네이버 폼에 흩어져 있고 회차마다 폼이 달라서, 코드가 계산하려면 폼마다
   *    연동을 붙여야 한다. 대신 어디서 나온 숫자인지 note 에 남겨 둘 것.
   *
   * ⚠️ 여기 싣는 후기는 **협찬으로 활용 동의를 받은 게시물만** 넣는다.
   *    우리 계정 게시물은 후기가 아니므로 홈의 인스타 섹션으로 간다.
   */
  | ({
      type: "reviews";
      /** 제목 아래 가운데 한 줄 */
      subtitle?: string;
      /** 요약 수치. 2개가 보기 좋다. */
      stats: { value: string; label: string; note?: string }[];
      /** 한 줄 후기. meta 는 '2026.08.29 · 그룹 회차' 처럼 출처 한 줄. */
      quotes: { text: string; meta?: string }[];
      /**
       * 맨 아래 작은 단서. 후기 자체에 대한 주석을 다는 자리다 —
       * 예: 프리오픈 때 소개팅 회차 후기가 섞여 있다는 안내(2026-09-16).
       */
      footnote?: string;
      /**
       * 크리에이터 후기 게시물. 옆으로 밀어서 본다.
       *
       * instagram : 인스타 공식 임베드로 **게시물 원본 그대로** 보여준다.
       *             API 키가 필요 없고 이미지도 우리가 들고 있지 않아도 된다.
       *             ⚠️ 영상은 인라인 재생이 안 된다(썸네일 + 재생 버튼 → 인스타로 이동).
       * naver     : 네이버 블로그는 임베드 수단이 없다. og 태그에서 뽑은
       *             제목·요약·썸네일로 **우리 카드**를 만들고 링크만 건다.
       *             썸네일 주소는 만료될 수 있어 우리 저장소에 올려 쓴다.
       */
      links: {
        channel: "instagram" | "naver";
        url: string;
        /** 작성자 표시명. 네이버는 블로그 닉네임, 인스타는 임베드가 직접 보여준다. */
        author?: string;
        /** naver 전용 */
        title?: string;
        excerpt?: string;
        image?: string;
        /** '2026.08.30' */
        date?: string;
      }[];
    } & BlockCommon);

export type ThemeBlockType = ThemeBlock["type"];

export type ThemeContent = {
  blocks: ThemeBlock[];
  /**
   * 콘텐츠 구조 버전. 없으면 v1(가격표가 상세 페이지에 하드코딩돼 있던 시절).
   * 저장할 때마다 최신 버전으로 덮인다 — sanitizeContent 참고.
   */
  v?: number;
};

export const THEME_CONTENT_VERSION = 3;

export const EMPTY_THEME_CONTENT: ThemeContent = { blocks: [] };

/** 새 테마의 기본 콘텐츠. 가격표 한 장은 깔고 시작한다. */
export const DEFAULT_THEME_CONTENT: ThemeContent = {
  v: THEME_CONTENT_VERSION,
  blocks: [{ type: "price", title: "인원별 참가비", eyebrow: "PRICE" }],
};

/** 블록 종류별 표시 이름. 어드민 '블록 추가' 메뉴에 쓴다. */
export const THEME_BLOCK_LABELS: Record<ThemeBlockType, string> = {
  price: "인원별 참가비",
  venue: "진행 장소",
  reviews: "후기",
  text: "제목 + 문단",
  list: "목록",
  timetable: "진행 순서",
  callout: "강조 박스",
  faq: "자주 묻는 질문",
  image: "이미지",
};

/**
 * 저장된 JSON 을 블록 배열로 읽는다. **있는 그대로만** 읽는다.
 *
 * 옛 4칸 구조(for_you / steps / timetable / precautions)로 저장된 테마가
 * 남아 있어 한 번에 갈아엎을 수 없다. 읽을 때 변환하고, 어드민에서 저장하는
 * 순간 새 구조로 덮인다.
 *
 * ⚠️ 저장 직전(sanitizeContent)에는 반드시 이쪽을 쓴다. normalizeThemeContent
 *    를 쓰면 운영자가 방금 지운 가격표가 저장하면서 되살아난다.
 */
export function parseThemeContent(raw: unknown): ThemeContent {
  if (!raw || typeof raw !== "object") return { ...EMPTY_THEME_CONTENT };
  const o = raw as Record<string, unknown>;
  const v = typeof o.v === "number" ? o.v : 1;

  if (Array.isArray(o.blocks)) return { v, blocks: o.blocks as ThemeBlock[] };

  const blocks: ThemeBlock[] = [];
  const list = (x: unknown) => (Array.isArray(x) ? x : []);

  if (list(o.for_you).length)
    blocks.push({ type: "list", title: "이런 분께 추천", items: list(o.for_you) as never });
  if (list(o.steps).length)
    blocks.push({ type: "list", title: "진행 방식", items: list(o.steps) as never });
  if (list(o.timetable).length)
    blocks.push({ type: "timetable", title: "진행 순서", items: list(o.timetable) as never });
  if (list(o.precautions).length)
    blocks.push({ type: "callout", title: "주의사항", items: list(o.precautions) as never });

  return { v, blocks };
}

/**
 * 화면·편집기에서 읽을 때. parseThemeContent 에 더해 **옛 버전 콘텐츠를 지금
 * 구조로 옮겨준다.** 한 번 저장되면 최신 버전이 되어 다시는 손대지 않는다 —
 * 그래야 운영자가 지운 것은 지운 대로, 비운 것은 비운 대로 남는다.
 *
 *   v1 → v2 : 가격표 블록을 맨 앞에 끼운다.
 *             v1 에는 '가격표 블록' 이라는 게 없었다(상세 페이지에 하드코딩).
 *   v2 → v3 : included 블록의 title 을 headline 으로 옮긴다.
 *             제목 칸이 판 안의 문구에 쓰이고 있어 라벨·제목을 달 수 없었다.
 */
export function normalizeThemeContent(raw: unknown): ThemeContent {
  const parsed = parseThemeContent(raw);
  const v = parsed.v ?? 1;
  if (v >= THEME_CONTENT_VERSION) return parsed;

  let blocks = parsed.blocks;

  if (v < 2 && !blocks.some((b) => b?.type === "price")) {
    blocks = [{ type: "price", title: "인원별 참가비", eyebrow: "PRICE" }, ...blocks];
  }

  if (v < 3) {
    blocks = blocks.map((b) =>
      b?.type === "list" && b.variant === "included" && b.headline === undefined
        ? { ...b, headline: b.title, title: "" }
        : b
    );
  }

  return { ...parsed, blocks };
}

/**
 * 고객 화면에 내보내는 장소 정보 (theme_public_venue 뷰).
 * 2026-09-15(p34)부터 상호명·주소도 공개한다 — 네이버 플레이스 등록 요건.
 */
export type PublicVenue = {
  area_label: string;
  parking_note: string | null;
  map_url: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type ThemeCategory = {
  id: string;
  name: string;
  /** 물음표 말풍선 설명. 비우면 물음표가 안 나온다. */
  description: string | null;
  sort_order: number;
};

export type Theme = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  /** 시놉시스. 상세 화면 상단에 크게 보인다. (칸 이름은 옛 '설명' 그대로) */
  description: string | null;
  /**
   * 소개 화면 시놉시스 아래 강조 안내(p38). 비우면 안 나온다. **굵게** 지원.
   * 프리오픈 때 소개팅 회차가 있었어서 생긴 오해를 첫 화면에서 바로 풀려고 만들었다.
   */
  intro_notice: string | null;
  /** 장르 해시태그. # 없이 저장한다 — 화면이 붙여 그린다. */
  genres: string[];
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
  /** 잠금. 목록에는 나오되 상세로 못 들어가고(자물쇠) 검색엔진에도 안 올린다 */
  is_locked: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ThemeWithTiers = Theme & { tiers: ThemePriceTier[] };

/**
 * 장르 태그 최대 개수·글자 수. 넘치면 상세 상단의 태그 줄이 서너 줄로 불어나
 * 난이도·시간보다 커 보인다. 어드민 입력칸과 저장 검증이 같이 쓴다.
 */
export const GENRE_MAX_COUNT = 8;
export const GENRE_MAX_LENGTH = 12;

/**
 * 시놉시스 앞뒤의 **빈 줄만** 걷어낸다. 줄 안의 띄어쓰기는 한 칸도 건드리지 않는다.
 *
 * 운영자가 빈칸을 여러 개 넣어 모양을 잡는다(예: "[YES]        > [YES]").
 * trim() 을 쓰면 첫 줄 들여쓰기가 잘려 나간다. 내용이 공백뿐이면 빈 문자열.
 */
export function tidySynopsis(raw: string | null | undefined): string {
  const s = raw ?? "";
  if (!s.trim()) return "";
  return s.replace(/^(?:[ \t]*\r?\n)+/, "").replace(/(?:\r?\n[ \t]*)+$/, "").replace(/[ \t]+$/, "");
}

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
  /** 회차 시각 옆 짧은 표시(예: 인기). 비우면 안 나온다 — p42. */
  badge?: string | null;
};

/**
 * 회차 최소 연령.
 *
 * 이용약관 제9조 제1항 — **종료 시각** 기준이다.
 *   22:00 이전 종료 → 만 16세 이상 / 22:00 이후(및 정각) 종료 → 만 19세 이상.
 * 테마에 min_age_floor 가 있으면 그보다 낮출 수 없다.
 *
 * ⚠️ v1.1 까지는 '시작 시각 18시' 기준이었다(어드민 안내 문구에도 그 흔적이
 *    남아 있어 2026-09-13에 같이 고쳤다). 지금 운영 중인 회차
 *    (11:30·15:30·19:30 / 180분)는 두 규칙의 결과가 같아 데이터는 안 바뀐다.
 * ⚠️ DB 의 default_min_age() 는 옛 규칙 그대로다. 2026-09-10 마이그레이션에서
 *    한 번 쓰였을 뿐 지금은 아무 데서도 호출되지 않는다(함수·뷰·컬럼 기본값
 *    전부 확인). 새 회차의 min_age 는 이 함수가 정한다.
 */
export function defaultMinAge(
  startKstHhMm: string,
  durationMinutes: number,
  themeFloor?: number | null
): number {
  const [h, m] = startKstHhMm.split(":").map(Number);
  const endMinutes = h * 60 + (m || 0) + durationMinutes;
  const byTime = endMinutes < 22 * 60 ? 16 : 19;
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
