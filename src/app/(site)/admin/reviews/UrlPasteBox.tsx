"use client";

import { useState, useTransition } from "react";
import { addInstagramUrls, addNaverUrl } from "./actions";

/**
 * 주소를 손으로 담는 칸.
 *
 * 인스타는 **자동으로 찾아올 수 없다** — 해시태그 페이지를 받아 봐도 게시물 데이터가
 * 한 건도 들어 있지 않다(전부 JS 번들). 그래서 쌓인 릴스·게시물은 여기에 주소를
 * 여러 줄 붙여넣어 한 번에 담는다.
 *
 * 네이버는 크론이 찾아오지만, 키워드를 안 쓴 후기는 검색에 안 걸린다. 그런 글을
 * 손으로 넣는 길도 같이 둔다.
 */
export function UrlPasteBox() {
  const [igText, setIgText] = useState("");
  const [naverUrl, setNaverUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ success: true; message?: string } | { error: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setMessage(res.error);
      } else {
        setMessage(res.message ?? "담았습니다.");
        after?.();
      }
    });
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-panel p-4">
      <h2 className="mb-1 text-body font-semibold">주소로 직접 담기</h2>
      <p className="mb-3 text-micro text-muted">
        인스타는 자동 수집이 막혀 있어 주소를 붙여넣어야 합니다. 여러 개를 한꺼번에
        넣으려면 줄바꿈으로 구분하세요.
      </p>

      <textarea
        rows={4}
        value={igText}
        onChange={(e) => setIgText(e.target.value)}
        placeholder={"https://www.instagram.com/reel/XXXXXXX/\nhttps://www.instagram.com/p/YYYYYYY/"}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body-sm outline-none focus:border-glow"
      />
      <button
        type="button"
        disabled={pending || !igText.trim()}
        onClick={() => run(() => addInstagramUrls(igText), () => setIgText(""))}
        className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
      >
        인스타 주소 담기
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={naverUrl}
          onChange={(e) => setNaverUrl(e.target.value)}
          placeholder="https://blog.naver.com/아이디/글번호"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-body-sm outline-none focus:border-glow"
        />
        <button
          type="button"
          disabled={pending || !naverUrl.trim()}
          onClick={() => run(() => addNaverUrl(naverUrl), () => setNaverUrl(""))}
          className="rounded-lg border border-border px-3 py-1.5 text-body-sm disabled:opacity-40"
        >
          네이버 글 담기
        </button>
      </div>

      {message && <p className="mt-2 text-micro text-muted">{message}</p>}
    </div>
  );
}
