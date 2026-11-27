"use client";

import { useState } from "react";
import { AdminBadge, AdminField, AdminNotice, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { CONTACT_METHODS } from "@/lib/groupBooking";
import { LEADER_BASE, LEADER_QUESTIONS, LEADER_SECOND } from "@/lib/groupForms/leaderSchema";
import { answerText } from "@/lib/groupForms/leaderForm";
import { OTHER, otherKey, type Question } from "@/lib/groupForms/schema";
import { isVisible, type Answers } from "@/lib/groupForms/validate";
import {
  changeContact,
  lockLeaderForm,
  resolveLeaderEdit,
  revealLeaderPhone,
  saveLeaderAnswer,
  settleLeaderPending,
  unlockLeaderForm,
} from "../groupActions";
import { ActionNote, useGroupAction } from "./GroupDetailClient";

/**
 * 단체 상세 › 개요의 「모임장 신청서」 카드(관리자 개편 docs/02 4장).
 *
 * 위에서부터: 모임장 수정 요청 → 신청서와 다른 내용(반영 / 넘기기) → 상담이 필요한 내용 → 운영 준비에 바로 쓰는 요약
 * → 「신청서 전체 보기」(답을 하나씩 고칠 수 있다).
 *
 * ⚠️ 휴대폰 번호는 가린 값으로 온다. 「번호 보기」 를 눌렀을 때만 전체 값을 받는다(감사로그에 남는다).
 * ⚠️ 「반영」 은 금액 탭 · 일정 수정과 같은 길로 간다 — 금액은 서버가 다시 계산한다.
 */

export type LeaderCardData = {
  answers: Answers;
  submittedAt: string;
  submitCount: number;
  locked: boolean;
  phoneMasked: string;
  newLeaderMasked: string | null;
  editRequest: string | null;
  editRequestedAt: string | null;
  pending: { key: string; label: string }[];
  consult: string[];
  adminUpdatedAt: string | null;
};

const HIGHLIGHT_IDS = ["team", "teamHow", "difficulty", "level", "event", "eventDetail", "surprise", "repeat", "repeatN", "afterParty", "apHours", "cleanup", "byob", "display", "welcome", "contactPref", "openchat", "etc"];
const EDITABLE = [...LEADER_SECOND, ...LEADER_QUESTIONS];

export function LeaderCard({ id, cancelled, data }: { id: string; cancelled: boolean; data: LeaderCardData }) {
  const { pending, note, run } = useGroupAction();
  const [editing, setEditing] = useState<string | null>(null);
  const a = data.answers;
  const visible = (q: Question) => isVisible(q, a);
  const highlights = EDITABLE.filter((q) => HIGHLIGHT_IDS.includes(q.id) && visible(q) && a[q.id] !== undefined && a[q.id] !== "");
  const sections = [...new Set(EDITABLE.filter(visible).map((q) => q.section ?? ""))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminBadge tone={data.locked ? "done" : "warn"}>{data.locked ? "제출 완료" : "수정 열어 둠"}</AdminBadge>
        <span className="text-body-sm text-muted">
          {data.submittedAt} 제출{data.submitCount > 1 ? ` · ${data.submitCount}번째 제출` : ""}
          {data.adminUpdatedAt ? ` · 운영자 수정 ${data.adminUpdatedAt}` : ""}
        </span>
      </div>

      {data.editRequest && (
        <AdminNotice title={`모임장 수정 요청${data.editRequestedAt ? ` · ${data.editRequestedAt}` : ""}`}>
          <p className="whitespace-pre-line break-words">{data.editRequest}</p>
          {!cancelled && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => unlockLeaderForm({ id }))} className={adminButtonClass("primary")}>
                수정 열어주기
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => resolveLeaderEdit({ id }))} className={adminButtonClass("secondary")}>
                처리 완료
              </button>
            </div>
          )}
          <p className="mt-2 text-body-sm text-muted">「수정 열어주기」 는 모임장이 직접 고쳐 다시 내게 합니다. 직접 고쳤다면 「처리 완료」.</p>
        </AdminNotice>
      )}

      {data.pending.length > 0 && (
        <section aria-labelledby="leader-pending">
          <h3 id="leader-pending" className="text-body font-semibold text-foreground">
            신청서와 다른 내용 {data.pending.length}건
          </h3>
          <p className="mt-1 text-body-sm text-muted">「반영」 을 누르면 금액을 다시 계산합니다. 「넘기기」 는 지금 값을 그대로 둡니다.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {data.pending.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-fill-subtle p-3">
                <span className="min-w-0 break-words text-body-sm font-semibold text-foreground">{p.label}</span>
                {!cancelled && (
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => settleLeaderPending({ id, key: p.key, apply: true }))}
                      className={adminButtonClass("primary")}
                    >
                      반영
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => settleLeaderPending({ id, key: p.key, apply: false }))}
                      className={adminButtonClass("secondary")}
                    >
                      넘기기
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.consult.length > 0 && (
        <AdminNotice title="상담이 필요한 내용">
          <ul className="list-disc pl-5">
            {data.consult.map((c) => (
              <li key={c} className="break-words">
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-body-sm text-muted">금액은 자동으로 바뀌지 않습니다. 연락해 정한 뒤 금액 탭에서 고쳐주세요.</p>
        </AdminNotice>
      )}

      <ActionNote note={note} />

      <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {highlights.map((q) => (
          <div key={q.id} className="min-w-0">
            <dt className="text-body-sm text-muted">{q.label}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-body font-semibold text-foreground">{answerText(q, a)}</dd>
          </div>
        ))}
      </dl>

      <PhoneRow id={id} masked={data.phoneMasked} newLeader={data.newLeaderMasked} />

      <details className="rounded-lg border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-body-sm font-semibold text-foreground">신청서 전체 보기 · 직접 수정</summary>
        <div className="flex flex-col gap-4 border-t border-border p-3">
          <section>
            <h4 className="text-body-sm font-semibold text-muted">기본 정보 (신청서에 적힌 값)</h4>
            <dl className="mt-2 flex flex-col gap-2">
              {LEADER_BASE.filter((q) => a[q.id] !== undefined).map((q) => (
                <div key={q.id}>
                  <dt className="text-body-sm text-muted">{q.label}</dt>
                  <dd className="break-words text-body-sm text-foreground">{answerText(q, a)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-body-sm text-muted">모임 이름 · 인원 · 일정은 단체 정보라 각자의 자리(모임 이름 수정 · 금액 탭 · 일정 수정)에서 고칩니다.</p>
          </section>
          {sections.map((s) => (
            <section key={s}>
              <h4 className="text-body-sm font-semibold text-muted">{s}</h4>
              <ul className="mt-2 flex flex-col gap-3">
                {EDITABLE.filter((q) => (q.section ?? "") === s && visible(q)).map((q) => (
                  <li key={q.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-sm text-muted">{q.label}</p>
                        <p className="whitespace-pre-line break-words text-body-sm text-foreground">{answerText(q, a)}</p>
                      </div>
                      {!cancelled && q.type !== "agree" && editing !== q.id && (
                        <button type="button" onClick={() => setEditing(q.id)} className="min-h-11 shrink-0 px-2 text-body-sm text-glow underline">
                          수정
                        </button>
                      )}
                    </div>
                    {editing === q.id && <AnswerEditor id={id} q={q} answers={a} onClose={() => setEditing(null)} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!cancelled && !data.editRequest && (
            <div className="border-t border-border pt-3">
              {data.locked ? (
                <button type="button" disabled={pending} onClick={() => run(() => unlockLeaderForm({ id }))} className={adminButtonClass("secondary")}>
                  수정 열어주기
                </button>
              ) : (
                <button type="button" disabled={pending} onClick={() => run(() => lockLeaderForm({ id }))} className={adminButtonClass("secondary")}>
                  다시 잠그기
                </button>
              )}
              <p className="mt-1 text-body-sm text-muted">
                {data.locked ? "모임장이 같은 링크에서 고쳐 다시 낼 수 있게 합니다." : "지금 모임장이 고칠 수 있는 상태입니다. 다시 내면 저절로 잠깁니다."}
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/** 답 하나를 고치는 칸. 공개 폼과 같은 검증을 서버가 한다. */
function AnswerEditor({ id, q, answers, onClose }: { id: string; q: Question; answers: Answers; onClose: () => void }) {
  const cur = answers[q.id];
  const [value, setValue] = useState<string>(typeof cur === "string" || typeof cur === "number" ? String(cur) : "");
  const [picks, setPicks] = useState<string[]>(Array.isArray(cur) ? cur : []);
  const [other, setOther] = useState<string>(typeof answers[otherKey(q.id)] === "string" ? (answers[otherKey(q.id)] as string) : "");
  const { pending, note, run } = useGroupAction();
  const fieldId = `leader-edit-${q.id}`;
  const needOther = q.other && (q.type === "checkbox" ? picks.includes(OTHER) : value === OTHER);
  const toggle = (opt: string) => {
    if (picks.includes(opt)) return setPicks(picks.filter((x) => x !== opt));
    if (q.none && opt === q.none) return setPicks([opt]);
    setPicks([...picks.filter((x) => x !== q.none), opt]);
  };

  return (
    <form
      className="mt-2 rounded-lg border border-border bg-fill-subtle p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveLeaderAnswer({ id, questionId: q.id, value: q.type === "checkbox" ? picks : value, other: needOther ? other : undefined }), onClose);
      }}
    >
      {q.type === "checkbox" ? (
        <fieldset>
          <legend className="text-body-sm font-semibold text-foreground">{q.label}</legend>
          <div className="mt-1 flex flex-col">
            {(q.options ?? []).map((opt) => (
              <label key={opt} className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
                <input type="checkbox" checked={picks.includes(opt)} onChange={() => toggle(opt)} className="h-5 w-5 shrink-0" />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <AdminField label={q.label} htmlFor={fieldId} hint={q.required ? undefined : "비워 두면 답을 지웁니다"}>
          {q.type === "radio" ? (
            <select id={fieldId} value={value} onChange={(e) => setValue(e.target.value)} className={adminInputClass}>
              {!q.required && <option value="">(답 없음)</option>}
              {q.required && value === "" && <option value="">고르기</option>}
              {(q.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : q.type === "textarea" ? (
            <textarea id={fieldId} value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={(q.max ?? 1000) * 2} className={adminInputClass} />
          ) : (
            <input
              id={fieldId}
              type={q.type === "date" ? "date" : q.type === "time" ? "time" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={(q.max ?? 100) * 2}
              autoComplete="off"
              className={adminInputClass}
            />
          )}
        </AdminField>
      )}
      {needOther && (
        <div className="mt-2">
          <AdminField label="기타 내용" htmlFor={`${fieldId}-other`} hint="2~50자">
            <input id={`${fieldId}-other`} value={other} onChange={(e) => setOther(e.target.value)} maxLength={100} autoComplete="off" className={adminInputClass} />
          </AdminField>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={onClose} className={adminButtonClass("secondary")}>
          닫기
        </button>
      </div>
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </form>
  );
}

/** 신청서의 휴대폰 번호 — 가려서 보여주고, 누를 때만 전체 값을 받는다. */
function PhoneRow({ id, masked, newLeader }: { id: string; masked: string; newLeader: string | null }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-body-sm text-muted">신청서에 적은 휴대폰 번호 (단체 연락처와 따로 보관)</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className="text-body font-semibold tabular-nums text-foreground">{phone ?? masked}</span>
        {!phone && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await revealLeaderPhone({ id });
              setBusy(false);
              if ("error" in res) return setError(res.error);
              setPhone(res.phone);
            }}
            className="min-h-11 text-body-sm text-glow underline"
          >
            {busy ? "불러오는 중…" : "번호 보기"}
          </button>
        )}
      </div>
      {phone && <p className="mt-1 text-body-sm text-muted">본 기록이 남았습니다.</p>}
      {newLeader && <p className="mt-1 text-body-sm text-foreground">새 담당자 이름: {newLeader} (가린 값 — 위 「반영」 을 누르면 단체 담당자가 바뀝니다)</p>}
      {error && (
        <p role="alert" className="mt-1 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** 담당자 연락처 변경 — 가려진 값을 고치는 게 아니라 새 연락처로 바꾼다. */
export function ContactEditor({ id, method }: { id: string; method: string }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState(method);
  const [contact, setContact] = useState("");
  const { pending, note, run } = useGroupAction();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 block min-h-11 text-body-sm text-glow underline">
        연락처가 바뀌었어요
      </button>
    );
  }
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => changeContact({ id, method: m, contact }),
          () => {
            setContact("");
            setOpen(false);
          }
        );
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <AdminField label="연락 방법" htmlFor="contact-method">
          <select id="contact-method" value={m} onChange={(e) => setM(e.target.value)} className={adminInputClass}>
            {CONTACT_METHODS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="새 연락처" htmlFor="contact-value" hint="전화번호 · 카카오톡 ID · 이메일">
          <input id="contact-value" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={100} autoComplete="off" className={adminInputClass} />
        </AdminField>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
          {pending ? "저장 중…" : "저장"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={adminButtonClass("secondary")}>
          닫기
        </button>
      </div>
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </form>
  );
}
