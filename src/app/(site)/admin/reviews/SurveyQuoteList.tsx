"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { AdminBadge, AdminEmpty, adminButtonClass } from "@/components/admin/ui";
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
            aria-pressed={filter === key}
            className={`min-h-11 rounded-lg px-3 text-body-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              filter === key ? "bg-foreground text-background" : "text-muted hover:bg-fill hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {shortCount > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-body-sm text-muted md:ml-auto">
            <input
              type="checkbox"
              checked={showShort}
              onChange={(e) => setShowShort(e.target.checked)}
            />
            짧은 답({SHORT}자 미만) {shortCount}건 보기
          </label>
        )}
      </div>

      {message && (
        <p role="status" className="mb-2 text-body-sm text-muted">
          {message}
        </p>
      )}

      {list.length === 0 ? (
        <AdminEmpty title="해당하는 답이 없어요" hint="위에서 「전체」 를 누르거나 짧은 답 보기를 켜 보세요." />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((q) => {
            const isOn = on.has(q.text);
            return (
              <li
                key={q.text}
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  isOn ? "border-confirm bg-confirm-soft" : "border-border bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-body-sm text-foreground">{q.text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-body-sm text-muted">
                    {/* 색만으로 가르지 않는다 — 실린 글에는 글자 배지를 붙인다 */}
                    {isOn && <AdminBadge tone="done">실림</AdminBadge>}
                    <span>
                      {q.date ?? "날짜 없음"} · {q.question}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => toggle(q)}
                  className={`${adminButtonClass(isOn ? "secondary" : "primary")} shrink-0`}
                >
                  {busy === q.text ? "처리 중…" : isOn ? "삭제" : "등록"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
