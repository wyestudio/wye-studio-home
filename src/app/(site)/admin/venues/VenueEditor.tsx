"use client";

import { useState, useTransition } from "react";
import { AdminBadge, AdminEmpty, adminButtonClass } from "@/components/admin/ui";
import type { Venue } from "@/types/catalog";
import { saveVenue, deleteVenue, type VenueInput } from "./actions";

const EMPTY: VenueInput = {
  name: "",
  address: "",
  area_label: "",
  parking_note: "",
  map_url: "",
  coords: "",
  operating_period: "",
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
    coords: v.lat != null && v.lng != null ? `${v.lat}, ${v.lng}` : "",
    operating_period: v.operating_period ?? "",
    is_active: v.is_active,
  };
}

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-body-sm";
const label = "block text-micro font-semibold text-muted mb-1";

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
        <p
          role={message.kind === "ok" ? "status" : "alert"}
          className={`rounded-lg border px-3 py-2 text-body-sm ${
            message.kind === "ok" ? "border-confirm bg-confirm-soft text-confirm" : "border-danger bg-danger-soft text-danger"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* 편집 중에는 목록과 「등록」 버튼을 숨긴다 — 목록 → 한 건 편집(테마 화면과 같다). */}
      {!editing && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className={adminButtonClass("primary")}>
            장소 등록
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setEditing(null)} className="min-h-11 text-body-sm text-glow hover:underline">
              ← 장소 목록
            </button>
            <h2 className="text-h3 font-semibold text-foreground">{editing.id ? `${editing.name || "장소"} 수정` : "새 장소"}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>상호명 * (테마 상세에 공개)</label>
              <input
                className={field}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="예: OO파티룸 신림점"
              />
            </div>
            <div>
              <label className={label}>대략 위치 * (상호명 위 작은 글씨)</label>
              <input
                className={field}
                value={editing.area_label}
                onChange={(e) => setEditing({ ...editing, area_label: e.target.value })}
                placeholder="예: 서울 신림역 인근"
              />
            </div>
          </div>

          <div>
            <label className={label}>정확 주소 * (테마 상세에 공개 + 장소안내 문자)</label>
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
              <label className={label}>네이버 지도 링크 (비우면 주소 검색으로 열림)</label>
              <input
                className={field}
                value={editing.map_url}
                onChange={(e) => setEditing({ ...editing, map_url: e.target.value })}
                placeholder="https://naver.me/…"
              />
            </div>
          </div>

          <div>
            <label className={label}>지도 좌표 (위도, 경도) — 비우면 테마 상세에 지도 없이 주소만 보임</label>
            <input
              className={field}
              value={editing.coords}
              onChange={(e) => setEditing({ ...editing, coords: e.target.value })}
              placeholder="예: 37.5403064, 127.0851419"
            />
            <p className="mt-1 text-micro text-muted">
              구글 지도에서 장소를 마우스 오른쪽 버튼으로 누르면 맨 위에 좌표가 나와요. 눌러서 복사한 뒤 그대로 붙여 넣으면 됩니다.
            </p>
          </div>

          <div>
            <label className={label}>운영기간 (테마 상세 진행 장소에 공개) — 비우면 안 보임</label>
            <input
              className={field}
              value={editing.operating_period}
              onChange={(e) => setEditing({ ...editing, operating_period: e.target.value })}
              placeholder="예: 2026.09.26 ~ 2027.03.25"
            />
            <p className="mt-1 text-micro text-muted">
              네이버 스마트플레이스(팝업스토어) 등록에 필요해서 화면에 보여줍니다. 종료일 없이
              적으면 등록이 보류돼요. 화면에는 &ldquo;이 장소 운영기간 · (입력한 값)&rdquo; 으로 나옵니다.
            </p>
          </div>

          <label className="flex items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              checked={editing.is_active}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
            />
            사용 중
          </label>

          {message?.kind === "err" && (
            <p role="alert" className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-body-sm text-danger">
              {message.text}
            </p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={submit} disabled={pending} className={adminButtonClass("primary")}>
              {pending ? "저장 중…" : "저장"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className={adminButtonClass("secondary")}>
              취소
            </button>
          </div>
        </div>
      )}

      {!editing && (
      <div className="space-y-2">
        {venues.length === 0 ? (
          <AdminEmpty title="아직 장소가 없어요" hint="테마를 만들려면 장소가 먼저 필요합니다. 「장소 등록」 을 눌러 주세요." />
        ) : (
          venues.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {v.name}
                  <AdminBadge tone={v.is_active ? "done" : "idle"}>{v.is_active ? "사용 중" : "사용 안 함"}</AdminBadge>
                </p>
                <p className="mt-1 text-body-sm text-muted">공개 위치: {v.area_label}</p>
                <p className="text-micro text-muted">주소: {v.address}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setEditing(toInput(v))} className={adminButtonClass("secondary")}>
                  수정
                </button>
                <button type="button" onClick={() => remove(v.id, v.name)} className={adminButtonClass("danger")}>
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
