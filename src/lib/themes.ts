import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Theme,
  ThemePriceTier,
  ThemeWithTiers,
  SessionView,
} from "@/types/catalog";
import type { SessionStats } from "@/types/domain";

/**
 * 목록(/contents)에 노출할 테마들.
 * 판단 기준은 is_listed 하나뿐이다 — is_active(신청 받기)는 신청 버튼만
 * 좌우하므로, 신청을 잠시 닫아둔 테마도 목록에는 계속 보인다.
 */
export async function getListedThemes(): Promise<ThemeWithTiers[]> {
  const supabase = await createClient();

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
/** 고객 화면에 내보내도 되는 장소 정보. 상호명·정확 주소는 들어 있지 않다. */
export type PublicVenue = {
  area_label: string;
  parking_note: string | null;
  map_url: string | null;
};

export type ThemeDetail = ThemeWithTiers & { venue: PublicVenue | null };

export async function getThemeBySlug(slug: string): Promise<ThemeDetail | null> {
  const supabase = await createClient();

  // 카테고리 이름을 함께 가져온다. 상세 화면에서 테마명 아래에 보인다.
  const { data, error } = await supabase
    .from("themes")
    .select("*, theme_categories(name)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: tiers } = await supabase
    .from("theme_price_tiers")
    .select("*")
    .eq("theme_id", (data as Theme).id)
    .order("min_headcount");

  // 장소는 venues 를 직접 못 읽는다(정확 주소가 같이 딸려 나오므로 anon 에
  // grant 가 없다). 공개해도 되는 칸만 추린 theme_public_venue 뷰를 쓴다.
  const { data: venue } = await supabase
    .from("theme_public_venue")
    .select("area_label, parking_note, map_url")
    .eq("theme_id", (data as Theme).id)
    .maybeSingle();

  return {
    ...(data as Theme),
    tiers: (tiers ?? []) as ThemePriceTier[],
    venue: (venue ?? null) as PublicVenue | null,
  };
}

/**
 * 해당 테마의 "앞으로 진행될" 회차들. 지난 회차와 비활성화된 회차는 뺀다.
 * session_view 를 쓰는 이유는 가격·정원·장소의 override 규칙이 그 안에만
 * 존재하기 때문이다 (sessions 테이블을 직접 읽지 않는다).
 *
 * ⚠️ opens_at 이 아직 안 온 회차는 뺀다. 롤링 오픈이라 회차는 몇 달 치가 미리
 *    만들어져 있고, 공개 시각이 지나야 고객 화면에 나온다.
 */
export async function getUpcomingSessionsForTheme(themeId: string): Promise<SessionView[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("session_view")
    .select("*")
    .eq("theme_id", themeId)
    .neq("status", "cancelled")
    .gte("start_at", now)
    .lte("opens_at", now)
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionView[];
}

/** 회차별 공개 집계를 한 번에 붙인다. 개별 실패는 카드 표시를 막지 않는다. */
export async function attachStats(
  sessions: SessionView[]
): Promise<(SessionView & { stats: SessionStats | null })[]> {
  const supabase = await createClient();
  return Promise.all(
    sessions.map(async (s) => {
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

/** 회차가 신청을 받을 수 있는 상태인가. */
export function isBookable(
  session: Pick<SessionView, "status" | "capacity_max">,
  stats: SessionStats | null
): boolean {
  if (session.status !== "open") return false;
  const left = remainingSeats(session, stats);
  return left === null || left > 0;
}
