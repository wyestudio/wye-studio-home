"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/**
 * 신청 목록 검색·필터.
 *
 * 상태를 URL 에 담는다 — 새로고침·뒤로가기·링크 공유가 그대로 되고,
 * 서버 컴포넌트가 searchParams 만 보면 되므로 클라이언트 상태 동기화가 없다.
 */
export function ApplicationFilters({
  sessions,
}: {
  sessions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // 조건이 바뀌면 1페이지로
    router.push(`/applications?${next.toString()}`);
  }

  const hasFilter = ["q", "status", "payment", "session"].some((k) => params.get(k));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex gap-2"
      >
        <input
          className={`${field} w-64`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="접수번호 · 이름 · 입금자명 · 전화번호"
        />
        <button type="submit" className="rounded bg-glow px-3 py-2 text-sm text-glow-foreground">
          검색
        </button>
      </form>

      <select
        className={field}
        value={params.get("status") ?? ""}
        onChange={(e) => apply({ status: e.target.value })}
      >
        <option value="">상태 전체</option>
        <option value="confirmed">확정</option>
        <option value="waiting">대기</option>
        <option value="cancelled">취소</option>
      </select>

      <select
        className={field}
        value={params.get("payment") ?? ""}
        onChange={(e) => apply({ payment: e.target.value })}
      >
        <option value="">입금 전체</option>
        <option value="pending">입금 전</option>
        <option value="confirmed">입금 완료</option>
        <option value="cancelled">취소</option>
      </select>

      <select
        className={`${field} max-w-56`}
        value={params.get("session") ?? ""}
        onChange={(e) => apply({ session: e.target.value })}
      >
        <option value="">회차 전체</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {hasFilter && (
        <button
          onClick={() => {
            setQ("");
            router.push("/applications");
          }}
          className="rounded border border-border px-3 py-2 text-sm text-muted"
        >
          초기화
        </button>
      )}
    </div>
  );
}
