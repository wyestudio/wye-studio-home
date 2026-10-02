"use client";

import { useEffect } from "react";
import { GROUP_EVENT, pushGa4Event } from "@/lib/analytics";
import { GROUP_PAGE_LABEL } from "@/lib/groupBooking";

/**
 * 어느 링크를 타고 들어왔는지 한 번 기록한다.
 *
 * 상세 페이지의 연결 4곳이 전부 `?from=<진입지점>` 을 달고 있고(groupBookingHref),
 * 서버가 그 값을 걸러 여기로 넘긴다. 링크마다 클릭 핸들러를 붙이지 않는 이유는
 * `groupBooking.ts` 의 groupBookingHref 주석에 적어 뒀다.
 *
 * ⚠️ 화면에 아무것도 그리지 않는다.
 */
export function GroupEntryTracker({ entry }: { entry: string }) {
  useEffect(() => {
    pushGa4Event(GROUP_EVENT.entryClick, {
      themeLabel: GROUP_PAGE_LABEL,
      sectionKey: entry,
    });
  }, [entry]);

  return null;
}
