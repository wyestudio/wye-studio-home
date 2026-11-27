"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminButtonClass } from "@/components/admin/ui";
import { openNametagMaker, saveNametagState, type NametagOpen } from "../groupActions";

/**
 * 명찰 제작기 — 화면 가득 여는 창(관리자 개편 docs/02 9장).
 *
 * 제작기는 대표님이 만든 단일 HTML(45MB)이다. 비공개 저장소에 있고, 누를 때 서버가 내준 5분짜리 임시 주소로
 * **브라우저가 직접** 받는다(Vercel 서버를 지나지 않는다). 한 번 받은 파일은 이 브라우저에 보관해 두고,
 * 파일이 바뀌었을 때만 다시 받는다.
 *
 * 격리: 제작기는 `sandbox` 틀 안에서 돈다 — 관리자 화면의 쿠키 · 저장소 · DOM 에 닿지 못한다.
 * 주고받는 것은 메시지뿐이고, 내용은 닉네임 · 방수 · 글자 위치/크기뿐이다(이름 · 연락처는 넘기지 않는다).
 * 받는 쪽은 그 틀이 보낸 메시지인지(event.source) 확인한다.
 *
 * 고친 내용은 「고친 내용 저장」 을 누르거나 창을 닫을 때 단체별로 저장된다. 설문 원본은 바뀌지 않는다.
 */

const CACHE_NAME = "wye-admin-tools";

/** 받아 둔 제작기 파일을 꺼내거나, 없으면 임시 주소에서 받아 보관한다. 판(version)이 바뀌면 다시 받는다. */
async function loadMakerFile(url: string, version: string, onProgress: (text: string) => void): Promise<Blob> {
  const key = `/__wye-admin-tools/nametag-maker?v=${encodeURIComponent(version)}`;
  let cache: Cache | null = null;
  try {
    cache = await window.caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (hit) return new Blob([await hit.blob()], { type: "text/html" });
  } catch {
    // 보관함을 못 쓰는 브라우저(사생활 보호 모드 등)는 매번 받는다.
    cache = null;
  }
  onProgress("명찰 제작기를 받는 중… (45MB · 처음 한 번만)");
  const res = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`파일을 받지 못했습니다(${res.status}).`);
  const blob = new Blob([await res.blob()], { type: "text/html" });
  if (cache) {
    try {
      // 예전 판은 지우고 새 판만 둔다.
      for (const old of await cache.keys()) await cache.delete(old);
      await cache.put(key, new Response(blob, { headers: { "Content-Type": "text/html" } }));
    } catch {
      // 보관에 실패해도(용량 등) 이번에는 그대로 쓴다.
    }
  }
  return blob;
}

type Phase = "idle" | "loading" | "ready" | "error";

export function NametagMaker({ id, disabled }: { id: string; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [info, setInfo] = useState<NametagOpen | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const roster = useRef<NametagOpen | null>(null);
  const waiters = useRef<((state: unknown) => void)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);

  const send = (message: Record<string, unknown>) => {
    // 격리된 틀은 출처가 없어('null') 주소를 지정할 수 없다 — 대신 우리가 만든 그 틀의 창에만 보낸다.
    frame.current?.contentWindow?.postMessage(message, "*");
  };
  const sendRoster = (data: NametagOpen) =>
    send({ type: "wye-badge-roster", group: data.group, experience: data.mode, edition: data.edition ?? undefined, people: data.people });

  // 제작기가 보낸 메시지. 우리가 연 그 틀에서 온 것만 받는다.
  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: string; count?: number; state?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "wye-badge-ready" && roster.current) sendRoster(roster.current);
      if (data.type === "wye-badge-loaded") {
        setPhase("ready");
        setStatus(`명찰 ${Number(data.count) || 0}개를 채웠습니다.`);
      }
      if (data.type === "wye-badge-state") {
        const list = waiters.current;
        waiters.current = [];
        list.forEach((resolve) => resolve(data.state));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // sendRoster 는 ref 만 읽는다 — 다시 걸 필요가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 창이 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게 한다.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const load = useCallback(
    async (fresh: boolean) => {
      setPhase("loading");
      setNote(null);
      setStatus("명단을 불러오는 중…");
      const data = await openNametagMaker({ id, fresh });
      if ("error" in data) {
        setPhase("error");
        setStatus(data.error);
        return;
      }
      roster.current = data;
      setInfo(data);
      if (frame.current && src) {
        // 이미 떠 있는 제작기에는 명단만 다시 보낸다.
        sendRoster(data);
        return;
      }
      try {
        const blob = await loadMakerFile(data.url, data.version, setStatus);
        setStatus("명찰 제작기를 여는 중…");
        setSrc(URL.createObjectURL(blob));
      } catch (err) {
        setPhase("error");
        setStatus(err instanceof Error ? err.message : "명찰 제작기를 받지 못했습니다.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, src]
  );

  /** 제작기에게 지금 상태를 달라고 한다. 2초 안에 답이 없으면 null. */
  const askState = () =>
    new Promise<unknown>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 2000);
      waiters.current.push((state) => {
        window.clearTimeout(timer);
        resolve(state);
      });
      send({ type: "wye-badge-get-state" });
    });

  const save = async (): Promise<boolean> => {
    if (phase !== "ready") return false;
    setBusy(true);
    const state = await askState();
    if (!state) {
      setBusy(false);
      setNote({ ok: false, text: "제작기에서 내용을 받지 못했습니다. 잠시 뒤 다시 눌러주세요." });
      return false;
    }
    const res = await saveNametagState({ id, state });
    setBusy(false);
    if ("error" in res) {
      setNote({ ok: false, text: `저장하지 못했습니다 — ${res.error}` });
      return false;
    }
    setNote({ ok: true, text: res.message ?? "저장했습니다." });
    return true;
  };

  const start = () => {
    setIsOpen(true);
    void load(false);
  };

  const close = async () => {
    // 닫을 때 고친 내용을 저장해 둔다(다시 열면 이어진다). 저장에 실패하면 닫지 않고 알려준다.
    if (phase === "ready") {
      const ok = await save();
      if (!ok && !window.confirm("고친 내용을 저장하지 못했습니다. 그래도 닫을까요?")) return;
    }
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setInfo(null);
    roster.current = null;
    setPhase("idle");
    setStatus("");
    setNote(null);
    setIsOpen(false);
  };

  const refill = () => {
    if (!window.confirm("설문 명단으로 다시 채울까요? 여기서 고친 닉네임 · 글자 크기 · 위치는 사라집니다.")) return;
    void load(true);
  };

  return (
    <>
      <button type="button" onClick={start} disabled={disabled} className={adminButtonClass("primary")}>
        명찰 만들기
      </button>

      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label="명찰 제작기" className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold text-foreground">명찰 제작기{info ? ` · ${info.group}` : ""}</p>
              <p className={`text-body-sm ${phase === "error" ? "font-semibold text-danger" : "text-muted"}`} role="status" aria-live="polite">
                {phase === "error" ? `열지 못했습니다 — ${status}` : status}
                {phase === "ready" && info && (
                  <>
                    {" "}
                    {info.fromSaved
                      ? `저장해 둔 명찰을 불러왔어요${info.added > 0 ? ` · 그 뒤 들어온 응답 ${info.added}명을 뒤에 더했어요` : ""}.`
                      : `설문 ${info.surveyCount}명의 닉네임과 방수를 넣었어요.`}
                  </>
                )}
              </p>
              {note && <p className={`text-body-sm ${note.ok ? "text-confirm" : "font-semibold text-danger"}`}>{note.text}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={refill} disabled={phase !== "ready" || busy} className={adminButtonClass("secondary")}>
                설문 명단으로 다시 채우기
              </button>
              <button type="button" onClick={() => void save()} disabled={phase !== "ready" || busy} className={adminButtonClass("secondary")}>
                {busy ? "저장 중…" : "고친 내용 저장"}
              </button>
              <button ref={closeButton} type="button" onClick={() => void close()} disabled={busy} className={adminButtonClass("primary")}>
                닫기
              </button>
            </div>
          </div>

          <p className="border-b border-border bg-fill-subtle px-4 py-1.5 text-body-sm text-muted md:hidden">
            명찰 제작기는 화면이 넓어야 쓰기 편합니다. 컴퓨터에서 열어주세요.
          </p>

          <div className="relative min-h-0 flex-1">
            {phase === "loading" && !src && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-body text-muted">{status}</p>
            )}
            {src && (
              <iframe
                ref={frame}
                src={src}
                title="명찰 제작기"
                // 스크립트 · 인쇄 창(벡터 PDF 저장) · 내려받기만 연다. allow-same-origin 을 주지 않아 관리자 화면과 격리된다.
                sandbox="allow-scripts allow-modals allow-downloads"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0 bg-surface"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
