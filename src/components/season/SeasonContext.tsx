"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteSkin } from "@/lib/season";

/**
 * 지금 씌운 시즌 스킨을 클라이언트 컴포넌트에 알린다.
 *
 * 장식·색은 CSS(<html data-season>)로 충분하지만, **그림 자체를 바꿔야 하는 곳**
 * (홈 마스코트)은 src 를 골라야 해서 값이 필요하다. 루트 레이아웃이 서버에서 읽은
 * 값을 그대로 내려주므로 서버·클라이언트 그림이 어긋나지 않는다.
 */
const SeasonContext = createContext<SiteSkin | null>(null);

export function SeasonProvider({ skin, children }: { skin: SiteSkin | null; children: ReactNode }) {
  return <SeasonContext.Provider value={skin}>{children}</SeasonContext.Provider>;
}

export function useSiteSkin(): SiteSkin | null {
  return useContext(SeasonContext);
}
