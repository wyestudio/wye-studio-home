import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskName, scheduleOf, type GroupCore } from "@/lib/groupStage";

/**
 * 단체 예약 공개 폼의 링크(관리자 개편 docs/05 3장).
 *
 * 폼 주소는 `/f/<토큰>` 이다. 토큰은 무작위 128비트라 추측할 수 없고, 링크 하나는 **한 단체의 한 폼**만 연다.
 * 이 파일은 서버에서만 돈다 — 서비스 키로 읽고, 브라우저에는 **꼭 필요한 최소한**만 내려보낸다:
 *   참가자 설문: 모임명 · 일시 · 확정 인원 · 제출 인원 수 · (가린 이름 + 닉네임) 목록
 *   후기 설문:   모임명
 * 전화번호 · 나이대 · 방수 · 동의 여부 · 이름 전체는 어떤 경로로도 내려가지 않는다.
 */

export type FormKey = "leader" | "participant" | "review";

/** 폼 링크의 기준 주소. 테스트 서버는 NEXT_PUBLIC_SITE_URL 이 운영 주소라 그 프로젝트의 도메인을 쓴다(santa-calendar 와 같다). */
export function formsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com").replace(/\/$/, "");
}

export const formUrl = (token: string) => `${formsBaseUrl()}/f/${token}`;

/** 단체의 폼 링크 3개(없으면 만든다). 어드민 화면 · 안내 문자가 쓴다. */
export async function ensureFormLinks(inquiryId: string): Promise<Record<FormKey, string>> {
  const supabase = createAdminClient();
  const read = (columns: string) =>
    supabase.from("group_form_links").select(columns).eq("inquiry_id", inquiryId).is("revoked_at", null);
  let { data, error } = await read("form_key, token");
  if (error) throw new Error(error.message);
  if ((data ?? []).length < 3) {
    const made = await supabase.rpc("admin_ensure_group_form_links", { p_inquiry_id: inquiryId });
    if (made.error) throw new Error(made.error.message);
    // ⚠️ 만든 뒤에는 **다른 모양의 조회**로 다시 읽는다. 서버 컴포넌트는 한 번 그리는 동안 똑같은 GET 요청의 응답을
    //    되풀이해 쓰기 때문에, 위와 같은 조회를 다시 보내면 만들기 전의 빈 결과가 그대로 돌아온다(실제로 그랬다).
    ({ data, error } = await read("form_key, token, created_at"));
    if (error) throw new Error(error.message);
  }
  const map = Object.fromEntries(((data ?? []) as unknown as { form_key: FormKey; token: string }[]).map((r) => [r.form_key, r.token]));
  if (!map.leader || !map.participant || !map.review) throw new Error("폼 링크를 만들지 못했습니다.");
  return map as Record<FormKey, string>;
}

/** 이미 있는 링크만 읽는다(만들지 않는다). 안내 문자 미리보기처럼 읽기만 하는 자리에서 쓴다. */
export async function readFormLinks(inquiryId: string): Promise<Partial<Record<FormKey, string>>> {
  const { data, error } = await createAdminClient()
    .from("group_form_links")
    .select("form_key, token")
    .eq("inquiry_id", inquiryId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as { form_key: FormKey; token: string }[]).map((r) => [r.form_key, r.token]));
}

const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;

export type FormContext = {
  formKey: FormKey;
  inquiryId: string;
  /** 화면에 보일 모임명. */
  groupName: string;
  date: string | null;
  time: string | null;
  /** 확정된 일시인가(예약금 입금). 아니면 희망 일시다. */
  fixed: boolean;
  headcount: number;
  cancelled: boolean;
};

/**
 * 주소의 토큰으로 폼을 찾는다. 없거나 무효면 null — 화면은 "링크가 만료되었거나 올바르지 않습니다" 만 보여준다.
 * (있는 링크인지 없는 링크인지, 어느 단체인지 추측할 단서를 주지 않는다.)
 */
export async function resolveForm(token: string): Promise<FormContext | null> {
  if (!TOKEN_RE.test(token)) return null;
  const supabase = createAdminClient();
  const { data: link, error } = await supabase
    .from("group_form_links")
    .select("inquiry_id, form_key")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!link) return null;
  const l = link as { inquiry_id: string; form_key: FormKey };
  // 이름 · 연락처가 없는 칸만 읽는다.
  const { data: g, error: gErr } = await supabase
    .from("group_booking_inquiries")
    .select(
      "group_name, display_name, headcount, stage, cancelled_at, deposit_amount, deposit_paid_at, balance_paid_at, event_date, event_time, event_minutes, preferred_date, preferred_time, options"
    )
    .eq("id", l.inquiry_id)
    .maybeSingle();
  if (gErr) throw new Error(gErr.message);
  if (!g) return null;
  const row = g as GroupCore & { group_name: string | null; display_name: string | null; headcount: number };
  const sch = scheduleOf(row);
  return {
    formKey: l.form_key,
    inquiryId: l.inquiry_id,
    groupName: row.display_name ?? row.group_name ?? "단체 모임",
    date: sch.date,
    time: sch.time,
    fixed: row.deposit_paid_at != null,
    headcount: row.headcount,
    cancelled: row.cancelled_at != null,
  };
}

export type ParticipantStatus = {
  count: number;
  /** 제출한 사람 — 가린 이름과 닉네임만. 낸 순서대로. */
  people: { name: string; nick: string }[];
};

/** 참가자 설문 첫 화면의 신청 현황. 이름은 **여기서 가려서** 돌려준다(전체 값은 서버 밖으로 나가지 않는다). */
export async function loadParticipantStatus(inquiryId: string): Promise<ParticipantStatus> {
  const { data, error } = await createAdminClient()
    .from("admin_group_participants_view")
    .select("name, nickname, submitted_at")
    .eq("inquiry_id", inquiryId)
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { name: string; nickname: string }[];
  return { count: rows.length, people: rows.map((r) => ({ name: maskName(r.name), nick: r.nickname })) };
}

/**
 * 횟수 제한에 쓰는 IP 해시. IP 를 그대로 저장하지 않는다 — 링크마다 다른 값이 되게 토큰과 섞어 해시한다.
 * Vercel 뒤에 있으므로 x-forwarded-for 의 맨 앞이 실제 클라이언트다(auditLog.ts 와 같다).
 */
export async function requestIpHash(token: string): Promise<string> {
  let ip = "unknown";
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    ip = (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) || "unknown";
  } catch {
    // 헤더를 못 읽어도 제출은 막지 않는다 — 링크 단위 제한은 그대로 걸린다.
  }
  return createHash("sha256").update(`${ip}|${token}`).digest("hex").slice(0, 40);
}
