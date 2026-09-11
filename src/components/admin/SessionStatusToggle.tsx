"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updateSessionStatus } from "@/app/(site)/admin/sessions/actions";

/**
 * 회차 모집/마감 전환.
 *
 * ⚠️ '회차 비활성화' 와는 다른 기능이다. 비활성화는 최소인원 미달로 회차를
 *    취소하면서 신청자 전원에게 문자를 보내는 것이고, 이건 그냥 더 받을지 말지만
 *    바꾼다 — 신청 건은 그대로 두고 문자도 안 나간다.
 */
export function SessionStatusToggle({
  sessionId,
  status,
  label,
  size = "sm",
}: {
  sessionId: string;
  status: string;
  /** 확인창에 띄울 회차 설명 (예: "9월 26일 (토) 11:30") */
  label: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 취소된 회차는 여기서 되돌리지 않는다. 신청이 전부 취소된 상태라 되살리면
  // 화면과 실제 신청 상태가 어긋난다.
  if (status === "cancelled") return null;

  const closing = status === "open";

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await updateSessionStatus(sessionId, closing ? "closed" : "open");
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        disabled={pending}
        className={`rounded border transition-colors disabled:opacity-50 ${
          size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]"
        } ${
          closing
            ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            : "border-glow/50 text-glow hover:bg-glow/10"
        }`}
      >
        {pending ? "처리중…" : closing ? "마감하기" : "다시 모집"}
      </button>

      <ConfirmDialog
        open={open}
        title={closing ? "이 회차를 마감할까요?" : "이 회차를 다시 열까요?"}
        message={
          closing
            ? `${label} 회차의 신규 신청을 더 받지 않습니다. 이미 접수된 신청은 그대로 두고 문자도 나가지 않습니다. 언제든 다시 열 수 있습니다.`
            : `${label} 회차를 다시 모집중으로 바꿉니다. 고객 화면에서 신청할 수 있게 됩니다.`
        }
        cancelLabel="아니요"
        confirmLabel={closing ? "네, 마감" : "네, 다시 모집"}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        danger={closing}
        error={error}
        confirmDisabled={pending}
      />
    </>
  );
}
