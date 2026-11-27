"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminCard, AdminField, AdminNotice, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { REPORT_DEFAULTS_BASE, REPORT_DEFAULT_LIMITS, cleanReportDefaults, type ReportDefaults } from "@/lib/groupToolRules";
import { saveReportDefaults } from "../actions";

/** 리포트 기본값 편집 — 문구 다섯 칸과 게임 이름(1~8개). 일시 · 모임명 · 인원 · 팀은 단체마다 자동으로 채워져 여기에 없다. */
const FIELDS: { key: "host" | "kicker" | "sub" | "place" | "msg"; label: string; hint: string }[] = [
  { key: "host", label: "HOST", hint: "표지의 HOST 칸" },
  { key: "place", label: "PLACE", hint: "표지의 PLACE 칸" },
  { key: "kicker", label: "제목 위 문구", hint: "제목 바로 위의 작은 글" },
  { key: "sub", label: "제목 아래 문구", hint: "제목 바로 아래의 설명" },
  { key: "msg", label: "마무리 인사", hint: "마지막 사진 장의 인사말" },
];

export function ReportDefaultsEditor({ initial }: { initial: ReportDefaults }) {
  const router = useRouter();
  const [value, setValue] = useState<ReportDefaults>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(value) !== saved;

  const set = (patch: Partial<ReportDefaults>) => {
    setValue((cur) => ({ ...cur, ...patch }));
    setNote(null);
  };
  const setGame = (i: number, name: string) => set({ games: value.games.map((g, k) => (k === i ? name : g)) });
  const save = () => {
    const res = cleanReportDefaults(value, true);
    if ("error" in res) return setNote({ ok: false, text: res.error });
    startTransition(async () => {
      const out = await saveReportDefaults({ value: res.value });
      if ("error" in out) return setNote({ ok: false, text: out.error });
      setValue(res.value);
      setSaved(JSON.stringify(res.value));
      setNote({ ok: true, text: out.message ?? "저장했습니다." });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title="기본 문구">
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => {
            const len = Array.from(value[f.key].trim()).length;
            const max = REPORT_DEFAULT_LIMITS[f.key];
            return (
              <div key={f.key} className={f.key === "msg" ? "md:col-span-2" : ""}>
                <AdminField label={f.label} htmlFor={`rd-${f.key}`} hint={`${f.hint} · ${len} / ${max}`} error={len > max ? `${max}자까지 쓸 수 있어요.` : null}>
                  <input
                    id={`rd-${f.key}`}
                    value={value[f.key]}
                    onChange={(e) => set({ [f.key]: e.target.value })}
                    maxLength={max * 2}
                    autoComplete="off"
                    className={adminInputClass}
                  />
                </AdminField>
              </div>
            );
          })}
        </div>
      </AdminCard>

      <AdminCard title={`게임 ${value.games.length}종`}>
        <p className="text-body-sm text-muted">스코어보드의 게임 칸입니다. 리포트 안에서도 게임을 더하거나 뺄 수 있어요.</p>
        <ol className="mt-3 flex flex-col gap-2">
          {value.games.map((g, i) => (
            <li key={i} className="flex items-center gap-2">
              <label htmlFor={`rd-game-${i}`} className="w-16 shrink-0 text-body-sm text-muted">
                게임 {i + 1}
              </label>
              <input
                id={`rd-game-${i}`}
                value={g}
                onChange={(e) => setGame(i, e.target.value)}
                maxLength={REPORT_DEFAULT_LIMITS.game * 2}
                autoComplete="off"
                className={adminInputClass}
              />
              <button
                type="button"
                onClick={() => set({ games: value.games.filter((_, k) => k !== i) })}
                disabled={value.games.length <= 1}
                aria-label={`게임 ${i + 1} 삭제`}
                className={adminButtonClass("danger")}
              >
                삭제
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => set({ games: [...value.games, ""] })}
          disabled={value.games.length >= REPORT_DEFAULT_LIMITS.games}
          className={`${adminButtonClass("secondary")} mt-3`}
        >
          게임 등록
        </button>
      </AdminCard>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending || !dirty} className={adminButtonClass("primary")}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={() => set({ ...REPORT_DEFAULTS_BASE, games: [...REPORT_DEFAULTS_BASE.games] })} disabled={pending} className={adminButtonClass("secondary")}>
          처음 값으로 채우기
        </button>
        {dirty && !pending && <span className="text-body-sm text-wait">저장하지 않은 변경이 있어요.</span>}
      </div>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`text-body-sm ${note.ok ? "text-confirm" : "font-semibold text-danger"}`}>
          {note.ok ? note.text : `저장하지 못했습니다 — ${note.text}`}
        </p>
      )}

      <AdminNotice title="리포트 틀 파일">
        리포트의 모양(틀)은 비공개 저장소에 올려 둔 파일입니다. 틀에는 실제 단체의 사진이 들어 있을 수 있어 이 화면에서 올리지 않고, 사진을 비우는 스크립트를 거쳐
        올립니다(운영 반영 안내문 참고). 사진은 어디에도 저장되지 않습니다.
      </AdminNotice>
    </div>
  );
}
