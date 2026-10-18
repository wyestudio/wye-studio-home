import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RANKINGS_TAG } from "@/lib/themes";
import { RANKING_GRADES, type RankingGrade } from "@/types/catalog";

export const dynamic = "force-dynamic";

/**
 * 방탈출 현장 앱(BAR-O, wye-studio-webapp)이 회차가 끝날 때 팀별 결과를 보내는 자리.
 * 받은 기록은 theme_rankings 에 쌓여 테마 상세의 '이달의 랭킹' 이 된다.
 *
 * ⚠️ 현장에는 이 프로젝트의 Supabase 키를 두지 않는다(예약·결제 DB 까지 열린다).
 *    현장은 BARO_RESULT_SECRET 하나만 갖고, 그 키로 할 수 있는 일은 랭킹 기록을
 *    넣는 것뿐이다. 보드 사진 키(BOARD_PHOTO_SECRET)와 **따로 둔다** — 그 키는
 *    "사진만 올릴 수 있다" 는 약속으로 현장에 나가 있다.
 * ⚠️ 같은 기록을 두 번 보내도 한 줄로 남는다(external_ref = run id + 자리). 현장은
 *    실패하면 다시 보내므로 그렇게 돼야 한다.
 * ⚠️ hidden 은 보내지도 덮어쓰지도 않는다 — 어드민에서 숨긴 기록이 다시 보내질 때
 *    되살아나면 안 된다.
 */

/**
 * 현장 앱의 진행 모드 → 이 사이트의 테마. 현장 앱은 바-ㅇ탈출 하나만 운영한다.
 * 테마가 늘면 현장이 테마를 같이 보내게 바꾼다.
 */
const THEME_SLUG: Record<"party" | "normal", string> = {
  party: "baotalchul",
  normal: "baotalchul-normal",
};

type TeamIn = {
  seat: string;
  name: string;
  points: number;
  grade: string;
  headcount: number;
  remainingSec: number | null;
  hintFree: boolean;
};

function sameSecret(got: string | null, expected: string) {
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 노말모드 랭킹 구분 — 2 · 3 · 4(4인 이상). 1명 이하는 구분 밖(null). */
function sizeGroup(headcount: number) {
  if (headcount >= 4) return 4;
  if (headcount === 2 || headcount === 3) return headcount;
  return null;
}

export async function POST(request: NextRequest) {
  const expected = process.env.BARO_RESULT_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "BARO_RESULT_SECRET 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!sameSecret(request.headers.get("x-baro-secret"), expected)) {
    return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
  }

  let body: { runId?: unknown; playMode?: unknown; date?: unknown; teams?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 을 읽지 못했습니다." }, { status: 400 });
  }

  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const playMode = body.playMode === "normal" ? "normal" : body.playMode === "party" ? "party" : null;
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const teams = Array.isArray(body.teams) ? (body.teams as TeamIn[]) : null;
  if (!runId || runId.length > 64 || !playMode || !date || !teams) {
    return NextResponse.json({ ok: false, error: "runId · playMode · date · teams 가 필요합니다." }, { status: 400 });
  }
  if (teams.length > 12) {
    return NextResponse.json({ ok: false, error: "팀이 너무 많습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: theme, error: themeErr } = await supabase
    .from("themes")
    .select("id")
    .eq("slug", THEME_SLUG[playMode])
    .maybeSingle();
  if (themeErr || !theme) {
    return NextResponse.json({ ok: false, error: `테마(${THEME_SLUG[playMode]})를 찾을 수 없습니다.` }, { status: 500 });
  }

  const rows = [];
  for (const t of teams) {
    const name = typeof t?.name === "string" ? t.name.trim().slice(0, 30) : "";
    const seat = typeof t?.seat === "string" ? t.seat.trim().slice(0, 8) : "";
    const points = Number(t?.points);
    const grade = String(t?.grade ?? "").toUpperCase() as RankingGrade;
    if (!name || !seat || !Number.isInteger(points) || !RANKING_GRADES.includes(grade)) {
      return NextResponse.json({ ok: false, error: `팀 기록 형식이 맞지 않습니다 (${seat || "?"}).` }, { status: 400 });
    }
    const remaining = Number(t?.remainingSec);
    rows.push({
      theme_id: theme.id,
      played_on: date,
      team_name: name,
      points,
      remaining_sec: t?.remainingSec == null || !Number.isFinite(remaining) || remaining < 0 ? null : Math.round(remaining),
      grade,
      group_size: playMode === "normal" ? sizeGroup(Number(t?.headcount) || 0) : null,
      hint_free: t?.hintFree === true,
      source: "baro" as const,
      external_ref: `${runId}:${seat}`,
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("theme_rankings").upsert(rows, { onConflict: "external_ref" });
    if (error) {
      console.error("[baro-result] 저장 실패", error);
      return NextResponse.json({ ok: false, error: "저장 실패" }, { status: 500 });
    }
    revalidateTag(RANKINGS_TAG, "max");
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
