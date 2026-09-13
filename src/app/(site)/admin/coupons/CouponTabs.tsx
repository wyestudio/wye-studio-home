"use client";

import { useState } from "react";
import { CouponPanel, type CouponRow } from "./CouponPanel";
import { SendPanel } from "./SendPanel";
import type { CampaignRow } from "./CampaignEditor";
import type { PickerSession } from "@/components/admin/SessionPicker";

export function CouponTabs(props: {
  campaigns: CampaignRow[];
  coupons: CouponRow[];
  themes: { id: string; name: string }[];
  sessions: PickerSession[];
  templates: { key: string; label: string }[];
}) {
  const [tab, setTab] = useState<"manage" | "send">("manage");

  const btn = (key: "manage" | "send", label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded px-3 py-1.5 text-sm ${
        tab === key ? "bg-glow font-semibold text-glow-foreground" : "border border-border text-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {btn("manage", "쿠폰 관리")}
        {btn("send", "발송")}
      </div>

      {tab === "manage" ? (
        <CouponPanel
          campaigns={props.campaigns}
          coupons={props.coupons}
          themes={props.themes}
        />
      ) : props.campaigns.length === 0 ? (
        <div className="rounded-lg border border-border py-16 text-center text-sm text-muted">
          먼저 쿠폰 종류를 만들어주세요.
        </div>
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
