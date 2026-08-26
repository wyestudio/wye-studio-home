import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendSponsorshipApplicationSlackAlert } from "@/lib/slack";

export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  birthYear?: number;
  gender?: string;
  phone?: string;
  handle?: string;
  platform?: string;
  profileUrl?: string;
  followers?: number;
  reach?: number;
  portfolioUrl?: string | null;
  note?: string | null;
  deliverable?: string;
  agreements?: Record<string, boolean>;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const gender = String(body.gender ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const handle = String(body.handle ?? "").trim();
  const platform = String(body.platform ?? "").trim();
  const profileUrl = String(body.profileUrl ?? "").trim();
  const deliverable = String(body.deliverable ?? "").trim();
  const birthYear = Number(body.birthYear);
  const followers = Number(body.followers);
  const reach = Number(body.reach);

  if (!name || !phone || !handle || !platform || !profileUrl || !deliverable) {
    return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
  }
  if (gender !== "M" && gender !== "F") {
    return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
  }
  if (gender !== "F") {
    return NextResponse.json({ error: "이번 협찬은 여성 크리에이터만 신청할 수 있어요." }, { status: 400 });
  }
  if (!Number.isFinite(birthYear) || !Number.isFinite(followers) || !Number.isFinite(reach)) {
    return NextResponse.json({ error: "숫자 항목을 확인해주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_sponsorship_dating_application", {
    p_name: name,
    p_birth_year: birthYear,
    p_gender: gender,
    p_phone: phone,
    p_handle: handle,
    p_platform: platform,
    p_profile_url: profileUrl,
    p_followers: followers,
    p_reach: reach,
    p_portfolio_url: body.portfolioUrl?.trim() || null,
    p_note: body.note?.trim() || null,
    p_deliverable: deliverable,
    p_agreements: body.agreements ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  after(async () => {
    try {
      await sendSponsorshipApplicationSlackAlert({ type: "dating", name, handle });
    } catch (err) {
      console.error("[sponsorship] 슬랙 알림 처리 중 에러", err);
    }
  });

  return NextResponse.json({ id: data });
}
