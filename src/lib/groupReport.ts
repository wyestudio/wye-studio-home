/**
 * 플레이 리포트와 주고받는 값(관리자 개편 docs/02 11장). 전부 순수 함수다.
 *
 * 리포트 틀은 대표님이 만든 단일 HTML(그 자체가 편집기)이고, 관리자 화면 안의 격리된 틀(iframe)에서 돈다.
 * 처음 열 때는 단체 정보 · 팀 편성으로 채워 주고, 닫을 때 **글자 · 팀 · 점수만** 단체별로 저장한다.
 * 사진은 저장하지 않는다(얼굴이 들어간다 — 2026-11-27 대표님). 사진은 그 화면에서 [HTML 저장] · [PDF / 인쇄] 로 보관한다.
 */
import { BASE_MINUTES, OPTION, addMinutes } from "@/lib/groupPricing";
import { teamLabel, type Team, type TeamPerson } from "@/lib/groupTeams";

export const REPORT_FILE = "play-report.html";

/** HOST 칸의 기본 문구(2026-11-27 대표님). 리포트에서 고칠 수 있다. */
export const REPORT_HOST = "진행 MC NOIS · 스태프 MAKE · 스태프 TING";
/** 틀의 기본 문구 · 게임 — 우주이스케이프 단체 대관 프로그램 기준. 리포트에서 고칠 수 있다. */
export const REPORT_DEFAULT_TEXTS = {
  kicker: "★ 우주이스케이프 주관 ★",
  sub: "바-ㅇ탈출 단체 대관 프로그램",
  v2: "우주이스케이프",
  msg: "함께해 주신 모든 분들께 감사드립니다. 다들 즐거운 시간 되셨길 바랍니다.",
} as const;
export const REPORT_DEFAULT_GAMES = ["목격! 나도!", "스탑 앤 고!", "미니게임", "보물찾기", "바-ㅇ탈출"] as const;

export type ReportTeam = { name: string; members: string; award: string; comment: string };
export type ReportState = {
  theme: "dark" | "light";
  pri: string;
  perPage: number;
  photoPages: number;
  sbSort: "rank" | "team";
  texts: Record<string, string>;
  games: { name: string }[];
  teams: ReportTeam[];
  scores: string[][];
};
export type ReportFill = { texts: Record<string, string>; games: { name: string }[]; teams: ReportTeam[] };

const cut = (v: unknown, max: number) =>
  Array.from(String(v ?? "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")).slice(0, max).join("");
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** '2026. 12. 03 (목) 15:00 – 18:00' */
export function reportDateText(date: string | null, time: string | null, minutes: number): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  const dow = DOW[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${y}. ${m}. ${d} (${dow})${time ? ` ${time} – ${addMinutes(time, minutes)}` : ""}`;
}

/** 처음 열 때 채울 값. 모두 리포트에서 고칠 수 있다. */
export function buildReportFill(input: {
  /** 화면 표시 모임명, 없으면 모임명. 둘 다 없으면 빈 글. */
  title: string;
  date: string | null;
  time: string | null;
  headcount: number;
  /** 레크리에이션을 하는가(안 하면 플레이 타임이 150분). */
  icebreaking: boolean;
  teams: readonly Team[];
  people: readonly TeamPerson[];
  /** 단체 도구 › 플레이 리포트에서 고친 기본값. 없으면 이 파일의 기본값. */
  defaults?: { host: string; kicker: string; sub: string; place: string; msg: string; games: readonly string[] };
}): ReportFill {
  const d = input.defaults;
  const play = BASE_MINUTES - (input.icebreaking ? 0 : OPTION.icebreaking.minutes);
  const texts: Record<string, string> = {
    ...REPORT_DEFAULT_TEXTS,
    ...(d ? { kicker: d.kicker, sub: d.sub, v2: d.place, msg: d.msg } : {}),
    // 모임 이름이 아직 없으면 이름 자리를 비워 둔다('단체 모임 단체모임' 처럼 겹치지 않게).
    brandKo: input.title ? `우주이스케이프 x ${input.title}` : "우주이스케이프",
    title: input.title ? `${input.title} 단체모임` : "단체모임",
    v3: d ? d.host : REPORT_HOST,
    s1v: `${input.headcount}명`,
    s4v: `${play}분`,
  };
  const when = reportDateText(input.date, input.time, play);
  if (when) texts.v1 = when;
  return { texts, games: (d?.games.length ? d.games : REPORT_DEFAULT_GAMES).map((name) => ({ name })), teams: reportTeams(input.teams, input.people) };
}

/** 팀 편성 → 리포트의 팀(팀명 · 팀원 닉네임 · 구호). 이름 · 연락처는 쓰지 않는다. */
export function reportTeams(teams: readonly Team[], people: readonly TeamPerson[]): ReportTeam[] {
  const byId = new Map(people.map((p) => [p.id, p.nick]));
  return teams.slice(0, 10).map((t, i) => ({
    name: teamLabel(t, i),
    members: t.members.map((id) => byId.get(id)).filter(Boolean).join(" · "),
    award: "",
    comment: t.slogan.trim() ? `"${t.slogan.trim()}"` : "",
  }));
}

/**
 * 리포트가 돌려준 상태를 저장하기 전에 **아는 모양만** 남긴다. 모양이 아니면 null.
 * ⚠️ 사진(photos · teams[].photo)은 여기서 반드시 빠진다 — 아는 칸만 옮겨 담기 때문이다.
 */
export function cleanReportState(raw: unknown): ReportState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.teams) || !Array.isArray(s.games)) return null;
  const texts: Record<string, string> = {};
  if (s.texts && typeof s.texts === "object") {
    for (const [k, v] of Object.entries(s.texts as Record<string, unknown>).slice(0, 80)) {
      if (/^[A-Za-z0-9]{1,20}$/.test(k) && typeof v === "string") texts[k] = cut(v, 500);
    }
  }
  const games = s.games.slice(0, 8).map((g) => ({ name: cut((g as { name?: unknown } | null)?.name, 40) }));
  const teams = s.teams.slice(0, 10).map((t) => {
    const r = (t ?? {}) as Record<string, unknown>;
    return { name: cut(r.name, 40), members: cut(r.members, 300), award: cut(r.award, 60), comment: cut(r.comment, 120) };
  });
  if (games.length === 0 || teams.length === 0) return null;
  const rows = Array.isArray(s.scores) ? s.scores : [];
  const scores = teams.map((_, i) => games.map((_, j) => cut(Array.isArray(rows[i]) ? (rows[i] as unknown[])[j] : "0", 12) || "0"));
  const perPage = [4, 6, 9, 12].includes(Number(s.perPage)) ? Number(s.perPage) : 9;
  const photoPages = Math.min(8, Math.max(1, Math.trunc(Number(s.photoPages) || 2)));
  return {
    theme: s.theme === "light" ? "light" : "dark",
    pri: typeof s.pri === "string" && /^#[0-9a-fA-F]{6}$/.test(s.pri) ? s.pri : "#ffd84a",
    perPage,
    photoPages,
    sbSort: s.sbSort === "team" ? "team" : "rank",
    texts,
    games,
    teams,
    scores,
  };
}
