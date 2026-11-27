"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminField, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { CONTACT_METHODS } from "@/lib/groupBooking";
import { createGroup } from "./groupActions";

/**
 * 단체 등록 — 카카오톡으로 바로 문의한 단체를 운영자가 직접 넣는다(홈페이지 견적을 거치지 않은 건).
 * 등록하면 그 단체의 상세로 간다. 검증은 서버 액션과 DB 함수가 한 번 더 한다.
 */
export function NewGroupForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({
    groupName: "",
    organizerName: "",
    contactMethod: "kakao",
    contact: "",
    date: defaultDate,
    time: "15:00",
    headcount: "10",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () =>
    startTransition(async () => {
      const res = await createGroup({ ...f, headcount: Number(f.headcount) });
      if ("error" in res) return setError(res.error);
      router.push(`/group-bookings/${res.message}`);
    });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={adminButtonClass("primary")}>
        단체 등록
      </button>
    );
  }

  const phoneLike = f.contactMethod === "phone" || f.contactMethod === "sms";
  return (
    <form
      className="w-full rounded-xl border border-border bg-surface p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="mb-1 text-h3 font-semibold text-foreground">단체 등록</h2>
      <p className="mb-4 text-body-sm text-muted">카카오톡 등으로 바로 문의한 단체를 넣습니다. 6~24명 밖은 별도 상담으로 표시됩니다.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField label="모임 이름" htmlFor="ng-group" hint="2~30자">
          <input id="ng-group" value={f.groupName} onChange={set("groupName")} maxLength={60} autoComplete="off" className={adminInputClass} />
        </AdminField>
        <AdminField label="담당자 이름" htmlFor="ng-name">
          <input id="ng-name" value={f.organizerName} onChange={set("organizerName")} maxLength={40} autoComplete="off" className={adminInputClass} />
        </AdminField>
        <AdminField label="연락 수단" htmlFor="ng-method">
          <select id="ng-method" value={f.contactMethod} onChange={set("contactMethod")} className={adminInputClass}>
            {CONTACT_METHODS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="연락처" htmlFor="ng-contact" hint={phoneLike ? "010으로 시작하는 11자리" : "카카오톡 ID 또는 이메일"}>
          <input
            id="ng-contact"
            value={f.contact}
            onChange={set("contact")}
            maxLength={100}
            inputMode={phoneLike ? "numeric" : "text"}
            placeholder={phoneLike ? "010-0000-0000" : ""}
            autoComplete="off"
            className={adminInputClass}
          />
        </AdminField>
        <AdminField label="희망 날짜" htmlFor="ng-date">
          <input id="ng-date" type="date" value={f.date} onChange={set("date")} className={adminInputClass} />
        </AdminField>
        <AdminField label="시작 시간" htmlFor="ng-time">
          <input id="ng-time" type="time" value={f.time} onChange={set("time")} className={adminInputClass} />
        </AdminField>
        <AdminField label="인원" htmlFor="ng-n" hint="2~200명">
          <input id="ng-n" type="number" inputMode="numeric" min={2} max={200} value={f.headcount} onChange={set("headcount")} className={adminInputClass} />
        </AdminField>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-body-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={adminButtonClass("secondary")}>
          닫기
        </button>
        <button type="submit" disabled={pending} className={adminButtonClass("primary")}>
          {pending ? "등록 중…" : "등록"}
        </button>
      </div>
    </form>
  );
}
