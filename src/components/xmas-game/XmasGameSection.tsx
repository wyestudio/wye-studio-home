"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pushGa4Event } from "@/lib/analytics";
import { characterSvg, giftSvg, treeSvg } from "./xmasGameArt";
import { jua } from "./xmasGameFont";
import {
  XMAS_GAME_EVENT,
  XMAS_GAME_HASH,
  XMAS_GAME_PATH,
  formatGiftCode,
  gameHref,
  savedGiftCode,
} from "./xmasGameShared";
import c from "./XmasGameSection.module.css";
import theme from "./xmasScene.module.css";

// 눈사람은 잡힌 표정(><)으로 — 옆에 +1 이 뜬다
const SNOWMAN_HIT = characterSvg("snow", null, true);
const RUDOLPH = characterSvg("deer", null, false);
const SANTA_WITH_GIFT = characterSvg("santa", "?", false);
const GIFT = giftSvg();
const TREE = treeSvg();
const SANTA = characterSvg("santa", null, false);

/** 손님이 직접 화면을 움직였다는 신호 — 이게 오면 자동 스크롤을 멈춘다. */
const USER_MOVES = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

const noop = () => () => {};

/**
 * 받은 선물 코드를 다시 읽을 때 — 게임은 새 창에서 하고 「돌아가기」 는 그 창을 닫을 뿐이라, 이 창(상세)은 코드를 받기 전
 * 모습 그대로 남는다(2026-11-27 대표님 — "돌아가면 받은 코드가 바로 보이게").
 *   storage    다른 창(게임)이 저장소에 코드를 적는 순간 이 창에 온다
 *   focus      이 창으로 돌아왔을 때(storage 가 안 오는 브라우저 대비)
 *   pageshow   같은 탭에서 뒤로 가기로 돌아와 예전 화면이 되살아났을 때
 */
function subscribeGiftCode(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("pageshow", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("pageshow", onChange);
  };
}

/**
 * 크리스마스 이벤트 「산타의 어드벤트 캘린더」 입구 — 테마 상세의 회차 선택과 상세 정보 사이(2026-11-26 대표님).
 *
 * 크리스마스 스킨이 켜져 있을 때만 붙는다(page.tsx). 스킨을 끄면 같이 사라진다.
 * 게임은 여기서 하지 않는다 — 「게임 참여하기」 가 **새 창**으로 게임 화면(/santa-calendar)을 연다.
 * 상세 페이지가 화면 전체를 게임에 내주면 보던 자리를 잃는다(같은 날 대표님). 새 창이면 이 창은 그대로 남는다.
 *
 * 무엇을 두는가(같은 날 대표님 — 세 번 고쳐 여기로 왔다):
 *   - 앞세우는 것은 **게임하면 크리스마스 선물을 받는다**와 **참여 버튼**이다.
 *   - 맥락은 무슨 게임인지 하나뿐이다(한 문장 + 달력 여섯 칸 그림). 받는 것은 제목이 이미 말한다.
 *     참여 순서 세 칸 · 수령 방법 · 랭킹 안내까지 늘어놓았더니 "쓸데없는 정보가 많아 피곤하다" 였고,
 *     전부 걷어냈더니 "너무 없어서 맥락을 모르겠다" 였고, 조건 칸("○○점 이상이면…")과 맨 아래 교환권까지 넣었더니
 *     "또 너무 길다" 였다. 이 선에서 더하지도 빼지도 않는다.
 *   - 게임의 달력은 "크리스마스 어드벤트 캘린더" 라고 부른다("달력" 이라고 줄여 쓰지 않는다 — 같은 날 대표님).
 *   - 그 한 문장은 설명이 아니라 예고편이다 — "~해요" · "~다" 로 풀어 쓰지 않고 명사로 끊어 친다(같은 날 대표님).
 *     "두더지 잡기" 를 넣는다: 거기서 따온 게임이라 그 한마디면 무슨 게임인지 바로 안다. "어드벤트 캘린더 순발력 게임"
 *     처럼 우리 이름으로만 부르면 무슨 말인지 모른다. 마지막 문장은 참여를 끌어당기는 한마디다(랭킹).
 *   - 블록 제목은 게임 이름이 아니라 "크리스마스 이벤트" 다(같은 이유 — 게임 이름만 봐서는 뭔지 모른다). "크리스마스" 는
 *     한 글자씩 빨강 · 초록을 번갈아 칠하고 양옆에 트리와 산타를 세운다. 그림은 이모지가 아니라 SVG 다(이모지는 기기마다 다르게 그려진다).
 *
 * - 게임 화면의 「돌아가기」 는 #xmas-game 으로 여기에 내려온다(공유 링크는 게임 화면으로 바로 간다 — 받은 사람도
 *   돌아가기를 누르면 여기로 온다).
 * - 달력 그림 밑의 금색 점선 칸이 선물 코드 자리다. 받은 브라우저에는 코드를 다시 보여 준다(현장에서 이 화면을 열어
 *   보여 줄 수 있다). 아직 안 받았으면 같은 자리에 빈 칸(???-???)을 둔다 — 칸이 없으면 오른쪽이 왼쪽보다 짧아 좌우가
 *   안 맞고, 코드를 받는 순간 판의 짜임이 바뀐다. 휴대폰에서는 빈 칸을 감춘다(세로로 길어진다).
 * - 휴대폰에서는 "제목 → 한 문장 → 달력 그림 → (코드) → 버튼" 순서다. 글이 먼저 오고 누를 것이 맨 아래(엄지가 닿는 곳)에 온다.
 * - 판 안의 제목 · 숫자 · 버튼은 게임 화면과 같은 글꼴(주아)이다. 판 밖의 소제목 · 제목은 사이트 글꼴 그대로다.
 *   ⚠️ c.display 를 붙인 곳에는 text-* · font-extrabold 토큰을 같이 쓰지 않는다(주아는 굵기가 하나고, 크기는 CSS 가 정한다).
 *
 * ⚠️ 문구는 확정된 내용만 적는다(대표님 설명 · 승인 시안). 선물 종류 · 수량 · 기간은 정해지지 않았으니
 *    지어 넣지 않는다.
 * ⚠️ 서버가 그릴 때는 주소 · 저장소를 모른다. 링크는 칸 없는 게임 주소로 그리고, 브라우저에서 지금 화면의 주소를 실어 채운다.
 */
export function XmasGameSection({
  themeLabel,
  accent,
  align = "center",
  headingClassName = "mb-6 sm:mb-10",
}: {
  themeLabel: string;
  accent?: string;
  /** 소제목 · 제목 정렬 — 단체 예약 페이지는 다른 블록 제목이 전부 왼쪽이라 맞춘다(2026-11-27 대표님) */
  align?: "center" | "left";
  /** 제목과 판 사이 — 기본은 테마 상세의 다른 블록과 같은 값. 단체 예약 페이지는 그쪽 블록 간격(mb-5)을 넘긴다 */
  headingClassName?: string;
}) {
  const section = useRef<HTMLElement>(null);
  // 서버가 그릴 때는 저장소를 모른다 — 빈 값으로 그리고 브라우저에서 채운다
  const code = useSyncExternalStore(subscribeGiftCode, savedGiftCode, () => null);
  // 게임 화면에 지금 화면(모드 포함)을 실어 보낸다 — 그쪽의 돌아가기 · 공유가 이 값을 쓴다
  const href = useSyncExternalStore(noop, gameHref, () => XMAS_GAME_PATH);

  useEffect(() => {
    // 게임 화면의 돌아가기(#xmas-game)로 들어왔을 때 — 여기로 내려오는 것은 브라우저가 하지만, 페이지가
    // 뜨는 동안 위쪽 블록의 높이가 바뀌면 어긋난다(사파리는 따라가 주지 않는다). 높이가 바뀔 때마다 다시 맞추다가,
    // 손님이 직접 움직이거나 2.5초가 지나면 손을 뗀다.
    const el = section.current;
    if (!el || window.location.hash !== `#${XMAS_GAME_HASH}`) return;
    const go = () => el.scrollIntoView();
    const resize = new ResizeObserver(go);
    const stop = () => {
      resize.disconnect();
      clearTimeout(timer);
      for (const type of USER_MOVES) window.removeEventListener(type, stop);
    };
    const timer = setTimeout(stop, 2500);
    for (const type of USER_MOVES) window.addEventListener(type, stop, { passive: true });
    resize.observe(document.body);
    go();
    return stop;
  }, []);

  useEffect(() => {
    // 이 블록을 본 사람 수 — 참여 현황의 첫 칸이다. 4분의 1이 보이면 봤다고 친다(다른 블록의 SectionViewTracker 와 같은 기준).
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        pushGa4Event(XMAS_GAME_EVENT.view, { themeLabel });
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [themeLabel]);

  return (
    <section id={XMAS_GAME_HASH} ref={section} aria-label="크리스마스 이벤트" className={`${theme.theme} ${c.section}`}>
      <SectionHeading
        eyebrow="CHRISTMAS EVENT"
        title={
          <span className={c.title}>
            <span className={c.titleArt} aria-hidden dangerouslySetInnerHTML={{ __html: TREE }} />
            <span aria-hidden>
              {[..."크리스마스"].map((letter, i) => (
                <span key={i} className={i % 2 ? c.titleGreen : c.titleRed}>
                  {letter}
                </span>
              ))}{" "}
              이벤트
            </span>
            <span className="sr-only">크리스마스 이벤트</span>
            <span className={c.titleArt} aria-hidden dangerouslySetInnerHTML={{ __html: SANTA }} />
          </span>
        }
        eyebrowColor={accent}
        align={align}
        className={headingClassName}
      />

      {/*
        판 안은 게임 화면과 같은 세계다 — 같은 풍경(xmasScene.module.css), 같은 글꼴(주아), 같은 버튼 · 금색 점선 칸 · 달력 틀.
        눌러서 들어갈 곳이 어떤 곳인지 여기서 먼저 보인다(2026-11-26 대표님).
      */}
      <div className={`${jua.variable} ${theme.theme} ${theme.scene} ${c.panel}`}>
        <div className={c.banner}>
          <div className={c.text}>
            <h3 className={`${c.headline} ${c.display}`}>
              게임하고
              <br />
              <span className={c.em}>크리스마스 선물</span> 받아가세요!
            </h3>
            {/* 문장마다 한 덩어리 — 휴대폰에서는 문장 하나가 한 줄이 된다(문장 중간에서 끊기면 읽는 호흡이 깨진다) */}
            <p className={`${c.lead} text-body`}>
              <span>크리스마스 어드벤트 캘린더 두더지 잡기!</span> <span>눈사람과 루돌프는 터치, 산타는 터치 금지.</span>{" "}
              <span>내 순발력 랭킹은 몇 위일까?</span>
            </p>
            <a
              href={href}
              onClick={() => pushGa4Event(XMAS_GAME_EVENT.open, { themeLabel })}
              target="_blank"
              // opener 를 남긴다 — 게임 화면의 「돌아가기」 가 그 창을 닫고 이 창으로 돌아오려면 열어 준 창을 알아야 한다.
              // 같은 사이트 안의 화면이라 남겨도 된다(바깥 사이트로 가는 링크에는 쓰지 않는다)
              rel="opener"
              className={`${c.start} ${c.display}`}
            >
              게임 참여하기
            </a>
          </div>

          {/*
            게임의 한 장면 — 달력 여섯 칸. 닫힌 문 셋(날짜), 열린 문 셋(눈사람을 잡아 +1 이 뜬 순간 · 루돌프 ·
            물음표 선물을 든 산타). 규칙을 글로 풀지 않고 이 그림이 보여 준다.
            선물 코드 자리는 그 밑에 붙는다 — 받았으면 코드가, 아직이면 빈 칸이. 게임 화면 「게임 방법」 의 금색 점선 칸과 같은 모양.
          */}
          <div className={c.side}>
            <div className={c.board} aria-hidden>
              <span className={`${c.door} ${c.doorRose} ${c.display}`}>21</span>
              <span className={c.open}>
                <span dangerouslySetInnerHTML={{ __html: SNOWMAN_HIT }} />
                <b className={`${c.pop} ${c.display}`}>+1</b>
              </span>
              <span className={`${c.door} ${c.doorPine} ${c.display}`}>23</span>
              <span className={c.open}>
                <span dangerouslySetInnerHTML={{ __html: RUDOLPH }} />
              </span>
              <span className={`${c.door} ${c.doorSun} ${c.display}`}>24</span>
              <span className={c.open}>
                <span dangerouslySetInnerHTML={{ __html: SANTA_WITH_GIFT }} />
              </span>
            </div>
            {code ? (
              <p className={c.code}>
                <span aria-hidden dangerouslySetInnerHTML={{ __html: GIFT }} />
                <span>
                  <small className="text-label font-semibold">내 선물 코드</small>
                  <strong className={c.display}>{formatGiftCode(code)}</strong>
                </span>
              </p>
            ) : (
              // 아직 못 받은 코드의 자리 — 그림의 일부라 읽어 주지 않는다
              <p className={`${c.code} ${c.codeLocked}`} aria-hidden>
                <span dangerouslySetInnerHTML={{ __html: GIFT }} />
                <span>
                  <small className="text-label font-semibold">내 선물 코드</small>
                  <strong className={c.display}>???-???</strong>
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
