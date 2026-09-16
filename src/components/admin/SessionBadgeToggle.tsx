"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSessionBadge } from "@/app/(site)/admin/sessions/actions";

/** 지금 쓰는 태그는 '인기' 하나다. 다른 말이 필요해지면 여기에 더한다. */
const BADGE = "인기";

/**
 * 회차 '인기' 표시 켜고 끄기.
 *
 * 회차가 여럿 열려 있으면 "아무도 신청 안 했나?" 싶어 망설인다는 의견 때문에 만든 표시라
 * (2026-09-16), 운영자가 상황을 보고 그때그때 옮겨 달 수 있어야 한다.
 *
 * ⚠️ 마감·비활성화된 회차에는 고객 화면에서 태그가 안 보인다(마감 표시가 이긴다).
 *    여기서는 값이 그대로 남아 있으므로, 다시 모집중으로 돌리면 태그도 같이 돌아온다.
 */
export function SessionBadgeToggle({
  sessionId,
  badge,
}: {
  sessionId: string;
  badge: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const on = !!badge?.trim();

  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const res = await updateSessionBadge(sessionId, on ? null : BADGE);
      if ("error" in res && res.error) {
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
        title={on ? "고객 화면에서 태그를 뗍니다" : "고객 화면 시각 옆에 '인기' 를 붙입니다"}
        className={`rounded border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
          on
            ? "border-glow bg-glow/15 text-glow"
            : "border-border text-muted hover:border-glow hover:text-glow"
        }`}
      >
        {pending ? "처리중..." : on ? `${badge} 표시중` : "인기 표시"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
