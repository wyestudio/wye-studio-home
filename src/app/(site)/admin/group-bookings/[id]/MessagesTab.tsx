"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBadge, AdminCard, adminButtonClass } from "@/components/admin/ui";
import { copyMessage, reissueFormLink } from "../groupActions";
import { ActionNote, useGroupAction } from "./GroupDetailClient";
import { FormQr } from "./FormQr";

export type MessageView = {
  kind: string;
  label: string;
  /** 그 단체 값이 채워진 문구(담당자 이름은 가린 채). 쓸 수 없는 문자면 null. */
  preview: string | null;
  /** 지금 쓸 수 없는 이유. */
  blocked: string | null;
  /** 마지막으로 복사한 때. */
  copiedAt: string | null;
  /** 복사하면 넘어갈 단계 이름. 넘어가지 않으면 null. */
  nextStage: string | null;
  /** 보내기 전에 확인할 것(예: 임박 예약의 전액 입금). */
  warning: string | null;
};

/**
 * 설문 · 문자 탭(관리자 개편 docs/02 8장).
 *
 * 왼쪽에 문자 종류, 오른쪽에 그 단체 값이 채워진 완성 문구와 「문자 복사」. 휴대폰에서는 위아래로 쌓인다.
 * ⚠️ **여기서 문자를 보내지 않는다.** 복사해서 카카오톡 채널에 붙여넣는다.
 * ⚠️ 미리보기의 담당자 이름은 가려져 있다. 「문자 복사」 를 누르면 전체 이름이 들어간 문구가 복사된다.
 */
export type FormLinkView = {
  key: string;
  label: string;
  url: string;
  /** '13 / 16명' · '4건 · 평균 4.5점' 처럼 서버가 만든 현황 한 줄. */
  stat: string;
  /** QR 그림 파일 이름(확장자 없이). */
  fileName: string;
};

export function MessagesTab({ id, messages, links }: { id: string; messages: MessageView[]; links: FormLinkView[] }) {
  const router = useRouter();
  const firstOpen = messages.find((m) => !m.blocked && !m.copiedAt) ?? messages.find((m) => !m.blocked) ?? messages[0];
  const [kind, setKind] = useState(firstOpen.kind);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const cur = messages.find((m) => m.kind === kind)!;

  const copy = async () => {
    setBusy(true);
    setNote(null);
    try {
      let result: { text: string; note: string } | null = null;
      // 사파리는 누른 직후에만 클립보드에 쓸 수 있다. 서버에서 문구를 받아오는 동안에도 권한이 유지되게
      // 「나중에 채워질 글」(Promise)로 넘긴다. 이 방식이 안 되는 브라우저는 받아온 뒤에 쓴다.
      const text = copyMessage({ id, kind }).then((res) => {
        if ("error" in res) throw new Error(res.error);
        result = res;
        return res.text;
      });
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setNote({ ok: true, text: (result as { note: string } | null)?.note ?? "복사했습니다." });
      router.refresh();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "복사하지 못했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((l) => (
          <FormLinkCard key={l.key} id={id} link={l} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <AdminCard title="안내 문자">
          <div role="tablist" aria-label="문자 종류" aria-orientation="vertical" className="flex flex-col gap-1">
            {messages.map((m) => {
              const active = m.kind === kind;
              return (
                <button
                  key={m.kind}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setKind(m.kind);
                    setNote(null);
                  }}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-left text-body-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-brand-soft font-semibold text-brand" : m.blocked ? "text-muted hover:bg-fill" : "text-foreground hover:bg-fill"
                  }`}
                >
                  <span>{m.label}</span>
                  {m.copiedAt ? <AdminBadge tone="done">복사됨</AdminBadge> : m.blocked ? <AdminBadge tone="idle">아직</AdminBadge> : null}
                </button>
              );
            })}
          </div>
        </AdminCard>

        <AdminCard title={cur.label} aside={cur.copiedAt ? <span className="text-body-sm text-muted">복사: {cur.copiedAt}</span> : undefined}>
          {cur.blocked ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-body-sm text-muted">{cur.blocked}</p>
          ) : (
            <>
              {cur.warning && <p className="mb-3 rounded-lg border border-wait bg-wait-soft p-3 text-body-sm font-semibold text-wait">확인 — {cur.warning}</p>}
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-sans text-body-sm text-foreground" data-clarity-mask="true">
                {cur.preview}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" disabled={busy} onClick={copy} className={adminButtonClass("primary")}>
                  {busy ? "복사 중…" : "문자 복사"}
                </button>
                {cur.nextStage && <span className="text-body-sm text-muted">복사하면 단계가 「{cur.nextStage}」 로 넘어갑니다.</span>}
              </div>
              <p className="mt-3 text-body-sm font-semibold text-foreground">
                여기서 문자를 보내지는 않습니다. 복사해서 카카오톡 채널에 붙여넣으세요.
              </p>
              <p className="mt-1 text-body-sm text-muted">미리보기의 담당자 이름은 가려져 있습니다. 복사한 문구에는 전체 이름이 들어갑니다.</p>
            </>
          )}
          {note && (
            <p role={note.ok ? "status" : "alert"} className={`mt-2 text-body-sm ${note.ok ? "text-confirm" : "text-danger"}`}>
              {note.ok ? "" : "복사하지 못했습니다 — "}
              {note.text}
            </p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

/** 폼 하나의 링크 카드 — 주소 · QR · 「링크 복사」 · 「폼 열기」 · 「다시 발급」. */
function FormLinkCard({ id, link }: { id: string; link: FormLinkView }) {
  const { pending, note, run } = useGroupAction();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <AdminCard title={link.label} aside={<span className="text-body-sm text-muted">{link.stat}</span>}>
      <FormQr url={link.url} fileName={link.fileName} label={link.label} />
      <p className="mt-3 break-all text-body-sm text-muted" data-clarity-mask="true">
        {link.url}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={adminButtonClass("primary")}>
          {copied ? "복사됨" : "링크 복사"}
        </button>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className={adminButtonClass("secondary")}>
          폼 열기
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            window.confirm(`「${link.label}」 링크를 다시 발급할까요? 이전 링크와 QR 은 더 이상 열리지 않습니다. 이미 보낸 문자 속 링크도 안 열립니다.`) &&
            run(() => reissueFormLink({ id, formKey: link.key }))
          }
          className={adminButtonClass("secondary")}
        >
          {pending ? "발급 중…" : "다시 발급"}
        </button>
      </div>
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </AdminCard>
  );
}
