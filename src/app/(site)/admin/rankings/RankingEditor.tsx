"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RANKING_GRADES, type RankingGrade } from "@/types/catalog";
import { saveRanking, deleteRanking, type RankingInput } from "./actions";

export type RankingTheme = { id: string; name: string; variant_label: string | null };
export type RankingRow = {
  id: string;
  theme_id: string;
  played_on: string;
  team_name: string;
  points: number;
  remaining_sec: number | null;
  grade: RankingGrade;
  group_size: number | null;
  hint_free: boolean;
  hidden: boolean;
  source: "manual" | "baro";
};

const field = "rounded-md border border-border bg-background px-2 py-1.5 text-body-sm";

const SIZE_LABEL: Record<number, string> = { 2: "2인", 3: "3인", 4: "4인 이상" };

/** 'm:ss' ↔ 초. 비우면 null, 형식이 틀리면 NaN(저장 때 걸러진다). */
function parseTime(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,3}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
function formatTime(sec: number | null) {
  return sec === null ? "" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

type Draft = Omit<RankingInput, "remaining_sec"> & { time: string };

function toDraft(r: RankingRow): Draft {
  return {
    id: r.id,
    theme_id: r.theme_id,
    played_on: r.played_on,
    team_name: r.team_name,
    points: r.points,
    time: formatTime(r.remaining_sec),
    grade: r.grade,
    group_size: r.group_size,
    hint_free: r.hint_free,
    hidden: r.hidden,
  };
}

/**
 * 랭킹 기록 편집.
 *
 * 한 줄 = 한 팀의 한 번 기록. 파티는 인원 구분을 비우고, 노말은 2인·3인·4인 이상을
 * 고른다 — 노말 랭킹 블록이 이 값으로 판을 나눈다.
 */
export function RankingEditor({
  month,
  themes,
  rows,
}: {
  month: string;
  themes: RankingTheme[];
  rows: RankingRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const themeName = (id: string) => {
    const t = themes.find((x) => x.id === id);
    return t ? `${t.name}${t.variant_label ? ` · ${t.variant_label}` : ""}` : "(테마 없음)";
  };

  function blank(): Draft {
    return {
      theme_id: themes[0]?.id ?? "",
      played_on: `${month}-01`,
      team_name: "",
      points: 0,
      time: "",
      grade: "B",
      group_size: null,
      hint_free: true,
      hidden: false,
    };
  }

  function submit(d: Draft) {
    const remaining = parseTime(d.time);
    if (Number.isNaN(remaining)) {
      setMessage({ kind: "err", text: "남은 시간은 12:34 처럼 분:초로 입력해주세요." });
      return;
    }
    const { time: _time, ...rest } = d;
    void _time;
    startTransition(async () => {
      const res = await saveRanking({ ...rest, remaining_sec: remaining });
      if ("error" in res) setMessage({ kind: "err", text: res.error });
      else {
        setMessage({ kind: "ok", text: res.message ?? "저장했습니다." });
        setEditing(null);
        router.refresh();
      }
    });
  }

  function toggleHidden(r: RankingRow) {
    submit({ ...toDraft(r), hidden: !r.hidden });
  }

  function remove(r: RankingRow) {
    if (!confirm(`'${r.team_name}' 기록을 삭제할까요? 되돌릴 수 없습니다. 감추기만 하려면 숨김을 쓰세요.`)) return;
    startTransition(async () => {
      const res = await deleteRanking(r.id);
      setMessage("error" in res ? { kind: "err", text: res.error } : { kind: "ok", text: "삭제했습니다." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-body-sm">
          달
          <input
            type="month"
            className={field}
            value={month}
            onChange={(e) => e.target.value && router.push(`/rankings?month=${e.target.value}`)}
          />
        </label>
        <button
          type="button"
          onClick={() => setEditing(blank())}
          className="ml-auto rounded-md bg-glow px-3 py-2 text-body-sm text-white"
        >
          기록 추가
        </button>
      </div>

      {message && (
        <p className={message.kind === "ok" ? "text-body-sm text-glow" : "text-body-sm text-red-400"}>
          {message.text}
        </p>
      )}

      {editing && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{editing.id ? "기록 수정" : "새 기록"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-micro text-muted">
              테마
              <select
                className={field}
                value={editing.theme_id}
                onChange={(e) => setEditing({ ...editing, theme_id: e.target.value })}
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {themeName(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              회차 날짜
              <input
                type="date"
                className={field}
                value={editing.played_on}
                onChange={(e) => setEditing({ ...editing, played_on: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              팀명 (고객 화면에 그대로 나갑니다)
              <input
                className={field}
                value={editing.team_name}
                maxLength={30}
                onChange={(e) => setEditing({ ...editing, team_name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              인원 구분 (노말만)
              <select
                className={field}
                value={editing.group_size ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, group_size: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">없음 (파티)</option>
                <option value="2">2인</option>
                <option value="3">3인</option>
                <option value="4">4인 이상</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              획득 포인트
              <input
                type="number"
                className={field}
                value={editing.points}
                onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              남은 시간 (분:초, 노말만)
              <input
                className={field}
                value={editing.time}
                placeholder="12:34"
                onChange={(e) => setEditing({ ...editing, time: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-micro text-muted">
              등급
              <select
                className={field}
                value={editing.grade}
                onChange={(e) => setEditing({ ...editing, grade: e.target.value as RankingGrade })}
              >
                {RANKING_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col justify-end gap-1.5 text-body-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.hint_free}
                  onChange={(e) => setEditing({ ...editing, hint_free: e.target.checked })}
                />
                노힌트
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.hidden}
                  onChange={(e) => setEditing({ ...editing, hidden: e.target.checked })}
                />
                숨김
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(editing)}
              className="rounded-md bg-glow px-3 py-2 text-body-sm text-white disabled:opacity-40"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-border px-3 py-2 text-body-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-body-sm text-muted">
          {month} 기록이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-body-sm">
            <thead className="bg-fill-subtle text-micro text-muted">
              <tr>
                {["날짜", "테마", "인원", "팀명", "포인트", "남은 시간", "등급", "노힌트", "출처", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-border ${r.hidden ? "opacity-40" : ""}`}>
                  <td className="px-3 py-2 tabular-nums">{r.played_on}</td>
                  <td className="px-3 py-2">{themeName(r.theme_id)}</td>
                  <td className="px-3 py-2">{r.group_size ? SIZE_LABEL[r.group_size] : "-"}</td>
                  <td className="px-3 py-2 font-semibold">{r.team_name}</td>
                  <td className="px-3 py-2 tabular-nums">{r.points}</td>
                  <td className="px-3 py-2 tabular-nums">{formatTime(r.remaining_sec) || "-"}</td>
                  <td className="px-3 py-2">{r.grade}</td>
                  <td className="px-3 py-2">{r.hint_free ? "O" : "X"}</td>
                  <td className="px-3 py-2 text-muted">{r.source === "baro" ? "현장 연동" : "직접 입력"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" onClick={() => setEditing(toDraft(r))} className="mr-2 underline">
                      수정
                    </button>
                    <button type="button" onClick={() => toggleHidden(r)} className="mr-2 underline">
                      {r.hidden ? "다시 보이기" : "숨김"}
                    </button>
                    <button type="button" onClick={() => remove(r)} className="text-red-400 underline">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
