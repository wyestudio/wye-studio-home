import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendGroupBookingInquirySlackAlert } from "@/lib/slack";
import { sanitizeAttribution } from "@/lib/attribution";
import {
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  contactMethodLabel,
  groupKindLabel,
  isContactMethod,
  isGroupKind,
  isPreferredTime,
  preferredTimeLabel,
} from "@/lib/groupBooking";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 견적 신청 접수.
 *
 * 협찬 신청(`/api/sponsorship/group`)과 같은 모양이다 — 검증 후 security definer
 * 함수로 넣고, 슬랙 알림은 응답을 막지 않게 `after()` 로 뒤에 보낸다.
 *
 * ⚠️ 슬랙 전송이 실패해도 접수는 성공이다. 알림 때문에 고객에게 에러를 보여주면
 *    같은 사람이 여러 번 접수한다.
 */
type Body = {
  headcount?: number;
  contactMethod?: string;
  contact?: string;
  preferredDate?: string | null;
  preferredTime?: string;
  groupKind?: string;
  note?: string | null;
  attribution?: unknown;
};

/** 'YYYY-MM-DD' 만 받는다. date 칸이라 다른 모양은 DB 가 거부한다. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const headcount = Number(body.headcount);
  const contactMethod = String(body.contactMethod ?? "").trim();
  const contact = String(body.contact ?? "").trim();
  const preferredTime = String(body.preferredTime ?? "").trim();
  const groupKind = String(body.groupKind ?? "").trim();
  const preferredDate = String(body.preferredDate ?? "").trim();

  if (!Number.isInteger(headcount) || headcount < GROUP_HEADCOUNT_MIN || headcount > GROUP_HEADCOUNT_MAX) {
    return NextResponse.json(
      { error: `예상 참여 인원을 ${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명 사이로 입력해주세요.` },
      { status: 400 }
    );
  }
  if (!isContactMethod(contactMethod)) {
    return NextResponse.json({ error: "연락 수단을 선택해주세요." }, { status: 400 });
  }
  if (!contact) {
    return NextResponse.json({ error: "연락처를 입력해주세요." }, { status: 400 });
  }
  if (contact.length > 200) {
    return NextResponse.json({ error: "연락처를 확인해주세요." }, { status: 400 });
  }
  if (!isPreferredTime(preferredTime)) {
    return NextResponse.json({ error: "예상 이용 시간을 선택해주세요." }, { status: 400 });
  }
  if (!isGroupKind(groupKind)) {
    return NextResponse.json({ error: "모임 성격을 선택해주세요." }, { status: 400 });
  }
  if (preferredDate && !ISO_DATE.test(preferredDate)) {
    return NextResponse.json({ error: "예상 날짜를 확인해주세요." }, { status: 400 });
  }

  // 요청사항은 길이만 자른다. 운영자가 읽는 자유 입력이라 내용은 손대지 않는다.
  const note = String(body.note ?? "").trim().slice(0, 2000) || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_group_booking_inquiry", {
    p_headcount: headcount,
    p_contact_method: contactMethod,
    p_contact: contact,
    p_preferred_date: preferredDate || null,
    p_preferred_time: preferredTime,
    p_group_kind: groupKind,
    p_note: note,
    // 주소창 값은 누구나 만들어 넣을 수 있다 — 길이를 자르고 빈 값은 버린다.
    p_attribution: sanitizeAttribution(body.attribution) ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  after(async () => {
    try {
      await sendGroupBookingInquirySlackAlert({
        headcount,
        preferredDate: preferredDate || null,
        preferredTime: preferredTimeLabel(preferredTime),
        groupKind: groupKindLabel(groupKind),
        contactMethod: contactMethodLabel(contactMethod),
      });
    } catch (err) {
      console.error("[group-booking] 슬랙 알림 처리 중 에러", err);
    }
  });

  return NextResponse.json({ id: data });
}
