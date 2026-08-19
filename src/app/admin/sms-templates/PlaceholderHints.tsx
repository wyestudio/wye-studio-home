"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export const PLACEHOLDER_INFO: Record<string, { label: string; example: string }> = {
  name: { label: "신청자 이름", example: "홍길동" },
  theme_name: { label: "테마명", example: "바-ㅇ탈출" },
  product_label: { label: "그룹/소개팅 파티형 방탈출 표기", example: "그룹 파티형 방탈출" },
  event_date: { label: "진행 날짜", example: "8/29(토)" },
  start_time: { label: "시작 시각", example: "13:00" },
  end_time: { label: "종료 시각 (~포함, 없으면 빈 값)", example: "~17:00" },
  duration: { label: "소요 시간", example: "3시간 30분" },
  attendee_count: { label: "참여 인원 수", example: "2" },
  confirmation_code: { label: "접수번호", example: "384920" },
  price: { label: "입금액", example: "69,000원" },
  bank_name: { label: "입금 은행명", example: "카카오뱅크" },
  account_number: { label: "입금 계좌번호", example: "3333-05-2843942" },
  account_holder: { label: "예금주", example: "김시온" },
  depositor_name: { label: "신청 시 입력한 입금자명", example: "홍길동" },
  venue_name: { label: "장소명", example: "뮤트스페이스 신림점" },
  venue_address_text: { label: "장소 주소 (괄호 포함, 없으면 빈 값)", example: " (서울 관악구 ...)" },
  reapply_url: { label: "재신청 링크", example: "www.wouldyouescape.com/sessions/0829-meeting" },
  refund_amount: { label: "환불 금액", example: "138,000원" },
};

export function PlaceholderHints({ placeholders }: { placeholders: string[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  }

  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2">
      {placeholders.map((key) => {
        const info = PLACEHOLDER_INFO[key];
        return (
          <span key={key} className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              onClick={() => handleCopy(key)}
              className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-glow transition-colors hover:border-brand"
            >
              {copied === key ? "복사됨!" : `{{${key}}}`}
            </button>
            <AnimatePresence>
              {hovered === key && info && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="glass-panel pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg px-3 py-2 text-xs"
                >
                  <p className="font-semibold text-foreground">{info.label}</p>
                  <p className="mt-0.5 text-muted">예: {info.example}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </span>
        );
      })}
    </div>
  );
}
