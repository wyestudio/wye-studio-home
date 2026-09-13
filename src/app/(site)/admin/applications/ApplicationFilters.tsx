"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SessionPicker, type PickerSession } from "@/components/admin/SessionPicker";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/**
 * 신청 목록 검색·필터.
 *
 * 상태를 URL 에 담는다 — 새로고침·뒤로가기·링크 공유가 그대로 되고,
 * 서버 컴포넌트가 searchParams 만 보면 되므로 클라이언트 상태 동기화가 없다.
 *
 * 회차는 테마 → 날짜(달력) → 시각 3단계로 고른다(SessionPicker). 쿠폰 발송
 * 화면과 같은 컴포넌트다.
 */
export function ApplicationFilters({ sessions }: { sessions: PickerSession[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // '초기화' 로 SessionPicker 안의 테마·날짜까지 지우려면 다시 마운트해야 한다.
  // (주소만 비우면 컴포넌트는 그대로라 고른 날짜가 남는다)
  const [pickerKey, setPickerKey] = useState(0);

  const selectedSessionId = params.get("session") ?? "";

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
    <div className="mb-4 flex flex-wrap items-end gap-2">
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

      <SessionPicker
        key={pickerKey}
        sessions={sessions}
        value={selectedSessionId}
        onChange={(id) => apply({ session: id })}
      />

      {hasFilter && (
        <button
          onClick={() => {
            setQ("");
            setPickerKey((k) => k + 1);
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
