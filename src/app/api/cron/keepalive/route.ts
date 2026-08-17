import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Supabase Free 플랜은 7일간 활동이 없으면 프로젝트를 자동 일시정지한다.
// 가벼운 select 하나로 DB 활동을 남겨 정지를 방지한다 — SMS나 다른 부수효과 없음.
export async function GET(request: NextRequest) {
  const tokenFromQuery = request.nextUrl.searchParams.get("token");
  const tokenFromHeader = request.headers.get("x-cron-secret");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const token = tokenFromQuery || tokenFromHeader;
  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("sessions").select("id").limit(1);

  if (error) {
    return NextResponse.json({ error: "DB 조회 실패", details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
