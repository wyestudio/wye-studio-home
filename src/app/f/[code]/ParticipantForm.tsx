"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import type { FormDef } from "@/lib/groupForms/schema";
import type { Answers } from "@/lib/groupForms/validate";
import type { ParticipantStatus } from "@/lib/groupFormLinks";
import { FormFlow } from "./FormFlow";
import { checkNickname, refreshStatus, submitParticipant } from "./actions";

/**
 * 참가자 사전 설문(관리자 개편 docs/04 3장).
 *
 * 첫 화면은 **신청 현황** — 모임장이 "누가 냈어요?" 를 계속 물어서 둔 화면이다. 명단은 접혀 있고, 펼치면
 * 가린 이름과 닉네임만 나온다(전화번호 · 나이대 · 방수는 서버에서 내려오지 않는다).
 *
 * 이 기기에서 낸 답은 **이 기기(localStorage)에만** 기억해 「내 답변 수정」 때 미리 채운다. 서버는 남의 번호를
 * 넣는다고 그 사람의 답을 돌려주지 않는다 — 같은 번호로 다시 내면 조용히 덮어쓸 뿐이다.
 */

/** 이 기기에 기억해 두는 내 답 — 필수 동의(다시 받는다)를 뺀 나머지. 양식에 더한 질문의 답도 같이 둔다. */
type Mine = Answers & { name: string; phone: string; nick: string };

const storeKey = (code: string) => `wye-group-form:${code}`;

function readMine(code: string): Mine | null {
  try {
    const raw = window.localStorage.getItem(storeKey(code));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Mine>;
    return typeof v.nick === "string" && typeof v.phone === "string" ? (v as Mine) : null;
  } catch {
    return null;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function ParticipantForm({
  code,
  groupName,
  when,
  headcount,
  initialStatus,
  def,
}: {
  /** 지금 쓰는 양식(서버가 읽어 넘긴다). */
  def: FormDef;
  code: string;
  groupName: string;
  /** '12월 3일 (목) 15:00' 처럼 서버가 만든 일시 문구. 날짜가 없으면 빈 글. */
  when: string;
  headcount: number;
  initialStatus: ParticipantStatus;
}) {
  const [view, setView] = useState<"status" | "form" | "done">("status");
  const [status, setStatus] = useState(initialStatus);
  const [listOpen, setListOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hp, setHp] = useState("");
  // 이 기기에 저장된 내 답. 서버에서 그릴 때는 없다고 보고(null), 브라우저에서 읽는다.
  const stored = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storeKey(code)),
    () => null
  );
  const mine = stored ? readMine(code) : null;

  const refresh = async () => {
    setRefreshing(true);
    const res = await refreshStatus(code);
    setRefreshing(false);
    if (!("error" in res)) setStatus(res);
  };

  const over = status.count - headcount;
  const pct = headcount > 0 ? Math.min(100, Math.round((status.count / headcount) * 100)) : 0;

  if (view === "form") {
    return (
      <>
        {/* 사람에게는 안 보이는 칸 — 봇이 채우면 서버가 저장하지 않는다 */}
        <div aria-hidden className="hidden">
          <label>
            웹사이트
            <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
          </label>
        </div>
        <FormFlow
          def={def}
          initial={mine ? { ...mine } : undefined}
          onExit={() => setView("status")}
          checkBeforeNext={async (q, value) => {
            if (q.id !== "nick") return null;
            const res = await checkNickname(code, value, mine?.nick);
            if ("error" in res) return null; // 확인을 못 했으면 막지 않는다 — 제출할 때 서버가 다시 본다
            return res.available ? null : "이미 다른 분이 쓰는 닉네임이에요.";
          }}
          onSubmit={async (answers: Answers) => {
            const res = await submitParticipant(code, answers, hp);
            if ("ok" in res) {
              try {
                // 필수 동의는 기억하지 않는다 — 고칠 때 다시 동의받는다. 선택 동의(사진 홍보)는 기억한다.
                const required = new Set(def.questions.filter((q) => q.type === "agree" && q.required).map((q) => q.id));
                const keep: Mine = {
                  ...Object.fromEntries(Object.entries(answers).filter(([k]) => !required.has(k))),
                  name: String(answers.name ?? ""),
                  phone: String(answers.phone ?? ""),
                  nick: String(answers.nick ?? ""),
                };
                window.localStorage.setItem(storeKey(code), JSON.stringify(keep));
                window.dispatchEvent(new StorageEvent("storage"));
              } catch {
                // 저장을 못 해도(사생활 보호 모드 등) 제출은 끝났다.
              }
              await refresh();
              setView("done");
            }
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

      {view === "done" && (
        <div role="status" className="mb-4 rounded-xl border border-confirm bg-confirm-soft p-4">
          <p className="text-body font-semibold text-confirm">설문을 잘 받았어요</p>
          <p className="mt-1 text-body-sm text-foreground">고칠 내용이 있으면 아래 「내 답변 수정」 으로 다시 내면 돼요.</p>
        </div>
      )}

      <p className="text-body-sm text-muted">{when}</p>
      <h1 className="mt-1 text-h1 font-extrabold text-foreground">{groupName}</h1>

      <section aria-labelledby="status-title" className="mt-5 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="status-title" className="text-h3 font-semibold text-foreground">
            신청 현황
          </h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="min-h-11 rounded-lg px-2 text-body-sm text-glow underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {refreshing ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        <p className="mt-1 text-body text-foreground" aria-live="polite">
          <strong className="text-h2 font-extrabold tabular-nums">{status.count}명</strong> 제출
          <span className="text-muted"> · 확정 {headcount}명</span>
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-fill-strong"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={headcount}
          aria-valuenow={Math.min(status.count, headcount)}
          aria-label="설문 제출 현황"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-body-sm text-muted">
          {over > 0
            ? `확정 인원보다 ${over}명 많아요. 모임장에게 알려주세요.`
            : over === 0
              ? "모두 제출했어요."
              : `아직 ${-over}명이 남았어요.`}
        </p>

        {status.count > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setListOpen(!listOpen)}
              aria-expanded={listOpen}
              aria-controls="status-list"
              className="flex min-h-11 w-full items-center justify-between text-body-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              제출한 사람 {status.count}명 {listOpen ? "접기" : "보기"}
            </button>
            {listOpen && (
              <ul id="status-list" className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                {status.people.map((p, i) => (
                  <li key={`${p.nick}-${i}`} className="truncate text-body-sm text-foreground">
                    {p.name} <span className="text-muted">· {p.nick}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-body-sm text-muted">전화번호와 나머지 답변은 다른 참가자에게 보이지 않아요.</p>
          </div>
        )}
      </section>

      {mine && (
        <section className="mt-4 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-h3 font-semibold text-foreground">내 제출</h2>
          <p className="mt-1 text-body text-foreground">
            {mine.name} <span className="text-muted">· {mine.nick}</span>
          </p>
          <p className="mt-1 text-body-sm text-muted">이 기기에서 낸 답이에요. 같은 전화번호로 다시 내면 답이 고쳐져요.</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setView("form")}
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-foreground px-4 text-body font-semibold text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {mine ? "내 답변 수정" : "설문 작성하기"}
      </button>
      <p className="mt-3 text-center text-body-sm text-muted">
        질문 {def.questions.filter((q) => q.type !== "agree" && !q.showIf).length}개와 약관 확인 · 1분이면 끝나요.
      </p>
    </div>
  );
}
