"use client";

import Link from "next/link";
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
  /** 양식이 여럿인 문자(견적 안내 — 일반용 · 회사용). 양식마다 완성된 미리보기가 들어 있다. */
  variants?: { key: string; label: string; preview: string; copiedAt: string | null }[];
  /** 모임 성격으로 고른 기본 양식. */
  defaultVariant?: string;
  /** 왜 그 양식이 골라졌는지 한 줄. */
  variantNote?: string;
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
  /** 받은 답을 읽는 화면(후기 탭)으로 가는 길. 없으면 버튼을 내지 않는다. */
  detailHref?: string;
  detailLabel?: string;
};

export function MessagesTab({ id, messages, links }: { id: string; messages: MessageView[]; links: FormLinkView[] }) {
  const router = useRouter();
  const firstOpen = messages.find((m) => !m.blocked && !m.copiedAt) ?? messages.find((m) => !m.blocked) ?? messages[0];
  const [kind, setKind] = useState(firstOpen.kind);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const cur = messages.find((m) => m.kind === kind)!;
  // 견적 안내의 양식 — 모임 성격으로 골라진 것에서 시작하고, 눌러서 바꾼다(화면 안에서만 — 서버를 부르지 않는다).
  const [variant, setVariant] = useState(messages.find((m) => m.variants)?.defaultVariant ?? "");
  const curVariant = cur.variants?.find((v) => v.key === variant) ?? cur.variants?.[0] ?? null;
  const preview = curVariant ? curVariant.preview : cur.preview;
  const copiedAt = curVariant ? curVariant.copiedAt : cur.copiedAt;

  const copy = async () => {
    setBusy(true);
    setNote(null);
    try {
      let result: { text: string; note: string } | null = null;
      // 사파리는 누른 직후에만 클립보드에 쓸 수 있다. 서버에서 문구를 받아오는 동안에도 권한이 유지되게
      // 「나중에 채워질 글」(Promise)로 넘긴다. 이 방식이 안 되는 브라우저는 받아온 뒤에 쓴다.
      const text = copyMessage({ id, kind, variant: curVariant?.key }).then((res) => {
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {links.map((l) => (
          <FormLinkCard key={l.key} id={id} link={l} />
        ))}
      </div>

      {/* grid-cols-1 — 좁은 화면에서 칸이 화면보다 넓어지지 않게(미리보기의 긴 주소가 페이지를 옆으로 밀었다) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
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
                  {m.copiedAt || m.variants?.some((v) => v.copiedAt) ? (
                    <AdminBadge tone="done">복사됨</AdminBadge>
                  ) : m.blocked ? (
                    <AdminBadge tone="idle">아직</AdminBadge>
                  ) : null}
                </button>
              );
            })}
          </div>
        </AdminCard>

        <AdminCard title={cur.label} aside={copiedAt ? <span className="text-body-sm text-muted">복사: {copiedAt}</span> : undefined}>
          {cur.blocked ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-body-sm text-muted">{cur.blocked}</p>
          ) : (
            <>
              {cur.variants && cur.variants.length > 1 && (
                <div className="mb-3">
                  <div role="group" aria-label="문자 양식" className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold text-foreground">양식</span>
                    {cur.variants.map((v) => {
                      const on = v.key === curVariant?.key;
                      return (
                        <button
                          key={v.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setVariant(v.key);
                            setNote(null);
                          }}
                          className={`min-h-11 rounded-lg border px-3 text-body-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            on ? "border-foreground bg-foreground text-background" : "border-line bg-surface text-muted hover:bg-fill hover:text-foreground"
                          }`}
                        >
                          {v.label}
                          {v.key === cur.defaultVariant && <span className="ml-1 font-normal">(자동)</span>}
                        </button>
                      );
                    })}
                  </div>
                  {cur.variantNote && <p className="mt-1.5 text-body-sm text-muted">{cur.variantNote} 다른 양식으로 보내려면 눌러서 바꾸세요.</p>}
                </div>
              )}
              {cur.warning && <p className="mb-3 rounded-lg border border-wait bg-wait-soft p-3 text-body-sm font-semibold text-wait">확인 — {cur.warning}</p>}
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-sans text-body-sm text-foreground" data-clarity-mask="true">
                {preview}
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
        {link.detailHref && (
          <Link href={link.detailHref} className={adminButtonClass("secondary")}>
            {link.detailLabel ?? "답변 보기"}
          </Link>
        )}
      </div>
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </AdminCard>
  );
}
