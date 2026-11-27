"use client";

import Image from "next/image";
import { useState } from "react";
import { REVIEW_FORM } from "@/lib/groupForms/schema";
import { FormFlow } from "./FormFlow";
import { submitReview } from "./actions";

/**
 * 모임 후기 설문(관리자 개편 docs/04 4장) — 익명. 이름 · 연락처를 받지 않는다. 한 사람이 여러 번 낼 수 있다.
 */
export function ReviewForm({ code, groupName }: { code: string; groupName: string }) {
  const [view, setView] = useState<"intro" | "form" | "done">("intro");
  const [hp, setHp] = useState("");

  if (view === "form") {
    return (
      <>
        <div aria-hidden className="hidden">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
          </label>
        </div>
        <FormFlow
          def={REVIEW_FORM}
          onExit={() => setView("intro")}
          onSubmit={async (answers) => {
            const res = await submitReview(code, answers, hp);
            if ("ok" in res) setView("done");
            return res;
          }}
        />
      </>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Image src="/logo-black.png" alt="" width={860} height={600} className="h-10 w-auto" priority />
        <span className="text-body font-extrabold text-foreground">우주이스케이프</span>
      </div>
      <p className="text-body-sm text-muted">익명 · {groupName}</p>
      {view === "done" ? (
        <div role="status">
          <h1 className="mt-1 text-h1 font-extrabold text-foreground">후기 고맙습니다</h1>
          <p className="mt-3 text-body text-muted">남겨주신 이야기는 다음 모임을 더 좋게 만드는 데 쓸게요.</p>
        </div>
      ) : (
        <>
          <h1 className="mt-1 text-h1 font-extrabold text-foreground">오늘 어떠셨나요?</h1>
          <p className="mt-3 text-body text-muted">질문 6개 · 1분이면 끝나요. 이름과 연락처는 받지 않아요.</p>
          <p className="mt-1 text-body-sm text-muted">답변은 익명으로 홍보물에 인용될 수 있어요.</p>
          <button
            type="button"
            onClick={() => setView("form")}
            className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-foreground px-4 text-body font-semibold text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            시작하기
          </button>
        </>
      )}
    </div>
  );
}
