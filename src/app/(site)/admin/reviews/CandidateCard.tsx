"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { ignoreCandidate, publishCandidate, resetCandidate } from "./actions";

export type CandidateView = {
  id: string;
  channel: "naver" | "instagram";
  url: string;
  title: string | null;
  excerpt: string | null;
  author: string | null;
  posted_at: string | null;
  thumbnail_url: string | null;
  stored_thumbnail_url: string | null;
  status: "new" | "published" | "ignored";
  published_theme_slug: string | null;
  discovered_at: string;
};

/**
 * 후보 한 건.
 *
 * 누르는 순간 바뀌는 버튼이라 **되돌리는 길을 같이 둔다**. 목록을 훑다가 잘못 누른
 * 것을 되살릴 수 없으면, 그 다음부터는 아무것도 못 누르게 된다.
 */
export function CandidateCard({
  c,
  themes,
}: {
  c: CandidateView;
  themes: { slug: string; name: string }[];
}) {
  const [themeSlug, setThemeSlug] = useState(themes[0]?.slug ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const image = c.stored_thumbnail_url || c.thumbnail_url;

  function run(fn: () => Promise<{ success: true; message?: string } | { error: string }>) {
    startTransition(async () => {
      const res = await fn();
      setMessage("error" in res ? res.error : (res.message ?? "처리했습니다."));
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row ${
        c.status === "new" ? "border-border bg-panel" : "border-border/50 bg-panel/40"
      }`}
    >
      {/* 그림은 네이버 카드에만 있다. 인스타는 임베드가 원본을 그리므로 여기선 빈칸이다. */}
      <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-fill sm:w-44">
        {image ? (
          // next/image 를 쓰지 않는다 — 외부 도메인이 글마다 달라서 설정에 다 넣을 수 없다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-micro text-muted">
            {c.channel === "instagram" ? "인스타 임베드" : "썸네일 없음"}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-micro text-muted">
          <span
            className={`rounded px-1.5 py-0.5 font-semibold ${
              c.channel === "naver" ? "bg-success-soft text-success" : "bg-brand-soft text-brand"
            }`}
          >
            {c.channel === "naver" ? "네이버" : "인스타"}
          </span>
          {c.author && <span>{c.author}</span>}
          {c.posted_at && <span>{c.posted_at.replace(/-/g, ".")}</span>}
          {c.status === "published" && (
            <span className="font-semibold text-success">
              실림{c.published_theme_slug ? ` · ${c.published_theme_slug}` : ""}
            </span>
          )}
          {c.status === "ignored" && <span className="font-semibold text-muted">관련없음</span>}
        </div>

        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-body font-semibold hover:underline"
        >
          {c.title || c.url}
        </a>
        {c.excerpt && <p className="mt-1 line-clamp-2 text-body-sm text-muted">{c.excerpt}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {c.status === "new" ? (
            <>
              {themes.length > 1 && (
                <div className="w-44">
                  <Select
                    value={themeSlug}
                    onChange={setThemeSlug}
                    options={themes.map((t) => ({ value: t.slug, label: t.name }))}
                  />
                </div>
              )}
              <button
                type="button"
                disabled={pending || !themeSlug}
                onClick={() => run(() => publishCandidate({ id: c.id, themeSlug }))}
                className="rounded-lg bg-brand px-3 py-1.5 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
              >
                후기에 넣기
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => ignoreCandidate(c.id))}
                className="rounded-lg border border-border px-3 py-1.5 text-body-sm text-muted disabled:opacity-40"
              >
                관련없음
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => resetCandidate(c.id))}
              className="rounded-lg border border-border px-3 py-1.5 text-body-sm text-muted disabled:opacity-40"
            >
              되돌리기
            </button>
          )}
          {pending && <span className="text-micro text-muted">처리 중…</span>}
          {message && <span className="text-micro text-muted">{message}</span>}
        </div>

        {c.status === "published" && (
          <p className="mt-2 text-micro text-muted">
            ⚠️ 되돌려도 테마의 후기 블록에서 자동으로 빠지지 않습니다. 빼려면 테마 편집에서
            해당 줄을 지워주세요.
          </p>
        )}
      </div>
    </div>
  );
}
