"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { captureAttribution } from "@/lib/attribution";

/**
 * 유입경로를 처음 도착한 순간에 한 번 잡아 둔다.
 *
 * 레이아웃에 한 번만 두면 된다. 화면을 그리지 않는다.
 * ⚠️ useSearchParams 를 쓰므로 부모에서 <Suspense> 로 감싸야 한다(Next 규칙).
 */
export function AttributionTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    captureAttribution();
    // 주소가 바뀔 때마다 확인한다 — utm 을 달고 들어온 경우를 놓치지 않기 위해.
    // 이미 기록돼 있고 새 utm 이 없으면 captureAttribution 이 알아서 넘어간다.
  }, [pathname, search]);

  return null;
}
