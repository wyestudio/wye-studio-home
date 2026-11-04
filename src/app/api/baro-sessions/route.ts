import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 방탈출 현장 앱(BAR-O, wye-studio-webapp)이 **진행할 회차 하나**의 신청 명단을 읽어 가는 자리.
 * 진행자가 현장 앱에서 날짜 · 시각을 골라 "홈페이지에서 불러오기" 를 누를 때만 부른다.
 * 현장 앱은 매장 와이파이 안에만 있어 이쪽에서 밀어 넣을 수 없다 — 현장이 당겨 간다.
 *
 *   ?date=2026-11-07              그날 회차 목록(시각 · 인원수만, 명단 없음) — 시각 고르기용
 *   ?date=2026-11-07&time=13:30   그 회차 하나 + 명단
 *
 * ⚠️ 회차는 몇 달 치가 미리 만들어져 있다. 기간으로 한꺼번에 내보내지 않는다 — 명단은
 *    고른 회차 하나만 나간다(2026-11-04 대표님).
 * ⚠️ 키는 BARO_SESSIONS_SECRET 을 따로 둔다. BOARD_PHOTO_SECRET(사진 올리기)·
 *    BARO_RESULT_SECRET(랭킹 넣기)와 섞지 않는다 — 키마다 할 수 있는 일이 하나뿐이다.
 *    헤더 이름도 baro-result 의 x-baro-secret 과 다르게 둬서 잘못 보낸 키를 걸러낸다.
 * ⚠️ 전화번호 · 출생년도 · 성별 · 환불계좌 · 금액은 내보내지 않는다. 매장 태블릿까지
 *    흘러갈 수 있는 값이다. 이름 · 닉네임 · 방탈출 경험 · 입금 여부만 보낸다.
 * ⚠️ 노말모드는 명단을 보내지 않는다(인원수만). 참가자가 당일 팀원 이름을 직접 적는다.
 */

const THEME_MODE: Record<string, "party" | "normal"> = {
  baotalchul: "party",
  "baotalchul-normal": "normal",
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const KST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NO_STORE = { "Cache-Control": "no-store" };

function sameSecret(got: string | null, expected: string) {
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** UTC 시각 → KST "YYYY-MM-DDTHH:MM" */
function kstIso(d: Date) {
  return new Date(d.getTime() + KST_MS).toISOString().slice(0, 16);
}

/** KST 날짜의 0시를 UTC 시각으로. 달력에 없는 날짜(2026-02-30)는 null. */
function kstMidnight(ymd: string) {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) || kstIso(d).slice(0, 10) !== ymd ? null : d;
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

type SessionRow = {
  id: string;
  start_at: string;
  status: string;
  themes: { slug: string; name: string; variant_label: string | null };
};

type Att = {
  application_id: string;
  is_representative: boolean;
  name: string | null;
  nickname: string | null;
  experience_range: string | null;
  created_at: string;
};

function summary(s: SessionRow) {
  const kst = kstIso(new Date(s.start_at));
  return {
    id: s.id,
    themeSlug: s.themes.slug,
    playMode: THEME_MODE[s.themes.slug],
    title: [s.themes.name, s.themes.variant_label].filter(Boolean).join(" "), // "바-ㅇ탈출 파티모드"
    date: kst.slice(0, 10),
    startTime: kst.slice(11, 16),
    status: s.status,
  };
}

export async function GET(request: NextRequest) {
  const expected = process.env.BARO_SESSIONS_SECRET;
  if (!expected) return fail(500, "BARO_SESSIONS_SECRET 환경변수가 설정되지 않았습니다.");
  if (!sameSecret(request.headers.get("x-baro-sessions-secret"), expected)) return fail(401, "인증 실패");

  const sp = request.nextUrl.searchParams;
  const date = sp.get("date") ?? "";
  const time = sp.get("time");
  if (!YMD.test(date)) return fail(400, "date 는 YYYY-MM-DD 형식이어야 합니다.");
  const dayStart = kstMidnight(date);
  if (!dayStart) return fail(400, "date 가 없는 날짜입니다.");
  if (time != null && !HM.test(time)) return fail(400, "time 은 HH:MM 형식이어야 합니다 (예: 13:30).");

  const supabase = createAdminClient();
  const { data, error: sErr } = await supabase
    .from("sessions")
    .select("id, start_at, status, themes!inner(slug, name, variant_label)")
    .in("themes.slug", Object.keys(THEME_MODE))
    .neq("status", "cancelled")
    .gte("start_at", dayStart.toISOString())
    .lt("start_at", new Date(dayStart.getTime() + DAY_MS).toISOString())
    .order("start_at");
  if (sErr) {
    console.error("[baro-sessions] 회차 조회 실패", sErr);
    return fail(500, "회차 조회 실패");
  }
  const day = (data ?? []) as unknown as SessionRow[];
  const ids = day.map((s) => s.id);

  const { data: apps, error: aErr } = ids.length
    ? await supabase
        .from("applications")
        .select("id, session_id, status, payment_status, created_at")
        .in("session_id", ids)
        .neq("status", "cancelled")
        .order("created_at")
    : { data: [], error: null };
  if (aErr) {
    console.error("[baro-sessions] 신청 조회 실패", aErr);
    return fail(500, "신청 조회 실패");
  }

  // 신청 한 건의 인원 = 참가자 줄 수. headcount 칸은 옛 신청에 비어 있다.
  // ⚠️ application_attendees 표는 service_role 로도 직접 못 읽는다(개인정보) — 어드민 뷰로 센다.
  // ⚠️ 실패를 0명으로 넘기지 않는다. 현장에서 "신청 0명" 으로 읽힌다.
  const appIds = (apps ?? []).map((a) => a.id as string);
  const { data: heads, error: hErr } = appIds.length
    ? await supabase.from("admin_attendee_view").select("application_id").in("application_id", appIds)
    : { data: [], error: null };
  if (hErr) {
    console.error("[baro-sessions] 인원 조회 실패", hErr);
    return fail(500, "인원 조회 실패");
  }
  const headOf = new Map<string, number>();
  for (const h of heads ?? []) headOf.set(h.application_id, (headOf.get(h.application_id) ?? 0) + 1);

  const countsOf = (sessionId: string) => {
    const c = { confirmed: 0, paid: 0, waiting: 0 };
    for (const a of apps ?? []) {
      if (a.session_id !== sessionId) continue;
      const n = headOf.get(a.id as string) ?? 0;
      if (a.status === "waiting") c.waiting += n;
      else if (a.status === "confirmed") {
        c.confirmed += n;
        if (a.payment_status === "confirmed") c.paid += n;
      }
    }
    return c;
  };

  // ── 시각을 안 줬으면 그날 회차 목록만(명단 없음) ──
  if (time == null) {
    return NextResponse.json(
      { sessions: day.map((s) => ({ ...summary(s), counts: countsOf(s.id) })) },
      { headers: NO_STORE },
    );
  }

  // ── 고른 회차 하나 + 명단 ──
  const picked = day.filter((s) => summary(s).startTime === time);
  if (picked.length === 0) return fail(404, `${date} ${time} 에 바-ㅇ탈출 회차가 없습니다.`);
  // 파티 · 노말 회차는 같은 시각에 겹치지 않는다. 겹치면 어느 쪽인지 고를 수 없으니 알린다.
  if (picked.length > 1) return fail(409, `${date} ${time} 에 회차가 ${picked.length}개 있습니다. 어드민에서 확인해 주세요.`);
  const s = picked[0];
  const base = { ...summary(s), counts: countsOf(s.id) };

  if (base.playMode !== "party") return NextResponse.json({ session: { ...base, attendees: [] } }, { headers: NO_STORE });

  const confirmed = (apps ?? []).filter((a) => a.session_id === s.id && a.status === "confirmed");
  const { data: atts, error: tErr } = confirmed.length
    ? // 이름은 암호화돼 있어 복호화해 주는 어드민 뷰에서 읽는다. 전화번호 칸은 고르지 않는다.
      await supabase
        .from("admin_attendee_view")
        .select("application_id, is_representative, name, nickname, experience_range, created_at")
        .in("application_id", confirmed.map((a) => a.id as string))
    : { data: [], error: null };
  if (tErr) {
    console.error("[baro-sessions] 명단 조회 실패", tErr);
    return fail(500, "명단 조회 실패");
  }

  const attendees: {
    nickname: string | null;
    name: string | null;
    experienceRange: string | null;
    paid: boolean;
    applicationNo: number;
  }[] = [];
  let no = 0;
  for (const a of confirmed) {
    // 신청 순서대로 일행 번호를 매기고, 일행 안에서는 대표자를 먼저
    const people = ((atts ?? []) as Att[])
      .filter((p) => p.application_id === a.id)
      .sort((x, y) => Number(y.is_representative) - Number(x.is_representative) || x.created_at.localeCompare(y.created_at));
    if (!people.length) continue;
    no += 1;
    for (const p of people) {
      attendees.push({
        nickname: p.nickname?.trim() || null,
        name: p.name?.trim() || null,
        experienceRange: p.experience_range,
        paid: a.payment_status === "confirmed",
        applicationNo: no,
      });
    }
  }

  return NextResponse.json({ session: { ...base, attendees } }, { headers: NO_STORE });
}
