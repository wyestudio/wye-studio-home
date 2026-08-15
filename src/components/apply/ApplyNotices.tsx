"use client";

import { useState } from "react";

export function ApplyNotices({ isDatingSession }: { isDatingSession: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const bullets = [
    "현장에서 신분증을 확인하며, 신청 정보와 다를 경우 참여가 제한될 수 있습니다.",
    "식사는 제공되지 않고 간단한 다과만 준비됩니다. 미리 식사하고 오시는 것을 추천드립니다.",
    "조 편성은 최대한 공평하게 진행하되, 참여 인원이나 방탈출 경험 등에 따라 조별 인원이 조금씩 달라질 수 있습니다.",
    ...(isDatingSession
      ? [
          "성비는 5:5에 가깝게 맞추려 하지만, 신청 현황에 따라 달라질 수 있습니다.",
          "2부부터는 음주가 가능합니다. 만 19세 이상만 참가 가능하며 현장에서 신분증을 확인합니다.",
        ]
      : []),
    "지각·노쇼 등 다른 참여자에게 피해를 주는 행동은 이후 이용에 제한이 있을 수 있습니다.",
    "입금 계좌 안내는 신청자 전화번호로 보내드립니다.",
  ];

  return (
    <div className="hud-panel hud-panel-glow relative flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-base font-bold" style={{ color: "var(--hud-accent)" }}>
          참가 전 안내사항
        </h2>
        <p className="mt-1 text-xs text-muted">공정하고 즐거운 진행을 위해 아래 내용을 확인해주세요.</p>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${collapsed ? "max-h-0" : "max-h-[600px]"}`}>
        <ul className="flex flex-col gap-3 text-sm text-foreground">
          {bullets.map((text, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-brand">✓</span>
              <span className="text-muted">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center gap-1 border-t border-border pt-2 text-xs text-muted hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <>
            <span>더보기</span>
            <span>↓</span>
          </>
        ) : (
          <>
            <span>접기</span>
            <span>↑</span>
          </>
        )}
      </button>
    </div>
  );
}
