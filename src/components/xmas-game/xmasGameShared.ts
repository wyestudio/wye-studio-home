/**
 * 「산타의 어드벤트 캘린더」 — 상세 페이지의 입구(XmasGameSection)와 게임 화면(XmasGame)이 같이 쓰는 값.
 *
 * ⚠️ 이 파일은 상세 페이지가 처음부터 내려받는다. 게임 본체(엔진 · 달력 그림 · 소리)를 여기서 import 하지 않는다 —
 *    게임을 안 하는 손님까지 받게 된다.
 */

import type { Kind } from "./xmasGameArt";

export const XMAS_GAME_TITLE = "산타의 어드벤트 캘린더";
/** 게임 화면의 제목(브라우저 탭 · 화면 위 이름 · 공유 카드 제목) — 이름만으로는 무엇인지 몰라 "게임" 을 붙인다(2026-11-27 대표님). */
export const XMAS_GAME_PAGE_TITLE = `${XMAS_GAME_TITLE} 게임`;

/**
 * 선물이 열리는 점수 — 다섯 라운드 합계(가장 많이 내면 52점). 엔진의 게이지와 화면 문구가 이 값을 쓴다.
 * 37점이었다가 35점으로 내렸다(2026-11-26 대표님 — 여러 번 해 본 사람도 3점 안쪽으로 겨우 넘었다).
 * ⚠️ 바꾸면 DB 의 xmas_game_claim 도 같이 고친다. 어긋나면 화면은 통과인데 코드가 안 나온다.
 */
export const XMAS_GIFT_GOAL = 35;

/**
 * 게임 화면의 주소. 상세 페이지에서 **새 창**으로 연다(src/app/santa-calendar).
 * ⚠️ 어드민 화면(/xmas-game — 어드민 호스트 전용)과 이름을 다르게 뒀다. 같으면 어느 쪽 이야기인지 헷갈린다.
 */
export const XMAS_GAME_PATH = "/santa-calendar";

/** 게임 화면에 "어느 화면에서 왔나" 를 넘기는 칸(?from=/themes/baotalchul). 돌아가기 · 공유 주소가 이 값을 쓴다. */
const FROM_PARAM = "from";

/** 입구의 id. 게임 화면의 돌아가기가 #xmas-game 으로 여기에 내려온다. */
export const XMAS_GAME_HASH = "xmas-game";

/**
 * 기록을 공유하는 주소 — /santa-calendar/r/7-61-3-d 는 "7라운드 61점, 랭킹 3위, 카드 그림은 루돌프".
 * 받은 사람은 **게임 화면으로 바로** 들어온다(2026-11-26 대표님). 공유 카드(제목 · 그림)가 이 기록으로 그려진다
 * (src/app/santa-calendar/r/[record]).
 * ⚠️ 기록을 ?칸이 아니라 경로에 싣는다 — ?칸을 서버가 읽으면 그 화면은 요청마다 다시 그려진다(wye-server-cost).
 *    경로는 주소마다 한 번 그려 두고 다시 쓴다.
 * ⚠️ 숫자와 그림 글자 하나뿐이다. 닉네임 같은 글을 싣지 않는다 — 아무나 주소를 지어 우리 이름이 박힌 카드에
 *    아무 말이나 띄울 수 있게 된다.
 */
export const XMAS_SHARE_PATH = `${XMAS_GAME_PATH}/r`;

/** 공유된 기록. rank 는 랭킹에 등록한 사람만 있다(없으면 null). who 는 공유 카드에 그릴 캐릭터. */
export type ShareRecord = { round: number; score: number; rank: number | null; who: Kind };

const WHO_BY_LETTER: Record<string, Kind> = { s: "snow", d: "deer", t: "santa" };
const LETTER_BY_WHO: Record<Kind, string> = { snow: "s", deer: "d", santa: "t" };
export const SHARE_CHARACTERS: Kind[] = ["snow", "deer", "santa"];

/** '7-61-3-d' → 기록. 모양이 다르면 null(그때는 기록 없는 게임 화면으로 보여 준다). */
export function parseShareRecord(text: string): ShareRecord | null {
  const m = /^([5-9]|1\d|20)-(-?\d{1,3})-(\d{1,4})-([sdt])$/.exec(text);
  if (!m) return null;
  const score = Number(m[2]);
  if (score < -80 || score > 337) return null;
  return { round: Number(m[1]), score, rank: Number(m[3]) || null, who: WHO_BY_LETTER[m[4]] };
}

export const shareRecordPath = (r: ShareRecord) =>
  `${XMAS_SHARE_PATH}/${r.round}-${r.score}-${r.rank ?? 0}-${LETTER_BY_WHO[r.who]}`;

/** 공유 카드 제목 · 같이 보내는 글의 첫 줄 — "랭킹 3위, 61점!" / 랭킹에 없으면 "7라운드 61점!" */
export const shareHeadline = (r: ShareRecord) =>
  r.rank ? `랭킹 ${r.rank}위, ${r.score}점!` : `${r.round}라운드 ${r.score}점!`;

/**
 * 분석 이벤트(pushGa4Event). 한 판에 많아야 서너 번 남는다. 어드민 > 크리스마스 게임의 「참여 현황」 이 이 이름들로
 * 센다(DB 의 xmas_game_funnel) — 이름을 바꾸면 그 함수도 같이 바꾼다.
 * ⚠️ 문을 누르는 것은 남기지 않는다(한 판에 80번이 넘는다) — 달력에 data-track-off 를 달아 방문 발자취에서도 뺐다.
 */
export const XMAS_GAME_EVENT = {
  /** 테마 상세의 이벤트 블록이 화면에 들어왔다(페이지 방문당 한 번) */
  view: "xmas_game_view",
  /** 게임 창을 열었다 */
  open: "xmas_game_open",
  /** 1라운드를 시작했다(다시하기 포함) */
  start: "xmas_game_start",
  /** 다섯 라운드를 마쳤고 선물 점수에 못 미쳤다 */
  fail: "xmas_game_fail",
  /** 다섯 라운드를 마쳤고 선물 점수를 넘겼다 */
  pass: "xmas_game_pass",
  /** 정답을 맞혀 선물 코드를 받았다 */
  gift: "xmas_game_gift",
  /** 이어하기(6~20라운드)가 끝났다 */
  final: "xmas_game_final",
  /** 선물 코드 밑의 「참여 신청하러 가기」 를 눌렀다 */
  apply: "xmas_game_apply",
  /** 닉네임을 넣어 랭킹에 올랐다 */
  rank: "xmas_game_rank",
  /** 공유하기를 눌렀다 */
  share: "xmas_game_share",
  /** 이어하기에서 떨어진 뒤 「공유하고 재도전하기」 로 공유를 시작했다. sectionKey = kakao | instagram */
  retryShare: "xmas_game_retry_share",
  /** 공유가 인정돼 떨어진 라운드를 다시 시작했다 */
  retry: "xmas_game_retry",
} as const;

/**
 * 카카오톡 공유에 실어 보내는 값의 이름(serverCallbackArgs) — 카카오가 웹훅(/api/xmas/kakao-share)으로 그대로 돌려준다.
 * 값은 DB 의 공유 표 번호(xmas_game_shares.token). 웹훅과 화면이 같은 이름을 써야 한다.
 */
export const XMAS_SHARE_ARG = "xmas_share";

/**
 * 입구에서 게임 화면으로 가는 주소. 지금 화면(모드 포함)을 from 으로 넘긴다 — 그쪽의 돌아가기 · 공유가 이 값을 쓴다.
 * 브라우저에서만 부른다.
 */
export function gameHref(): string {
  const params = new URLSearchParams();
  const mode = new URLSearchParams(window.location.search).get("mode");
  params.set(FROM_PARAM, window.location.pathname + (mode ? `?mode=${encodeURIComponent(mode)}` : ""));
  return `${XMAS_GAME_PATH}?${params}`;
}

/**
 * 게임 화면에서 — 들어온 화면의 경로. 없으면(주소를 직접 쳤으면) null.
 * ⚠️ 우리 사이트 안의 경로만 받는다("/…" 로 시작하고 "//" · 역슬래시가 없다). 그대로 이동에 쓰이는 값이라,
 *    바깥 주소를 받아 주면 우리 링크처럼 보이는 주소로 남의 사이트에 보낼 수 있다.
 */
export function returnPath(): string | null {
  const from = new URLSearchParams(window.location.search).get(FROM_PARAM) ?? "";
  return /^\/(?!\/)[^\\]{0,200}$/.test(from) ? from : null;
}

/**
 * 선물 코드를 받은 뒤 「참여 신청하러 가기」 가 보내는 곳 — 들어온 테마 상세의 회차 선택(#booking).
 * 테마 상세에서 온 게 아니면(주소를 직접 쳤다) 테마를 고르는 화면으로 보낸다.
 */
export function applyPath(): string {
  const from = returnPath();
  return from?.startsWith("/themes/") ? `${from}#booking` : "/contents";
}

/**
 * 내 기록을 공유할 주소 — 게임 화면으로 바로 들어오는 주소. 들어온 상세 페이지(from)를 그대로 실어 보내서,
 * 받은 사람이 「돌아가기」 를 누르면 그 상세 페이지의 이벤트 블록으로 간다.
 */
export function shareUrl(record: ShareRecord): string {
  const url = new URL(shareRecordPath(record), window.location.origin);
  const from = returnPath();
  if (from) url.searchParams.set(FROM_PARAM, from);
  return url.href;
}

/** 공유 링크(/santa-calendar/r/…)로 들어왔으면 친구의 기록. 아니면 null. 브라우저에서만 부른다. */
export function friendRecord(): ShareRecord | null {
  const path = window.location.pathname;
  return path.startsWith(`${XMAS_SHARE_PATH}/`) ? parseShareRecord(path.slice(XMAS_SHARE_PATH.length + 1)) : null;
}

/** 받은 선물 코드를 브라우저에 적어 두는 자리 — 창을 닫았다 와도 입구 카드와 결과 화면이 다시 보여 준다. */
export const GIFT_CODE_KEY = "wye_xmas_gift";

export function savedGiftCode(): string | null {
  try {
    return window.localStorage.getItem(GIFT_CODE_KEY);
  } catch {
    return null;
  }
}

/** 'ABCDEF' → 'ABC-DEF'. 읽어 주거나 받아 적기 쉽게 반으로 끊는다. */
export const formatGiftCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

/*
  닉네임 규칙(2026-11-27 대표님) — 서버(xmas_game_name)와 같은 목록이다. 한쪽만 고치면 "화면은 된다는데 등록이 안 되는" 이름이 생긴다.
    - 일반 띄어쓰기는 된다. 공백만 넣은 이름은 안 된다(여러 칸은 한 칸으로 줄이고 앞뒤는 자른다).
    - 보이지 않는 글자 · 띄어쓰기처럼 보이는 글자는 안 된다: 제어 문자 · 줄바꿈 · 폭 없는 공백 · 글자 방향 바꾸기 ·
      한글 채움 문자(U+3164 · U+115F · U+1160 · U+FFA0) · 점자 빈칸(U+2800) · 전각 공백(U+3000) · 이음표 같은 것들.
    - 위험한 글자는 안 된다: < > " ' ` \
  ⚠️ 글자를 직접 적지 않고 \u 로 적는다 — 보이지 않는 글자는 복사하다 사라진다.
*/
const NICK_FORBIDDEN =
  /[\u0000-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u061C\u115F\u1160\u1680\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0<>"'`\\]/;

/** 서버가 저장할 모양 — 여러 칸 띄어쓰기를 한 칸으로, 앞뒤 공백은 자른다. */
export const cleanNickname = (name: string) => name.replace(/ +/g, " ").trim();

/** 닉네임이 안 되는 이유. 되면 null. */
export function nicknameError(name: string): string | null {
  if (NICK_FORBIDDEN.test(name)) return "닉네임에 쓸 수 없는 글자가 있어요.";
  // 글자 수는 서버(char_length)처럼 센다 — 이모지를 두 글자로 세지 않게
  const length = [...cleanNickname(name)].length;
  if (length < 1 || length > 10) return "닉네임을 입력해 주세요. (10자 이내)";
  return null;
}
