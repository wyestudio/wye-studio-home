import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { BusySlot } from "@/lib/groupPricing";

/**
 * 운영자가 마감으로 표시한 단체 일정(어드민 > 단체 예약 문의).
 *
 * 단체 일정 데이터가 따로 없어서 견적은 '희망 일시' 로 받는다. 이미 찬 날만 운영자가
 * 막는다(2026-10-25 대표님). time 이 null 이면 그날 종일 마감이다.
 * 아니면 time 부터 minutes 분 동안이 마감이다(2026-10-30, closureSlots 로 겹침을 본다).
 */
export type GroupClosure = { date: string; time: string | null; minutes: number | null };

export const GROUP_CLOSURES_TAG = "group-closures";

async function _getGroupClosures(): Promise<GroupClosure[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("public_group_booking_closures")
    .select("date, start_time, minutes");
  // 읽기에 실패해도 견적 화면은 떠야 한다 — 마감 표시만 빠진다. 접수 함수가 한 번 더 막는다.
  if (error || !data) return [];
  return (data as { date: string; start_time: string | null; minutes: number | null }[]).map((r) => ({
    date: r.date,
    time: r.start_time,
    minutes: r.minutes,
  }));
}

/**
 * 같은 장소에서 신청자가 있는 노말모드 회차의 시간대(DB 뷰 public_group_busy_slots).
 * 신청이 들어오는 시점에 태그를 털지는 않는다 — 60초 안에 화면에 반영되고, 그 사이 들어온
 * 단체 신청은 접수 API 가 캐시 없이 다시 본다.
 */
async function _getGroupBusySlots(): Promise<BusySlot[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("public_group_busy_slots").select("date, start_time, end_time");
  if (error || !data) return [];
  return (data as { date: string; start_time: string; end_time: string }[]).map((r) => ({
    date: r.date,
    start: r.start_time,
    end: r.end_time,
  }));
}

export const getGroupBusySlots = unstable_cache(_getGroupBusySlots, ["group-busy-slots"], {
  revalidate: 60,
  tags: [GROUP_CLOSURES_TAG],
});

/** 60초. 어드민에서 마감을 바꾸면 태그로 바로 턴다. */
export const getGroupClosures = unstable_cache(_getGroupClosures, ["group-closures"], {
  revalidate: 60,
  tags: [GROUP_CLOSURES_TAG],
});
