"use client";

import { useState } from "react";
import { AdminEmpty } from "@/components/admin/ui";
import { CouponPanel, type CouponRow } from "./CouponPanel";
import { SendPanel } from "./SendPanel";
import type { CampaignRow } from "./CampaignEditor";
import type { PickerSession } from "@/components/admin/SessionPicker";

type Tab = "running" | "ended" | "send";

/**
 * 쓸 수 있는 쿠폰인가 — 중지하지 않았고 사용 종료일이 지나지 않았다.
 * ⚠️ 목록을 탭으로 가르는 데만 쓴다. 실제 사용 가능 여부는 서버(DB)가 따로 판단한다.
 */
function isRunning(c: CampaignRow, nowIso: string): boolean {
  if (!c.is_active) return false;
  return !c.valid_until || Date.parse(c.valid_until) > Date.parse(nowIso);
}

/** 쿠폰 — 진행 중 / 중지 · 끝남 / 발송(관리자 개편 docs/01 5장). 발급 · 수정은 쿠폰 한 건을 펼친 안에 있다. */
export function CouponTabs(props: {
  campaigns: CampaignRow[];
  coupons: CouponRow[];
  themes: { id: string; name: string }[];
  sessions: PickerSession[];
  templates: { key: string; label: string }[];
  /** 서버가 화면을 그린 시각 — 진행 중 / 끝남을 가르는 기준. */
  nowIso: string;
}) {
  const [tab, setTab] = useState<Tab>("running");
  const running = props.campaigns.filter((c) => isRunning(c, props.nowIso));
  const ended = props.campaigns.filter((c) => !isRunning(c, props.nowIso));
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "running", label: "진행 중", count: running.length },
    { key: "ended", label: "중지 · 끝남", count: ended.length },
    { key: "send", label: "발송" },
  ];

  return (
    <div>
      <div className="mb-4 overflow-x-auto border-b border-border [scrollbar-width:none]">
        <div role="tablist" aria-label="쿠폰" className="flex min-w-max gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-label font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 text-micro ${tab === t.key ? "bg-foreground text-background" : "bg-fill-strong text-muted"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab !== "send" ? (
        <CouponPanel
          // 탭을 바꾸면 펼쳐 둔 수정 · 코드 칸을 닫는다(다른 탭의 쿠폰이 열린 채 남지 않게).
          key={tab}
          campaigns={tab === "running" ? running : ended}
          coupons={props.coupons}
          themes={props.themes}
          emptyTitle={
            props.campaigns.length === 0
              ? "아직 만든 쿠폰이 없어요"
              : tab === "running"
                ? "지금 쓸 수 있는 쿠폰이 없어요"
                : "중지했거나 기간이 끝난 쿠폰이 없어요"
          }
        />
      ) : props.campaigns.length === 0 ? (
        <AdminEmpty title="먼저 쿠폰 종류를 만들어 주세요" hint="「진행 중」 탭의 「쿠폰 종류 등록」 으로 만듭니다." />
      ) : (
        <SendPanel
          campaigns={props.campaigns.map((c) => ({ id: c.id, name: c.name }))}
          sessions={props.sessions}
          templates={props.templates}
        />
      )}
    </div>
  );
}
