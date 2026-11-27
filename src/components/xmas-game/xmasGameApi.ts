/**
 * 「산타의 어드벤트 캘린더」 서버 쪽 — 판 기록 · 랭킹 · 선물 코드(supabase/migrations/20261126062217_xmas_game.sql).
 *
 * ⚠️ Vercel 서버(서버 액션 · API 라우트)를 거치지 않고 Supabase 함수를 **바로** 부른다.
 *    판 수만큼 함수가 돌면 무료 한도를 넘긴다(wye-server-cost). 공개 anon 키로 xmas_game_* 만 부를 수 있다.
 * ⚠️ 실패해도 게임은 멈추지 않는다 — 전부 null 을 돌려주고, 화면이 "지금은 랭킹을 불러올 수 없어요" 로 받는다.
 * ⚠️ 번호(wye_xmas_player)는 게임 전용이다. 방문 발자취의 번호(wye_vid)를 쓰지 않는다 —
 *    닉네임이 신청 정보와 이어지면 안 된다.
 */

import { GIFT_CODE_KEY } from "./xmasGameShared";

const PLAYER_KEY = "wye_xmas_player";
const NICK_KEY = "wye_xmas_nick";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type BoardRow = { rank: number; name: string; score: number; round: number; me?: boolean };
export type Board = { ok?: boolean; players: number; top: BoardRow[]; me: BoardRow | null };
export type Claim = { ok: boolean; code?: string; reason?: "score" | "tries" | "answer" };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ ((Math.random() * 16) >> (+c / 4))).toString(16),
      );
}

// 저장소가 막힌 브라우저에서는 창을 닫을 때까지만 같은 사람으로 센다
let memoryPlayer: string | null = null;

/** 이 브라우저의 게임 번호. */
export function playerId(): string {
  try {
    let id = window.localStorage.getItem(PLAYER_KEY);
    if (!id || !UUID.test(id)) {
      id = newId();
      window.localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    memoryPlayer ??= newId();
    return memoryPlayer;
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 못 해도 이번 화면에는 보인다 */
  }
}

/** 전에 등록한 닉네임 — 입력칸에 미리 넣어 준다. */
export const savedNickname = () => read(NICK_KEY) ?? "";

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 판을 시작한다. 번호를 못 받으면(null) 그 판은 랭킹 · 선물 없이 진행된다. */
export async function startRun(page: string): Promise<string | null> {
  const args = { p_player: playerId(), p_page: page };
  // 한 번 놓쳤다고 한 판이 통째로 기록 없이 가지 않게 한 번만 더 해 본다
  return (await rpc<string>("xmas_game_start", args)) ?? (await rpc<string>("xmas_game_start", args));
}

/** 지금 랭킹과 내 자리. 판을 시작할 때 읽어 두었다가, 끝났을 때 순위가 올랐는지 견준다. */
export function fetchBoard(): Promise<Board | null> {
  return rpc<Board>("xmas_game_board", { p_player: playerId() });
}

/** 점수를 남기고 랭킹을 받는다. round 는 마친 라운드(5~20). */
export function submitScore(run: string, round: number, score: number, combo: number): Promise<Board | null> {
  return rpc<Board>("xmas_game_submit", { p_run: run, p_player: playerId(), p_round: round, p_score: score, p_combo: combo });
}

/** 닉네임을 등록하고(바꾸고) 랭킹을 받는다. ok 가 false 면 등록되지 않았다. */
export async function registerNickname(run: string, nickname: string): Promise<Board | null> {
  const board = await rpc<Board>("xmas_game_name", { p_run: run, p_player: playerId(), p_nickname: nickname });
  if (board?.ok && board.me) write(NICK_KEY, board.me.name);
  return board;
}

/** 정답을 낸다. 맞으면 선물 코드가 온다. */
export async function claimGift(run: string, answer: string): Promise<Claim | null> {
  const claim = await rpc<Claim>("xmas_game_claim", { p_run: run, p_player: playerId(), p_answer: answer });
  if (claim?.ok && claim.code) write(GIFT_CODE_KEY, claim.code);
  return claim;
}
