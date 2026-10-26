"use client";

import { createContext, useContext } from "react";
import type { QuoteOptions } from "@/lib/groupPricing";

/**
 * 견적 카드와 안내의 타임테이블(ProgramBuilder)이 **같은 옵션 값**을 쓰게 하는 통로.
 *
 * 안내는 서버에서 그려 GroupQuoteFlow 안에 끼워 넣는다. 그 안의 클라이언트 컴포넌트도
 * 이 컨텍스트를 읽을 수 있다 — 그래서 안내에서 옵션을 켜면 견적 금액이 바로 바뀐다.
 * 값을 따로 들면 "안내에서 켰는데 견적엔 없는" 상태가 된다.
 */
export type QuoteCtx = {
  /** 회차 규칙까지 반영한 옵션(주말 11:30 이면 애프터파티 0). */
  options: QuoteOptions;
  setOptions: (o: QuoteOptions) => void;
  /** 고른 시작 시간. 없으면 타임테이블은 경과 시간(0:00 부터)으로 보여 준다. */
  time: string | null;
  /** 프로그램 길이(분). 애프터파티 제외. */
  minutes: number;
  optionsTotal: number;
  /** 고른 날짜·회차에서 애프터파티가 되는지. 아직 안 골랐으면 true. */
  partyOk: boolean;
  /** 견적 카드의 시간 줄을 연다(모바일은 시트를 올린다). */
  openTimeRow: () => void;
};

export const QuoteContext = createContext<QuoteCtx | null>(null);

export function useQuoteContext(): QuoteCtx | null {
  return useContext(QuoteContext);
}
