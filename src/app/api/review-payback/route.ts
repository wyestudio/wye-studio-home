import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  phone?: string;
  session?: string;
  channel?: string;
  url?: string;
  bank?: string;
  account?: string;
  holder?: string;
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
  const phone = String(body.phone ?? "").trim();
  const session = String(body.session ?? "").trim();
  const channel = String(body.channel ?? "").trim();
  const url = String(body.url ?? "").trim();
  const bank = String(body.bank ?? "").trim();
  const account = String(body.account ?? "").trim();
  const holder = String(body.holder ?? "").trim();

  if (!name || !phone || !session || !channel || !url || !bank || !account || !holder) {
    return NextResponse.json({ error: "필수 항목을 모두 입력해주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_review_payback_application", {
    p_name: name,
    p_phone: phone,
    p_session_slug: session,
    p_channel: channel,
    p_post_url: url,
    p_bank_name: bank,
    p_account_number: account,
    p_account_holder: holder,
    p_agreements: body.agreements ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data });
}
