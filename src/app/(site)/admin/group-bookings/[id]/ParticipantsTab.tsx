"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminBadge, AdminCard, AdminEmpty, AdminNotice, adminButtonClass } from "@/components/admin/ui";
import { NAMETAG_MODES, nametagColor, nametagTier, type NametagMode } from "@/lib/groupTeams";
import { exportParticipantsCsv, logParticipantsCopied, revealParticipantPhone, saveHeadcount, setNametagMode } from "../groupActions";
import { ActionNote, useGroupAction } from "./GroupDetailClient";
import { NametagMaker } from "./NametagMaker";

/**
 * 단체 상세 › 참가자 탭(관리자 개편 docs/02 9장).
 *
 * 현황(설문 n / 확정 m명) · 명찰 색 기준 · 목록 · 닉네임/방수 복사 · CSV 저장 · 명찰 만들기(NametagMaker).
 * 설문은 정원을 넘어도 받는다 — 넘으면 「인원을 n명으로 수정」 으로 요금 구간과 잔금을 다시 계산한다(자동으로 올리지 않는다).
 *
 * ⚠️ 전화번호는 가린 값으로 온다. 「보기」 와 「CSV 저장」 은 누를 때마다 감사로그에 남는다.
 * ⚠️ 새 응답은 「새로고침」 을 눌렀을 때 읽는다 — 주기적으로 서버를 부르지 않는다(wye-server-cost).
 */

export type ParticipantView = {
  id: string;
  name: string;
  phoneMasked: string;
  nick: string;
  ageBand: string;
  count: number;
  photo: boolean;
  at: string;
  edited: boolean;
  /** 낸 지(고친 지) 한 시간이 안 됐다. */
  recent: boolean;
  /** 양식에 더한 질문의 답 — 서버가 글로 바꿔 넘긴다(질문 이름 · 답). */
  extras: { label: string; value: string }[];
};

// 명찰 색 견본 — 색만으로 가르지 않게 항상 색 이름을 같이 적는다. 값은 명찰 제작기(TIER_META)의 색과 같다.
const SWATCH = ["#f5f5f1", "#f2d3a6", "#c98f66", "#c9c9c9", "#565656"];

export function ParticipantsTab({
  id,
  cancelled,
  headcount,
  mode,
  people,
  teamsHref,
}: {
  id: string;
  cancelled: boolean;
  headcount: number;
  mode: NametagMode;
  people: ParticipantView[];
  teamsHref: string;
}) {
  const router = useRouter();
  const { pending, note, setNote, run } = useGroupAction();
  const [busy, setBusy] = useState("");
  const count = people.length;
  const over = count - headcount;
  const pct = headcount > 0 ? Math.min(100, Math.round((count / headcount) * 100)) : 0;

  const copyNicks = async () => {
    try {
      // 표에 바로 붙여넣을 수 있게 탭으로 가른다.
      await navigator.clipboard.writeText(people.map((p) => `${p.nick}\t${p.count}`).join("\n"));
      setNote({ ok: true, text: "닉네임과 방수를 복사했습니다. 표에 바로 붙여넣을 수 있어요." });
      void logParticipantsCopied({ id, count });
    } catch {
      setNote({ ok: false, text: "복사하지 못했습니다. 브라우저의 복사 권한을 확인해주세요." });
    }
  };

  const saveCsv = async () => {
    setBusy("csv");
    const res = await exportParticipantsCsv({ id });
    setBusy("");
    if ("error" in res) return setNote({ ok: false, text: res.error });
    const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNote({ ok: true, text: "명단을 저장했습니다. 저장한 기록이 감사로그에 남았습니다." });
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title="참가자 설문">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-body text-foreground" aria-live="polite">
            <strong className="text-h2 font-extrabold tabular-nums">
              {count} / {headcount}명
            </strong>
            <span className="ml-2 text-body-sm text-muted">
              {over > 0 ? `확정 인원보다 ${over}명 많음` : over === 0 ? "모두 제출" : `미응답 ${-over}명`}
            </span>
          </p>
          <button type="button" onClick={() => router.refresh()} className={adminButtonClass("secondary")}>
            새로고침
          </button>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-fill-strong"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={headcount}
          aria-valuenow={Math.min(count, headcount)}
          aria-label="참가자 설문 제출 현황"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-body-sm text-muted">새 응답은 「새로고침」 을 눌렀을 때 반영됩니다.</p>

        {count > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyNicks} className={adminButtonClass("secondary")}>
              닉네임 · 방수 복사
            </button>
            <button type="button" onClick={saveCsv} disabled={busy === "csv"} className={adminButtonClass("secondary")}>
              {busy === "csv" ? "만드는 중…" : "CSV 저장"}
            </button>
            <Link href={teamsHref} className={adminButtonClass("secondary")}>
              팀 편성
            </Link>
            <NametagMaker id={id} />
          </div>
        )}
        <div className="mt-2">
          <ActionNote note={note} />
        </div>
      </AdminCard>

      {over > 0 && !cancelled && (
        <AdminNotice
          title={`설문 ${count}명 · 확정 ${headcount}명`}
          actions={
            <button type="button" disabled={pending} onClick={() => run(() => saveHeadcount({ id, headcount: count }))} className={adminButtonClass("primary")}>
              인원을 {count}명으로 수정
            </button>
          }
        >
          설문이 확정 인원보다 많습니다. 인원을 고치면 요금 구간과 잔금을 다시 계산합니다. 설문은 정원을 넘어도 막지 않습니다.
        </AdminNotice>
      )}

      <AdminCard title="명찰 색 기준">
        <fieldset disabled={pending || cancelled}>
          <legend className="text-body-sm text-muted">참가자들의 방수를 보고 고릅니다. 명찰 제작기에도 이 기준이 넘어갑니다.</legend>
          <div className="mt-2 flex flex-col gap-2">
            {NAMETAG_MODES.map((m) => (
              <label key={m.code} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-body-sm text-foreground">
                <input
                  type="radio"
                  name="nametag-mode"
                  checked={mode === m.code}
                  onChange={() => run(() => setNametagMode({ id, mode: m.code }))}
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="font-semibold">{m.label}</span>
                  <span className="mt-0.5 block text-muted">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </AdminCard>

      <AdminCard title={`명단 ${count}명`}>
        {count === 0 ? (
          <AdminEmpty title="아직 응답이 없어요" hint="「설문 · 문자」 탭에서 참가자용 설문 링크를 모임장에게 전달하세요." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {people.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 md:w-56">
                  <p className="break-words text-body font-semibold text-foreground">
                    {p.name} <span className="font-normal text-muted">· {p.nick}</span>
                  </p>
                  <p className="text-body-sm text-muted">{p.ageBand}</p>
                  {p.extras.map((x) => (
                    <p key={x.label} className="break-words text-body-sm text-muted">
                      {x.label}: <span className="text-foreground">{x.value}</span>
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-2 md:w-48">
                  <span aria-hidden className="h-4 w-4 shrink-0 rounded-md border border-line" style={{ background: SWATCH[nametagTier(p.count, mode)] }} />
                  <span className="text-body-sm text-foreground">
                    <span className="tabular-nums">{p.count}방</span> · {nametagColor(p.count, mode)}
                  </span>
                </div>
                <PhoneCell id={id} participantId={p.id} masked={p.phoneMasked} />
                <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
                  <AdminBadge tone={p.photo ? "done" : "idle"}>{p.photo ? "사진 홍보 동의" : "사진 홍보 미동의"}</AdminBadge>
                  {p.edited && <AdminBadge tone="progress">수정됨</AdminBadge>}
                  {p.recent && <AdminBadge tone="warn">방금</AdminBadge>}
                  <span className="text-micro text-muted">{p.at}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

/** 전화번호 — 가려서 보여주고, 누를 때만 전체 값을 받는다(기록이 남는다). */
function PhoneCell({ id, participantId, masked }: { id: string; participantId: string; masked: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2 md:w-56">
      <span className="text-body-sm tabular-nums text-foreground">{phone ?? masked}</span>
      {!phone && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await revealParticipantPhone({ id, participantId });
            setBusy(false);
            if ("error" in res) return setError(res.error);
            setPhone(res.phone);
          }}
          className="min-h-11 px-1 text-body-sm text-glow underline"
        >
          {busy ? "…" : "보기"}
        </button>
      )}
      {error && (
        <span role="alert" className="text-body-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
