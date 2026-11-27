/**
 * 단체 예약의 진행 단계 · 일정 · 가림 표시(관리자 개편 docs/02).
 *
 * 한 단체는 세 가지를 **따로** 본다: 진행 단계(stage) · 결제(예약금 · 잔금) · 종료(cancelled_at).
 * 단계는 운영자가 고르지 않는다 — 문자 복사 · 입금 확인 같은 동작에 따라 넘어간다(2026-11-27 대표님).
 *
 * ⚠️ 이 파일은 "use client" 화면도 import 한다 — 감출 값을 적지 않는다.
 */
import { HHMM, OPTION, BASE_MINUTES } from "@/lib/groupPricing";
import type { SettlementOptions } from "@/lib/groupSettlement";

/** 코드는 DB 제약(group_booking_inquiries.stage)에 박혀 있다. 라벨만 바꾸는 건 자유다. */
export const GROUP_STAGES = [
  { code: "new", label: "견적 접수" },
  { code: "contacted", label: "연락 완료" },
  { code: "confirmed", label: "예약 확정" },
  { code: "d7", label: "7일 전 안내" },
  { code: "d1", label: "하루 전 안내" },
  { code: "done", label: "진행 완료" },
  { code: "report", label: "리포트 · 후기" },
] as const;
export type GroupStage = (typeof GROUP_STAGES)[number]["code"];
export const stageLabel = (code: string) => GROUP_STAGES.find((s) => s.code === code)?.label ?? code;
export const stageIndex = (code: string) => GROUP_STAGES.findIndex((s) => s.code === code);

/** 단계 · 일정 · 결제를 따지는 데 필요한 칸. */
export type GroupCore = {
  stage: string;
  cancelled_at: string | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  event_date: string | null;
  event_time: string | null;
  event_minutes: number | null;
  preferred_date: string | null;
  preferred_time: string;
  options: { icebreaking?: boolean; character?: boolean; after_party_hours?: number; cleanup?: boolean } | null;
};

/** DB 의 options(jsonb) → 정산 계산의 옵션. 비어 있으면(v1 접수분) 기본 구성이다. */
export function toSettlementOptions(o: GroupCore["options"]): SettlementOptions {
  return {
    icebreaking: o?.icebreaking !== false,
    character: !!o?.character,
    afterPartyHours: Math.max(0, Math.min(OPTION.afterParty.maxHours, Math.trunc(o?.after_party_hours ?? 0))),
    cleanup: !!o?.cleanup,
  };
}

/** 옵션대로면 몇 분짜리 행사인가(기본 180 · 레크리에이션 제외 150 · 애프터파티 시간 더함). */
export function optionMinutes(o: GroupCore["options"]): number {
  const s = toSettlementOptions(o);
  return BASE_MINUTES - (s.icebreaking ? 0 : OPTION.icebreaking.minutes) + s.afterPartyHours * 60;
}

/**
 * 이 단체의 일시 — 확정(또는 협의)된 행사 일시가 있으면 그것, 없으면 희망 일시.
 * 희망 시간이 옛 코드값(t1530 · flexible 등)이면 시각은 null 이다(읽는 쪽에서 정규화한다 — 기존 값은 고치지 않는다).
 */
export function scheduleOf(g: GroupCore): { date: string | null; time: string | null; minutes: number; fixed: boolean } {
  if (g.event_date) {
    return { date: g.event_date, time: g.event_time, minutes: g.event_minutes ?? optionMinutes(g.options), fixed: true };
  }
  return {
    date: g.preferred_date,
    time: HHMM.test(g.preferred_time) ? g.preferred_time : null,
    minutes: optionMinutes(g.options),
    fixed: false,
  };
}

/** 예약금이 들어와 확정된 단체인가. 옛 화면에서 '예약 확정' 으로만 바꾼 건(예약금 미기록)도 확정으로 본다. */
export function isConfirmed(g: GroupCore): boolean {
  return g.deposit_paid_at != null || stageIndex(g.stage) >= stageIndex("confirmed");
}

/**
 * 화면에 보이는 단계. 확정된 건은 **행사일이 지나면 자동으로 「진행 완료」** 다 — DB 를 고치지 않고 읽을 때 본다.
 */
export function effectiveStage(g: GroupCore, today: string): GroupStage {
  const stage = (stageIndex(g.stage) >= 0 ? g.stage : "new") as GroupStage;
  const date = g.event_date;
  if (date && date < today && (stage === "confirmed" || stage === "d7" || stage === "d1")) return "done";
  return stage;
}

/** 목록의 탭. */
export type GroupListTab = "new" | "wait" | "confirmed" | "past" | "cancelled";
export function listTabOf(g: GroupCore, today: string): GroupListTab {
  if (g.cancelled_at) return "cancelled";
  if (!isConfirmed(g)) return g.stage === "new" ? "new" : "wait";
  const date = g.event_date;
  return date && date < today ? "past" : "confirmed";
}

/** 'D-6' · '오늘' · 'D+3'. */
export function ddayLabel(daysLeft: number): string {
  return daysLeft === 0 ? "오늘" : daysLeft > 0 ? `D-${daysLeft}` : `D+${-daysLeft}`;
}

/** 지금 할 일 한 줄 — 목록의 「다음 할 일」 과 상세 맨 위에 쓴다. 끝난 건은 null. */
export function nextAction(g: GroupCore, today: string, daysLeft: number | null): string | null {
  if (g.cancelled_at) return null;
  const stage = effectiveStage(g, today);
  if (stage === "new") return "견적 안내 보내기";
  if (stage === "contacted") return "예약금 입금 확인";
  if (stage === "confirmed") {
    if (g.deposit_paid_at == null) return "받은 예약금 기록하기";
    return daysLeft != null && daysLeft > 7 ? `7일 전 안내 (${daysLeft - 7}일 뒤)` : "7일 전 안내 보내기";
  }
  if (stage === "d7") {
    if (g.balance_paid_at == null && daysLeft != null && daysLeft <= 1) return "하루 전 안내 보내기 · 잔금 확인";
    return daysLeft != null && daysLeft > 1 ? `하루 전 안내 (${daysLeft - 1}일 뒤)` : "하루 전 안내 보내기";
  }
  if (stage === "d1") return "행사 진행";
  if (stage === "done") return "리포트 전달";
  return null;
}

/** 이름 가림 — '김서윤' → '김*윤', '김윤' → '김*'. 전체 값은 「연락처 보기」 를 눌러야 내려간다. */
export function maskName(name: string | null): string {
  const chars = Array.from((name ?? "").trim());
  if (chars.length === 0) return "이름 없음";
  if (chars.length === 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/**
 * 연락처 가림. 전화 · 문자는 '010-****-1234', 카카오톡 ID · 이메일은 앞 두 글자만 남긴다.
 * ⚠️ 가린 값은 **서버에서** 만들어 내려준다. 전체 값을 내려보내고 화면에서 가리지 않는다.
 */
export function maskContact(method: string, contact: string | null): string {
  const raw = (contact ?? "").trim();
  if (!raw) return "-";
  const digits = raw.replace(/\D/g, "");
  if ((method === "phone" || method === "sms") && digits.length >= 9) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  const at = raw.indexOf("@");
  if (at > 0) return `${Array.from(raw.slice(0, at)).slice(0, 2).join("")}***${raw.slice(at)}`;
  return `${Array.from(raw).slice(0, 2).join("")}***`;
}
