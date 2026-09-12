"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/** ISO(UTC) → KST 기준 'YYYY-MM-DD'. `<input type="date">` 가 쓰는 형식이다. */
function kstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** ISO(UTC) → KST 'HH:MM'. */
function kstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 16);
}

/**
 * 신청 목록 검색·필터.
 *
 * 상태를 URL 에 담는다 — 새로고침·뒤로가기·링크 공유가 그대로 되고,
 * 서버 컴포넌트가 searchParams 만 보면 되므로 클라이언트 상태 동기화가 없다.
 */
export function ApplicationFilters({
  sessions,
}: {
  sessions: { id: string; start_at: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  // ⚠️ 회차를 한 줄 목록으로 고르게 하면 안 된다. 롤링 오픈으로 회차가 150개
  //    가까이 생성돼 있어(2027년치까지) 콤보가 끝없이 길어진다.
  //    달력으로 날짜를 먼저 고르고, 그날 회차(보통 3개)만 보여준다.
  const selectedSessionId = params.get("session") ?? "";
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // 주소에 회차가 이미 있으면 그 회차의 날짜를 달력에 채워 보여준다.
  const [date, setDate] = useState(
    selectedSession ? kstDate(selectedSession.start_at) : ""
  );

  const sessionsOnDate = date
    ? sessions
        .filter((s) => kstDate(s.start_at) === date)
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
    : [];

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

      {/* 회차 날짜 — 달력으로 고른다. 날짜를 비우면 회차 필터가 해제된다. */}
      <input
        type="date"
        className={field}
        value={date}
        aria-label="회차 날짜"
        onChange={(e) => {
          const next = e.target.value;
          setDate(next);
          const onDate = sessions
            .filter((s) => kstDate(s.start_at) === next)
            .sort((a, b) => a.start_at.localeCompare(b.start_at));
          // ⚠️ 날짜를 고르면 **항상** 그날의 한 회차가 선택되게 한다.
          //    '그날 전체' 같은 선택지를 두면 실제로는 회차 필터가 풀려
          //    전체 신청이 나오는데, 쓰는 사람은 그날 것만 나온다고 읽는다.
          //    시간은 옆 드롭다운에서 바꾸면 된다.
          apply({ session: onDate[0]?.id ?? "" });
        }}
      />

      {/* 날짜를 고른 뒤에만 그날 회차(보통 11:30/15:30/19:30)를 보여준다. */}
      {date && sessionsOnDate.length > 1 && (
        <select
          className={field}
          value={selectedSessionId}
          aria-label="회차 시각"
          onChange={(e) => apply({ session: e.target.value })}
        >
          {sessionsOnDate.map((s) => (
            <option key={s.id} value={s.id}>
              {kstTime(s.start_at)}
            </option>
          ))}
        </select>
      )}

      {date && sessionsOnDate.length === 0 && (
        <span className="text-sm text-muted">그날 회차가 없습니다</span>
      )}

      {hasFilter && (
        <button
          onClick={() => {
            setQ("");
            setDate("");
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
