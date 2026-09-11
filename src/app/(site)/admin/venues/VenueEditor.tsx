"use client";

import { useState, useTransition } from "react";
import type { Venue } from "@/types/catalog";
import { saveVenue, deleteVenue, type VenueInput } from "./actions";

const EMPTY: VenueInput = {
  name: "",
  address: "",
  area_label: "",
  parking_note: "",
  map_url: "",
  is_active: true,
};

function toInput(v: Venue): VenueInput {
  return {
    id: v.id,
    name: v.name,
    address: v.address,
    area_label: v.area_label,
    parking_note: v.parking_note ?? "",
    map_url: v.map_url ?? "",
    is_active: v.is_active,
  };
}

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";

export function VenueEditor({ venues }: { venues: Venue[] }) {
  const [editing, setEditing] = useState<VenueInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveVenue(editing);
      if ("error" in res && res.error) {
        setMessage({ kind: "err", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMessage({ kind: "ok", text: "저장되었습니다." });
        setEditing(null);
      }
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`'${name}' 장소를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      const res = await deleteVenue(id);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "삭제되었습니다." }
      );
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok" ? "border-glow text-glow" : "border-red-500 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded bg-glow px-3 py-2 text-sm text-glow-foreground"
        >
          + 장소 추가
        </button>
      </div>

      {editing && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h2 className="font-semibold">{editing.id ? "장소 수정" : "새 장소"}</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>상호명 * (고객에게 노출되지 않음)</label>
              <input
                className={field}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="예: OO파티룸 신림점"
              />
            </div>
            <div>
              <label className={label}>공개용 위치 * (고객에게 보이는 대략 위치)</label>
              <input
                className={field}
                value={editing.area_label}
                onChange={(e) => setEditing({ ...editing, area_label: e.target.value })}
                placeholder="예: 서울 신림역 인근"
              />
            </div>
          </div>

          <div>
            <label className={label}>정확 주소 * (비공개 — 전날안내 문자에만 사용)</label>
            <input
              className={field}
              value={editing.address}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              placeholder="예: 서울특별시 관악구 OO로 123 지하 1층"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>주차 안내</label>
              <input
                className={field}
                value={editing.parking_note}
                onChange={(e) => setEditing({ ...editing, parking_note: e.target.value })}
                placeholder="예: 인근 유료주차장 이용"
              />
            </div>
            <div>
              <label className={label}>지도 링크</label>
              <input
                className={field}
                value={editing.map_url}
                onChange={(e) => setEditing({ ...editing, map_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.is_active}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
            />
            사용 중
          </label>

          {message?.kind === "err" && (
            <div className="rounded border border-red-500 px-3 py-2 text-sm text-red-400">
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded border border-border px-4 py-2 text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {venues.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            등록된 장소가 없습니다. 테마를 만들려면 장소가 먼저 필요합니다.
          </p>
        ) : (
          venues.map((v) => (
            <div
              key={v.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {v.name}
                  {!v.is_active && <span className="ml-2 text-xs text-muted">(사용 안 함)</span>}
                </p>
                <p className="mt-1 text-sm text-muted">공개 위치: {v.area_label}</p>
                <p className="text-xs text-muted">주소: {v.address}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setEditing(toInput(v))}
                  className="rounded border border-border px-3 py-1.5 text-xs"
                >
                  수정
                </button>
                <button
                  onClick={() => remove(v.id, v.name)}
                  className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
