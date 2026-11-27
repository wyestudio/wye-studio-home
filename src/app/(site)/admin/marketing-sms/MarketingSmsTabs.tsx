"use client";

import { useState } from "react";
import { AdminBadge, AdminEmpty, AdminTabButtons } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";
import { formatDateTimeFull } from "@/lib/format";
import type { MarketingOptout, MarketingRecipient } from "@/lib/marketingSmsServer";
import { MarketingSmsPanel } from "./MarketingSmsPanel";
import { OptoutPanel } from "./OptoutPanel";

// ⚠️ 여기서 상수를 export 하지 않는다 — 서버 화면(page.tsx)은 "use client" 파일의 상수를 읽을 수 없다. 타입만 내보낸다.
export type MarketingSmsTab = "compose" | "history" | "optout";

/** 발송 한 번 — 감사로그(marketing_sms.sent)에서 문구와 건수만 뽑은 것. */
export type SendHistoryRow = {
  id: number;
  createdAt: string;
  /** 운영자가 적은 문구(머리말 · 수신거부 안내는 발송 때 자동으로 붙어 여기에는 없다) */
  body: string;
  /** 고른 사람 수 */
  requested: number | null;
  /** 보내는 순간 대상이 아니게 돼 빠진 사람 수(그 사이 수신거부 등) */
  dropped: number | null;
  /** 발송 접수에 성공한 건수 */
  succeeded: number | null;
};

/**
 * 광고 문자의 탭 셋. 탭은 화면 안에서만 바뀐다 — 세 탭을 모두 그려 두고 가려서,
 * 「발송 기록」 을 보고 와도 적던 문구 · 고른 대상이 남는다.
 * 주소의 ?tab= 은 서버를 부르지 않고 바꾼다(wye-server-cost: history.replaceState).
 */
export function MarketingSmsTabs({
  initialTab,
  recipients,
  optouts,
  history,
  historyError,
  historyLimit,
}: {
  initialTab: MarketingSmsTab;
  recipients: MarketingRecipient[];
  optouts: MarketingOptout[];
  history: SendHistoryRow[];
  historyError: string | null;
  historyLimit: number;
}) {
  const [tab, setTab] = useState<MarketingSmsTab>(initialTab);

  const select = (next: MarketingSmsTab) => {
    setTab(next);
    // 주소의 다른 값은 그대로 두고 tab 만 바꾼다(작성이 기본이라 그때는 뺀다).
    const params = new URLSearchParams(window.location.search);
    if (next === "compose") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  };

  return (
    <div>
      <AdminTabButtons
        label="광고 문자"
        current={tab}
        onSelect={select}
        tabs={[
          { key: "compose", label: "작성" },
          { key: "history", label: "발송 기록", count: historyError ? undefined : history.length },
          { key: "optout", label: "수신거부", count: optouts.length },
        ]}
      />

      <div role="tabpanel" aria-label="작성" hidden={tab !== "compose"}>
        <MarketingSmsPanel recipients={recipients} />
      </div>
      <div role="tabpanel" aria-label="발송 기록" hidden={tab !== "history"}>
        <SendHistory rows={history} error={historyError} limit={historyLimit} />
      </div>
      <div role="tabpanel" aria-label="수신거부" hidden={tab !== "optout"}>
        <OptoutPanel optouts={optouts} />
      </div>
    </div>
  );
}

function SendHistory({ rows, error, limit }: { rows: SendHistoryRow[]; error: string | null; limit: number }) {
  if (error) {
    return (
      <p role="alert" className="text-body-sm text-danger">
        발송 기록을 불러올 수 없습니다: {error}
      </p>
    );
  }
  if (rows.length === 0) {
    return <AdminEmpty title="아직 보낸 광고 문자가 없어요" hint="「작성」 탭에서 보내면 여기에 문구와 건수가 남습니다." />;
  }
  return (
    <>
      <p className="mb-3 text-body-sm text-muted">
        최근 <strong className="text-foreground">{rows.length}</strong>번
        {rows.length >= limit && ` · 그보다 오래된 발송은 감사로그에서 봅니다`}
      </p>
      <ul className="rounded-xl border border-border bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-border/50 p-4 last:border-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-body-sm font-semibold tabular-nums text-foreground">{formatDateTimeFull(r.createdAt)}</span>
              <ResultBadges row={r} />
            </div>
            <details className="group/body mt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body-sm text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                {/* 접힌 동안에는 문구 첫 줄만 — 펼치면 아래에 전체가 나온다 */}
                <span className="min-w-0 flex-1 truncate group-open/body:hidden">{firstLine(r.body)}</span>
                <span className="hidden flex-1 group-open/body:block">보낸 문구</span>
                <Chevron dir="down" className="h-4 w-4 shrink-0 transition-transform group-open/body:rotate-180" />
              </summary>
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-fill-subtle p-3 font-sans text-body-sm text-foreground">
                {r.body || "(문구가 기록되지 않았습니다)"}
              </pre>
              <p className="mt-1.5 text-body-sm text-muted">
                맨 앞 「(광고) 우주이스케이프」 와 맨 끝 수신거부 안내는 보낼 때 자동으로 붙어 여기에는 없습니다.
              </p>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

function firstLine(body: string): string {
  return body.split("\n").find((l) => l.trim())?.trim() ?? "(문구가 기록되지 않았습니다)";
}

/** 건수 — 색만으로 가르지 않게 글자를 같이 쓴다. 숫자가 기록에 없으면 그 배지는 내지 않는다(0 으로 속이지 않는다). */
function ResultBadges({ row }: { row: SendHistoryRow }) {
  const { requested, dropped, succeeded } = row;
  // 실제로 발송을 시도한 수 = 고른 사람 − 그 사이 대상에서 빠진 사람
  const attempted = requested != null ? requested - (dropped ?? 0) : null;
  const failed = attempted != null && succeeded != null ? attempted - succeeded : null;
  return (
    <span className="flex flex-wrap gap-1">
      {succeeded != null && (
        <AdminBadge tone={failed ? "progress" : "done"}>
          성공 {succeeded}
          {attempted != null && ` / ${attempted}`}건
        </AdminBadge>
      )}
      {failed != null && failed > 0 && <AdminBadge tone="danger">실패 {failed}건</AdminBadge>}
      {dropped != null && dropped > 0 && <AdminBadge tone="warn">대상에서 빠짐 {dropped}명</AdminBadge>}
    </span>
  );
}
