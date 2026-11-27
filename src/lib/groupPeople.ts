import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskContact } from "@/lib/groupStage";
import { isNametagMode, type NametagMode, type Team } from "@/lib/groupTeams";

/**
 * 단체 참가자 · 팀 편성 — 어드민 서버가 읽는 길(관리자 개편 6단계).
 *
 * ⚠️ 전화번호는 **가려서**(010-****-1234) 넘긴다. 전체 값은 「보기」 를 눌렀을 때와 CSV 저장 때만 서버 액션이
 *    따로 읽어 내려주고, 그때마다 감사로그에 남긴다.
 * ⚠️ 팀 편성 · 명찰에는 닉네임과 방수만 쓴다. 이름 · 전화번호는 넘기지 않는다.
 */

export type ParticipantRow = {
  id: string;
  name: string;
  phoneMasked: string;
  nick: string;
  ageBand: string;
  count: number;
  photo: boolean;
  submittedAt: string;
  updatedAt: string;
  edited: boolean;
  /** 낸 지(고친 지) 한 시간이 안 됐다. */
  recent: boolean;
  /** 양식에 더한 질문의 답(질문 id → 답). 없으면 빈 객체. */
  answers: Record<string, unknown>;
};

type ViewRow = {
  id: string;
  name: string;
  phone: string;
  nickname: string;
  age_band: string;
  room_count: number;
  consent_photo: boolean;
  submitted_at: string;
  updated_at: string;
  edited: boolean;
  answers: Record<string, unknown> | null;
};

/** 참가자 목록(낸 순서). 전화번호는 가린 값이다. */
export async function loadParticipants(inquiryId: string): Promise<ParticipantRow[]> {
  const { data, error } = await createAdminClient()
    .from("admin_group_participants_view")
    .select("id, name, phone, nickname, age_band, room_count, consent_photo, submitted_at, updated_at, edited, answers")
    .eq("inquiry_id", inquiryId)
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(error.message);
  const now = Date.now();
  return ((data ?? []) as ViewRow[]).map((r) => ({
    recent: now - new Date(r.updated_at).getTime() < 3_600_000,
    answers: r.answers ?? {},
    id: r.id,
    name: r.name,
    phoneMasked: maskContact("phone", r.phone),
    nick: r.nickname,
    ageBand: r.age_band,
    count: r.room_count,
    photo: r.consent_photo,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
    edited: r.edited,
  }));
}

/** 팀 편성 · 명찰에 쓰는 최소한 — 닉네임과 방수만(이름 · 전화번호를 읽지 않는다). */
export async function loadTeamPeople(inquiryId: string): Promise<{ id: string; nick: string; count: number }[]> {
  const { data, error } = await createAdminClient()
    .from("group_participants")
    .select("id, nickname, room_count, submitted_at")
    .eq("inquiry_id", inquiryId)
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; nickname: string; room_count: number }[]).map((r) => ({ id: r.id, nick: r.nickname, count: r.room_count }));
}

/** 저장된 편성. 한 번도 고치지 않았으면 null(= 추천 편성 상태). */
export async function loadSavedTeams(inquiryId: string): Promise<Team[] | null> {
  const supabase = createAdminClient();
  const { data: teams, error } = await supabase.from("group_teams").select("id, idx, name, slogan").eq("inquiry_id", inquiryId).order("idx");
  if (error) throw new Error(error.message);
  const list = (teams ?? []) as { id: string; idx: number; name: string | null; slogan: string | null }[];
  if (list.length === 0) return null;
  const { data: members, error: mErr } = await supabase
    .from("group_team_members")
    .select("participant_id, team_id, pos")
    .in(
      "team_id",
      list.map((t) => t.id)
    )
    .order("pos");
  if (mErr) throw new Error(mErr.message);
  const rows = (members ?? []) as { participant_id: string; team_id: string }[];
  return list.map((t) => ({
    name: t.name ?? "",
    slogan: t.slogan ?? "",
    members: rows.filter((m) => m.team_id === t.id).map((m) => m.participant_id),
  }));
}

/** 명찰 색 기준(초심자 / 숙련자). */
export async function loadNametagMode(inquiryId: string): Promise<NametagMode> {
  const { data, error } = await createAdminClient().from("group_booking_inquiries").select("nametag_mode").eq("id", inquiryId).maybeSingle();
  if (error) throw new Error(error.message);
  const mode = String((data as { nametag_mode?: string } | null)?.nametag_mode ?? "");
  return isNametagMode(mode) ? mode : "experienced";
}
