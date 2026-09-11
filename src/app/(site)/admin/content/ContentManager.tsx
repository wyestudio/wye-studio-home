"use client";

import { useState } from "react";
import { NoticeEditor, type NoticeRow } from "./NoticeEditor";
import { FaqEditor, type FaqRow } from "./FaqEditor";

const kst = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/**
 * 공지·FAQ 관리.
 *
 * 목록에서 항목을 눌러 펼쳐 고친다. 별도 상세 페이지를 두지 않은 이유는
 * 항목이 짧고, 여러 개를 연달아 손보는 일이 많기 때문이다.
 */
export function ContentManager({ notices, faqs }: { notices: NoticeRow[]; faqs: FaqRow[] }) {
  const [tab, setTab] = useState<"notice" | "faq">("notice");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const tabBtn = (key: "notice" | "faq", label: string, count: number) => (
    <button
      key={key}
      onClick={() => {
        setTab(key);
        setOpenId(null);
        setAdding(false);
      }}
      className={`rounded px-3 py-1.5 text-sm ${
        tab === key ? "bg-glow text-glow-foreground font-semibold" : "border border-border text-muted"
      }`}
    >
      {label} <span className="text-xs">({count})</span>
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {tabBtn("notice", "공지사항", notices.length)}
        {tabBtn("faq", "자주 묻는 질문", faqs.length)}
        <button
          onClick={() => {
            setAdding((v) => !v);
            setOpenId(null);
          }}
          className="ml-auto rounded border border-border px-3 py-1.5 text-sm"
        >
          {adding ? "취소" : tab === "notice" ? "+ 공지 추가" : "+ 질문 추가"}
        </button>
      </div>

      {adding && (
        <div className="mb-4">
          {tab === "notice" ? (
            <NoticeEditor onDone={() => setAdding(false)} />
          ) : (
            <FaqEditor onDone={() => setAdding(false)} />
          )}
        </div>
      )}

      {tab === "notice" ? (
        notices.length === 0 ? (
          <Empty label="등록된 공지가 없습니다." />
        ) : (
          <div className="flex flex-col gap-2">
            {notices.map((n) => (
              <div key={n.id}>
                <button
                  onClick={() => setOpenId(openId === n.id ? null : n.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/10"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {n.is_pinned && <span className="mr-1.5 text-glow">📌</span>}
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {n.published_at ? kst(n.published_at) : <span className="text-amber-400">미게시</span>}
                  </span>
                </button>
                {openId === n.id && (
                  <div className="mt-2">
                    <NoticeEditor notice={n} onDone={() => setOpenId(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : faqs.length === 0 ? (
        <Empty label="등록된 질문이 없습니다." />
      ) : (
        <div className="flex flex-col gap-2">
          {faqs.map((f) => (
            <div key={f.id}>
              <button
                onClick={() => setOpenId(openId === f.id ? null : f.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/10"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="mr-2 text-xs text-muted">{f.sort_order}</span>
                  {f.question}
                </span>
                {!f.is_visible && <span className="shrink-0 text-xs text-amber-400">비공개</span>}
              </button>
              {openId === f.id && (
                <div className="mt-2">
                  <FaqEditor faq={f} onDone={() => setOpenId(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border py-16 text-center text-sm text-muted">{label}</div>
  );
}
