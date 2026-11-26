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
  XMAS_GAME_TITLE,
  applyPath,
  formatGiftCode,
  friendRecord,
  returnPath,
  savedGiftCode,
  shareHeadline,
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
        const next = id ? await submitScore(id, round, e.points, e.peak) : null;
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
  const restart = () => {
    game.reset();
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
    const me = board?.me;
    const record: ShareRecord = {
      round: me ? me.round : round,
      score: me ? me.score : points,
      rank: me ? me.rank : null,
      who: SHARE_CHARACTERS[Math.floor(Math.random() * SHARE_CHARACTERS.length)],
    };
    const url = shareUrl(record);
    const text = `${shareHeadline(record)} 내 기록에 도전해 보세요.\n우주이스케이프 크리스마스 이벤트 「${XMAS_GAME_TITLE}」`;
    pushGa4Event(XMAS_GAME_EVENT.share, { themeLabel: origin });
    if (navigator.share) {
      try {
        await navigator.share({ title: XMAS_GAME_TITLE, text, url });
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
        <h1 className={`${s.wordmark} ${s.display}`}>{XMAS_GAME_TITLE}</h1>
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
              +1
            </li>
            <li>
              <span aria-hidden dangerouslySetInnerHTML={{ __html: RUDOLPH }} />
              <span className="sr-only">루돌프</span>
              +1
            </li>
            <li className={s.legendBad}>
              <span aria-hidden dangerouslySetInnerHTML={{ __html: SANTA }} />
              <span className="sr-only">산타</span>
              −1
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
          {view.phase === "rules" && (
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
                  <b className={`${s.point} ${s.pointBad} ${s.display}`}>−1</b>
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
              {/* 자동으로 초점을 주지 않는다 — 창이 뜨자마자 누르지도 않은 버튼에 테두리가 둘러져 있으면 고장처럼 보인다 */}
              <button type="button" className={`${s.btn} ${s.btnBig}`} onClick={game.begin}>
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
                <button type="button" className={`${s.btn} ${s.btnPaper}`} onClick={game.skipPuzzle}>
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
              {code && (
                <div className={s.ticket}>
                  <small className="text-label font-semibold">선물 코드</small>
                  <strong className={s.display}>{formatGiftCode(code)}</strong>
                  <p className="text-body-sm">이 코드를 현장에서 직원에게 보여주시면 크리스마스 선물을 드려요.</p>
                  {/* 선물은 참여하는 날 받는다 — 코드를 받은 자리에서 바로 신청으로 잇는다. 이 카드에서 가장 먼저 누를 것 */}
                  <button type="button" className={`${s.btn} ${s.btnBig}`} onClick={goApply}>
                    참여 신청하러 가기
                  </button>
                </div>
              )}
              {result.kind === "win" && (
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
        {shown?.hit && <span className={`${s.pop} ${santa ? s.popBad : ""}`}>{santa ? "아이쿠! −1" : "+1"}</span>}
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
  return (
    <div className={s.rank}>
      <div className={s.rankHead}>
        <strong className={s.display}>{listed ? "현재 랭킹" : "랭킹에 내 기록 올리기"}</strong>
        {listed && <span className={`${s.muted} text-label`}>등록 {board.players}명</span>}
      </div>
      {raised && (
        <p className={`${s.rankNews} ${s.display}`} role="status">
          {climbed > 0 ? `${before.rank}위에서 ${me.rank}위로 랭킹 상승!` : `최고 기록 ${me.score}점 달성!`}
        </p>
      )}
      {listed &&
        (board.top.length ? (
          <ol className={s.rankList}>
            {board.top.map((row) => (
              <li
                key={row.rank}
                className={`${s.rankRow} ${row.me ? s.rankMe : ""} ${row.me && raised ? s.rankUp : ""}`}
                style={row.me && raised ? climb : undefined}
              >
                <b className={s.display}>{row.rank}</b>
                <span className={`${s.rankName} text-body font-semibold`}>{row.name}</span>
                <span className={`${s.rankScore} ${s.display}`}>{row.score}점</span>
                <span className={`${s.rankRound} text-label`}>{row.round}라운드</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={`${s.muted} text-body-sm`}>아직 등록된 기록이 없어요.</p>
        ))}
      {me ? (
        // 내가 위 세 명 안에 있으면 그 줄이 이미 칠해져 있다 — 같은 말을 두 번 하지 않는다
        me.rank > board.top.length && (
          <p className={`${s.rankMine} ${raised ? s.rankUp : ""} text-body font-semibold`} style={raised ? climb : undefined}>
            <span>
              내 순위<b className={s.display}>{me.rank}위</b>
            </span>
            <span>
              {me.name}
              <small className="text-label font-normal">최고 {me.score}점</small>
            </span>
          </p>
        )
      ) : (
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
