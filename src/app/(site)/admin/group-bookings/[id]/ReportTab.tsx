"use client";

import { useEffect, useRef, useState } from "react";
import { AdminCard, AdminNotice, adminButtonClass } from "@/components/admin/ui";
import { openReport, saveReportState, type ReportOpen } from "../groupActions";

/**
 * 단체 상세 › 리포트 탭(관리자 개편 docs/02 11장).
 *
 * 리포트 틀은 대표님이 만든 단일 HTML 이고 **그 자체가 편집기**다(팀 · 게임 수 · 점수 · 사진 · 다크/라이트 · HTML 저장 · PDF 인쇄).
 * 새로 만들지 않고 그 틀을 화면 가득 열어, 단체 정보와 팀 편성으로 채워 준다. 디자인은 그대로다.
 *
 * 격리: 틀은 `sandbox` 안에서 돈다 — 관리자 화면의 쿠키 · 저장소 · DOM 에 닿지 못한다. 주고받는 것은 메시지뿐이다.
 *
 * ⚠️ **사진은 저장하지 않는다**(얼굴이 들어간다 — 2026-11-27 대표님). 글자 · 팀 · 점수만 단체별로 저장한다.
 *    사진을 넣었으면 닫기 전에 틀의 [HTML 저장] 이나 [PDF / 인쇄] 로 보관해야 한다 — 닫을 때 한 번 더 묻는다.
 * ⚠️ 시스템이 리포트를 보내지 않는다. 내려받은 파일을 운영자가 카카오톡으로 전달한다.
 */

type Phase = "idle" | "loading" | "ready" | "error";

export function ReportTab({ id, cancelled, savedAt }: { id: string; cancelled: boolean; savedAt: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [info, setInfo] = useState<ReportOpen | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const data = useRef<ReportOpen | null>(null);
  const waiters = useRef<((state: unknown) => void)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);

  // 격리된 틀은 출처가 없어('null') 주소를 지정할 수 없다 — 대신 우리가 만든 그 틀의 창에만 보낸다.
  const send = (message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(message, "*");

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const msg = event.data as { type?: string; teams?: number; state?: unknown } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "wye-report-ready" && data.current) {
        send({ type: "wye-report-fill", docId: data.current.docId, saved: data.current.saved, fill: data.current.fill });
      }
      if (msg.type === "wye-report-loaded") {
        setPhase("ready");
        setStatus(`${Number(msg.teams) || 0}팀으로 채웠습니다.`);
      }
      if (msg.type === "wye-report-state") {
        const list = waiters.current;
        waiters.current = [];
        list.forEach((resolve) => resolve(msg.state));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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

  const start = async () => {
    setIsOpen(true);
    setPhase("loading");
    setNote(null);
    setStatus("리포트를 준비하는 중…");
    const res = await openReport({ id });
    if ("error" in res) {
      setPhase("error");
      setStatus(res.error);
      return;
    }
    data.current = res;
    setInfo(res);
    try {
      const file = await fetch(res.url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      if (!file.ok) throw new Error(`틀 파일을 받지 못했습니다(${file.status}).`);
      setSrc(URL.createObjectURL(new Blob([await file.blob()], { type: "text/html" })));
    } catch (err) {
      setPhase("error");
      setStatus(err instanceof Error ? err.message : "리포트 틀을 받지 못했습니다.");
    }
  };

  /** 틀에게 지금 내용을 달라고 한다(사진은 빼고 온다). 2초 안에 답이 없으면 null. */
  const askState = () =>
    new Promise<unknown>((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 2000);
      waiters.current.push((state) => {
        window.clearTimeout(timer);
        resolve(state);
      });
      send({ type: "wye-report-get-state" });
    });

  const save = async (): Promise<boolean> => {
    if (phase !== "ready") return false;
    setBusy(true);
    const state = await askState();
    if (!state) {
      setBusy(false);
      setNote({ ok: false, text: "리포트에서 내용을 받지 못했습니다. 잠시 뒤 다시 눌러주세요." });
      return false;
    }
    const res = await saveReportState({ id, state });
    setBusy(false);
    if ("error" in res) {
      setNote({ ok: false, text: `저장하지 못했습니다 — ${res.error}` });
      return false;
    }
    setNote({ ok: true, text: res.message ?? "저장했습니다." });
    return true;
  };

  const close = async () => {
    if (phase === "ready") {
      if (!window.confirm("사진은 저장되지 않습니다. 사진을 넣었다면 [HTML 저장] 이나 [PDF / 인쇄] 로 먼저 보관하세요.\n\n글자 · 팀 · 점수를 저장하고 닫을까요?")) return;
      const ok = await save();
      if (!ok && !window.confirm("내용을 저장하지 못했습니다. 그래도 닫을까요?")) return;
    }
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setInfo(null);
    data.current = null;
    setPhase("idle");
    setStatus("");
    setNote(null);
    setIsOpen(false);
  };

  const pullTeams = () => {
    if (!info) return;
    if (!window.confirm("팀 편성 탭의 팀 · 팀명 · 구호 · 팀원으로 다시 채울까요? 점수와 상 이름은 팀 순서대로 그대로 둡니다.")) return;
    setPhase("loading");
    send({ type: "wye-report-teams", teams: info.teamsNow });
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title="플레이 리포트">
        <p className="text-body-sm text-foreground">
          행사 일시 · 모임명 · 인원 · 플레이 타임과 팀 편성(팀명 · 구호 · 팀원 닉네임)을 채운 리포트를 엽니다. 열고 나서 모두 고칠 수 있어요.
        </p>
        <ul className="mt-2 list-disc pl-5 text-body-sm text-muted">
          <li>사진 · 점수 · 순위는 행사 뒤에 리포트 안에서 넣습니다.</li>
          <li>완성본은 리포트 안의 [HTML 저장] · [PDF / 인쇄] 로 내려받아 카카오톡으로 전달합니다. 시스템이 보내지 않습니다.</li>
        </ul>
        <p className="mt-2 text-body-sm text-muted">{savedAt ? `마지막 저장 ${savedAt} — 이어서 엽니다.` : "아직 저장한 내용이 없습니다. 단체 정보로 새로 채웁니다."}</p>
        <button type="button" onClick={() => void start()} disabled={cancelled} className={`${adminButtonClass("primary")} mt-3`}>
          {savedAt ? "리포트 이어서 열기" : "리포트 만들기"}
        </button>
      </AdminCard>

      <AdminNotice title="사진은 저장되지 않습니다">
        참가자 얼굴이 들어가는 사진은 서버에 두지 않습니다. 글자 · 팀 · 점수만 단체별로 저장됩니다. 사진을 넣었다면 닫기 전에 [HTML 저장] 이나 [PDF / 인쇄] 로
        컴퓨터에 보관하세요. 저장한 HTML 파일은 다시 열어 이어서 고칠 수 있습니다.
      </AdminNotice>

      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label="플레이 리포트" className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold text-foreground">플레이 리포트{info ? ` · ${info.group}` : ""}</p>
              <p className={`text-body-sm ${phase === "error" ? "font-semibold text-danger" : "text-muted"}`} role="status" aria-live="polite">
                {phase === "error" ? `열지 못했습니다 — ${status}` : status}
                {phase === "ready" && info && (
                  <> {info.saved ? "저장해 둔 내용을 불러왔어요(사진 제외)." : info.teamsSaved ? "팀 편성 탭의 편성을 넣었어요." : "추천 편성을 넣었어요 — 팀 편성을 고쳤다면 다시 가져오세요."}</>
                )}
              </p>
              {note && <p className={`text-body-sm ${note.ok ? "text-confirm" : "font-semibold text-danger"}`}>{note.text}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={pullTeams} disabled={phase !== "ready" || busy || !info?.teamsNow.length} className={adminButtonClass("secondary")}>
                팀 편성 다시 가져오기
              </button>
              <button type="button" onClick={() => void save()} disabled={phase !== "ready" || busy} className={adminButtonClass("secondary")}>
                {busy ? "저장 중…" : "내용 저장"}
              </button>
              <button ref={closeButton} type="button" onClick={() => void close()} disabled={busy} className={adminButtonClass("primary")}>
                닫기
              </button>
            </div>
          </div>
          <p className="border-b border-border bg-wait-soft px-4 py-1.5 text-body-sm text-foreground">
            사진은 저장되지 않습니다 — 사진을 넣었다면 닫기 전에 아래 화면의 [HTML 저장] 이나 [PDF / 인쇄] 로 보관하세요.
          </p>
          <div className="relative min-h-0 flex-1">
            {phase === "loading" && !src && <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-body text-muted">{status}</p>}
            {src && (
              <iframe
                ref={frame}
                src={src}
                title="플레이 리포트"
                // 스크립트 · 인쇄 창과 확인 창 · 내려받기(HTML 저장)만 연다. allow-same-origin 을 주지 않아 관리자 화면과 격리된다.
                sandbox="allow-scripts allow-modals allow-downloads"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0 bg-surface"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
