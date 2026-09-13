import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw, formatDuration } from "@/lib/format";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";

/**
 * 문자 포맷 미리보기에 넣을 **진짜 값**을 모은다.
 *
 * 왜 필요한가 —
 * 예전 미리보기는 코드에 박아둔 예시("69,000원", "3시간 30분", "8/29(토)")를
 * 그대로 보여줬다. 가격도 소요시간도 지금과 달라서, 운영자가 미리보기를 볼
 * 때마다 "혹시 이 값으로 나가는 건 아닌가" 하고 불안해했다. 미리보기는
 * **잘못 나가는 걸 막으려고** 있는 장치인데 반대로 불안을 만든 셈이다.
 *
 * 그래서 테마를 고르면 그 테마의 실제 가격·소요시간·장소·다음 회차 일시로
 * 예시를 채운다.
 *
 * ⚠️ 여기 값은 어디까지나 '미리보기용'이다. 실제 발송 값은 smsV2 가 발송
 *    시점에 다시 계산한다 — 두 곳이 같은 규칙을 쓰도록 formatKrw /
 *    resolveUnitPrice / formatDuration 같은 공용 함수를 그대로 쓴다.
 */

/** 미리보기 인원. 1명이면 인당가·총액이 같아 보여서 구분이 안 된다. */
const SAMPLE_HEADCOUNT = 2;

export type PreviewTheme = {
  id: string;
  name: string;
  /** 플레이스홀더 → 이 테마 기준 실제 예시값 */
  examples: Record<string, string>;
  /** 미리보기의 근거를 화면에 적어주기 위한 한 줄 */
  basis: string;
};

function kst(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...opts }).format(new Date(iso));
}

export async function loadPreviewThemes(): Promise<PreviewTheme[]> {
  const supabase = createAdminClient();

  const [themesRes, tiersRes, venuesRes, sessionsRes] = await Promise.all([
    supabase
      .from("themes")
      .select("id, slug, name, duration_minutes, venue_id, category_id, theme_categories(name)")
      .order("sort_order")
      .order("created_at"),
    supabase.from("theme_price_tiers").select("*").order("min_headcount"),
    supabase.from("venues").select("id, name, address, area_label, parking_note"),
    // 다음 회차가 있으면 그걸, 없으면 가장 최근 회차를 쓴다.
    supabase
      .from("session_display")
      .select("theme_id, start_at, end_at, min_age")
      .neq("status", "cancelled")
      .order("start_at", { ascending: true }),
  ]);

  const tiers = (tiersRes.data ?? []) as ThemePriceTier[];
  const venues = venuesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const now = Date.now();

  return (themesRes.data ?? []).map((t) => {
    const themeId = t.id as string;
    const themeTiers = tiers.filter((x) => x.theme_id === themeId);
    const venue = venues.find((v) => v.id === t.venue_id);
    const ofTheme = sessions.filter((s) => s.theme_id === themeId);
    const session =
      ofTheme.find((s) => new Date(s.start_at as string).getTime() >= now) ??
      ofTheme[ofTheme.length - 1];

    const unit = resolveUnitPrice(themeTiers, SAMPLE_HEADCOUNT);
    const total = unit != null ? unit * SAMPLE_HEADCOUNT : null;
    const durationMinutes = t.duration_minutes as number;

    const startAt = (session?.start_at as string) ?? null;
    const endAt = (session?.end_at as string) ?? null;

    // 조인 결과라 타입이 배열로 잡힌다. 한 건만 오므로 첫 값을 쓴다.
    const joined = (t as unknown as { theme_categories?: { name: string }[] | { name: string } | null })
      .theme_categories;
    const categoryName = Array.isArray(joined) ? (joined[0]?.name ?? null) : (joined?.name ?? null);

    const examples: Record<string, string> = {
      theme_name: t.name as string,
      product_label: categoryName ?? "파티형 방탈출",
      attendee_count: String(SAMPLE_HEADCOUNT),
      price: total != null ? formatKrw(total) : "(요금 구간 미설정)",
      duration:
        startAt && endAt
          ? formatDuration(startAt, endAt)
          : durationMinutes > 0
            ? `${Math.floor(durationMinutes / 60)}시간${durationMinutes % 60 ? ` ${durationMinutes % 60}분` : ""}`
            : "(시간 미정)",
      min_age: session?.min_age != null ? String(session.min_age) : "(회차 없음)",
      event_date: startAt ? kst(startAt, { month: "long", day: "numeric", weekday: "short" }) : "(회차 없음)",
      start_time: startAt ? kst(startAt, { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
      end_time: endAt ? `~${kst(endAt, { hour: "2-digit", minute: "2-digit", hour12: false })}` : "",
      venue_name: (venue?.name as string) ?? "(장소 미지정)",
      venue_address_text: venue?.address ? ` (${venue.address})` : "",
      parking_note: (venue?.parking_note as string) ?? "",
      reapply_url: `www.wouldyouescape.com/themes/${t.slug}`,
      // 아래는 테마와 무관한 값들 — 실제 상수이거나 사람마다 달라지는 값이다.
      name: "홍길동",
      depositor_name: "홍길동",
      confirmation_code: "384920",
      bank_name: BANK_ACCOUNT.bankName,
      account_number: "3333-05-2843942",
      account_holder: "김시온",
      refund_amount: total != null ? formatKrw(total) : "124,000원",
      refund_notice:
        total != null
          ? `입금하신 금액 ${formatKrw(total)}은 영업일 기준 3일 내에 전액 환불해 드립니다.`
          : "입금하신 금액은 영업일 기준 3일 내에 전액 환불해 드립니다.",
      code: "M0EH-EVG1",
      discount: "5,000원",
      expires_at: "2027년 9월 12일",
      link: "www.wouldyouescape.com/c/M0EHEVG1",
    };

    const basis = startAt
      ? `${examples.event_date} ${examples.start_time} 회차 · ${SAMPLE_HEADCOUNT}명 기준`
      : `회차가 없어 날짜·시각은 비어 있습니다 · ${SAMPLE_HEADCOUNT}명 기준`;

    return { id: themeId, name: t.name as string, examples, basis };
  });
}
