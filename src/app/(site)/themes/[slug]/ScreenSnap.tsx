"use client";

import { useEffect } from "react";

/**
 * 데스크톱에서 스크롤이 블록 경계 **근처에서 멈추면** 블록 윗끝에 살짝 붙게 한다.
 * 브라우저 기본 기능(CSS scroll-snap, proximity)이라 입력을 가로채지 않는다.
 * 규칙은 globals.css 의 `html.screen-snap` 에 있다. 이 컴포넌트는 테마 상세에 있는 동안만 켠다.
 *
 * 왜 바꿨나 (2026-09-16)
 *   처음(2026-09-15)에는 휠 이벤트를 가로채 '휠 한 번 = 블록 하나' 로 직접 넘겼다.
 *   그랬더니 스크롤이 **씹힌다**는 의견이 나왔다. 원인은 둘이었다.
 *   - 트랙패드는 한 번 쓸면 관성 휠 이벤트가 1초 가까이 쏟아진다. 두 칸씩 넘어가지 않게
 *     '잠잠해질 때까지 먹기' 를 했는데, 그 사이에 다시 쓸면 새 동작까지 먹혔다.
 *   - 휠을 가로채려면(preventDefault) 브라우저가 매 이벤트마다 스크립트를 기다렸다가
 *     스크롤한다. 무거운 화면에서는 반응이 한 박자 늦다.
 *   스크롤바를 잡고 끌 때만 멀쩡했던 것도 그래서다 — 그건 가로채지 않았다.
 *
 * ⚠️ 휠을 다시 가로채지 말 것. 블록 사이 이동은 왼쪽 목차(SectionNav)가 맡는다.
 * ⚠️ proximity(가까울 때만)를 쓴다. mandatory 는 긴 블록(후기) 안에서 멈출 수가 없다.
 */
export function ScreenSnap() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("screen-snap");
    return () => root.classList.remove("screen-snap");
  }, []);

  return null;
}
