/**
 * 단체 팀 편성과 명찰 색의 규칙(관리자 개편 docs/02 9~10장). 전부 순수 함수다 — 화면과 서버가 같이 쓴다.
 *
 * 팀 수: 올림(인원 ÷ 4), 최대 6팀. 팀당 4명까지 권장(보통 3~4명).
 * 나누는 법: 방수(방탈출 횟수)가 높은 순으로 한 바퀴에 한 명씩 돌리되, 그때까지 경험이 가장 적게 모인 팀이
 *   다음 고수를 받는다. 팀 인원 차이는 1명 이내. 경험은 log2(1 + 방수)로 센다 — 500방 한 명이 팀 전체를
 *   덮어 버리지 않게(시안의 suggestTeams 와 같은 셈이다).
 */

export const TEAM_SIZE = 4;
export const TEAM_MAX = 6;
export const TEAM_NAME_MAX = 16;
export const TEAM_SLOGAN_MAX = 30;

export type TeamPerson = { id: string; nick: string; count: number };
export type Team = { name: string; slogan: string; members: string[] };

export const teamCountFor = (people: number) => Math.min(TEAM_MAX, Math.max(1, Math.ceil(people / TEAM_SIZE)));

/**
 * 추천 편성. `count` 를 주면 그 팀 수로, 안 주면 인원에 맞는 팀 수로 나눈다.
 * `keep` 을 주면 팀명 · 구호는 그대로 둔다(배치만 다시 한다).
 */
export function suggestTeams(people: readonly TeamPerson[], count?: number, keep?: readonly Pick<Team, "name" | "slogan">[]): Team[] {
  const k = Math.min(TEAM_MAX, Math.max(1, count ?? teamCountFor(people.length)));
  const teams: Team[] = Array.from({ length: k }, (_, i) => ({ name: keep?.[i]?.name ?? "", slogan: keep?.[i]?.slogan ?? "", members: [] }));
  const total = Array<number>(k).fill(0);
  // 방수가 같으면 들어온 순서를 지킨다(Array.prototype.sort 는 순서를 지키는 정렬이다).
  const sorted = [...people].sort((a, b) => b.count - a.count);
  for (let r = 0; r * k < sorted.length; r++) {
    const order = teams.map((_, i) => i).sort((x, y) => total[x] - total[y] || x - y);
    sorted.slice(r * k, r * k + k).forEach((p, j) => {
      teams[order[j]].members.push(p.id);
      total[order[j]] += Math.log2(1 + Math.max(0, p.count));
    });
  }
  return teams;
}

/**
 * 저장된 편성을 지금 참가자에 맞춘다 — 없어진 참가자 · 두 번 들어간 참가자를 빼고, 아무 팀에도 없는 사람은 미배정으로 모은다.
 */
export function reconcileTeams(saved: readonly Team[], people: readonly TeamPerson[]): { teams: Team[]; free: string[] } {
  const ids = new Set(people.map((p) => p.id));
  const used = new Set<string>();
  const teams = saved.map((t) => ({
    ...t,
    members: t.members.filter((id) => {
      if (!ids.has(id) || used.has(id)) return false;
      used.add(id);
      return true;
    }),
  }));
  return { teams, free: people.filter((p) => !used.has(p.id)).map((p) => p.id) };
}

/** 한 사람을 다른 팀(또는 미배정: to = -1)으로 옮긴다. */
export function moveMember(teams: readonly Team[], id: string, to: number): Team[] {
  return teams.map((t, i) => {
    const members = t.members.filter((m) => m !== id);
    return { ...t, members: i === to ? [...members, id] : members };
  });
}

/** 미배정 인원을 인원이 적은 팀부터(같으면 방수 합이 적은 팀부터) 넣는다. 방수가 높은 사람부터 넣는다. */
export function fillTeams(teams: readonly Team[], free: readonly string[], people: readonly TeamPerson[]): Team[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const out = teams.map((t) => ({ ...t, members: [...t.members] }));
  if (out.length === 0) return out;
  const sum = (t: Team) => t.members.reduce((a, id) => a + (byId.get(id)?.count ?? 0), 0);
  [...free]
    .sort((a, b) => (byId.get(b)?.count ?? 0) - (byId.get(a)?.count ?? 0))
    .forEach((id) => {
      const target = [...out].sort((a, b) => a.members.length - b.members.length || sum(a) - sum(b))[0];
      target.members.push(id);
    });
  return out;
}

export const teamLabel = (t: Pick<Team, "name">, i: number) => t.name.trim() || `${i + 1}팀`;

/** 「팀 명단 복사」 — `팀명 "구호"` 줄과 닉네임 목록. */
export function teamsText(teams: readonly Team[], people: readonly TeamPerson[]): string {
  const byId = new Map(people.map((p) => [p.id, p]));
  return teams
    .map((t, i) => {
      const nicks = t.members.map((id) => byId.get(id)?.nick).filter(Boolean);
      return `${teamLabel(t, i)}${t.slogan.trim() ? ` "${t.slogan.trim()}"` : ""}\n${nicks.length ? nicks.join(", ") : "(팀원 없음)"}`;
    })
    .join("\n\n");
}

// ── 명찰 색 ──────────────────────────────────────────────────────

export type NametagMode = "beginner" | "experienced";
export const NAMETAG_MODES: { code: NametagMode; label: string; desc: string }[] = [
  { code: "experienced", label: "숙련자", desc: "흰 0~50 · 베이지 51~100 · 갈색 101~200 · 연회색 201~500 · 검회색 501 이상" },
  { code: "beginner", label: "초심자", desc: "흰 0 · 베이지 1~10 · 갈색 11~20 · 연회색 21~50 · 검회색 51 이상" },
];
export const isNametagMode = (v: string): v is NametagMode => v === "beginner" || v === "experienced";

/** 색 이름과 그 색의 상한(방수). 명찰 제작기(강아지_명찰_제작기.html)의 기준과 같아야 한다. */
export const NAMETAG_COLORS = ["흰색", "베이지색", "갈색", "연회색", "검회색"] as const;
const LIMITS: Record<NametagMode, readonly number[]> = {
  experienced: [50, 100, 200, 500, Infinity],
  beginner: [0, 10, 20, 50, Infinity],
};

/** 방수 → 명찰 색의 순번(0 흰색 … 4 검회색). */
export function nametagTier(count: number, mode: NametagMode): number {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return LIMITS[mode].findIndex((limit) => n <= limit);
}
export const nametagColor = (count: number, mode: NametagMode) => NAMETAG_COLORS[nametagTier(count, mode)];
