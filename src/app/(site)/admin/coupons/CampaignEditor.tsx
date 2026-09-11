"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCampaign, deleteCampaign, type CampaignInput } from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs text-muted mb-1";

/** datetime-local(로컬 표기) ↔ ISO. 서버는 UTC 로 돈다. */
function toIso(local: string): string | null {
  return local ? new Date(`${local}:00+09:00`).toISOString() : null;
}
function toLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);
}

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  discount_type: "fixed" | "percent";
  discount_value: number;
  max_discount_krw: number | null;
  min_headcount: number | null;
  theme_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  restrict_to_issued_phone: boolean;
  is_active: boolean;
};

export function CampaignEditor({
  campaign,
  themes,
  onDone,
}: {
  campaign?: CampaignRow;
  themes: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignInput>({
    id: campaign?.id,
    name: campaign?.name ?? "",
    description: campaign?.description ?? "",
    discountType: campaign?.discount_type ?? "fixed",
    discountValue: campaign?.discount_value ?? 5000,
    maxDiscountKrw: campaign?.max_discount_krw ?? null,
    minHeadcount: campaign?.min_headcount ?? null,
    themeId: campaign?.theme_id ?? null,
    validFrom: campaign?.valid_from ?? null,
    validUntil: campaign?.valid_until ?? null,
    restrictToIssuedPhone: campaign?.restrict_to_issued_phone ?? false,
    isActive: campaign?.is_active ?? true,
  });
  const [from, setFrom] = useState(toLocal(campaign?.valid_from ?? null));
  const [until, setUntil] = useState(toLocal(campaign?.valid_until ?? null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await saveCampaign({ ...form, validFrom: toIso(from), validUntil: toIso(until) });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    router.refresh();
    onDone?.();
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    const result = await deleteCampaign(form.id);
    setBusy(false);
    if ("error" in result) return setError(result.error);
    router.refresh();
    onDone?.();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <label className={label}>쿠폰 이름 *</label>
        <input
          className={field}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="예: 재방문 감사 쿠폰"
        />
      </div>

      <div>
        <label className={label}>안내 문구</label>
        <input
          className={field}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="고객에게 보이는 설명"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={label}>할인 방식</label>
          <select
            className={field}
            value={form.discountType}
            onChange={(e) =>
              setForm({ ...form, discountType: e.target.value as "fixed" | "percent" })
            }
          >
            <option value="fixed">정액 (원)</option>
            <option value="percent">정률 (%)</option>
          </select>
        </div>
        <div>
          <label className={label}>{form.discountType === "fixed" ? "할인 금액" : "할인율"}</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className={`${field} w-28`}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
            />
            <span className="text-sm text-muted">{form.discountType === "fixed" ? "원" : "%"}</span>
          </div>
        </div>
        {form.discountType === "percent" && (
          <div>
            <label className={label}>최대 할인액</label>
            <input
              type="number"
              className={`${field} w-32`}
              value={form.maxDiscountKrw ?? ""}
              onChange={(e) =>
                setForm({ ...form, maxDiscountKrw: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="제한 없음"
            />
          </div>
        )}
      </div>

      {form.discountType === "percent" && (
        <p className="text-xs text-muted">
          정률은 인원이 많을수록 할인액이 커집니다. 상한을 비워두면 4인 신청에서 할인액이 크게 뜁니다.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={label}>사용 시작</label>
          <input
            type="datetime-local"
            className={`${field} w-52`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>사용 종료</label>
          <input
            type="datetime-local"
            className={`${field} w-52`}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>최소 인원</label>
          <input
            type="number"
            className={`${field} w-24`}
            value={form.minHeadcount ?? ""}
            onChange={(e) =>
              setForm({ ...form, minHeadcount: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="제한 없음"
          />
        </div>
        <div>
          <label className={label}>사용 가능 테마</label>
          <select
            className={field}
            value={form.themeId ?? ""}
            onChange={(e) => setForm({ ...form, themeId: e.target.value || null })}
          >
            <option value="">전체 테마</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          사용 가능
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.restrictToIssuedPhone}
            onChange={(e) => setForm({ ...form, restrictToIssuedPhone: e.target.checked })}
          />
          받은 분 번호로만 사용
        </label>
      </div>
      <p className="text-xs text-muted">
        &lsquo;받은 분 번호로만&rsquo;을 켜면 양도가 막힙니다. 지인에게 선물하는 쿠폰이면 꺼두세요.
      </p>

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-glow px-4 py-2 text-sm font-semibold text-glow-foreground disabled:opacity-50"
        >
          {busy ? "저장 중…" : form.id ? "저장" : "쿠폰 만들기"}
        </button>
        {form.id && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded border border-red-500/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
          >
            삭제
          </button>
        )}
        {onDone && (
          <button onClick={onDone} className="rounded border border-border px-4 py-2 text-sm text-muted">
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
