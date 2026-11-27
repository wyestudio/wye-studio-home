"use client";

import { useState } from "react";
import { AdminBadge, AdminCard, AdminField, AdminNotice, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { OPTION } from "@/lib/groupPricing";
import {
  ADJUST_REASONS,
  DISCOUNT_REASONS,
  LATE_BOOKING_DAYS,
  PAY_TYPES,
  STUDENT_ALL_RATIO,
  type AdjustReason,
  type PayType,
  type Settlement,
  type SettlementOptions,
} from "@/lib/groupSettlement";
import {
  addAdjustment,
  confirmDeposit,
  overrideTotal,
  removeAdjustment,
  saveHeadcount,
  saveOptions,
  savePayType,
  saveStudent,
  setBalancePaid,
  setDepositReturned,
  unconfirmDeposit,
} from "../groupActions";
import { ActionNote, useGroupAction } from "./GroupDetailClient";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const signed = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n).toLocaleString("ko-KR")}원`;

export type MoneyTabProps = {
  id: string;
  cancelled: boolean;
  headcount: number;
  options: SettlementOptions;
  isStudent: boolean;
  studentCount: number | null;
  payType: PayType;
  /** 지금 일시(확정이면 확정 일시, 아니면 희망 일시). 시각이 옛 코드값이면 time 이 null 이다. */
  schedule: { date: string | null; time: string | null; minutes: number; fixed: boolean };
  /** 옵션대로면 몇 분짜리 행사인가 — 막아 둔 시간과 다르면 알려준다. */
  optionMinutes: number;
  /** 서버가 계산한 정산. 화면은 보여주기만 한다 — 저장할 때 서버가 다시 계산한다. */
  settlement: Settlement;
  adjustments: { id: string; reason: AdjustReason; label: string; note: string | null }[];
  deposit: { amount: number | null; paidAt: string | null; returnedAt: string | null };
  balancePaidAt: string | null;
  /** 지금 확정하려면 받아야 할 금액(임박 예약 · 결제 방식에 따라 전액 또는 30%). */
  required: { amount: number; full: boolean };
  daysLeft: number | null;
  refund: { deposit: number; amount: number; label: string; daysLeft: number | null };
  history: { id: number; summary: string; reason: string | null; actor: string; at: string }[];
};

/**
 * 금액 탭(관리자 개편 docs/02 7장 · docs/03).
 *
 * 왼쪽: 금액 내역(인원 · 학생 단체 · 옵션 · 조정 줄 · 총액 직접 수정). 오른쪽: 결제 방식 · 예약금 · 잔금.
 * 아래: 변경 기록. 휴대폰에서는 한 줄로 쌓인다.
 *
 * ⚠️ 여기 보이는 금액은 전부 서버가 계산해 내려준 값이다. 바꿀 때마다 서버가 다시 계산해 저장하고 기록을 남긴다.
 */
export function MoneyTab(p: MoneyTabProps) {
  const s = p.settlement;
  return (
    <div className="flex flex-col gap-4">
      {p.cancelled && (
        <AdminNotice title="취소된 단체입니다">금액은 더 바꿀 수 없습니다. 아래는 취소 시점의 내역과 기록입니다.</AdminNotice>
      )}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <AdminCard title="금액 내역">
          <BaseBlock p={p} />
          <StudentBlock p={p} />
          <OptionsBlock p={p} />
          <AdjustBlock p={p} />
          <dl className="mt-5 border-t border-border pt-4">
            <Row label="총 이용 금액" value={won(s.total)} strong />
            <Row label="받은 예약금" value={p.deposit.amount != null ? won(p.deposit.amount) : "아직 없음"} />
            <Row label="잔금" value={p.balancePaidAt ? `${won(s.balance)} · 확인됨` : won(s.balance)} strong />
          </dl>
        </AdminCard>

        <div className="flex flex-col gap-4">
          <PayBlock p={p} />
          <DepositBlock p={p} />
        </div>
      </div>

      <AdminCard title="변경 기록">
        {p.history.length === 0 ? (
          <p className="text-body-sm text-muted">아직 기록이 없어요. 인원 · 옵션 · 조정 · 일정 · 확정 · 취소를 바꾸면 여기에 남습니다.</p>
        ) : (
          <ul className="divide-y divide-border">
            {p.history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="text-body-sm text-foreground">{h.summary}</p>
                <p className="text-micro text-muted">
                  {h.at} · {h.actor}
                  {h.reason ? ` · 사유: ${h.reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-body-sm text-muted">{label}</dt>
      <dd className={`tabular-nums text-foreground ${strong ? "text-h3 font-extrabold" : "text-body font-semibold"}`}>{value}</dd>
    </div>
  );
}

function Lines({ lines }: { lines: { label: string; detail?: string; amount: number }[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {lines.map((l, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3 text-body-sm">
          <span className="min-w-0 text-foreground">
            {l.label}
            {l.detail && <span className="text-muted"> · {l.detail}</span>}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-foreground">{won(l.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

const sectionTitle = "text-label font-semibold text-muted";

/** 기본 프로그램 — 인원 × 1인 요금. 인원은 −/+ 로 바꾸고 「저장」 을 눌러야 반영된다. */
function BaseBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  const [n, setN] = useState(p.headcount);
  const dirty = n !== p.headcount;
  const s = p.settlement;
  const warn: string[] = [];
  if (dirty && n < p.headcount && p.daysLeft != null && p.daysLeft < LATE_BOOKING_DAYS && p.deposit.amount != null) {
    warn.push("행사 7일 전을 지났습니다. 7일 전 확정 인원 기준으로 정산합니다.");
  }
  if (dirty && n < p.headcount && p.balancePaidAt) warn.push("잔금 결제 후 인원 감소 · 취소에 따른 차액 환불은 어렵습니다.");
  if (dirty && n > p.headcount && p.deposit.amount != null) warn.push("추가 인원분은 별도 결제입니다 — 잔금이 늘어납니다.");
  const step = (d: number) => setN((v) => Math.max(2, Math.min(200, v + d)));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={sectionTitle}>
          기본 프로그램 · {s.seasonLabel} {s.weekend ? "주말" : "평일"}
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="인원 줄이기" disabled={p.cancelled || n <= 2} onClick={() => step(-1)} className={`${adminButtonClass("secondary")} w-11 px-0`}>
            −
          </button>
          <span className="min-w-16 text-center text-body font-extrabold tabular-nums text-foreground" aria-live="polite">
            {n}명
          </span>
          <button type="button" aria-label="인원 늘리기" disabled={p.cancelled || n >= 200} onClick={() => step(1)} className={`${adminButtonClass("secondary")} w-11 px-0`}>
            +
          </button>
        </div>
      </div>
      {s.priced ? (
        <Lines lines={s.baseLines} />
      ) : (
        <p className="mt-2 text-body-sm text-wait">
          6~24명 밖은 요금표가 없습니다(별도 상담). 상담한 금액을 아래 「총액 직접 수정」 으로 넣어주세요.
        </p>
      )}
      {dirty && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="text-body-sm text-foreground">
            인원을 {p.headcount}명 → {n}명으로 바꿉니다. 요금 구간이 바뀌면 1인 요금 · 총액 · 잔금이 같이 바뀌고, 받은 예약금은 그대로입니다.
          </p>
          {warn.map((w) => (
            <p key={w} className="mt-1 text-body-sm font-semibold text-wait">
              확인 — {w}
            </p>
          ))}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setN(p.headcount)} className={adminButtonClass("secondary")}>
              되돌리기
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => saveHeadcount({ id: p.id, headcount: n }))} className={adminButtonClass("primary")}>
              {pending ? "저장 중…" : "인원 저장"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </section>
  );
}

/** 학생 단체 특가 — 학생이 80% 이상이면 전원 학생가, 미만이면 학생 인원만. */
function StudentBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  const [on, setOn] = useState(p.isStudent);
  const [count, setCount] = useState(String(p.studentCount ?? p.headcount));
  const dirty = on !== p.isStudent || (on && Number(count) !== (p.studentCount ?? -1));
  const ratio = p.headcount > 0 ? Number(count) / p.headcount : 0;

  return (
    <section className="mt-5 border-t border-border pt-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm font-semibold text-foreground">
        <input type="checkbox" checked={on} disabled={p.cancelled} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5" />
        학생 단체 특가
        {p.isStudent && <AdminBadge tone="progress">{p.settlement.allStudentPrice ? "전원 학생가" : "학생 인원만 학생가"}</AdminBadge>}
      </label>
      {on && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-32">
            <AdminField label="학생 인원" htmlFor="st-count">
              <input id="st-count" type="number" inputMode="numeric" min={0} max={p.headcount} value={count} onChange={(e) => setCount(e.target.value)} className={adminInputClass} />
            </AdminField>
          </div>
          <p className="min-w-0 flex-1 basis-48 pb-2 text-body-sm text-muted">
            전체 {p.headcount}명 중 {Math.round(ratio * 100)}% — {ratio >= STUDENT_ALL_RATIO ? "80% 이상이라 전원 학생가" : "80% 미만이라 학생 인원만 학생가"}. 당일 학생증을 확인하고, 미확인 인원은 차액을 현장 결제합니다.
          </p>
        </div>
      )}
      {dirty && (
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={pending} onClick={() => run(() => saveStudent({ id: p.id, isStudent: on, studentCount: Number(count) }))} className={adminButtonClass("primary")}>
            {pending ? "저장 중…" : "학생 단체 저장"}
          </button>
        </div>
      )}
      <ActionNote note={note} />
    </section>
  );
}

/** 옵션. 주말 19:30 이 아닌 회차의 애프터파티는 뒤 타임이 비어 있을 때만 — 운영자가 확인하고 넣는다. */
function OptionsBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  const [o, setO] = useState(p.options);
  const dirty =
    o.icebreaking !== p.options.icebreaking ||
    o.character !== p.options.character ||
    o.afterPartyHours !== p.options.afterPartyHours ||
    (o.afterPartyHours > 0 && o.cleanup !== p.options.cleanup);
  const s = p.settlement;
  // 평일은 언제든, 주말은 19:30 회차만 자동 견적에서 열린다(groupPricing.ts canAfterParty). 그 밖은 운영자 판단.
  const needsCheck = s.weekend && p.schedule.time !== "19:30" && o.afterPartyHours > 0 && o.afterPartyHours !== p.options.afterPartyHours;

  const save = () => {
    if (needsCheck && !window.confirm("주말 19:30 이 아닌 회차입니다. 애프터파티는 뒤 타임이 비어 있을 때만 가능합니다. 넣을까요?")) return;
    run(() => saveOptions({ id: p.id, ...o }));
  };

  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className={sectionTitle}>옵션</h3>
      <div className="mt-1 flex flex-col">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
          <input type="checkbox" checked={o.icebreaking} disabled={p.cancelled} onChange={(e) => setO({ ...o, icebreaking: e.target.checked })} className="h-5 w-5" />
          레크리에이션 포함 <span className="text-muted">(빼면 −{OPTION.icebreaking.discount.toLocaleString("ko-KR")}원 · 30분 단축)</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
          <input type="checkbox" checked={o.character} disabled={p.cancelled} onChange={(e) => setO({ ...o, character: e.target.checked })} className="h-5 w-5" />
          캐릭터 꾸미기 <span className="text-muted">(+{OPTION.character.price.toLocaleString("ko-KR")}원)</span>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-body-sm text-foreground">
          <span className="shrink-0">애프터파티</span>
          <select
            value={o.afterPartyHours}
            disabled={p.cancelled}
            onChange={(e) => setO({ ...o, afterPartyHours: Number(e.target.value), cleanup: Number(e.target.value) > 0 ? o.cleanup : false })}
            aria-label="애프터파티 시간"
            className={`${adminInputClass} w-32`}
          >
            {[0, 1, 2, 3, 4].map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "없음" : `${h}시간`}
              </option>
            ))}
          </select>
          <span className="text-muted">(시간당 +{OPTION.afterParty.hourly.toLocaleString("ko-KR")}원)</span>
        </label>
        <label className={`flex min-h-11 items-center gap-2 text-body-sm ${o.afterPartyHours > 0 ? "cursor-pointer text-foreground" : "text-disabled"}`}>
          <input
            type="checkbox"
            checked={o.afterPartyHours > 0 && o.cleanup}
            disabled={p.cancelled || o.afterPartyHours === 0}
            onChange={(e) => setO({ ...o, cleanup: e.target.checked })}
            className="h-5 w-5"
          />
          뒷정리 서비스 <span className={o.afterPartyHours > 0 ? "text-muted" : ""}>(+{OPTION.cleanup.price.toLocaleString("ko-KR")}원 · 애프터파티가 있을 때만)</span>
        </label>
      </div>
      <p className="text-body-sm text-muted">4시간 넘는 애프터파티 · 특수 청소비는 별도 상담입니다. 금액은 아래 조정 줄로 넣어주세요.</p>
      <Lines lines={s.optionLines} />
      {dirty && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setO(p.options)} className={adminButtonClass("secondary")}>
            되돌리기
          </button>
          <button type="button" disabled={pending} onClick={save} className={adminButtonClass("primary")}>
            {pending ? "저장 중…" : "옵션 저장"}
          </button>
        </div>
      )}
      {p.schedule.fixed && p.deposit.amount != null && p.schedule.minutes !== p.optionMinutes && (
        <p className="mt-2 text-body-sm font-semibold text-wait">
          확인 — 옵션대로면 진행 시간이 {fmtMin(p.optionMinutes)}인데 막아 둔 시간은 {fmtMin(p.schedule.minutes)}입니다. 위 「일정 수정」 에서 진행 시간을 맞춰주세요.
        </p>
      )}
      <ActionNote note={note} />
    </section>
  );
}

const fmtMin = (m: number) => [Math.floor(m / 60) ? `${Math.floor(m / 60)}시간` : "", m % 60 ? `${m % 60}분` : ""].filter(Boolean).join(" ") || "0분";

/** 조정 줄과 총액 직접 수정. */
function AdjustBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  const [open, setOpen] = useState<"" | "add" | "total">("");
  const [reason, setReason] = useState<AdjustReason>("nearby");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"amount" | "pct">("pct");
  const [value, setValue] = useState("");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [target, setTarget] = useState("");
  const [why, setWhy] = useState("");
  const s = p.settlement;
  const pickable = ADJUST_REASONS.filter((r) => r.code !== "total_override");

  const add = () => {
    if (p.isStudent && DISCOUNT_REASONS.includes(reason) && sign === -1) {
      if (!window.confirm("학생 특가는 다른 할인과 중복 적용 불가입니다. 그래도 넣을까요?")) return;
    }
    const num = Number(value);
    run(
      () =>
        addAdjustment({
          id: p.id,
          reason,
          label,
          amount: mode === "amount" ? num : null,
          pct: mode === "pct" ? num : null,
          sign,
        }),
      () => {
        setValue("");
        setLabel("");
        setOpen("");
      }
    );
  };

  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className={sectionTitle}>조정</h3>
      {s.adjustmentLines.length === 0 ? (
        <p className="mt-1 text-body-sm text-muted">조정 줄이 없어요.</p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {s.adjustmentLines.map((l, i) => {
            const row = p.adjustments[i];
            return (
              <li key={row?.id ?? i} className="flex items-center justify-between gap-2 py-0.5 text-body-sm">
                <span className="min-w-0 text-foreground">
                  {l.label}
                  {l.detail && <span className="text-muted"> · {l.detail}</span>}
                  {row?.note && <span className="block text-micro text-muted">사유: {row.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold tabular-nums text-foreground">{signed(l.amount)}</span>
                  {row && !p.cancelled && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => window.confirm(`조정 줄 「${l.label}」 을 삭제할까요?`) && run(() => removeAdjustment({ id: p.id, adjustmentId: row.id }))}
                      className="min-h-11 rounded-lg px-2 text-body-sm text-muted hover:text-danger"
                    >
                      삭제
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!p.cancelled && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(open === "add" ? "" : "add")} aria-expanded={open === "add"} className={adminButtonClass("secondary")}>
            조정 줄 등록
          </button>
          <button type="button" onClick={() => setOpen(open === "total" ? "" : "total")} aria-expanded={open === "total"} className={adminButtonClass("secondary")}>
            총액 직접 수정
          </button>
        </div>
      )}

      {open === "add" && (
        <form
          className="mt-3 rounded-lg border border-border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="사유" htmlFor="adj-reason">
              <select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)} className={adminInputClass}>
                {pickable.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="이름 (비우면 사유 이름)" htmlFor="adj-label">
              <input id="adj-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoComplete="off" className={adminInputClass} />
            </AdminField>
            <AdminField label="더하기 · 빼기" htmlFor="adj-sign">
              <select id="adj-sign" value={sign} onChange={(e) => setSign(Number(e.target.value) === 1 ? 1 : -1)} className={adminInputClass}>
                <option value={-1}>빼기 (할인)</option>
                <option value={1}>더하기 (추가)</option>
              </select>
            </AdminField>
            <AdminField label={mode === "pct" ? "기본요금의 %" : "금액 (원)"} htmlFor="adj-value">
              <span className="flex gap-2">
                <input id="adj-value" type="number" inputMode="decimal" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} className={adminInputClass} />
                <select aria-label="금액 방식" value={mode} onChange={(e) => setMode(e.target.value === "pct" ? "pct" : "amount")} className={`${adminInputClass} w-24`}>
                  <option value="pct">%</option>
                  <option value="amount">원</option>
                </select>
              </span>
            </AdminField>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
              {pending ? "등록 중…" : "등록"}
            </button>
          </div>
        </form>
      )}

      {open === "total" && (
        <form
          className="mt-3 rounded-lg border border-border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => overrideTotal({ id: p.id, target: Number(target), reason: why }),
              () => {
                setTarget("");
                setWhy("");
                setOpen("");
              }
            );
          }}
        >
          <p className="mb-3 text-body-sm text-muted">
            지금 총액은 {won(s.total)}입니다. 맞출 총액을 넣으면 차액이 「총액 조정」 줄로 들어갑니다. 원래 계산은 지워지지 않습니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="맞출 총액 (원)" htmlFor="tot-target">
              <input id="tot-target" type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="사유 (필수)" htmlFor="tot-why">
              <input id="tot-why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} autoComplete="off" className={adminInputClass} />
            </AdminField>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      )}
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </section>
  );
}

/** 결제 방식 — 고르면 7일 전 안내 문구와 임박 예약의 입금액이 그 방식에 맞게 바뀐다. */
function PayBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  return (
    <AdminCard title="결제 방식">
      <div role="radiogroup" aria-label="결제 방식" className="flex flex-col">
        {PAY_TYPES.map((t) => (
          <label key={t.code} className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
            <input
              type="radio"
              name="pay-type"
              checked={p.payType === t.code}
              disabled={pending || p.cancelled}
              onChange={() => run(() => savePayType({ id: p.id, payType: t.code }))}
              className="h-5 w-5"
            />
            {t.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-body-sm text-muted">카드 결제 연동은 없습니다. 현장 단말기로 받고 여기서는 「잔금 확인」 만 누릅니다.</p>
      {p.payType === "corp_card_full" && p.deposit.amount != null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-body-sm text-foreground">
            행사 당일 예약금 {won(p.deposit.amount)}을 돌려주고 총액을 법인카드로 받습니다.
            {p.deposit.returnedAt && <span className="block text-muted">반환 기록: {p.deposit.returnedAt}</span>}
          </p>
          <button
            type="button"
            disabled={pending || p.cancelled}
            onClick={() => run(() => setDepositReturned({ id: p.id, returned: !p.deposit.returnedAt }))}
            className={adminButtonClass("secondary")}
          >
            {p.deposit.returnedAt ? "반환 기록 취소" : "예약금 반환 기록"}
          </button>
        </div>
      )}
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </AdminCard>
  );
}

/** 예약금 입금 확인(= 예약 확정)과 잔금 확인. */
function DepositBlock({ p }: { p: MoneyTabProps }) {
  const { pending, note, run } = useGroupAction();
  const paid = p.deposit.amount != null;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(p.deposit.amount ?? p.required.amount));
  const [date, setDate] = useState(p.schedule.date ?? "");
  const [time, setTime] = useState(p.schedule.time ?? "");
  const [hours, setHours] = useState(String(Math.floor(p.schedule.minutes / 60)));
  const [mins, setMins] = useState(String(p.schedule.minutes % 60));
  const [undo, setUndo] = useState(false);
  const [undoWhy, setUndoWhy] = useState("");
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const s = p.settlement;
  const showForm = !p.cancelled && (!paid || editing);

  return (
    <AdminCard title="예약금 · 잔금" aside={paid ? <AdminBadge tone="done">예약 확정</AdminBadge> : <AdminBadge tone="warn">입금 전</AdminBadge>}>
      {paid ? (
        <p className="text-body text-foreground">
          받은 예약금 <strong className="font-extrabold tabular-nums">{won(p.deposit.amount!)}</strong>
          <span className="block text-body-sm text-muted">확인: {p.deposit.paidAt}</span>
        </p>
      ) : (
        <>
          <p className="text-body text-foreground">
            {p.required.full ? "지금 받을 금액(전액)" : "예약금 권장액"} <strong className="font-extrabold tabular-nums">{won(p.required.amount)}</strong>
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {p.required.full
              ? "행사 7일 이내 예약이고 계좌이체라 전액 입금 시 확정입니다."
              : p.daysLeft != null && p.daysLeft <= LATE_BOOKING_DAYS
                ? "행사 7일 이내지만 카드 결제 방식이라 예약금 30% 만 받습니다. 나머지는 당일 카드로 결제합니다."
                : "할인 후 총액의 30% · 천 원 단위 반올림."}{" "}
            신청서를 안 냈어도 입금이 들어오면 확정하고 날짜를 막습니다.
          </p>
        </>
      )}

      {showForm && (
        <form
          className="mt-3 rounded-lg border border-border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => confirmDeposit({ id: p.id, amount: Number(amount), date, time, minutes }),
              () => setEditing(false)
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="실제 받은 금액 (원)" htmlFor="dp-amount" hint="권장액과 다르면 고쳐서 넣습니다">
              <input id="dp-amount" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="확정 날짜" htmlFor="dp-date">
              <input id="dp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="시작 시간" htmlFor="dp-time">
              <input id="dp-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="진행 시간" htmlFor="dp-hours">
              <span className="flex items-center gap-2 text-body-sm text-foreground">
                <input id="dp-hours" type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className={adminInputClass} />
                시간
                <input aria-label="분" type="number" inputMode="numeric" min={0} max={59} step={10} value={mins} onChange={(e) => setMins(e.target.value)} className={adminInputClass} />
                분
              </span>
            </AdminField>
          </div>
          <p className="mt-3 text-body-sm text-muted">
            확인하면 이 시간을 막습니다(앞뒤 1시간 세팅 · 정리 포함). 겹치는 빈 회차는 닫고, 신청자가 있는 회차는 알려드립니다. 이미 막힌 시간이면 저장하지 않습니다.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className={adminButtonClass("secondary")}>
                닫기
              </button>
            )}
            <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
              {pending ? "확인 중…" : paid ? "저장" : "입금 확인"}
            </button>
          </div>
        </form>
      )}

      {paid && !p.cancelled && !editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className={adminButtonClass("secondary")}>
            금액 · 일시 수정
          </button>
          <button type="button" onClick={() => setUndo(!undo)} aria-expanded={undo} className={adminButtonClass("danger")}>
            입금 확인 취소
          </button>
        </div>
      )}
      {undo && paid && !p.cancelled && (
        <form
          className="mt-3 rounded-lg border border-danger bg-danger-soft p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => unconfirmDeposit({ id: p.id, reason: undoWhy }),
              () => setUndo(false)
            );
          }}
        >
          <p className="text-body-sm text-foreground">
            예약금 {won(p.deposit.amount!)} 기록과 잔금 확인을 지우고, 단계를 「연락 완료」 로 되돌리며, 막아 둔 일정을 풉니다. 잘못 눌렀을 때만 쓰세요 — 환불은 「취소 · 환불」 입니다.
          </p>
          <div className="mt-2">
            <AdminField label="사유 (필수)" htmlFor="un-why">
              <input id="un-why" value={undoWhy} onChange={(e) => setUndoWhy(e.target.value)} maxLength={200} autoComplete="off" className={adminInputClass} />
            </AdminField>
          </div>
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={pending} className={adminButtonClass("danger")}>
              {pending ? "처리 중…" : "입금 확인 취소"}
            </button>
          </div>
        </form>
      )}

      {paid && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-body text-foreground">
            잔금 <strong className="font-extrabold tabular-nums">{won(s.balance)}</strong>
            <span className="block text-body-sm text-muted">{p.balancePaidAt ? `확인: ${p.balancePaidAt}` : s.balance <= 0 ? "받을 잔금이 없습니다" : "아직 확인 전"}</span>
          </p>
          {!p.cancelled && (
            <button type="button" disabled={pending} onClick={() => run(() => setBalancePaid({ id: p.id, paid: !p.balancePaidAt }))} className={adminButtonClass(p.balancePaidAt ? "secondary" : "primary")}>
              {p.balancePaidAt ? "확인 취소" : "잔금 확인"}
            </button>
          )}
        </div>
      )}

      {!p.cancelled && p.refund.deposit > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-body-sm text-muted">
          오늘 취소하면 환불 {won(p.refund.amount)} — {p.refund.daysLeft != null ? `행사 ${p.refund.daysLeft}일 전 · ` : ""}
          {p.refund.label}
        </p>
      )}
      <div className="mt-1">
        <ActionNote note={note} />
      </div>
    </AdminCard>
  );
}
