/**
 * 모임장 신청서의 답을 읽는 규칙(관리자 개편 docs/04 2-3) — 견적과 다른 내용 · 상담이 필요한 내용 · 요약.
 *
 * 전부 순수 함수다(DB · 네트워크를 쓰지 않는다). 공개 폼의 서버 액션과 관리자 화면이 같이 쓴다.
 *
 * ⚠️ 선택지 글자로 판단한다 — leaderSchema.ts 에서 locked 가 붙은 질문의 선택지를 바꾸면 여기도 같이 본다.
 * ⚠️ 금액은 여기서 바꾸지 않는다. 다른 내용은 「신청서와 다른 내용」 으로 올리고 운영자가 반영한다(2026-11-27 대표님).
 */
import { GROUP_KINDS } from "@/lib/groupBooking";
import { OPTION, dateLabel, won } from "@/lib/groupPricing";
import { OTHER, otherKey, type Question } from "@/lib/groupForms/schema";
import { isVisible, type Answers } from "@/lib/groupForms/validate";

/** 견적(또는 운영자 등록)에서 온 지금 값. */
export type LeaderGroupNow = {
  headcount: number;
  /** 지금 일시(확정됐으면 행사 일시, 아니면 희망 일시). */
  date: string | null;
  time: string | null;
  /** 예약금이 들어와 일정이 확정됐는가 — 확정이면 신청서로 일정을 바꿀 수 없다. */
  fixed: boolean;
  afterPartyHours: number;
  cleanup: boolean;
};

export type PendingItem =
  | { key: "headcount"; label: string; headcount: number }
  | { key: "schedule"; label: string; date: string; time: string }
  | { key: "after_party"; label: string; hours: number }
  | { key: "cleanup"; label: string; cleanup: boolean }
  | { key: "leader_name"; label: string };

export const PENDING_KEYS = ["headcount", "schedule", "after_party", "cleanup", "leader_name"] as const;

/** DB 에서 읽은 pending(jsonb)을 아는 모양만 남겨 돌려준다. */
export function parsePending(raw: unknown): PendingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is PendingItem =>
      !!x && typeof x === "object" && typeof (x as { label?: unknown }).label === "string" && (PENDING_KEYS as readonly string[]).includes((x as { key?: string }).key ?? "")
  );
}

const str = (a: Answers, id: string) => (typeof a[id] === "string" ? (a[id] as string) : "");

/** '2시간' → 2. 그 밖(4시간 넘게 · 아직 미정)은 null. */
function hoursOf(v: string): number | null {
  const m = /^([1-4])시간$/.exec(v);
  return m ? Number(m[1]) : null;
}

/**
 * 신청서 답과 지금 값을 견주어 「신청서와 다른 내용」 을 만든다.
 * 「아직 미정」 · 「고민 중」 처럼 정해지지 않은 답은 올리지 않는다.
 */
export function buildPending(a: Answers, now: LeaderGroupNow, leaderChanged: boolean): PendingItem[] {
  const out: PendingItem[] = [];

  const head = Number(a.headcount);
  if (Number.isInteger(head) && head !== now.headcount) {
    out.push({ key: "headcount", label: `인원 ${now.headcount}명 → ${head}명`, headcount: head });
  }

  const date = str(a, "date");
  const time = str(a, "time");
  if (!now.fixed && date && time && (date !== now.date || time !== now.time)) {
    const from = now.date ? `${dateLabel(now.date)} ${now.time ?? "시간 미정"}` : "미정";
    out.push({ key: "schedule", label: `희망 일시 ${from} → ${dateLabel(date)} ${time}`, date, time });
  }

  const party = str(a, "afterParty");
  if (party === "신청하지 않아요") {
    if (now.afterPartyHours > 0) out.push({ key: "after_party", label: `애프터파티 ${now.afterPartyHours}시간 → 신청 안 함`, hours: 0 });
  } else if (party === "신청할게요" || party === "아직 고민 중이에요") {
    const h = hoursOf(str(a, "apHours"));
    // 「고민 중」 인데 시간만 골라 둔 것은 아직 신청이 아니다 — 견적보다 늘리는 변경은 「신청할게요」 일 때만 올린다.
    if (h != null && h !== now.afterPartyHours && (party === "신청할게요" || h < now.afterPartyHours)) {
      out.push({
        key: "after_party",
        label: now.afterPartyHours > 0 ? `애프터파티 ${now.afterPartyHours}시간 → ${h}시간` : `애프터파티 ${h}시간 신청 (+${won(h * OPTION.afterParty.hourly)})`,
        hours: h,
      });
    }
    const clean = str(a, "cleanup");
    if (clean === "예" && !now.cleanup && party === "신청할게요") {
      out.push({ key: "cleanup", label: `정리 지원 서비스 신청 (+${won(OPTION.cleanup.price)})`, cleanup: true });
    } else if (clean === "아니요" && now.cleanup) {
      out.push({ key: "cleanup", label: "정리 지원 서비스 신청 안 함", cleanup: false });
    }
  }

  if (leaderChanged) out.push({ key: "leader_name", label: "담당자가 바뀌었어요 (새 이름은 신청서에 있어요)" });
  return out;
}

/** 「상담이 필요한 내용」 — 금액을 자동으로 바꾸지 않고 운영자가 연락해 정한다. 답에서 매번 읽는다(저장하지 않는다). */
export function consultItems(a: Answers): string[] {
  const out: string[] = [];
  const repeat = str(a, "repeat");
  if (repeat && repeat !== "없음") out.push(`재참여자: ${repeat}${str(a, "repeatN") ? ` · ${str(a, "repeatN")}` : ""}`);
  if (str(a, "apHours") === "4시간 넘게 (별도 상담)") out.push("애프터파티 4시간 넘게 이용 희망");
  if (str(a, "difficulty") === "별도 상담 희망") out.push("난이도 별도 상담 희망");
  if (str(a, "team") === "상담 후 결정") out.push("팀 편성 상담 후 결정");
  if (str(a, "headRange") === "그 외 인원 (별도 상담)") out.push("최종 인원이 6~24명 밖 (별도 상담)");
  const head = Number(a.headcount);
  if (Number.isInteger(head) && (head < 6 || head > 24)) out.push(`인원 ${head}명 — 6~24명 밖이라 별도 상담`);
  return out;
}

/** 이벤트가 있으면 준비 체크리스트에 넣을 한 줄(60자 이내). 없으면 null. */
export function eventChecklistLabel(a: Answers): string | null {
  const events = Array.isArray(a.event) ? a.event.filter((x) => x !== "없음") : [];
  if (events.length === 0) return null;
  const detail = str(a, "eventDetail").replace(/\s+/g, " ");
  const text = `${EVENT_ITEM_PREFIX} ${detail || events.join(" · ")}`;
  const chars = Array.from(text);
  return chars.length > 60 ? `${chars.slice(0, 59).join("")}…` : text;
}
export const EVENT_ITEM_PREFIX = "이벤트 준비:";

/** 모임 성격 — 화면의 글자(라벨) ↔ DB 의 코드. */
export const kindCodeOf = (label: string) => GROUP_KINDS.find((k) => k.label === label)?.code ?? null;
export const kindLabelOf = (code: string | null) => GROUP_KINDS.find((k) => k.code === code)?.label ?? null;

/** 한 문항의 답을 사람이 읽는 글로. 「기타」 는 직접 적은 내용을 붙인다. */
export function answerText(q: Question, a: Answers): string {
  const v = a[q.id];
  const other = typeof a[otherKey(q.id)] === "string" ? (a[otherKey(q.id)] as string) : "";
  const withOther = (s: string) => (s === OTHER && other ? `기타: ${other}` : s);
  if (q.type === "agree") return v === true ? "동의" : "-";
  if (Array.isArray(v)) return v.length ? v.map(withOther).join(", ") : "-";
  if (v == null || v === "") return "-";
  if (q.type === "date") return dateLabel(String(v));
  if (q.type === "number" && q.id === "headcount") return `${v}명`;
  return withOther(String(v));
}

export type SummaryRow = { id: string; section: string; label: string; value: string };

/**
 * 답 전체를 묶음 · 이름 · 값의 줄로. 조건에 걸려 묻지 않은 문항과 개인정보(이름 · 휴대폰 번호)는 뺀다.
 * 모임장에게 다시 보여줄 때(끝 4자리 확인 후)와 관리자의 「신청서 전체 보기」 가 같이 쓴다.
 * @param questions 그 답을 낼 때의 양식(묶음 이름이 붙은 질문들 — flattenTemplate).
 */
export function summaryRows(a: Answers, questions: readonly Question[]): SummaryRow[] {
  return questions.filter((q) => q.id !== "leaderName" && q.id !== "phone")
    .filter((q) => isVisible(q, a) && a[q.id] !== undefined && a[q.id] !== "")
    .map((q) => ({ id: q.id, section: q.section ?? "", label: q.label, value: answerText(q, a) }));
}
