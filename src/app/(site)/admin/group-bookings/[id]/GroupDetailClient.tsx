"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminField, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { TODO_TEXT_MAX } from "@/lib/adminTodos";
import { charCount } from "@/lib/textClean";
import { cancelGroup, rescheduleGroup, revealContact, saveGroupName, saveMemo } from "../groupActions";

type Result = { error: string } | { success: true; message?: string };

/**
 * 서버 액션을 부르고 결과 문구를 보여주는 공통 길. 성공하면 화면을 한 번 다시 읽는다(router.refresh).
 * ⚠️ 주기적으로 다시 읽지 않는다 — 저장 직후 한 번뿐이다(wye-server-cost).
 */
export function useGroupAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (job: () => Promise<Result>, onDone?: () => void) =>
    startTransition(async () => {
      const res = await job();
      if ("error" in res) return setNote({ ok: false, text: res.error });
      setNote({ ok: true, text: res.message ?? "저장했습니다." });
      onDone?.();
      router.refresh();
    });
  return { pending, note, setNote, run };
}

/** 결과 한 줄. 오류는 role=alert 로 읽힌다. 색만으로 가르지 않게 오류에는 글머리를 붙인다. */
export function ActionNote({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return (
    <p role={note.ok ? "status" : "alert"} className={`text-body-sm ${note.ok ? "text-confirm" : "text-danger"}`}>
      {note.ok ? "" : "저장하지 못했습니다 — "}
      {note.text}
    </p>
  );
}

/**
 * 상세 머리의 두 버튼 — 「일정 수정」 과 「취소 · 환불」. 누르면 그 아래로 칸이 펼쳐진다(한 번에 하나).
 * 둘 다 되돌리기 어려운 동작이라 무엇이 일어나는지 금액 · 대상과 함께 먼저 보여준다.
 */
export function HeadActions({
  id,
  cancelled,
  confirmed,
  schedule,
  refund,
}: {
  id: string;
  cancelled: boolean;
  confirmed: boolean;
  schedule: { date: string; time: string; minutes: number };
  /** 오늘 취소하면 얼마를 돌려주나(서버가 단체 규정으로 계산). */
  refund: { deposit: number; amount: number; label: string; daysLeft: number | null };
}) {
  const [panel, setPanel] = useState<"" | "resched" | "cancel">("");
  const { pending, note, setNote, run } = useGroupAction();
  const [date, setDate] = useState(schedule.date);
  const [time, setTime] = useState(schedule.time);
  const [hours, setHours] = useState(String(Math.floor(schedule.minutes / 60)));
  const [mins, setMins] = useState(String(schedule.minutes % 60));
  const [why, setWhy] = useState("");
  const [cancelWhy, setCancelWhy] = useState("");
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

  if (cancelled) return null;
  const toggle = (p: "resched" | "cancel") => {
    setNote(null);
    setPanel(panel === p ? "" : p);
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => toggle("resched")} aria-expanded={panel === "resched"} className={adminButtonClass("secondary")}>
          일정 수정
        </button>
        <button type="button" onClick={() => toggle("cancel")} aria-expanded={panel === "cancel"} className={adminButtonClass("danger")}>
          취소 · 환불
        </button>
      </div>

      {panel === "resched" && (
        <form
          className="mt-4 rounded-xl border border-border bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => rescheduleGroup({ id, date, time, minutes, reason: why }),
              () => {
                setWhy("");
                setPanel("");
              }
            );
          }}
        >
          <h3 className="mb-3 text-body font-semibold text-foreground">일정 수정</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminField label="날짜" htmlFor="rs-date">
              <input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="시작 시간" htmlFor="rs-time">
              <input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={adminInputClass} />
            </AdminField>
            <AdminField label="진행 시간" htmlFor="rs-hours">
              <span className="flex items-center gap-2 text-body-sm text-foreground">
                <input id="rs-hours" type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} className={adminInputClass} />
                시간
                <input aria-label="분" type="number" inputMode="numeric" min={0} max={59} step={10} value={mins} onChange={(e) => setMins(e.target.value)} className={adminInputClass} />
                분
              </span>
            </AdminField>
          </div>
          <div className="mt-3">
            <AdminField label="사유 (필수)" htmlFor="rs-why" hint="예) 고객 요청, 팀 일정 변경">
              <input id="rs-why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} autoComplete="off" className={adminInputClass} />
            </AdminField>
          </div>
          <p className="mt-3 text-body-sm text-muted">
            날짜가 바뀌면 평일 · 주말 · 성수기 요금으로 다시 계산하고 기록에 남깁니다. 받은 예약금은 그대로입니다.
            {confirmed && " 막아 둔 일정도 같이 옮깁니다 — 옮길 시간이 이미 막혀 있으면 저장하지 않고 알려드립니다."}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setPanel("")} className={adminButtonClass("secondary")}>
              닫기
            </button>
            <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      )}

      {panel === "cancel" && (
        <form
          className="mt-4 rounded-xl border border-danger bg-danger-soft p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => cancelGroup({ id, reason: cancelWhy }),
              () => setPanel("")
            );
          }}
        >
          <h3 className="mb-2 text-body font-semibold text-danger">취소 · 환불</h3>
          <p className="text-body text-foreground">
            {refund.deposit === 0 ? (
              "받은 예약금이 없습니다. 환불할 금액이 없습니다."
            ) : (
              <>
                오늘 취소하면 예약금 {won(refund.deposit)} 중 <strong className="font-extrabold">{won(refund.amount)}</strong> 을 환불합니다.
                <span className="mt-1 block text-body-sm text-muted">
                  {refund.daysLeft != null ? `행사 ${refund.daysLeft}일 전 · ` : ""}
                  {refund.label}
                </span>
              </>
            )}
          </p>
          <p className="mt-2 text-body-sm text-foreground">
            취소하면 이 단체는 종료되고{confirmed ? " 막아 둔 일정이 풀립니다." : " 목록의 「취소」 탭으로 옮겨집니다."} 실제 송금은 직접 해주세요.
          </p>
          <div className="mt-3">
            <AdminField label="사유 (필수)" htmlFor="cx-why" hint="예) 고객 사정, 인원 미달, 무응답">
              <input id="cx-why" value={cancelWhy} onChange={(e) => setCancelWhy(e.target.value)} maxLength={200} autoComplete="off" className={adminInputClass} />
            </AdminField>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setPanel("")} className={adminButtonClass("secondary")}>
              닫기
            </button>
            <button type="submit" disabled={pending} className={adminButtonClass("danger")}>
              {pending ? "처리 중…" : "이 단체 취소"}
            </button>
          </div>
        </form>
      )}
      <div className="mt-2">
        <ActionNote note={note} />
      </div>
    </div>
  );
}

/**
 * 담당자 · 연락처 — 기본은 가린 값(서버가 가려서 내려준다). 「연락처 보기」 를 눌러야 전체가 온다.
 * 누를 때마다 감사로그에 남는다. 화면을 떠나면 다시 가려진다(값을 어디에도 저장하지 않는다).
 */
export function ContactReveal({ id, maskedName, maskedContact, methodLabel }: { id: string; maskedName: string; maskedContact: string; methodLabel: string }) {
  const [full, setFull] = useState<{ name: string; contact: string; method: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const digits = full?.contact.replace(/\D/g, "") ?? "";
  const dialable = full && (full.method === "phone" || full.method === "sms") && digits.length >= 9;

  return (
    <div data-clarity-mask="true">
      <p className="text-body text-foreground">
        <span className="font-semibold">{full ? full.name || "이름 없음" : maskedName}</span>
        <span className="text-muted"> · {methodLabel} · </span>
        {full ? (
          dialable ? (
            <a href={`${full.method === "sms" ? "sms" : "tel"}:${digits}`} className="font-semibold text-glow underline">
              {full.contact}
            </a>
          ) : (
            <span className="break-all font-semibold">{full.contact}</span>
          )
        ) : (
          <span className="tabular-nums">{maskedContact}</span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {full ? (
          <button type="button" onClick={() => setFull(null)} className={adminButtonClass("secondary")}>
            다시 가리기
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await revealContact({ id });
                if ("error" in res) return setError(res.error);
                setError("");
                setFull(res);
              })
            }
            className={adminButtonClass("secondary")}
          >
            {pending ? "불러오는 중…" : "연락처 보기"}
          </button>
        )}
        <span className="text-body-sm text-muted">누른 기록이 감사로그에 남습니다.</span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** 운영 메모 — 고객에게 보이지 않는다. */
export function MemoEditor({ id, memo }: { id: string; memo: string }) {
  const [value, setValue] = useState(memo);
  const { pending, note, run } = useGroupAction();
  const dirty = value !== memo;
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        maxLength={4000}
        aria-label="운영 메모"
        placeholder="응대하며 적어 둘 내용 (고객에게 안 보임)"
        className={`${adminInputClass} py-2`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ActionNote note={note} />
        <button type="button" disabled={pending || !dirty} onClick={() => run(() => saveMemo({ id, memo: value }))} className={`${adminButtonClass("secondary")} ml-auto`}>
          {pending ? "저장 중…" : "메모 저장"}
        </button>
      </div>
    </div>
  );
}

/** 모임 이름 수정. */
export function GroupNameEditor({ id, groupName }: { id: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(groupName);
  const { pending, note, run } = useGroupAction();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-body-sm text-glow underline">
        모임 이름 수정
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveGroupName({ id, groupName: value }),
          () => setOpen(false)
        );
      }}
    >
      <div className="min-w-0 flex-1 basis-56">
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={TODO_TEXT_MAX} aria-label="모임 이름" autoComplete="off" className={adminInputClass} />
        <p className="mt-1 text-right text-micro text-muted tabular-nums">{charCount(value.trim())} / 30</p>
      </div>
      <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
        {pending ? "저장 중…" : "저장"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={adminButtonClass("secondary")}>
        닫기
      </button>
      <div className="basis-full">
        <ActionNote note={note} />
      </div>
    </form>
  );
}
