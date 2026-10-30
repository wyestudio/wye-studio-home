"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSessionGroupBlock } from "@/app/(site)/admin/group-bookings/actions";

/**
 * 파티모드 회차의 「단체 막기」 켜고 끄기.
 *
 * 파티는 인원 미달로 닫힐 수 있어 신청이 있어도 단체를 자동으로 막지 않는다. 회차가 확정되면
 * 켜서 그 시간에 단체 신청이 안 들어오게 한다(2026-10-30 대표님). 단체 예약 문의 화면의
 * 일정 마감 목록에도 같이 보인다.
 */
export function GroupBlockToggle({ sessionId, on }: { sessionId: string; on: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const res = await setSessionGroupBlock(sessionId, !on);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={on ? "이 회차 시간에 단체 신청을 다시 받습니다" : "이 회차 시간과 겹치는 단체 신청을 막습니다"}
        className={`rounded-md border px-3 py-1.5 text-micro transition-colors disabled:opacity-50 ${
          // 막는 것은 빨강 — 달력의 '막음' 표시와 같은 색(2026-10-30 대표님).
          on ? "border-[#ff6b6b] bg-[#ff6b6b]/15 text-[#ff6b6b]" : "border-border text-muted hover:border-[#ff6b6b] hover:text-[#ff6b6b]"
        }`}
      >
        {pending ? "처리중..." : on ? "단체 막는 중" : "단체 막기"}
      </button>
      {error && <span className="text-micro text-red-400">{error}</span>}
    </span>
  );
}
