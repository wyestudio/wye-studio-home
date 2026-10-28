import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendGroupBookingInquirySlackAlert } from "@/lib/slack";
import { sanitizeAttribution } from "@/lib/attribution";
import {
  GROUP_HEADCOUNT_MIN,
  contactMethodLabel,
  groupKindLabel,
  isContactMethod,
  isGroupKind,
  isRepeatPlayer,
  isTeamStyle,
} from "@/lib/groupBooking";
import {
  ISO_DATE,
  QUOTE_HEADCOUNT_MAX,
  QUOTE_LAST_DATE,
  WEEKEND_TIMES,
  calcQuote,
  isWeekdayTime,
  isWeekend,
  normalizeOptions,
  overlapsBusy,
  quoteFirstDate,
  type QuoteOptions,
} from "@/lib/groupPricing";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 견적 신청 접수(v2, /group 단계형 견적).
 *
 * 협찬 신청(`/api/sponsorship/group`)과 같은 모양이다 — 검증 후 security definer
 * 함수로 넣고, 슬랙 알림은 응답을 막지 않게 `after()` 로 뒤에 보낸다.
 *
 * ⚠️ 금액은 화면이 보낸 값을 쓰지 않는다. 인원·날짜·옵션으로 여기서 다시 계산해
 *    저장한다(groupPricing.ts) — 접수함의 금액이 곧 상담의 출발점이다.
 * ⚠️ 슬랙 전송이 실패해도 접수는 성공이다. 알림 때문에 고객에게 에러를 보여주면
 *    같은 사람이 여러 번 접수한다.
 */
type Body = {
  headcount?: number;
  preferredDate?: string;
  preferredTime?: string;
  options?: Partial<QuoteOptions>;
  organizerName?: string;
  contactMethod?: string;
  contact?: string;
  groupName?: string | null;
  groupKind?: string | null;
  groupKindNote?: string | null;
  teamStyle?: string | null;
  repeatPlayer?: string | null;
  occasion?: string | null;
  note?: string | null;
  agreeTerms?: boolean;
  agreePrivacy?: boolean;
  attribution?: unknown;
};

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/** 선택 칸: 앞뒤 공백을 자르고 길이를 넘으면 자른다. 비면 null. */
const opt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad("잘못된 요청입니다.");
  }

  const headcount = Number(body.headcount);
  const preferredDate = String(body.preferredDate ?? "").trim();
  const preferredTime = String(body.preferredTime ?? "").trim();
  const organizerName = String(body.organizerName ?? "").trim();
  const contactMethod = String(body.contactMethod ?? "").trim();
  const contact = String(body.contact ?? "").trim();

  if (!Number.isInteger(headcount) || headcount < GROUP_HEADCOUNT_MIN || headcount > QUOTE_HEADCOUNT_MAX) {
    return bad(`참여 인원을 ${GROUP_HEADCOUNT_MIN}~${QUOTE_HEADCOUNT_MAX}명 사이로 입력해주세요.`);
  }
  if (!ISO_DATE.test(preferredDate) || preferredDate < quoteFirstDate() || preferredDate > QUOTE_LAST_DATE) {
    return bad("희망 날짜를 다시 선택해주세요.");
  }
  // 주말은 정해진 회차만, 평일은 09:30~21:30 사이.
  const timeOk = isWeekend(preferredDate)
    ? (WEEKEND_TIMES as readonly string[]).includes(preferredTime)
    : isWeekdayTime(preferredTime);
  if (!timeOk) return bad("희망 시간을 다시 선택해주세요.");
  if (!organizerName || organizerName.length > 40) return bad("담당자 이름을 확인해주세요.");
  if (!isContactMethod(contactMethod)) return bad("연락 수단을 선택해주세요.");
  if (!contact || contact.length > 100) return bad("연락처를 확인해주세요.");
  if (!body.agreeTerms || !body.agreePrivacy) return bad("필수 확인 항목에 동의해주세요.");

  const groupKind = opt(body.groupKind, 20);
  if (groupKind && !isGroupKind(groupKind)) return bad("모임 성격을 다시 선택해주세요.");
  const teamStyle = opt(body.teamStyle, 20);
  if (teamStyle && !isTeamStyle(teamStyle)) return bad("팀 구성 방식을 다시 선택해주세요.");
  const repeatPlayer = opt(body.repeatPlayer, 20);
  if (repeatPlayer && !isRepeatPlayer(repeatPlayer)) return bad("재참여 여부를 다시 선택해주세요.");

  const options = normalizeOptions(
    {
      icebreaking: body.options?.icebreaking !== false,
      character: !!body.options?.character,
      afterPartyHours: Number(body.options?.afterPartyHours) || 0,
      cleanup: !!body.options?.cleanup,
    },
    preferredDate,
    preferredTime
  );
  const quote = calcQuote({ headcount, date: preferredDate, time: preferredTime, options });

  const supabase = await createClient();

  // 같은 장소에서 신청자가 있는 노말모드 회차와 겹치면 받지 않는다(파티모드는 조정 가능해 막지 않는다). 화면 목록은 60초 캐시라
  // 그 사이 들어온 신청은 여기서 캐시 없이 다시 본다.
  const { data: busyRows } = await supabase
    .from("public_group_busy_slots")
    .select("date, start_time, end_time")
    .eq("date", preferredDate);
  const busy = ((busyRows ?? []) as { date: string; start_time: string; end_time: string }[]).map((r) => ({
    date: r.date,
    start: r.start_time,
    end: r.end_time,
  }));
  if (overlapsBusy(busy, preferredDate, preferredTime, quote.minutes + options.afterPartyHours * 60)) {
    return bad("선택한 시간에 다른 예약이 있어요. 다른 날짜나 시간을 골라주세요.");
  }

  const { data, error } = await supabase.rpc("submit_group_booking_inquiry_v2", {
    p_headcount: headcount,
    p_organizer_name: organizerName,
    p_contact_method: contactMethod,
    p_contact: contact,
    p_preferred_date: preferredDate,
    p_preferred_time: preferredTime,
    p_options: {
      icebreaking: options.icebreaking,
      character: options.character,
      after_party_hours: options.afterPartyHours,
      cleanup: options.cleanup,
    },
    p_unit_price: quote.unit,
    p_estimate_total: quote.total,
    p_group_name: opt(body.groupName, 80),
    p_group_kind: groupKind,
    // '기타' 일 때만 받는다. 다른 성격을 골랐는데 남아 있는 글은 버린다.
    p_group_kind_note: groupKind === "etc" ? opt(body.groupKindNote, 80) : null,
    p_team_style: teamStyle,
    p_repeat_player: repeatPlayer,
    p_occasion: opt(body.occasion, 200),
    // 요청사항은 길이만 자른다. 운영자가 읽는 자유 입력이라 내용은 손대지 않는다.
    p_note: opt(body.note, 1500),
    // 주소창 값은 누구나 만들어 넣을 수 있다 — 길이를 자르고 빈 값은 버린다.
    p_attribution: sanitizeAttribution(body.attribution) ?? {},
  });

  if (error) return bad(error.message);

  after(async () => {
    try {
      await sendGroupBookingInquirySlackAlert({
        headcount,
        preferredDate,
        preferredTime,
        organizerName,
        groupName: opt(body.groupName, 80),
        groupKind: groupKind ? groupKindLabel(groupKind) : null,
        contactMethod: contactMethodLabel(contactMethod),
        contact,
        estimate: quote.total,
        deposit: quote.deposit,
        options: quote.lines
          .filter((l) => l.label !== "기본 프로그램")
          .map((l) => (l.detail ? `${l.label} ${l.detail}` : l.label)),
        note: opt(body.note, 1500),
      });
    } catch (err) {
      console.error("[group-booking] 슬랙 알림 처리 중 에러", err);
    }
  });

  return NextResponse.json({ id: data, estimate: quote.total });
}
