"use client";

import { useEffect } from "react";
import { DETAIL_EVENT, pushGa4Event } from "@/lib/analytics";

/**
 * 상세 페이지의 블록이 화면에 들어올 때마다 한 번씩 기록한다.
 *
 * 왜 (2026-09-30)
 *   "테마 상세 조회 → 신청 폼 열람" 사이가 퍼널에서 가장 크게 빠지는데, 그
 *   안에서 무슨 일이 있었는지 볼 방법이 없었다. 어느 블록까지 내려가고 멈추는지
 *   알면 고칠 블록이 특정된다 — 후기에서 멈추면 후기가 약한 것이고, 회차 선택에
 *   닿지도 못하면 동선이 너무 긴 것이다.
 *
 * 블록을 따로 고쳐 심지 않는다. 화면 블록은 전부 `[data-screen]` 이고 데스크톱
 * 목차(SectionNav)가 이미 그 속성으로 목록을 만든다. 여기서는 집계용 키
 * (`data-section-key`)만 더 읽는다 — 라벨은 운영자가 어드민에서 바꿀 수 있어
 * 집계 기준으로 쓰면 이름을 고친 날 통계가 두 갈래로 갈린다.
 *
 * ⚠️ 순서(`sectionIndex`)는 **DOM 순서**다. 어드민에서 블록 순서를 바꾸면 같은
 *    블록의 번호도 바뀐다. 기간을 걸쳐 볼 때 순서를 바꾼 시점이 있으면 그
 *    구간은 섞여 보인다.
 */
export function SectionViewTracker({ themeLabel }: { themeLabel: string }) {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-screen][data-section-key]")];
    if (els.length === 0) return;

    // 페이지 방문당 블록별 한 번. 오르내려도 다시 세지 않는다 —
    // 앞뒤 퍼널 칸이 전부 '세션 수' 라 단위를 맞춰야 한다.
    //
    // ⚠️ 기억해 두는 기준은 **키가 아니라 자리(순서)** 다. 한 테마에 같은 종류
    //    블록이 둘 이상 올 수 있어서(목록 블록 두 개 같은 것), 키로 기억하면
    //    둘째부터는 영영 안 세어져 한 칸으로 합쳐진다.
    const seen = new Set<number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const key = el.dataset.sectionKey ?? "";
          const index = els.indexOf(el);
          if (!key || seen.has(index)) continue;
          seen.add(index);
          pushGa4Event(DETAIL_EVENT.sectionView, {
            themeLabel,
            sectionKey: key,
            sectionLabel: el.dataset.navLabel ?? key,
            sectionIndex: index,
          });
        }
      },
      // 블록은 대체로 한 화면 크기다. 4분의 1이 보이면 '봤다' 로 친다 —
      // 절반을 기준으로 잡으면 짧은 덧붙임 블록이 끝까지 안 잡힌다.
      { threshold: 0.25 }
    );

    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [themeLabel]);

  return null;
}
