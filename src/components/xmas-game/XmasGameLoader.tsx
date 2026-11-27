"use client";

import dynamic from "next/dynamic";
import { characterSvg } from "./xmasGameArt";
import { XMAS_GAME_PAGE_TITLE } from "./xmasGameShared";
import l from "./XmasGameLoader.module.css";
import theme from "./xmasScene.module.css";

// 달력에서 나오는 순서 그대로 — 눈사람이 먼저 떠 있고, 오래 걸리면 루돌프 · 산타가 번갈아 올라온다
const WAITING = [characterSvg("snow", null, false), characterSvg("deer", null, false), characterSvg("santa", null, false)];

/**
 * 게임을 내려받는 동안의 화면 — 달력 문 한 칸에서 눈사람 · 루돌프 · 산타가 번갈아 올라와 폴짝거린다.
 * 대개는 눈사람만 보고 넘어가지만, 느린 연결에서는 몇 초가 걸린다. 제목 글자만 떠 있으면 멈춘 줄 알고 나간다
 * (2026-11-26 대표님). 배경은 게임 화면과 같아서 다 받았을 때 화면이 바뀌는 티가 나지 않는다.
 */
function Loading() {
  return (
    <div className={`${theme.theme} ${theme.scene} ${theme.falling} ${l.root} font-sans`} role="status" aria-label="게임을 불러오는 중">
      <div className={l.door} aria-hidden>
        {WAITING.map((art, i) => (
          <span key={i} className={l.char} dangerouslySetInnerHTML={{ __html: art }} />
        ))}
      </div>
      <p className={l.title} aria-hidden>
        {XMAS_GAME_PAGE_TITLE}
      </p>
      <span className={l.dots} aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/**
 * 게임 화면을 브라우저에서만 그린다.
 *
 * 게임은 처음 그릴 때부터 브라우저의 것을 읽는다 — 소리 켬/끔 · 받은 선물 코드 · 닉네임(localStorage), 들어온 화면과
 * 친구의 기록(주소). 서버가 먼저 그리면 그 값을 몰라 서로 다른 화면이 나온다. 그래서 서버는 기다리는 화면만 내보낸다.
 */
const XmasGame = dynamic(() => import("./XmasGame"), { ssr: false, loading: Loading });

export function XmasGameLoader() {
  return <XmasGame />;
}
