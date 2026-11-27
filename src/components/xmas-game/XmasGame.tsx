"use client";

import { memo, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { pushGa4Event } from "@/lib/analytics";
import { characterSvg, type Kind } from "./xmasGameArt";
import { CONFETTI, DOORS, GIFT_SVG } from "./xmasGameDoors";
import { createGameMusic } from "./xmasGameAudio";
import { GIFT_ROUNDS, ROUNDS, createGame, type GameEvent, type Shown } from "./xmasGameEngine";
import {
  claimGift,
  fetchBoard,
  registerNickname,
  savedNickname,
  startRun,
  submitScore,
  type Board,
  type BoardRow,
} from "./xmasGameApi";
import {
  XMAS_GAME_EVENT,
  XMAS_GAME_HASH,
  XMAS_GAME_PATH,
  SHARE_CHARACTERS,
  XMAS_GAME_PAGE_TITLE,
  XMAS_GAME_TITLE,
  applyPath,
  formatGiftCode,
  friendRecord,
  returnPath,
  savedGiftCode,
  shareUrl,
  type ShareRecord,
} from "./xmasGameShared";
import s from "./XmasGame.module.css";
import theme from "./xmasScene.module.css";

/**
 * 「산타의 어드벤트 캘린더」 게임 화면 — 테마 상세에서 새 창으로 연다(src/app/santa-calendar).
 *
 * 흐름
 *   게임 방법 → 1~5라운드 → 35점 미만: 최종 점수 + 닉네임을 넣으면 내 순위 · 상위 3명
 *                         → 35점 이상: 정답 입력 → 맞히면 선물 코드 + 참여 신청하러 가기 + 이어하기(6~20라운드) + 현재 랭킹
 *                                      → 「기록만 남기기」 로 건너뛰어도 이어하기 · 랭킹은 된다(선물 코드만 없다)
 *
 * 나눠 둔 것
 *   xmasGameEngine  문 · 점수 · 라운드(시계)        xmasGameAudio  음악 · 효과음
 *   xmasGameArt · xmasGameDoors  그림               xmasGameApi    판 기록 · 랭킹 · 선물 코드(Supabase 직통)
 *
 * 화면 구성(2026-11-26 대표님 — "게임다운 UI 로, 글은 줄글 말고 한눈에")
 *   - 맨 위에 「돌아가기」 를 크게 둔다. 게임은 구경거리고 신청은 상세 페이지에서 한다 — 돌아갈 길이 늘 보여야 한다.
 *   - 달력과 캐릭터는 승인 시안 그대로다. 둘레(점수판 · 안내 · 결과)만 게임 화면처럼 다시 짰다:
 *     두툼한 버튼, 점수 · 라운드 칸, 누르면 뜨는 +1 / −1, 산타를 누르면 흔들리는 판, 달아오르는 콤보.
 *   - 안내는 문장이 아니라 "그림 + 한 줄 + 점수" 칸으로 나눈다.
 *   - 기준은 「게임 방법」 카드다(대표님이 고른 것). 결과 카드 · 머리 · 점수판을 그 결에 맞췄다 —
 *     제목 · 숫자 · 버튼은 표시용 글꼴(주아, s.display), 카드 안 덩어리 사이는 넉넉히, 카드 안에 또 칸을 만들지 않는다.
 *     글자에 가운뎃점(·)으로 정보를 잇지 않고 칸을 나눈다. 규칙은 XmasGame.module.css 머리말에.
 *   - ⚠️ s.display 를 붙인 곳에는 font-extrabold 를 같이 쓰지 않는다(주아는 굵기가 하나다).
 *
 * ⚠️ 브라우저에서만 그린다(XmasGameLoader). 처음 그릴 때부터 저장소 · 주소를 읽는다.
 * ⚠️ 달력(문 25칸)에는 data-track-off 를 단다 — 한 판에 80번 넘게 누르는데 그게 전부 방문 발자취에 쌓이면
 *    하루 한도(3,000건)와 DB 를 먹는다(VisitTracker). 판의 시작 · 결과는 XMAS_GAME_EVENT 로 따로 남긴다.
 * ⚠️ 문구는 시안과 대표님 설명에 있는 것만 쓴다. 선물 종류 · 수량 · 기간처럼 정해지지 않은 것은 적지 않는다.
 */

const KIND_LABEL: Record<Kind, string> = { snow: "눈사람", deer: "루돌프", santa: "산타" };
const SNOWMAN = characterSvg("snow", null, false);
const RUDOLPH = characterSvg("deer", null, false);
const SANTA = characterSvg("santa", null, false);
const SANTA_WITH_STAR = characterSvg("santa", "★", false);

/** 콤보가 이 숫자에 닿는 순간 옆에 한 번 뜨는 말. */
const COMBO_CHEER: Record<number, string> = { 5: "NICE!", 10: "GREAT!", 20: "AMAZING!", 30: "PERFECT!" };

/** 입력칸의 Enter. 한글 조합 중의 Enter 는 글자 확정이다 — 그때 제출하면 마지막 글자가 빠진다. */
const isSubmitKey = (e: KeyboardEvent<HTMLInputElement>) =>
  e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229;


export default function XmasGame() {
  const [music] = useState(createGameMusic);
  // 엔진은 한 번 만들어 계속 쓴다
  const [game] = useState(() => {
    const g = createGame(music);
    g.reset();
    return g;
  });
  const view = useSyncExternalStore(game.subscribe, game.getView, game.getView);

  // 들어온 화면(상세 페이지)과 친구의 기록 — 주소에서 한 번 읽는다
  const [from] = useState(returnPath);
  const [friend] = useState(friendRecord);
  // 이번 판의 번호(받는 중일 수 있다)와 점수 기록 요청 — 정답 · 닉네임은 점수가 적힌 뒤에 보내야 한다
  const run = useRef<Promise<string | null> | null>(null);
  const submitted = useRef<Promise<void> | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardFailed, setBoardFailed] = useState(false);
  // 이번 판을 시작할 때의 내 자리(등록한 적이 없으면 null) — 끝났을 때 순위가 올랐는지 이것과 견준다
  const [before, setBefore] = useState<BoardRow | null>(null);
  const [code, setCode] = useState<string | null>(savedGiftCode);
  const [muted, setMuted] = useState(music.isMuted);
  const [answer, setAnswer] = useState("");
  const [response, setResponse] = useState("");
  const [checking, setChecking] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  /*
    랭킹에 등록한 적이 있는 사람의 첫 화면(2026-11-27 대표님) — 게임 방법 대신 내 순위 · 현재 랭킹 · 받은 선물 코드를 먼저
    보여 준다. 다시 온 사람이 궁금한 것은 규칙이 아니라 "내가 지금 몇 위인가" 다.
    lobby: 들어왔을 때 받아 둔 랭킹. 닉네임이 저장된 브라우저에서만 받는다(처음 온 사람은 서버를 부르지 않는다).
    showRules: 그 화면에서 「게임 방법 자세히 보기」 를 눌렀다 — 원래의 게임 방법 카드를 보여 준다.
  */
  /*
    시작하기 전에 받아 두는 닉네임(2026-11-27 대표님) — 적어 두면 판이 끝나는 순간 랭킹에 저절로 오른다.
    끝난 뒤에만 물었더니 닉네임 넣는 것을 잊고 창을 닫아 "등록이 안 됐다" 고 아쉬워하는 손님이 있었다.
    **적어야 시작할 수 있다**(같은 날 대표님 — 비워 두고 시작할 수 있게 했더니 "막아 달라" 고 하셨다).
    이미 랭킹에 있는 사람(닉네임이 서버에 있다)에게는 묻지 않는다.
  */
  const [nick, setNick] = useState(savedNickname);
  const [nickError, setNickError] = useState("");
  const nickInput = useRef<HTMLInputElement>(null);
  const nickRef = useRef(nick);
  useEffect(() => {
    nickRef.current = nick;
  }, [nick]);
  const [lobby, setLobby] = useState<Board | null>(null);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    if (savedNickname()) fetchBoard().then(setLobby);
  }, []);

  // 분석 이벤트에 붙이는 이름 — 어느 화면에서 넘어왔나
  const origin = from ?? XMAS_GAME_PATH;

  useEffect(() => {
    game.setEventHandler((e: GameEvent) => {
      if (e.type === "start") {
        run.current = startRun(origin);
        submitted.current = null;
        setBoard(null);
        setBoardFailed(false);
        setBefore(null);
        fetchBoard().then((now) => setBefore(now?.me ?? null));
        setAnswer("");
        setResponse("");
        setShareMsg("");
        pushGa4Event(XMAS_GAME_EVENT.start, { themeLabel: origin });
        return;
      }
      const round = e.type === "five" ? GIFT_ROUNDS : e.round;
      submitted.current = (async () => {
        const id = await run.current;
        let next = id ? await submitScore(id, round, e.points, e.peak) : null;
        // 시작 전에 닉네임을 적어 뒀고 아직 랭킹에 없으면 여기서 바로 올린다
        const name = nickRef.current.trim();
        if (id && next && !next.me && name.length >= 1 && name.length <= 10) {
          const named = await registerNickname(id, name);
          if (named?.ok) {
            next = named;
            pushGa4Event(XMAS_GAME_EVENT.rank, { themeLabel: origin });
          }
        }
        if (next) setBoard(next);
        else setBoardFailed(true);
      })();
      pushGa4Event(
        e.type === "final" ? XMAS_GAME_EVENT.final : e.passed ? XMAS_GAME_EVENT.pass : XMAS_GAME_EVENT.fail,
        { themeLabel: origin },
      );
    });
  }, [game, origin]);

  useEffect(() => {
    const onVisibility = () => (document.hidden ? game.suspend() : game.resume());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      game.destroy();
      music.close();
    };
  }, [game, music]);

  const replay = () => game.reset();
  /** 게임 방법 카드의 「게임 시작」 — 닉네임이 비었으면 시작하지 않고 칸으로 보낸다. */
  function beginWithNick() {
    const name = nick.trim();
    if (name.length < 1 || name.length > 10) {
      setNickError("닉네임을 입력해 주세요. (10자 이내)");
      nickInput.current?.focus();
      return;
    }
    setNickError("");
    game.begin();
  }
  // 머리의 재시작 버튼 — 여기로도 닉네임 없이 시작할 수 없다. 랭킹에 없고 닉네임도 비었으면 게임 방법 카드로 돌려보낸다
  const restart = () => {
    game.reset();
    const name = nick.trim();
    if (!(board ?? lobby)?.me && (name.length < 1 || name.length > 10)) {
      setShowRules(false);
      setNickError("닉네임을 입력해 주세요. (10자 이내)");
      return;
    }
    game.begin();
  };

  /**
   * 들어온 화면으로 돌아간다. 새 창으로 열렸으면 이 창을 닫는다 — 원래 창이 그 자리 그대로 남아 있다.
   * 같은 창에서 열렸으면(카카오톡 인앱 브라우저는 새 창을 못 띄운다) 닫히지 않으니 직접 이동한다.
   */
  function goBack() {
    game.reset();
    const to = from ? `${from}#${XMAS_GAME_HASH}` : "/";
    if (window.opener) window.close();
    setTimeout(() => {
      window.location.href = to;
    }, 150);
  }

  /**
   * 선물 코드를 받은 손님을 회차 선택으로 보낸다 — 선물은 참여하는 날 현장에서 받으니, 코드를 받은 그 자리에서
   * 신청으로 이어 준다(2026-11-26 대표님). 새 창으로 열렸으면 원래 창(상세 페이지)을 회차 선택으로 내리고 이 창을 닫는다.
   * 원래 창을 못 건드리거나 이 창이 안 닫히면(카카오톡 인앱 브라우저) 이 창이 직접 간다.
   */
  function goApply() {
    pushGa4Event(XMAS_GAME_EVENT.apply, { themeLabel: origin });
    const to = new URL(applyPath(), window.location.origin).href;
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.location.href = to;
        window.close();
      }
    } catch {
      // 원래 창이 다른 사이트로 넘어가 있으면 손댈 수 없다 — 아래에서 이 창이 간다
    }
    setTimeout(() => {
      window.location.href = to;
    }, 150);
  }

  function toggleSound() {
    const next = !muted;
    music.setMuted(next);
    setMuted(next);
    if (!next && (view.phase === "play" || view.phase === "countdown")) music.start();
  }

  async function submitAnswer() {
    if (checking) return;
    if (!answer.trim()) {
      setResponse("정답을 입력해 주세요.");
      return;
    }
    setChecking(true);
    const id = await run.current;
    await submitted.current;
    const claim = id ? await claimGift(id, answer) : null;
    setChecking(false);
    if (claim?.ok && claim.code) {
      setCode(claim.code);
      setResponse("");
      pushGa4Event(XMAS_GAME_EVENT.gift, { themeLabel: origin });
      game.win();
      return;
    }
    setResponse(
      claim?.reason === "answer"
        ? "산타의 선물에 적힌 글자를 다시 떠올려 보세요."
        : claim?.reason === "tries"
          ? "정답을 너무 많이 틀렸어요. 다시하기로 새 판을 시작해 주세요."
          : "지금은 정답을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.",
    );
  }

  /** 닉네임 등록. 안 됐으면 보여 줄 문구를, 됐으면 null 을 돌려준다. */
  async function register(nickname: string): Promise<string | null> {
    const id = await run.current;
    await submitted.current;
    const next = id ? await registerNickname(id, nickname) : null;
    if (!next) return "지금은 랭킹에 등록할 수 없어요. 잠시 후 다시 시도해 주세요.";
    setBoard(next);
    if (!next.ok) return "이번 기록을 확인하지 못했어요. 다시하기로 새 판을 시작해 주세요.";
    pushGa4Event(XMAS_GAME_EVENT.rank, { themeLabel: origin });
    return null;
  }

  /**
   * 기록을 공유한다 — 받은 사람은 게임 화면으로 바로 들어오고, 공유 카드에 내 랭킹 · 점수가 찍힌다(2026-11-26 대표님).
   * 랭킹에 올라 있으면 랭킹과 그 기록(가장 좋은 판)을, 아니면 이번 판의 라운드 · 점수를 싣는다.
   * 카드에 그릴 캐릭터는 누를 때마다 셋 중 하나를 뽑는다.
   */
  async function share() {
    const { round, points } = game.getView();
    const me = (board ?? lobby)?.me;
    const record: ShareRecord = {
      round: me ? me.round : round,
      score: me ? me.score : points,
      rank: me ? me.rank : null,
      who: SHARE_CHARACTERS[Math.floor(Math.random() * SHARE_CHARACTERS.length)],
    };
    const url = shareUrl(record);
    // 같이 보내는 글은 이름 한 줄뿐이다 — 랭킹 · 점수 · "도전해 보세요" 는 바로 아래 공유 카드가 말한다(2026-11-26 대표님).
    const text = `우주이스케이프 크리스마스 이벤트 게임 「${XMAS_GAME_TITLE}」`;
    pushGa4Event(XMAS_GAME_EVENT.share, { themeLabel: origin });
    if (navigator.share) {
      try {
        // title 은 넘기지 않는다 — 카카오톡이 "제목 - 글" 로 이어 붙여 이름이 두 번 나온다
        await navigator.share({ text, url });
      } catch {
        // 공유 취소 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMsg("기록과 링크를 복사했어요. 친구에게 붙여 넣어 주세요.");
    } catch {
      setShareMsg("복사하지 못했어요. 주소창의 링크를 공유해 주세요.");
    }
  }

  const playing = view.phase === "play";
  const result = view.result;
  const bonus = view.round > GIFT_ROUNDS;
  const left = view.goal - view.gauge;
  const full = left <= 0;

  // 한 판을 끝내고 처음으로 돌아왔으면 그 판의 랭킹이 가장 새것이다
  const home = board ?? lobby;
  const returning = home?.me != null && !showRules;

  /** 받은 선물 코드와 신청 버튼 — 정답 화면과, 다시 온 사람의 첫 화면에 같이 쓴다. */
  const giftTicket = code && (
    <div className={s.ticket}>
      <small className="text-label font-semibold">선물 코드</small>
      <strong className={s.display}>{formatGiftCode(code)}</strong>
      <p className="text-body-sm">이 코드를 현장에서 직원에게 보여주시면 크리스마스 선물을 드려요.</p>
      {/* 선물은 참여하는 날 받는다 — 코드를 받은 자리에서 바로 신청으로 잇는다 */}
      <button type="button" className={`${s.btn} ${s.btnBig}`} onClick={goApply}>
        참여 신청하러 가기
      </button>
    </div>
  );

  const shareNote = shareMsg && (
    <p role="status" className="text-body-sm">
      {shareMsg}
    </p>
  );
  /** 결과 화면 공통 — 공유 · 다시하기 · 돌아가기. */
  const endActions = (
    <div className={s.actions}>
      <button type="button" className={`${s.btn} ${s.btnGreen} ${s.btnWide}`} onClick={share}>
        친구에게 공유하기
      </button>
      <button type="button" className={`${s.btn} ${s.btnPaper}`} onClick={replay}>
        다시하기
      </button>
      <button type="button" className={`${s.btn} ${s.btnPaper}`} onClick={goBack}>
        돌아가기
      </button>
    </div>
  );

  return (
    <div className={`${theme.theme} ${theme.scene} ${theme.falling} ${s.root} font-sans`}>
      <header className={s.top}>
        <button type="button" className={s.back} onClick={goBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 3 5 9l6 6" />
          </svg>
          돌아가기
        </button>
        <h1 className={`${s.wordmark} ${s.display}`}>{XMAS_GAME_PAGE_TITLE}</h1>
        <div className={s.tools}>
          <button type="button" className={s.tool} aria-label="게임 재시작" title="게임 재시작" onClick={restart}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16.5 10a6.5 6.5 0 1 1-2-4.7M16.5 3v3.5H13" />
            </svg>
          </button>
          <button
            type="button"
            className={s.tool}
            aria-pressed={!muted}
            aria-label={muted ? "소리 꺼짐" : "소리 켜짐"}
            title={muted ? "소리 꺼짐" : "소리 켜짐"}
            onClick={toggleSound}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7.5v5h3l4 3.5v-12L6 7.5Z" fill="currentColor" />
              {muted ? <path d="m13.5 7.5 4 5m0-5-4 5" /> : <path d="M13.5 7a4.5 4.5 0 0 1 0 6M15.8 4.5a8 8 0 0 1 0 11" />}
            </svg>
          </button>
        </div>
      </header>

      <main className={s.game} inert={!playing}>
        <section className={s.hud} aria-label="점수판">
          <div className={s.stats}>
            <div className={s.stat}>
              <span className={`${s.statLabel} text-label font-semibold`}>라운드</span>
              <strong className={`${s.statValue} ${s.display}`}>
                {view.round}
                <small>/{view.roundTotal}</small>
              </strong>
              {/* 이어하기는 스무 칸이다 — 칸 사이를 좁혀 한 줄에 담는다 */}
              <span className={`${s.pips} ${view.roundTotal > 10 ? s.pipsMany : ""}`} aria-hidden>
                {Array.from({ length: view.roundTotal }, (_, i) => (
                  <i key={i} className={i + 1 < view.round ? s.pipDone : i + 1 === view.round ? s.pipNow : ""} />
                ))}
              </span>
            </div>
            <div className={`${s.stat} ${s.statScore}`}>
              <span className={`${s.statLabel} text-label font-semibold`}>점수</span>
              {/* 점수가 바뀔 때마다 다시 만들어 한 번 튄다 */}
              <strong key={view.points} className={`${s.statValue} ${s.display} ${s.bump}`}>
                {view.points}
              </strong>
            </div>
          </div>

          <div className={`${s.goal} ${full ? s.goalFull : ""}`}>
            <div className={`${s.goalText} text-label font-semibold`}>
              <span>{full ? (bonus ? "통과!" : "선물 게이지 완성!") : `${bonus ? "통과" : "선물"}까지 ${left}점`}</span>
              <span className={s.goalCount}>
                {view.gauge} / {view.goal}
              </span>
            </div>
            <div
              className={s.track}
              role="progressbar"
              aria-label={view.gaugeLabel}
              aria-valuemin={0}
              aria-valuemax={view.goal}
              aria-valuenow={view.gauge}
            >
              <div className={s.fill} style={{ transform: `scaleX(${view.gauge / view.goal})` }} />
            </div>
            <span className={s.goalGift} aria-hidden dangerouslySetInnerHTML={{ __html: GIFT_SVG }} />
          </div>

          <ul className={`${s.legend} ${s.display}`} aria-label="점수 규칙">
            <li>
              <span aria-hidden dangerouslySetInnerHTML={{ __html: SNOWMAN }} />
              <span className="sr-only">눈사람</span>
              <b>+1</b>
            </li>
            <li>
              <span aria-hidden dangerouslySetInnerHTML={{ __html: RUDOLPH }} />
              <span className="sr-only">루돌프</span>
              <b>+1</b>
            </li>
            <li className={s.legendBad}>
              <span aria-hidden dangerouslySetInnerHTML={{ __html: SANTA }} />
              <span className="sr-only">산타</span>
              {/* 빼기는 U+2212(−)가 아니라 키보드의 - 로 적는다 — 주아 글꼴에 − 가 없어 아이폰에서 통째로 빠졌다(2026-11-27 QA) */}
              <b>-1</b>
            </li>
          </ul>
          <p className="sr-only" role="status">
            {view.status}
          </p>
        </section>

        <div className={s.stage}>
          <div className={s.comboSlot} aria-hidden>
            {/* 다섯 라운드가 끝나면 걷는다 — 결과 화면 뒤에 숫자가 남아 있으면 지저분하다 */}
            {(playing || view.phase === "countdown") && <ComboBadge combo={view.combo} seq={view.comboSeq} />}
          </div>
          <section
            // 산타를 누를 때마다 판을 한 번 흔든다. 같은 애니메이션을 다시 걸 수 없어 이름 둘을 번갈아 쓴다
            className={`${s.board} ${view.santaSeq === 0 ? "" : view.santaSeq % 2 ? s.shakeA : s.shakeB}`}
            aria-label="12월 어드벤트 캘린더"
            data-track-off
            style={{ "--swing": `${view.swingMs}ms` } as CSSProperties}
          >
            {DOORS.map((_, i) => (
              <Tile key={i} index={i} shown={view.tiles[i]} open={view.openPos === i} onTap={game.tap} />
            ))}
          </section>
        </div>
      </main>

      {!playing && (
        <div className={s.overlay}>
          {/* 「게임 방법」 — 대표님이 고른 기준 카드(2026-11-26). 다른 카드를 이 결에 맞춘다. 이 카드의 짜임은 바꾸지 않는다 */}
          {/* 랭킹에 등록한 사람의 첫 화면 — 내 순위 · 현재 랭킹 → 게임 시작 → 짧은 게임 방법 → 선물 코드 → 공유. 게임 시작이 휴대폰 첫 화면 안에 들어오게 랭킹 바로 밑에 둔다 */}
          {view.phase === "rules" && returning && home && (
            <section className={s.card}>
              <p className={`${s.ribbon} ${s.ribbonKo} text-label font-extrabold`}>다시 오셨네요!</p>
              <h2 className={`${s.cardTitle} ${s.display}`}>내 기록</h2>
              <RankBlock board={home} failed={false} before={null} showTop onRegister={register} />
              <div className={s.next}>
                <button type="button" className={`${s.btn} ${s.btnBig}`} onClick={game.begin}>
                  게임 시작
                </button>
              </div>
              <ul className={`${s.brief} ${s.display}`} aria-label="점수 규칙">
                <li>
                  <span aria-hidden dangerouslySetInnerHTML={{ __html: SNOWMAN }} />
                  <span className="sr-only">눈사람</span>
                  <b>+1</b>
                </li>
                <li>
                  <span aria-hidden dangerouslySetInnerHTML={{ __html: RUDOLPH }} />
                  <span className="sr-only">루돌프</span>
                  <b>+1</b>
                </li>
                <li className={s.briefBad}>
                  <span aria-hidden dangerouslySetInnerHTML={{ __html: SANTA }} />
                  <span className="sr-only">산타</span>
                  <b>-1</b>
                </li>
              </ul>
              <p className={`${s.muted} text-body-sm`}>라운드마다 산타의 선물에 적힌 글자를 기억하세요.</p>
              {giftTicket}
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnGreen} ${s.btnWide}`} onClick={share}>
                  내 기록 공유하기
                </button>
                <button type="button" className={`${s.btn} ${s.btnPaper} ${s.btnWide}`} onClick={() => setShowRules(true)}>
                  게임 방법 자세히 보기
                </button>
              </div>
              {shareNote}
            </section>
          )}

          {view.phase === "rules" && !returning && (
            <section className={s.card}>
              <p className={`${s.ribbon} text-label font-extrabold`}>HOW TO PLAY</p>
              <h2 className={`${s.cardTitle} ${s.display}`}>게임 방법</h2>
              {friend && (
                <p className={`${s.callout} text-body-sm font-semibold`}>
                  친구가 {friend.rank ? `랭킹 ${friend.rank}위, ${friend.score}점` : `${friend.round}라운드 ${friend.score}점`}을
                  기록했어요. 도전해 보세요!
                </p>
              )}
              <ol className={s.howto}>
                <li>
                  <span className={s.howtoArt} aria-hidden>
                    <span dangerouslySetInnerHTML={{ __html: SNOWMAN }} />
                    <span dangerouslySetInnerHTML={{ __html: RUDOLPH }} />
                  </span>
                  <span className={`${s.howtoText} text-body-sm`}>
                    <strong className="text-body font-extrabold">눈사람 · 루돌프</strong>
                    문이 열리면 터치!
                  </span>
                  <b className={`${s.point} ${s.display}`}>+1</b>
                </li>
                <li>
                  <span className={s.howtoArt} aria-hidden>
                    <span dangerouslySetInnerHTML={{ __html: SANTA }} />
                  </span>
                  <span className={`${s.howtoText} text-body-sm`}>
                    <strong className="text-body font-extrabold">산타</strong>
                    터치하면 점수가 줄어요
                  </span>
                  <b className={`${s.point} ${s.pointBad} ${s.display}`}>-1</b>
                </li>
                <li>
                  <span className={s.howtoArt} aria-hidden>
                    <span dangerouslySetInnerHTML={{ __html: SANTA_WITH_STAR }} />
                  </span>
                  <span className={`${s.howtoText} text-body-sm`}>
                    <strong className="text-body font-extrabold">산타의 선물</strong>
                    라운드마다 딱 한 번, 선물에 적힌 글자를 기억하세요
                  </span>
                </li>
              </ol>
              <p className={`${s.mission} text-body font-extrabold`}>
                <span aria-hidden dangerouslySetInnerHTML={{ __html: GIFT_SVG }} />
                <span>
                  5라운드 동안 {view.goal}점 이상이면
                  <br />
                  산타의 선물이 열려요
                </span>
              </p>
              {/* 닉네임 — 이미 랭킹에 있는 사람(게임 방법을 다시 펴 본 사람)에게는 묻지 않는다 */}
              {!home?.me && (
                <div className={s.preNick}>
                  <input
                    ref={nickInput}
                    className="text-input font-semibold"
                    value={nick}
                    onChange={(e) => {
                      setNick(e.target.value);
                      if (nickError) setNickError("");
                    }}
                    onKeyDown={(e) => {
                      if (isSubmitKey(e)) {
                        e.preventDefault();
                        beginWithNick();
                      }
                    }}
                    aria-invalid={nickError ? true : undefined}
                    maxLength={10}
                    aria-label="랭킹에 올릴 닉네임"
                    placeholder="닉네임 (10자 이내)"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                  {nickError ? (
                    <p role="alert" className={`${s.warn} text-label font-semibold`}>
                      {nickError}
                    </p>
                  ) : (
                    <p className={`${s.muted} text-label`}>
                      게임이 끝나면 이 닉네임으로 랭킹에 자동으로 올라가요. 닉네임은 랭킹에 공개돼요.
                    </p>
                  )}
                </div>
              )}
              {/* 자동으로 초점을 주지 않는다 — 창이 뜨자마자 누르지도 않은 버튼에 테두리가 둘러져 있으면 고장처럼 보인다 */}
              <button type="button" className={`${s.btn} ${s.btnBig}`} onClick={home?.me ? game.begin : beginWithNick}>
                게임 시작
              </button>
            </section>
          )}

          {view.phase === "countdown" && (
            <div
              key={view.counterSeq}
              // 숫자(3 · 2 · 1)와 START! 는 크게, 'ROUND 3' · '6라운드 통과!' 같은 알림은 한 단계 작게
              className={`${s.counter} ${/^\d$|^START!$/.test(view.counter) ? "" : s.counterRound}`}
              role="status"
            >
              {view.counter}
            </div>
          )}

          {view.phase === "fail" && (
            <section className={s.card}>
              <h2 className={`${s.cardTitle} ${s.display}`}>최종 점수</h2>
              <strong className={`${s.bigScore} ${s.display}`}>
                {view.points}
                <small>점</small>
              </strong>
              <dl className={s.facts}>
                <div>
                  <dt className="text-label">선물까지</dt>
                  <dd className={s.display}>{view.goal - view.points}점</dd>
                </div>
                <div>
                  <dt className="text-label">최대 콤보</dt>
                  <dd className={s.display}>{view.peakCombo}</dd>
                </div>
              </dl>
              <RankBlock board={board} failed={boardFailed} before={before} showTop={false} onRegister={register} />
              {endActions}
              {shareNote}
            </section>
          )}

          {view.phase === "charge" && (
            <section className={s.card}>
              <h2 className={`${s.cardTitle} ${s.display}`}>선물 게이지 완성!</h2>
              <div className={`${s.track} ${s.trackBig}`}>
                <div className={`${s.fill} ${s.fillCharge}`} />
              </div>
            </section>
          )}

          {view.phase === "puzzle" && (
            <section className={`${s.card} ${s.burst} ${s.celebrate}`}>
              {Array.from({ length: 20 }, (_, i) => (
                <i key={i} aria-hidden style={{ "--a": `${i * 18}deg`, "--color": CONFETTI[i % 3] } as CSSProperties} />
              ))}
              <p className={`${s.ribbon} text-label font-extrabold`}>LAST MISSION</p>
              <div className={s.santaGift} aria-hidden dangerouslySetInnerHTML={{ __html: SANTA_WITH_STAR }} />
              <h2 className={`${s.cardTitle} ${s.display}`}>산타가 하려는 말은?</h2>
              <p className={`${s.muted} text-body`}>선물에 적혀 있던 글자를 라운드 순서대로 이어 보세요.</p>
              <div className={s.answerLine} role="group" aria-label="정답 제출">
                <input
                  className="text-input font-extrabold"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (isSubmitKey(e)) {
                      e.preventDefault();
                      submitAnswer();
                    }
                  }}
                  maxLength={50}
                  aria-label="산타가 하려는 말"
                  placeholder="정답 입력"
                  autoComplete="off"
                  autoCapitalize="off"
                  enterKeyHint="done"
                />
                <button type="button" className={s.btn} onClick={submitAnswer} disabled={checking}>
                  제출하기
                </button>
              </div>
              <p role="status" className={`${s.warn} text-body-sm font-semibold`}>
                {response}
              </p>
              <div className={s.actions}>
                <button type="button" className={`${s.btn} ${s.btnPaper}`} onClick={replay}>
                  다시하기
                </button>
                {/* 초록으로 눈에 띄게 — 정답을 모르겠으면 이것을 눌러 랭킹에는 남기라고(2026-11-27 대표님) */}
                <button type="button" className={`${s.btn} ${s.btnGreen}`} onClick={game.skipPuzzle}>
                  기록만 남기기
                </button>
              </div>
            </section>
          )}

          {view.phase === "result" && result && (
            <section className={`${s.card} ${result.kind === "win" ? s.celebrate : ""}`}>
              {result.kind === "win" && <p className={`${s.ribbon} ${s.ribbonKo} text-label font-extrabold`}>정답이에요!</p>}
              <h2 className={`${s.cardTitle} ${s.resultTitle} ${s.display}`}>{result.title}</h2>
              <dl className={s.facts}>
                <div>
                  <dt className="text-label">누적 점수</dt>
                  <dd className={s.display}>{view.points}점</dd>
                </div>
                {/* 이어하기에서 탈락했을 때만 — 통과선에 얼마나 모자랐는지. 다 깼으면 보여 줄 이유가 없다 */}
                {bonus && view.roundPoints < view.goal && (
                  <div>
                    <dt className="text-label">이번 라운드</dt>
                    <dd className={s.display}>
                      {view.roundPoints} / {view.goal}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-label">최대 콤보</dt>
                  <dd className={s.display}>{view.peakCombo}</dd>
                </div>
              </dl>
              {giftTicket}
              {/* 다섯 라운드를 통과한 화면(정답을 맞혔든 기록만 남겼든)에서만 — 이어하기가 끝난 화면에는 없다 */}
              {!bonus && (
                <div className={s.next}>
                  <button type="button" className={`${s.btn} ${s.btnGreen} ${s.btnBig}`} onClick={game.continueBonus}>
                    6라운드 이어하기
                  </button>
                  <p className={`${s.muted} text-body-sm`}>
                    {ROUNDS.length}라운드까지, 라운드마다 통과 게이지를 채우면 다음 라운드로 넘어가요.
                  </p>
                </div>
              )}
              <RankBlock board={board} failed={boardFailed} before={before} showTop onRegister={register} />
              {endActions}
              {shareNote}
            </section>
          )}
        </div>
      )}

      {view.record && (
        <div className={`${s.record} ${s.display}`} role="status">
          최고점수 갱신!
        </div>
      )}
    </div>
  );
}

/** 문 한 칸. 문이 닫힌 뒤에도 안의 캐릭터는 다음 것이 나올 때까지 남는다(닫히는 동안 보여야 한다). */
const Tile = memo(function Tile({
  index,
  shown,
  open,
  onTap,
}: {
  index: number;
  shown: Shown | null;
  open: boolean;
  onTap: (index: number) => void;
}) {
  const door = DOORS[index];
  const santa = shown?.card.kind === "santa";
  return (
    <div
      className={`${s.tile} ${door.wide ? s.wide : ""} ${open ? s.open : ""}`}
      style={{ "--bg": door.bg, "--ink": door.ink } as CSSProperties}
    >
      <button
        type="button"
        className={s.target}
        disabled={!open}
        aria-label={shown ? KIND_LABEL[shown.card.kind] : undefined}
        // 손가락이 닿는 순간 센다 — click 은 뗄 때 와서 빠른 라운드에서 늦는다. click 은 키보드용으로 남긴다
        onPointerDown={(e) => {
          if (e.button === 0) onTap(index);
        }}
        onClick={() => onTap(index)}
      >
        {shown && (
          <span
            className={s.char}
            dangerouslySetInnerHTML={{ __html: characterSvg(shown.card.kind, shown.card.letter ?? null, shown.hit) }}
          />
        )}
        {/* 누른 자리에서 점수가 튀어 오른다 */}
        {shown?.hit && <span className={`${s.pop} ${santa ? s.popBad : ""}`}>{santa ? "아이쿠! -1" : "+1"}</span>}
      </button>
      <div className={s.door}>
        <span className={s.num}>{index + 1}</span>
        <svg className={s.spark} viewBox="0 0 10 10" aria-hidden>
          <path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" />
        </svg>
        <span className={s.art} dangerouslySetInnerHTML={{ __html: door.art }} />
      </div>
    </div>
  );
});

/**
 * 콤보 — 2부터 판 위에 뜬다. 오를 때마다 다시 튀고(key), 5 · 10 · 20 에서 색이 달아오르며 한마디가 붙는다.
 * 끊기면 방금까지의 숫자가 회색으로 떨어지며 사라진다.
 */
function ComboBadge({ combo, seq }: { combo: number; seq: number }) {
  const [last, setLast] = useState({ combo: 0, broke: 0 });
  if (combo !== last.combo) setLast({ combo, broke: combo === 0 ? last.combo : 0 });

  const value = combo >= 2 ? combo : last.broke >= 2 ? last.broke : 0;
  if (!value) return null;
  const tone =
    combo < 2 ? s.comboBreak : combo >= 20 ? s.comboFire : combo >= 10 ? s.comboHot : combo >= 5 ? s.comboWarm : "";
  const cheer = COMBO_CHEER[combo];
  return (
    <div key={combo >= 2 ? seq : `break-${seq}`} className={`${s.combo} ${tone}`}>
      <span>
        <b>{value}</b>
        <i>COMBO</i>
      </span>
      {cheer && <em>{cheer}</em>}
    </div>
  );
}

/**
 * 랭킹 — 상위 3명과 내 순위. 다섯 라운드를 마친 뒤의 모든 결과 화면에 붙는다(실패 · 정답 · 이어하기 종료).
 *
 * 등록 전     닉네임을 넣는 칸. showTop 이 false 면(선물 점수 미만) 넣은 뒤에야 순위가 보인다.
 * 등록한 뒤   다시 묻지 않는다(서버가 같은 브라우저의 새 판에 닉네임을 붙인다). 2026-11-26 대표님:
 *   - 이번 점수가 등록된 기록보다 높으면 기록이 저절로 바뀌고, **순위가 올라가는 모습**을 보여 준다
 *     (내 줄이 아래에서 치고 올라오고, 몇 위에서 몇 위가 됐는지 한 줄로 알린다 — "최고 기록 29점 달성!" 처럼
 *      게임에서 흔히 쓰는 말투로. "~올렸어요" 는 어색하다고 하셨다).
 *   - 낮으면 현재 랭킹만 보여 준다.
 * before 는 이번 판을 시작할 때의 내 자리다. 그보다 점수가 높아졌으면 "올랐다" 로 본다.
 */
function RankBlock({
  board,
  failed,
  before,
  showTop,
  onRegister,
}: {
  board: Board | null;
  failed: boolean;
  before: BoardRow | null;
  showTop: boolean;
  onRegister: (nickname: string) => Promise<string | null>;
}) {
  const [nickname, setNickname] = useState(savedNickname);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  if (failed) {
    return (
      <div className={s.rank}>
        <p className={`${s.muted} text-body-sm`}>지금은 랭킹을 불러올 수 없어요.</p>
      </div>
    );
  }
  if (!board) {
    return (
      <div className={s.rank}>
        <p className={`${s.muted} text-body-sm`}>랭킹을 불러오는 중이에요.</p>
      </div>
    );
  }

  async function submit() {
    if (saving) return;
    const name = nickname.trim();
    if (name.length < 1 || name.length > 10) {
      setMessage("닉네임은 1~10자로 입력해 주세요.");
      return;
    }
    setSaving(true);
    setMessage((await onRegister(name)) ?? "");
    setSaving(false);
  }

  const me = board.me;
  const listed = showTop || me !== null;
  // 이번 판으로 기록이 올랐나. 올랐으면 몇 계단인지(순위는 그대로고 점수만 오를 수도 있다)
  const raised = before !== null && me !== null && me.score > before.score;
  const climbed = raised ? Math.max(0, before.rank - me.rank) : 0;
  // 치고 올라오는 거리 — 줄 하나가 52px 쯤이다. 아래 버튼까지 내려갔다 오지 않게 두 줄까지만
  const climb = { "--climb": `${Math.min(Math.max(climbed, 1), 2) * 52}px` } as CSSProperties;
  // 10위 밖이면 점 셋 밑에 내 바로 위 · 나 · 바로 아래를 잇는다. 예전 응답(around 없음)이면 내 줄만
  const outside = me !== null && me.rank > board.top.length;
  const around = outside ? (board.around?.length ? board.around : [{ ...me, me: true }]) : [];
  // 한 줄 목표 — 바로 위 사람을 넘으려면 몇 점이 더 필요한가(동점이면 1점). 1위에게는 없다
  const above = me && me.rank > 1 ? [...board.top, ...around].find((r) => r.rank === me.rank - 1) : undefined;
  const row = (r: BoardRow) => (
    <li
      key={r.rank}
      data-rank={r.rank}
      className={`${s.rankRow} ${r.me ? s.rankMe : ""} ${r.me && raised ? s.rankUp : ""}`}
      style={r.me && raised ? climb : undefined}
    >
      <b className={s.display}>{r.rank}</b>
      <span className={`${s.rankName} text-body font-semibold`}>{r.name}</span>
      <span className={`${s.rankScore} ${s.display}`}>{r.score}점</span>
      <span className={`${s.rankRound} text-label`}>{r.round}라운드</span>
    </li>
  );
  return (
    <div className={s.rank}>
      <div className={s.rankHead}>
        <strong className={s.display}>{listed ? "현재 랭킹" : "랭킹에 내 기록 올리기"}</strong>
        {/* 등록 인원은 100명을 넘긴 뒤에만 보여 준다 — 그 전에는 숫자가 작아 썰렁해 보인다(2026-11-27 대표님) */}
        {listed && board.players > 100 && <span className={`${s.muted} text-label`}>등록 {board.players}명</span>}
      </div>
      {raised && (
        <p className={`${s.rankNews} ${s.display}`} role="status">
          {climbed > 0 ? `${before.rank}위에서 ${me.rank}위로 랭킹 상승!` : `최고 기록 ${me.score}점 달성!`}
        </p>
      )}
      {listed &&
        (board.top.length ? (
          <ol className={s.rankList}>{board.top.map(row)}</ol>
        ) : (
          <p className={`${s.muted} text-body-sm`}>아직 등록된 기록이 없어요.</p>
        ))}
      {/* 10위와 내 주변 사이가 떨어져 있으면 점 셋으로 건너뛴 것을 알린다 */}
      {outside && around[0].rank > board.top.length + 1 && (
        <span className={s.rankGap} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
      {outside && <ol className={s.rankList}>{around.map(row)}</ol>}
      {above && me && (
        <p className={`${s.rankGoal} text-body-sm font-semibold`}>
          바로 위 {above.name}님까지 <b>{above.score - me.score + 1}점</b>!
        </p>
      )}
      {me ? null : (
        <>
          <div className={s.nickLine}>
            <input
              className="text-input font-semibold"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitKey(e)) {
                  e.preventDefault();
                  submit();
                }
              }}
              maxLength={10}
              aria-label="닉네임"
              placeholder="닉네임 (10자 이내)"
              autoComplete="off"
              enterKeyHint="done"
            />
            <button type="button" className={`${s.btn} ${s.btnGreen}`} onClick={submit} disabled={saving}>
              랭킹 등록
            </button>
          </div>
          <p className={`${s.muted} ${s.hint} text-label`}>닉네임은 랭킹에 공개돼요.</p>
          {message && (
            <p role="status" className={`${s.warn} text-body-sm font-semibold`}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
