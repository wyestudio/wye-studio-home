import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * 운영자가 마감으로 표시한 단체 일정(어드민 > 단체 예약 문의).
 *
 * 단체 일정 데이터가 따로 없어서 견적은 '희망 일시' 로 받는다. 이미 찬 날만 운영자가
 * 막는다(2026-10-25 대표님). time 이 null 이면 그날 종일 마감이다.
 */
export type GroupClosure = { date: string; time: string | null };

export const GROUP_CLOSURES_TAG = "group-closures";

async function _getGroupClosures(): Promise<GroupClosure[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("public_group_booking_closures")
    .select("date, start_time");
  // 읽기에 실패해도 견적 화면은 떠야 한다 — 마감 표시만 빠진다. 접수 함수가 한 번 더 막는다.
  if (error || !data) return [];
  return (data as { date: string; start_time: string | null }[]).map((r) => ({
    date: r.date,
    time: r.start_time,
  }));
}

/** 60초. 어드민에서 마감을 바꾸면 태그로 바로 턴다. */
export const getGroupClosures = unstable_cache(_getGroupClosures, ["group-closures"], {
  revalidate: 60,
  tags: [GROUP_CLOSURES_TAG],
});
