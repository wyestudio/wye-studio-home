import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  Theme,
  ThemePriceTier,
  ThemeWithTiers,
  SessionView,
  PublicVenue,
} from "@/types/catalog";
import type { SessionStats } from "@/types/domain";

/**
 * 캐시 태그. 어드민에서 테마를 저장하면 revalidateTag 로 한 번에 털어낸다.
 */
export const THEMES_TAG = "themes";

/*
  왜 캐시가 필요한가 (2026-09-14)
    테마 상세를 한 번 열 때 DB 를 14번 쳤다 — 테마 1 + 회차 목록 1 +
    **회차마다 집계 RPC 1번씩**(그때 12개, 회차가 늘면 같이 는다).
    동시 30명으로 재보니 중앙값 1.6초. 회차 오픈 0시처럼 몰리는 순간엔 더 나빠진다.

    페이지 단위 revalidate 는 쓸 수 없다 — 쿠키를 읽는 순간 Next 가 그 페이지를
    동적으로 확정해버리기 때문이다. 그래서 **데이터 단위로** 캐시한다.

  잔여석이 잠깐 옛것이어도 되나
    된다. 정원 판정은 화면이 아니라 submit_application() 이 한다. 화면이 조금
    늦어도 초과 예약은 생기지 않고, 기껏해야 신청 버튼에서 '정원마감' 을 보게 될 뿐이다.
*/

/**
 * 목록(/contents)에 노출할 테마들.
 * 판단 기준은 is_listed 하나뿐이다 — is_active(신청 받기)는 신청 버튼만
 * 좌우하므로, 신청을 잠시 닫아둔 테마도 목록에는 계속 보인다.
 */
export const getListedThemes = unstable_cache(
  _getListedThemes,
  ["listed-themes"],
  { revalidate: 60, tags: [THEMES_TAG] }
);

async function _getListedThemes(): Promise<ThemeWithTiers[]> {
  const supabase = createPublicClient();

  const [themesRes, tiersRes] = await Promise.all([
    supabase
      .from("themes")
      .select("*")
      .eq("is_listed", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("theme_price_tiers").select("*").order("min_headcount"),
  ]);

  if (themesRes.error) throw themesRes.error;

  const tiers = (tiersRes.data ?? []) as ThemePriceTier[];
  return (themesRes.data ?? []).map((t) => ({
    ...(t as Theme),
    tiers: tiers.filter((x) => x.theme_id === (t as Theme).id),
  }));
}

/**
 * slug 로 테마 1건.
 * is_active 가 false 여도 페이지는 보여야 하므로 여기서 거르지 않는다.
 */
// 장소 블록(ThemeBlocks)이 어드민 미리보기에서도 같은 타입을 써서 catalog 로 옮겼다.
export type { PublicVenue };

export type ThemeDetail = ThemeWithTiers & { venue: PublicVenue | null };

export const getThemeBySlug = unstable_cache(
  _getThemeBySlug,
  ["theme-by-slug"],
  { revalidate: 300, tags: [THEMES_TAG] }
);

async function _getThemeBySlug(slug: string): Promise<ThemeDetail | null> {
  const supabase = createPublicClient();

  // 카테고리 이름을 함께 가져온다. 상세 화면에서 테마명 아래에 보인다.
  const { data, error } = await supabase
    .from("themes")
    .select("*, theme_categories(name, description)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: tiers } = await supabase
    .from("theme_price_tiers")
    .select("*")
    .eq("theme_id", (data as Theme).id)
    .order("min_headcount");

  // 장소는 venues 를 직접 못 읽는다(anon 에 grant 가 없다).
  // 고객 화면에 필요한 칸만 추린 theme_public_venue 뷰를 쓴다.
  const { data: venue } = await supabase
    .from("theme_public_venue")
    .select("area_label, parking_note, map_url, name, address, lat, lng, operating_period")
    .eq("theme_id", (data as Theme).id)
    .maybeSingle();

  return {
    ...(data as Theme),
    tiers: (tiers ?? []) as ThemePriceTier[],
    venue: (venue ?? null) as PublicVenue | null,
  };
}

/**
 * 해당 테마에서 **고객 화면에 보일** 회차들. 취소된 회차와 아직 공개 시각이
 * 안 된 회차만 뺀다 — 지난 회차는 '종료' 로 남긴다.
 * session_view 를 쓰는 이유는 가격·정원·장소의 override 규칙이 그 안에만
 * 존재하기 때문이다 (sessions 테이블을 직접 읽지 않는다).
 *
 * ⚠️ 지난 회차도 내려간다. 달력에서 지난 날짜를 눌러 "이 회차가 있었다" 를 볼 수
 *    있어야 하는데, 쿼리에서 빼면 그 날짜 자체가 달력에 없는 날이 된다.
 *    **대신 신청을 막는 책임이 통째로 isBookable 로 옮겨왔다** — 지난 회차를
 *    목록에서 빼는 것이 예전에는 유일한 차단이었다. DB(submit_application_v3)
 *    는 status 만 보고 start_at 은 보지 않으므로, 운영에서 status 가 'open' 인
 *    채로 지나간 회차는 isBookable 의 시각 판정에만 걸린다.
 *
 * ⚠️ opens_at 이 아직 안 온 회차는 뺀다. 롤링 오픈이라 회차는 몇 달 치가 미리
 *    만들어져 있고, 공개 시각이 지나야 고객 화면에 나온다.
 */
// 회차 목록은 '지금 열려 있는지'(opens_at <= now) 로 걸러지므로 오래 들고 있으면 안 된다.
export const getPublicSessionsForTheme = unstable_cache(
  _getPublicSessionsForTheme,
  ["public-sessions"],
  { revalidate: 30 }
);

async function _getPublicSessionsForTheme(themeId: string): Promise<SessionView[]> {
  const supabase = createPublicClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("session_view")
    .select("*")
    .eq("theme_id", themeId)
    .neq("status", "cancelled")
    .lte("opens_at", now)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionView[];
}

/** 회차별 공개 집계를 한 번에 붙인다. 개별 실패는 카드 표시를 막지 않는다. */
// 여기가 제일 비싸다 — 회차 수만큼 RPC 를 친다. 30초만 들고 있어도 효과가 크다.
export const attachStats = unstable_cache(
  _attachStats,
  ["session-stats"],
  { revalidate: 30 }
);

async function _attachStats(
  sessions: SessionView[]
): Promise<(SessionView & { stats: SessionStats | null })[]> {
  const supabase = createPublicClient();
  return Promise.all(
    sessions.map(async (s) => {
      // 지난 회차는 집계를 묻지 않는다. 화면에는 '종료' 로만 나가 잔여석이 쓰이지
      // 않는데, 집계는 회차 수만큼 RPC 를 친다 — 지난 회차는 지우지 않으니
      // 계속 쌓이기만 한다.
      // ⚠️ 그래서 지난 회차의 stats 는 항상 null 이다. stats 가 null 이면
      //    remainingSeats 도 null 이고 "자리 있음" 쪽으로 읽히므로,
      //    isBookable 은 **시각을 먼저** 본다.
      if (isPastSession(s.start_at)) return { ...s, stats: null };

      const { data, error } = await supabase
        .rpc("get_session_stats", { p_session_id: s.id })
        .single();
      return { ...s, stats: error ? null : (data as SessionStats) };
    })
  );
}

/**
 * 잔여석. 기준은 **입금 확인까지 끝난 인원**이다.
 * 확정만 되고 미입금인 자리를 마감으로 세면 실제로는 빈자리를 막게 된다 —
 * 프리오픈 운영에서 나온 개선이라 그대로 계승한다.
 */
export function remainingSeats(
  session: Pick<SessionView, "capacity_max">,
  stats: SessionStats | null
): number | null {
  if (!stats) return null;
  return Math.max(0, session.capacity_max - stats.paid_confirmed_count);
}

/**
 * 이미 시작한 회차인가.
 *
 * ⚠️ 서버에서만 부른다. 브라우저 시계로 판정하면 시계가 틀어진 기기에서
 *    끝난 회차가 신청 가능으로 보인다(얼리버드와 같은 이유).
 */
export function isPastSession(startAt: string): boolean {
  return new Date(startAt).getTime() < Date.now();
}

/**
 * 아직 안 지난 'open' 회차들. 홈·컨텐츠 목록의 "남은 회차 N개" 와 "다음 회차"
 * 가 쓴다(집계는 묻지 않으므로 마감된 회차도 센다 — 예전부터 그랬다).
 *
 * ⚠️ status 만 보면 안 된다. 운영에서 지나간 회차의 status 를 'closed' 로
 *    내리지 않으므로, 끝난 회차가 '남은 회차' 로 세어지고 nextStartAt 이 과거
 *    날짜가 된다. 지난 회차를 목록에 남기기로 한 뒤 실제로 그렇게 됐다
 *    (2026-10-04: 지난 회차 13개 중 4개가 'open').
 */
export function upcomingOpenSessions<T extends Pick<SessionView, "status" | "start_at">>(
  sessions: T[]
): T[] {
  return sessions.filter((s) => s.status === "open" && !isPastSession(s.start_at));
}

/** 회차가 신청을 받을 수 있는 상태인가. */
export function isBookable(
  session: Pick<SessionView, "status" | "capacity_max" | "start_at">,
  stats: SessionStats | null
): boolean {
  // ⚠️ **시각을 제일 먼저 본다.** status 를 'closed' 로 내리는 건 운영자가 손으로
  //    하는 일이라 지나간 회차에 'open' 이 그대로 남아 있다(2026-10-04 운영 DB
  //    기준 지난 회차 13개 중 4개). 지난 회차를 목록에 남기기로 한 뒤부터는
  //    여기서 끊지 않으면 끝난 회차에 신청이 들어간다.
  if (isPastSession(session.start_at)) return false;
  if (session.status !== "open") return false;
  const left = remainingSeats(session, stats);
  return left === null || left > 0;
}
