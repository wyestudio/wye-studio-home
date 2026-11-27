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
/** top: 1~10위 / me: 내 자리 / around: 내 바로 위 · 나 · 바로 아래(10위 밖일 때 점 셋 밑에 보여 준다) */
export type Board = { ok?: boolean; players: number; top: BoardRow[]; me: BoardRow | null; around?: BoardRow[] };
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

/**
 * 판을 시작한다 — 번호와, 서버가 정한 20라운드 문 패(0 눈사람 · 1 루돌프 · 2 산타 · 3 글자 든 산타).
 * 점수는 서버가 이 문 패와 누른 기록으로 다시 센다(supabase/migrations/20261127055335_xmas_game_server_check.sql).
 * 못 받으면(null) 그 판은 랭킹 · 선물 없이 진행된다.
 */
export type Run = { id: string; decks: number[][] };

export async function startRun(page: string): Promise<Run | null> {
  const args = { p_player: playerId(), p_page: page };
  // 한 번 놓쳤다고 한 판이 통째로 기록 없이 가지 않게 한 번만 더 해 본다
  const run = (await rpc<Run>("xmas_game_start2", args)) ?? (await rpc<Run>("xmas_game_start2", args));
  return run && typeof run.id === "string" && Array.isArray(run.decks) ? run : null;
}

/** 라운드 하나의 기록 — o: 문이 열린 시각들(문 패 순서), h: [몇 번째 문, 누른 시각]들. ms, 라운드 시작 기준. */
export type RoundLog = { o: number[]; h: [number, number][] };

/** 지금 랭킹과 내 자리. 판을 시작할 때 읽어 두었다가, 끝났을 때 순위가 올랐는지 견준다. */
export function fetchBoard(): Promise<Board | null> {
  return rpc<Board>("xmas_game_board", { p_player: playerId() });
}

/** 누른 기록을 남기고 랭킹을 받는다. round 는 마친 라운드(5~20), log 는 1라운드부터 그 라운드까지. 점수는 서버가 센다. */
export function submitRun(run: string, round: number, log: RoundLog[]): Promise<Board | null> {
  return rpc<Board>("xmas_game_submit2", { p_run: run, p_player: playerId(), p_round: round, p_log: log });
}

/** 공유하고 재도전 — 떨어진 라운드의 새 문 패. 서버가 안 주면 null(그 라운드 기록은 랭킹에 안 올라간다). */
export async function retryDeck(run: string, round: number): Promise<number[] | null> {
  const deck = await rpc<number[]>("xmas_game_retry", { p_run: run, p_player: playerId(), p_round: round });
  return Array.isArray(deck) ? deck : null;
}

/** 닉네임을 등록하고(바꾸고) 랭킹을 받는다. ok 가 false 면 등록되지 않았다. */
export async function registerNickname(run: string, nickname: string): Promise<Board | null> {
  const board = await rpc<Board>("xmas_game_name", { p_run: run, p_player: playerId(), p_nickname: nickname });
  if (board?.ok && board.me) write(NICK_KEY, board.me.name);
  return board;
}

/**
 * 카카오톡 공유하고 재도전 — 공유 표를 하나 만든다(그 판이 정말 round 라운드에서 떨어졌을 때만). 표 번호를 카카오 공유에
 * 실어 보내면, 손님이 정말 보냈을 때 카카오가 웹훅으로 그 번호를 돌려준다(supabase/migrations/20261127043946_xmas_game_share_retry.sql).
 */
export function beginShare(run: string, round: number): Promise<string | null> {
  return rpc<string>("xmas_game_share_begin", { p_run: run, p_player: playerId(), p_round: round });
}

export type ShareStatus = "pending" | "ok" | "dup" | "memo";

/** 공유 표의 결과. pending 이면 아직 카카오 알림이 안 왔다(안 보냈거나 늦다). */
export function shareStatus(token: string): Promise<ShareStatus | null> {
  return rpc<ShareStatus>("xmas_game_share_status", { p_token: token, p_player: playerId() });
}

/** 정답을 낸다. 맞으면 선물 코드가 온다. */
export async function claimGift(run: string, answer: string): Promise<Claim | null> {
  const claim = await rpc<Claim>("xmas_game_claim", { p_run: run, p_player: playerId(), p_answer: answer });
  if (claim?.ok && claim.code) write(GIFT_CODE_KEY, claim.code);
  return claim;
}
