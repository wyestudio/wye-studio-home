"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 실제 동시 접속자 수를 Supabase Realtime Presence로 세되, 베타 초기라 숫자가
// 너무 작아 보이는 걸 막기 위해 시간대·페이지별로 자연스럽게 변하는 최소값과
// max()를 취한다. 실제 인원이 그보다 많아지면 즉시 실제 값으로 넘어간다.
const BASELINE_MIN = 3;
const BASELINE_RANGE = 7; // 3 ~ 9명
const BASELINE_BUCKET_MS = 10 * 60 * 1000; // 10분마다 값 갱신

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function baselineCount(scopeKey: string): number {
  const bucket = Math.floor(Date.now() / BASELINE_BUCKET_MS);
  const seed = hashString(`${scopeKey}:${bucket}`);
  return BASELINE_MIN + (seed % BASELINE_RANGE);
}

/** scopeKey로 구분되는 페이지(예: 세션 slug)의 실시간 열람자 수를 구독한다. */
export function useLiveViewerCount(scopeKey: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const channel = supabase.channel(`viewers:${scopeKey}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });

    const recompute = () => {
      if (!mounted) return;
      const real = Object.keys(channel.presenceState()).length;
      setCount(Math.max(real, baselineCount(scopeKey)));
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          recompute();
        }
      });

    // presence 변화가 없어도 시간대 버킷이 바뀌면 반영되도록 주기적으로 재계산
    const interval = setInterval(recompute, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [scopeKey]);

  return count;
}
