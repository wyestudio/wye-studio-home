import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 방탈출 현장 앱(BAR-O, wye-studio-webapp)이 다가오는 바-ㅇ탈출 회차와 신청 명단을
 * 읽어 가는 자리. 진행자가 현장 앱에서 "홈페이지에서 불러오기" 를 누를 때만 부른다.
 * 현장 앱은 매장 와이파이 안에만 있어 이쪽에서 밀어 넣을 수 없다 — 현장이 당겨 간다.
 *
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
const DAY_MS = 24 * 60 * 60 * 1000;
/** 한 번에 읽을 수 있는 기간 상한 — 실수로 몇 년 치를 당겨 가지 않게. */
const MAX_DAYS = 62;

function sameSecret(got: string | null, expected: string) {
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** KST 날짜 문자열(YYYY-MM-DD). */
function kstYmd(d: Date) {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** KST 날짜의 0시를 UTC 시각으로. 달력에 없는 날짜(2026-02-30)는 null. */
function kstMidnight(ymd: string) {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) || kstYmd(d) !== ymd ? null : d;
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

type Att = {
  application_id: string;
  session_id: string;
  is_representative: boolean;
  name: string | null;
  nickname: string | null;
  experience_range: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const expected = process.env.BARO_SESSIONS_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "BARO_SESSIONS_SECRET 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!sameSecret(request.headers.get("x-baro-sessions-secret"), expected)) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const today = kstYmd(new Date());
  const fromStr = sp.get("from") || today;
  if (!YMD.test(fromStr)) return bad("from 은 YYYY-MM-DD 형식이어야 합니다.");
  const from = kstMidnight(fromStr);
  if (!from) return bad("from 이 없는 날짜입니다.");
  const toStr = sp.get("to") || kstYmd(new Date(from.getTime() + 14 * DAY_MS));
  if (!YMD.test(toStr)) return bad("to 는 YYYY-MM-DD 형식이어야 합니다.");
  const to = kstMidnight(toStr);
  if (!to) return bad("to 가 없는 날짜입니다.");
  if (to < from) return bad("to 가 from 보다 앞입니다.");
  if ((to.getTime() - from.getTime()) / DAY_MS > MAX_DAYS) return bad(`기간은 ${MAX_DAYS}일까지만 조회할 수 있습니다.`);
  const toEnd = new Date(to.getTime() + DAY_MS); // to 날짜 하루 전체

  const supabase = createAdminClient();
  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("id, slug, session_type, start_at, status, themes!inner(slug, name, variant_label)")
    .in("themes.slug", Object.keys(THEME_MODE))
    .neq("status", "cancelled")
    .gte("start_at", from.toISOString())
    .lt("start_at", toEnd.toISOString())
    .order("start_at");
  if (sErr) {
    console.error("[baro-sessions] 회차 조회 실패", sErr);
    return NextResponse.json({ error: "회차 조회 실패" }, { status: 500 });
  }
  if (!sessions?.length) return NextResponse.json({ sessions: [] }, { headers: { "Cache-Control": "no-store" } });

  const ids = sessions.map((s) => s.id as string);
  const [{ data: apps, error: aErr }, { data: atts, error: tErr }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, session_id, status, payment_status, created_at")
      .in("session_id", ids)
      .neq("status", "cancelled"),
    // 이름은 암호화돼 있어 복호화해 주는 어드민 뷰에서 읽는다. 전화번호 칸은 고르지 않는다.
    supabase
      .from("admin_attendee_view")
      .select("application_id, session_id, is_representative, name, nickname, experience_range, created_at")
      .in("session_id", ids),
  ]);
  if (aErr || tErr) {
    console.error("[baro-sessions] 신청 조회 실패", aErr ?? tErr);
    return NextResponse.json({ error: "신청 조회 실패" }, { status: 500 });
  }

  const attsByApp = new Map<string, Att[]>();
  for (const a of (atts ?? []) as Att[]) {
    const list = attsByApp.get(a.application_id) ?? [];
    list.push(a);
    attsByApp.set(a.application_id, list);
  }
  for (const list of attsByApp.values()) {
    list.sort((x, y) => Number(y.is_representative) - Number(x.is_representative) || x.created_at.localeCompare(y.created_at));
  }

  const out = sessions.map((s) => {
    const theme = s.themes as unknown as { slug: string; name: string; variant_label: string | null };
    const themeSlug = theme.slug;
    const playMode = THEME_MODE[themeSlug];
    const mine = (apps ?? [])
      .filter((a) => a.session_id === s.id)
      .sort((x, y) => (x.created_at as string).localeCompare(y.created_at as string));

    const counts = { confirmed: 0, paid: 0, waiting: 0 };
    const attendees: {
      nickname: string | null;
      name: string | null;
      experienceRange: string | null;
      paid: boolean;
      applicationNo: number;
    }[] = [];
    let no = 0;
    for (const a of mine) {
      const people = attsByApp.get(a.id as string) ?? [];
      if (a.status === "waiting") {
        counts.waiting += people.length;
        continue;
      }
      if (a.status !== "confirmed") continue;
      const paid = a.payment_status === "confirmed";
      counts.confirmed += people.length;
      if (paid) counts.paid += people.length;
      if (playMode !== "party" || people.length === 0) continue;
      no += 1;
      for (const p of people) {
        attendees.push({
          nickname: p.nickname?.trim() || null,
          name: p.name?.trim() || null,
          experienceRange: p.experience_range,
          paid,
          applicationNo: no,
        });
      }
    }

    const start = new Date(s.start_at as string);
    const kst = new Date(start.getTime() + 9 * 60 * 60 * 1000).toISOString();
    return {
      id: s.id,
      slug: s.slug, // 옛 회차에만 있다. 회차를 가리킬 땐 id 를 쓴다
      themeSlug,
      playMode,
      sessionType: s.session_type, // 옛 회차(그룹 · 소개팅)에만 있고 지금 회차는 null
      // sessions.title 은 옛 회차에만 있다 — 테마 이름 + 모드로 만든다("바-ㅇ탈출 파티모드")
      title: [theme.name, theme.variant_label].filter(Boolean).join(" "),
      date: kst.slice(0, 10),
      startTime: kst.slice(11, 16),
      status: s.status,
      counts,
      attendees,
    };
  });

  return NextResponse.json({ sessions: out }, { headers: { "Cache-Control": "no-store" } });
}
