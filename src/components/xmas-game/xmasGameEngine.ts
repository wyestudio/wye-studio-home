import type { Kind } from "./xmasGameArt";
import type { GameMusic } from "./xmasGameAudio";
import { XMAS_GIFT_GOAL } from "./xmasGameShared";

/**
 * 「산타의 어드벤트 캘린더」 진행 — 문을 열고 닫는 시계, 점수 · 콤보, 라운드 넘김.
 *
 * 규칙(2026-11-26 대표님 · 승인 시안)
 *   - 문이 하나씩 열리고 눈사람 · 루돌프 · 산타 중 하나가 나온다. 눈사람 · 루돌프는 +1, 산타는 −1.
 *   - 다섯 라운드. 라운드마다 산타 한 명이 글자가 적힌 선물을 든다(X · - · M · A · S).
 *   - 다섯 라운드 합계가 35점(낼 수 있는 52점 중) 이상이면 정답을 넣을 기회가 열린다.
 *   - 다섯 라운드를 통과했으면 6~20라운드를 이어 할 수 있다(랭킹 도전) — 정답을 맞혔든, 정답을 건너뛰고 기록만 남겼든.
 *     라운드마다 통과선(그 라운드 점수의 25%)을 넘겨야 다음으로 간다.
 *
 * 화면(React)과는 view 한 덩어리로만 이야기한다 — 바뀔 때마다 새 객체를 만들어 알린다.
 * 서버(랭킹 · 선물 코드)는 모른다. 판이 시작되고 끝나는 순간만 onEvent 로 알린다.
 *
 * ⚠️ ROUNDS 의 n(문 수) · 라운드 수 · 선물 점수(XMAS_GIFT_GOAL)를 바꾸면 DB 의 xmas_game_submit(v_max · 라운드 범위) ·
 *    xmas_game_claim(35)을 같이 고친다 — 어긋나면 정상 점수가 "나올 수 없는 값" 으로 버려진다. maxScoreThrough() 로 확인한다.
 *    show · gap(속도)만 바꾸는 것은 DB 와 상관없다.
 *
 * 속도와 통과선을 이렇게 둔 이유(2026-11-26 대표님)
 *   - **라운드가 진행될수록 반드시 빨라진다.** 한 번이라도 느려지면 안 된다 — 성공률이 떨어지는 것보다 이게 먼저다.
 *     show 를 고칠 때 앞 라운드보다 큰 값을 넣지 않는다(5 → 6라운드 사이도 마찬가지).
 *   - 1~5라운드는 0.48초까지 빨라진다. 5라운드는 대부분 놓치는 속도지만 선물은 합계(35점)로 가르니 그래도 된다.
 *   - 6라운드부터는 0.465초에서 라운드마다 5ms 씩 줄어 20라운드 0.395초가 된다. 사람 손으로는 대부분 놓치는 속도라
 *     통과선을 70% 에서 25% 로 내렸다(BONUS_PASS_RATE) — 70% 면 다섯 판을 해도 6라운드를 넘는 사람이 100명에 6명,
 *     10라운드는 0명에 가까워 7~20라운드가 있으나 마나다(대표님 기록: 0.445초에서 14개 중 0~4개).
 *   - 어림(대표님의 일곱 판에 맞춘 것 — 누르기까지 걸리는 시간의 중앙값 0.58초): 두세 판 안에 80% 가 선물을 받고,
 *     선물 받은 사람이 이어하기를 다섯 판 하면 17라운드 이상 9%, 20라운드 도달 6%. 손님이 그보다 빠르거나 느리면
 *     크게 달라진다 — 어드민 > 크리스마스 게임의 「난이도 확인」 을 보고 show · BONUS_PASS_RATE 를 고친다.
 */

/** n: 그 라운드에 열리는 문 수 / show: 문이 열려 있는 시간(ms) / gap: 다음 문까지 쉬는 시간(ms) */
export const ROUNDS = [
  { n: 12, show: 1620, gap: 330 },
  { n: 14, show: 1230, gap: 225 },
  { n: 16, show: 920, gap: 155 },
  { n: 18, show: 680, gap: 110 },
  { n: 20, show: 480, gap: 85 },
  // 여기부터 이어하기(랭킹 도전) — 5라운드보다 빠른 데서 시작해 5ms 씩 줄어든다
  { n: 22, show: 465, gap: 80 },
  { n: 24, show: 460, gap: 80 },
  { n: 26, show: 455, gap: 80 },
  { n: 28, show: 450, gap: 75 },
  { n: 30, show: 445, gap: 75 },
  { n: 30, show: 440, gap: 75 },
  { n: 30, show: 435, gap: 75 },
  { n: 30, show: 430, gap: 75 },
  { n: 30, show: 425, gap: 70 },
  { n: 30, show: 420, gap: 70 },
  { n: 30, show: 415, gap: 70 },
  { n: 30, show: 410, gap: 70 },
  { n: 30, show: 405, gap: 70 },
  { n: 30, show: 400, gap: 70 },
  { n: 30, show: 395, gap: 70 },
];
/** 선물이 걸린 라운드 수. 그 뒤(6~20)는 랭킹 도전이다. */
export const GIFT_ROUNDS = 5;
/** 라운드 순서대로 산타가 드는 글자(1~5라운드). 손님이 직접 보고 읽는 값이라 감추는 값이 아니다. */
const LETTERS = "X-MAS";
/** 이어하기에서 다음 라운드로 넘어가는 선 — 그 라운드에서 낼 수 있는 점수의 25%(올림). */
const BONUS_PASS_RATE = 0.25;
const KINDS: Kind[] = ["snow", "deer", "santa"];
const BEST_KEY = "wye.advent.personalBest.v1";

export type Card = { kind: Kind; letter?: string };
export type Shown = { card: Card; hit: boolean };
export type Phase = "rules" | "countdown" | "play" | "fail" | "charge" | "puzzle" | "result";

export type GameView = {
  phase: Phase;
  /** 지금 라운드(1부터) */
  round: number;
  roundTotal: number;
  points: number;
  /** 게이지 목표 — 1~5라운드는 합계 35점(XMAS_GIFT_GOAL), 6라운드부터는 그 라운드의 통과선(BONUS_PASS_RATE) */
  goal: number;
  /** 게이지에 찬 양(0~goal) */
  gauge: number;
  /** 이번 라운드에서만 얻은 점수(6라운드부터 쓴다) */
  roundPoints: number;
  gaugeLabel: string;
  combo: number;
  peakCombo: number;
  /** 콤보가 오를 때마다 +1 — 같은 자리의 숫자를 다시 튕기는 열쇠 */
  comboSeq: number;
  /** 산타를 누를 때마다 +1 — 판을 한 번 흔드는 열쇠 */
  santaSeq: number;
  counter: string;
  counterSeq: number;
  /** 문 25칸에 마지막으로 나온 것. 문이 닫히는 동안에도 보여야 해서 닫혀도 남겨 둔다 */
  tiles: (Shown | null)[];
  openPos: number;
  /** 문이 열리고 닫히는 시간(ms) — 라운드가 빨라질수록 짧다 */
  swingMs: number;
  status: string;
  result: { kind: "win" | "final"; title: string } | null;
  /** '최고점수 갱신' 딱지 */
  record: boolean;
};

export type GameEvent =
  | { type: "start" }
  /** 다섯 라운드를 마쳤다. passed 면 정답 화면으로 간다 */
  | { type: "five"; points: number; peak: number; passed: boolean }
  /** 이어하기가 끝났다(탈락했거나 마지막 라운드를 깼다) */
  | { type: "final"; round: number; points: number; peak: number };

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 한 라운드의 패. 눈사람 · 루돌프 · 산타를 고루 섞고, 글자 든 산타 한 장을 맨 앞뒤가 아닌 곳에 끼운다. */
function makeDeck(r: number): Card[] {
  const cards: Card[] = Array.from({ length: ROUNDS[r].n - 1 }, (_, i) => ({ kind: KINDS[i % 3] }));
  shuffle(cards);
  cards.splice(2 + Math.floor(Math.random() * (cards.length - 3)), 0, { kind: "santa", letter: LETTERS[r] });
  return cards;
}

const scorable = (cards: Card[]) => cards.filter((c) => c.kind !== "santa").length;
const threshold = (cards: Card[]) => Math.ceil(scorable(cards) * BONUS_PASS_RATE);

/** round 라운드(1부터)까지 낼 수 있는 가장 높은 점수. DB 의 v_max 와 맞는지 볼 때 쓴다. */
export function maxScoreThrough(round: number): number {
  let sum = 0;
  for (let r = 0; r < round; r++) sum += scorable(makeDeck(r));
  return sum;
}

const READY_STATUS = "문이 열리면 캐릭터를 터치하세요. 산타의 선물도 눈여겨보세요!";

export type Game = ReturnType<typeof createGame>;

export function createGame(music: GameMusic) {
  const listeners = new Set<() => void>();
  // 판이 시작되고 끝나는 순간을 듣는 쪽(화면). 화면이 바뀔 때마다 갈아 끼운다
  let onEvent: (e: GameEvent) => void = () => {};
  let r = 0;
  let deck: Card[] = [];
  let decks: Card[][] = [];
  let last = -1;
  let roundStart = 0;
  let best = 0;
  // 지금 걸려 있는 시계 하나 — 화면이 가려지면 남은 시간을 적어 두고 멈췄다가 이어 간다
  let timer: ReturnType<typeof setTimeout> | undefined;
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;
  let due = 0;
  let remaining = 0;
  let next: (() => void) | null = null;
  let suspended = false;

  let view: GameView = {
    phase: "rules",
    round: 1,
    roundTotal: GIFT_ROUNDS,
    points: 0,
    goal: 1,
    gauge: 0,
    roundPoints: 0,
    gaugeLabel: "선물 게이지",
    combo: 0,
    peakCombo: 0,
    comboSeq: 0,
    santaSeq: 0,
    counter: "",
    counterSeq: 0,
    tiles: Array<Shown | null>(25).fill(null),
    openPos: -1,
    swingMs: 160,
    status: READY_STATUS,
    result: null,
    record: false,
  };

  function set(patch: Partial<GameView>) {
    view = { ...view, ...patch };
    listeners.forEach((l) => l());
  }

  function schedule(fn: () => void, ms: number) {
    clearTimeout(timer);
    next = fn;
    remaining = ms;
    due = performance.now() + ms;
    timer = setTimeout(fn, ms);
  }

  /** 점수가 바뀐 뒤 게이지를 다시 잰다. */
  function scored(points: number, goal = view.goal): Pick<GameView, "points" | "goal" | "gauge" | "roundPoints"> {
    const roundPoints = points - roundStart;
    return { points, goal, roundPoints, gauge: Math.max(0, Math.min(r < GIFT_ROUNDS ? points : roundPoints, goal)) };
  }

  function checkRecord() {
    try {
      best = Math.max(best, Number(window.localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* 저장소가 막혔으면 이번 창에서 낸 점수끼리만 견준다 */
    }
    if (view.points <= best) return;
    best = view.points;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      /* 위와 같다 */
    }
    set({ record: true });
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => set({ record: false }), 1350);
  }

  function reset() {
    music.rewind();
    clearTimeout(timer);
    clearTimeout(badgeTimer);
    next = null;
    suspended = false;
    r = 0;
    last = -1;
    roundStart = 0;
    decks = ROUNDS.map((_, i) => makeDeck(i));
    set({
      phase: "rules",
      round: 1,
      roundTotal: GIFT_ROUNDS,
      ...scored(0, XMAS_GIFT_GOAL),
      gaugeLabel: "선물 게이지",
      combo: 0,
      peakCombo: 0,
      counter: "",
      tiles: Array<Shown | null>(25).fill(null),
      openPos: -1,
      status: READY_STATUS,
      result: null,
      record: false,
    });
  }

  /**
   * 라운드 앞의 카운트다운. cleared 가 있으면(이어하기에서 그 라운드를 통과했다) 맨 앞에 "N라운드 통과!" 를 먼저 띄운다
   * — 통과했는지 말해 주지 않고 바로 다음 라운드 숫자가 뜨면 넘어간 줄도 모른다(2026-11-26 대표님).
   */
  function countdown(cleared = 0) {
    music.start();
    set({ phase: "countdown" });
    if (cleared) music.cue("pass");
    const words = [...(cleared ? [`${cleared}라운드 통과!`] : []), `ROUND ${r + 1}`, "3", "2", "1", "START!"];
    let index = 0;
    const step = () => {
      if (index === words.length) {
        startRound();
        return;
      }
      const word = words[index++];
      // 점수판은 'ROUND n' 이 뜨는 순간에 다음 라운드로 넘긴다 — "통과!" 가 떠 있는 동안에는 꽉 찬 게이지가 그대로 보인다
      if (word.startsWith("ROUND")) {
        if (r >= GIFT_ROUNDS) {
          // 이어하기 — 게이지를 이 라운드의 통과선으로 바꾼다
          roundStart = view.points;
          set({ ...scored(view.points, threshold(decks[r])), gaugeLabel: `${r + 1}라운드 통과 게이지` });
        }
        set({ round: r + 1, roundTotal: r < GIFT_ROUNDS ? GIFT_ROUNDS : ROUNDS.length });
      }
      set({ counter: word, counterSeq: view.counterSeq + 1 });
      schedule(step, /^\d$/.test(word) ? 720 : word === "START!" ? 600 : 850);
    };
    step();
  }

  function startRound() {
    deck = decks[r];
    set({
      phase: "play",
      swingMs: Math.round(ROUNDS[r].show * 0.14),
      status: `${r + 1}라운드 · 열린 문을 찾아보세요!`,
    });
    spawn();
  }

  function spawn() {
    const card = deck.pop();
    if (!card) {
      finishRound();
      return;
    }
    // 방금 열린 문은 피한다
    const pos = (last + 1 + Math.floor(Math.random() * (last < 0 ? 25 : 24))) % 25;
    last = pos;
    const tiles = view.tiles.slice();
    tiles[pos] = { card, hit: false };
    set({ tiles, openPos: pos });
    schedule(hide, ROUNDS[r].show);
  }

  function hide() {
    const shown = view.openPos >= 0 ? view.tiles[view.openPos] : null;
    // 눈사람 · 루돌프를 놓치면 콤보가 끊긴다. 산타는 안 누르는 게 맞다
    const broken = shown && !shown.hit && shown.card.kind !== "santa";
    set({ openPos: -1, ...(broken ? { combo: 0 } : null) });
    schedule(spawn, ROUNDS[r].gap);
  }

  function tap(pos: number) {
    if (view.phase !== "play" || view.openPos !== pos) return;
    const shown = view.tiles[pos];
    if (!shown || shown.hit) return;
    const { card } = shown;
    const santa = card.kind === "santa";
    const combo = santa ? 0 : view.combo + 1;
    music.hit(card.kind, combo);
    const tiles = view.tiles.slice();
    tiles[pos] = { card, hit: true };
    set({
      tiles,
      combo,
      peakCombo: Math.max(view.peakCombo, combo),
      comboSeq: santa ? view.comboSeq : view.comboSeq + 1,
      santaSeq: santa ? view.santaSeq + 1 : view.santaSeq,
      ...scored(view.points + (santa ? -1 : 1)),
    });
    // 글자 든 산타는 눌러도 원래 시간만큼 보여 준다(글자를 읽어야 한다). 나머지는 금방 닫는다
    schedule(hide, card.letter ? Math.max(390, due - performance.now()) : Math.min(390, Math.round(ROUNDS[r].show * 0.7)));
  }

  function finishRound() {
    if (r >= GIFT_ROUNDS - 1) checkRecord();
    if (r >= GIFT_ROUNDS) {
      const passed = view.roundPoints >= view.goal;
      if (passed && r < ROUNDS.length - 1) {
        r++;
        countdown(r);
        return;
      }
      music.stop();
      music.cue("result");
      set({ phase: "result", result: { kind: "final", title: passed ? `${ROUNDS.length}라운드 클리어!` : `${r + 1}라운드 도전 종료` } });
      onEvent({ type: "final", round: r + 1, points: view.points, peak: view.peakCombo });
      return;
    }
    if (r < GIFT_ROUNDS - 1) {
      r++;
      countdown();
      return;
    }
    music.stop();
    const passed = view.points >= view.goal;
    onEvent({ type: "five", points: view.points, peak: view.peakCombo, passed });
    if (!passed) {
      music.cue("result");
      set({ phase: "fail" });
      return;
    }
    // 게이지가 끝까지 차오르는 것을 보여 준 뒤 정답 화면으로
    music.cue("fill");
    set({ phase: "charge" });
    schedule(() => {
      music.cue("result");
      set({ phase: "puzzle" });
    }, 1050);
  }

  return {
    getView: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEventHandler(handler: (e: GameEvent) => void) {
      onEvent = handler;
    },
    /** 처음(게임 방법)으로. */
    reset,
    /** 1라운드 시작. 누른 직후에 불러야 소리가 난다. */
    begin() {
      onEvent({ type: "start" });
      countdown();
    },
    tap,
    /** 정답을 맞혔다 — 선물 코드 화면으로. */
    win() {
      if (view.phase !== "puzzle") return;
      music.cue("win");
      set({ phase: "result", result: { kind: "win", title: "메리크리스마스~!" } });
    },
    /** 정답을 넣지 않고 기록만 남긴다. */
    skipPuzzle() {
      if (view.phase !== "puzzle") return;
      set({ phase: "result", result: { kind: "final", title: "5라운드 완료" } });
    },
    /**
     * 다섯 라운드를 통과한 결과 화면에서 6라운드부터 이어 한다 — 정답을 맞힌 화면이든 「기록만 남기기」 로 온 화면이든.
     * (기록만 남기면 이어 할 길이 없었다 — 2026-11-26 대표님.) 이어하기가 끝난 결과 화면에서는 r 이 이미 넘어가 있어
     * 다시 눌러도 아무 일도 없다 — 같은 판에서 두 번 이어 하지 못한다.
     */
    continueBonus() {
      if (view.phase !== "result" || r !== GIFT_ROUNDS - 1) return;
      r++;
      countdown();
    },
    /** 화면이 가려졌다(다른 앱 · 탭) — 시계와 음악을 세운다. */
    suspend() {
      if ((view.phase !== "play" && view.phase !== "countdown") || suspended) return;
      remaining = Math.max(0, due - performance.now());
      clearTimeout(timer);
      music.stop();
      suspended = true;
    },
    resume() {
      if (!suspended) return;
      suspended = false;
      music.start();
      if (next) schedule(next, remaining);
    },
    destroy() {
      clearTimeout(timer);
      clearTimeout(badgeTimer);
      listeners.clear();
      music.stop();
    },
  };
}
