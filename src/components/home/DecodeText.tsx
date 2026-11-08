"use client";

import { useEffect, useRef } from "react";

/**
 * 해독되는 글자 — 히어로 「would you escape?」.
 *
 * 커서가 지나가는 글자(와 양옆 한 글자)가 잠깐 무작위 기호로 깜빡이다가 원래 글자로 돌아온다.
 * 처음 화면에 뜰 때는 왼쪽부터 한 글자씩 해독된다. 휴대폰(커서 없음)은 처음 한 번 + 누를 때마다.
 *
 * - 글자를 바꿀 때 React 상태를 쓰지 않는다 — 초당 수십 번 바뀌므로 span 의 글자만 직접 바꾼다.
 * - 고정폭 글꼴(Geist Mono)이라 기호로 바뀌어도 폭이 흔들리지 않는다. 다른 글꼴에 쓰면 글자가 출렁인다.
 * - 기호는 ASCII 만 쓴다 — 글꼴에 없는 기호는 기기 기본 글꼴로 떨어져 모양이 제각각이 된다.
 * - 화면 낭독기 · 검색엔진에는 원래 문장 하나로 읽힌다(sr-only). 쪼갠 글자들은 aria-hidden.
 * - 모션 줄이기에서는 아무것도 하지 않는다.
 */

const GLYPHS = "#/\\<>=+*%$&@!?01[]{}~^";
const TICK_MS = 55;

export function DecodeText({ text, className = "" }: { text: string; className?: string }) {
  const spans = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...text];
    // 글자마다 "언제까지 흔들릴지"(시각). 0 이면 원래 글자.
    const until = chars.map(() => 0);
    let timer = 0;

    const render = () => {
      const now = performance.now();
      let busy = false;
      chars.forEach((c, i) => {
        const el = spans.current[i];
        if (!el || c === " ") return;
        if (until[i] > now) {
          busy = true;
          el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          el.dataset.scrambled = "";
        } else if ("scrambled" in el.dataset || el.textContent !== c) {
          // ⚠️ 글자만 비교하면 안 된다. 기호로 뽑힌 게 원래 글자와 같으면(마지막 「?」) 되돌리기를
          //    건너뛰어, 해독 중 표시(색)가 남은 채 멈췄다.
          el.textContent = c;
          delete el.dataset.scrambled;
        }
      });
      timer = busy ? window.setTimeout(render, TICK_MS) : 0;
    };
    const kick = () => {
      if (!timer) timer = window.setTimeout(render, 0);
    };

    const scramble = (i: number, ms: number) => {
      if (i < 0 || i >= chars.length) return;
      until[i] = Math.max(until[i], performance.now() + ms);
    };

    // 처음 — 왼쪽부터 차례로 풀린다
    const t0 = 450;
    chars.forEach((_, i) => scramble(i, t0 + i * 45));
    kick();

    // 커서가 지나간 글자 + 양옆
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const i = spans.current.indexOf(e.target as HTMLSpanElement);
      if (i < 0) return;
      scramble(i, 420 + Math.random() * 200);
      scramble(i - 1, 260 + Math.random() * 160);
      scramble(i + 1, 260 + Math.random() * 160);
      kick();
    };
    // 누르면(휴대폰) 문장 전체를 다시 해독
    const onTap = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      chars.forEach((_, i) => scramble(i, 250 + i * 35));
      kick();
    };

    const root = spans.current[0]?.parentElement;
    root?.addEventListener("pointermove", onMove);
    root?.addEventListener("pointerdown", onTap);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener("pointermove", onMove);
      root?.removeEventListener("pointerdown", onTap);
    };
  }, [text]);

  return (
    <h1 className={`decode-text pointer-events-auto ${className}`}>
      <span className="sr-only">{text}</span>
      {[...text].map((c, i) => (
        <span
          key={i}
          aria-hidden
          ref={(el) => {
            spans.current[i] = el;
          }}
        >
          {c}
        </span>
      ))}
    </h1>
  );
}
