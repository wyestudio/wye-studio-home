"use client";

import { useState, useTransition } from "react";
import { adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";
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
export function UrlPasteBox({ defaultOpen = false }: { defaultOpen?: boolean }) {
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
    // 덜 쓰는 것은 접는다(docs/01 5장 원칙 5). 후보가 하나도 없을 때는 펼쳐 둔다.
    <details open={defaultOpen || undefined} className="group/paste mb-4 rounded-xl border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
        주소로 직접 담기
        <span className="text-body-sm font-normal text-muted">인스타 · 네이버 글 주소</span>
        <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open/paste:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
      <p className="mb-3 text-body-sm text-muted">
        인스타는 자동 수집이 막혀 있어 주소를 붙여넣어야 합니다. 여러 개를 한꺼번에
        넣으려면 줄바꿈으로 구분하세요.
      </p>

      <textarea
        rows={4}
        value={igText}
        onChange={(e) => setIgText(e.target.value)}
        placeholder={"https://www.instagram.com/reel/XXXXXXX/\nhttps://www.instagram.com/p/YYYYYYY/"}
        aria-label="인스타 주소(여러 줄)"
        className={`${adminInputClass} py-2`}
      />
      <button
        type="button"
        disabled={pending || !igText.trim()}
        onClick={() => run(() => addInstagramUrls(igText), () => setIgText(""))}
        className={`${adminButtonClass("primary")} mt-2`}
      >
        인스타 주소 담기
      </button>

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
        <input
          value={naverUrl}
          onChange={(e) => setNaverUrl(e.target.value)}
          placeholder="https://blog.naver.com/아이디/글번호"
          aria-label="네이버 글 주소"
          className={`${adminInputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          disabled={pending || !naverUrl.trim()}
          onClick={() => run(() => addNaverUrl(naverUrl), () => setNaverUrl(""))}
          className={`${adminButtonClass("secondary")} whitespace-nowrap`}
        >
          네이버 글 담기
        </button>
      </div>

      {message && (
        <p role="status" className="mt-2 text-body-sm text-muted">
          {message}
        </p>
      )}
      </div>
    </details>
  );
}
