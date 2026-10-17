"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import type { SurveyQuote } from "@/lib/reviewRating";
import { setSurveyQuote } from "./actions";

type Filter = "all" | "on" | "off";

/** 이보다 짧은 답("굿", "없음")은 한줄 후기로 쓸 일이 거의 없어 기본으로 접어 둔다. */
const SHORT = 8;

/**
 * 설문 서술형 답 목록. 하나씩 한줄 후기에 넣고 뺀다.
 *
 * "실렸는지" 는 서버가 넘겨준 테마별 quotes 글 목록으로 판단하고, 누른 뒤에는
 * 화면에서 바로 바꿔 보인다(서버 응답을 기다리면 연달아 고를 때 답답하다).
 */
export function SurveyQuoteList({
  quotes,
  themes,
}: {
  quotes: SurveyQuote[];
  themes: { slug: string; name: string; quoteTexts: string[] }[];
}) {
  const [themeSlug, setThemeSlug] = useState(themes[0]?.slug ?? "");
  const [included, setIncluded] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(themes.map((t) => [t.slug, new Set(t.quoteTexts.map((x) => x.trim()))]))
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [showShort, setShowShort] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const on = included[themeSlug] ?? new Set<string>();
  const shortCount = quotes.filter((q) => q.text.length < SHORT).length;
  const list = quotes.filter((q) => {
    const isOn = on.has(q.text);
    if (filter === "on" && !isOn) return false;
    if (filter === "off" && isOn) return false;
    // 실린 글은 짧아도 숨기지 않는다 — 실려 있는데 목록에 없으면 뺄 길이 안 보인다.
    if (!showShort && !isOn && q.text.length < SHORT) return false;
    return true;
  });

  function toggle(q: SurveyQuote) {
    const next = !on.has(q.text);
    setBusy(q.text);
    startTransition(async () => {
      const res = await setSurveyQuote({
        themeSlug,
        text: q.text,
        meta: q.date ? `${q.date} 설문` : "설문",
        on: next,
      });
      setBusy(null);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage(res.message ?? "");
      setIncluded((prev) => {
        const s = new Set(prev[themeSlug] ?? []);
        if (next) s.add(q.text);
        else s.delete(q.text);
        return { ...prev, [themeSlug]: s };
      });
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {themes.length > 1 && (
          <div className="w-44">
            <Select
              value={themeSlug}
              onChange={setThemeSlug}
              options={themes.map((t) => ({ value: t.slug, label: t.name }))}
            />
          </div>
        )}
        {(
          [
            ["all", `전체 ${quotes.length}`],
            ["on", `실린 것 ${quotes.filter((q) => on.has(q.text)).length}`],
            ["off", "안 실린 것"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-md px-2.5 py-1 text-body-sm ${
              filter === key ? "bg-glow text-glow-foreground" : "text-foreground hover:bg-muted/20"
            }`}
          >
            {label}
          </button>
        ))}
        {shortCount > 0 && (
          <label className="ml-auto flex items-center gap-1.5 text-micro text-muted">
            <input
              type="checkbox"
              checked={showShort}
              onChange={(e) => setShowShort(e.target.checked)}
            />
            짧은 답({SHORT}자 미만) {shortCount}건 보기
          </label>
        )}
      </div>

      {message && <p className="mb-2 text-micro text-muted">{message}</p>}

      {list.length === 0 ? (
        <p className="py-4 text-body-sm text-muted">해당하는 답이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((q) => {
            const isOn = on.has(q.text);
            return (
              <li
                key={q.text}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  isOn ? "border-success/40 bg-success-soft/40" : "border-border bg-panel"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-body-sm text-foreground">{q.text}</p>
                  <p className="mt-1 text-micro text-muted">
                    {q.date ?? "날짜 없음"} · {q.question}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => toggle(q)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-body-sm font-semibold disabled:opacity-40 ${
                    isOn
                      ? "border border-border text-muted"
                      : "bg-brand text-brand-foreground"
                  }`}
                >
                  {busy === q.text ? "처리 중…" : isOn ? "빼기" : "넣기"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
