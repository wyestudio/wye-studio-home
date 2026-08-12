import type { ReactNode } from "react";

// 회차 카드(SessionCard)가 이미 쓰고 있는 유리+네온 hud-panel 시스템을 그대로
// 재사용한다 — "유리 디스플레이, 네온, 우주비행선 느낌"이 명시적 요청이라
// 이미 검증된 언어를 새로 발명하지 않고 색(--glow)만 다르게 입힌다.
export function HudCard({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: "div" | "ol";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`hud-panel hud-panel-glow relative h-full ${className}`}>{children}</Tag>;
}
