"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCampaign, deleteCampaign, type CampaignInput } from "./actions";

/**
 * 계약으로 묶인 쿠폰인지.
 *
 * ⚠️ 잼핏(ZAMFIT) 제휴계약 제6조 7항 — "쿠폰 사용조건 또는 할인금액의 변경은
 *    양 당사자의 서면 합의로 정한다". 실수로 한 번 고치면 그 자체가 계약 위반이라
 *    저장 전에 한 번 더 확인받는다.
 *    이름으로 판별한다 — 계약 상대가 늘면 여기에 추가한다.
 */
function isContractBound(name: string): boolean {
  return name.trim().startsWith("잼핏");
}

/**
 * 계약에 걸린 항목만 추린다. 이름·설명처럼 계약과 무관한 건 확인을 요구하지 않는다.
 *
 * ⚠️ 날짜는 **화면에 보이는 분 단위 문자열**로 비교한다. ISO 문자열끼리 비교하면
 *    안 된다 — 입력칸이 분 단위라 toLocal/toIso 를 왕복하면 초가 떨어져
 *    (`:59:59` → `:59:00`) 손대지 않아도 '바뀜' 으로 잡힌다.
 *    쓸데없는 경고가 쌓이면 진짜 경고도 무시하게 된다.
 */
function contractChanges(
  before: CampaignRow,
  after: CampaignInput,
  dates: { from: string; until: string }
): string[] {
  const out: string[] = [];
  const 방식 = { fixed: "예약 1건당 정액", per_head: "1인당 정액", percent: "정률" } as const;
  if (before.discount_type !== after.discountType) {
    out.push(
      `할인 방식: ${방식[before.discount_type] ?? before.discount_type} → ${방식[after.discountType] ?? after.discountType}`
    );
  }
  if (before.discount_value !== Math.round(after.discountValue)) {
    out.push(`할인 금액: ${before.discount_value.toLocaleString()} → ${Math.round(after.discountValue).toLocaleString()}`);
  }
  if ((before.max_discount_krw ?? null) !== (after.maxDiscountKrw ?? null)) {
    out.push(`최대 할인액: ${before.max_discount_krw?.toLocaleString() ?? "제한 없음"} → ${after.maxDiscountKrw?.toLocaleString() ?? "제한 없음"}`);
  }
  if ((before.min_headcount ?? null) !== (after.minHeadcount ?? null)) {
    out.push(`최소 인원: ${before.min_headcount ?? "제한 없음"} → ${after.minHeadcount ?? "제한 없음"}`);
  }
  if ((before.theme_id ?? null) !== (after.themeId ?? null)) out.push("사용 가능 테마");
  if (toLocal(before.valid_from) !== dates.from) out.push("사용 시작일");
  if (toLocal(before.valid_until) !== dates.until) out.push("사용 종료일");
  if (before.stackable !== after.stackable) {
    out.push(after.stackable ? "다른 쿠폰과 중복 사용 허용" : "중복 사용 불가로 변경");
  }
  if (before.is_active !== after.isActive) {
    out.push(after.isActive ? "사용 가능으로 전환" : "사용 중지로 전환");
  }
  return out;
}

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
  discount_type: "fixed" | "percent" | "per_head";
  discount_value: number;
  max_discount_krw: number | null;
  min_headcount: number | null;
  theme_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  restrict_to_issued_phone: boolean;
  stackable: boolean;
  is_active: boolean;
  show_event_bubble: boolean;
  event_bubble_text: string | null;
  /** 외부 연동(ManyChat 등)이 이 캠페인을 찾는 고정 키. 없으면 연동 대상이 아니다. */
  key: string | null;
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
    stackable: campaign?.stackable ?? false,
    isActive: campaign?.is_active ?? true,
    showEventBubble: campaign?.show_event_bubble ?? false,
    eventBubbleText: campaign?.event_bubble_text ?? "",
  });
  const [from, setFrom] = useState(toLocal(campaign?.valid_from ?? null));
  const [until, setUntil] = useState(toLocal(campaign?.valid_until ?? null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 계약 연동 쿠폰의 조건을 바꿨을 때, 저장 전에 한 번 더 확인받는다. */
  const [confirmChanges, setConfirmChanges] = useState<string[] | null>(null);

  /** 저장 버튼. 계약 연동 쿠폰의 조건이 바뀌었으면 먼저 확인을 받는다. */
  function requestSubmit() {
    setError(null);
    const next = { ...form, validFrom: toIso(from), validUntil: toIso(until) };
    if (campaign && isContractBound(campaign.name)) {
      const changes = contractChanges(campaign, next, { from, until });
      if (changes.length > 0) {
        setConfirmChanges(changes);
        return;
      }
    }
    void save(next);
  }

  async function save(next: CampaignInput) {
    setBusy(true);
    setError(null);
    const result = await saveCampaign(next);
    setBusy(false);
    setConfirmChanges(null);
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
              setForm({
                ...form,
                discountType: e.target.value as "fixed" | "percent" | "per_head",
              })
            }
          >
            <option value="fixed">정액 (원) — 예약 1건당</option>
            <option value="per_head">인당 정액 (원) — 인원수 × 금액</option>
            <option value="percent">정률 (%)</option>
          </select>
        </div>
        <div>
          <label className={label}>
            {form.discountType === "percent" ? "할인율" : "할인 금액"}
            {form.discountType === "per_head" && <span className="ml-1 text-muted">(1인당)</span>}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className={`${field} w-28`}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
            />
            <span className="text-sm text-muted">
              {form.discountType === "percent" ? "%" : form.discountType === "per_head" ? "원 × 인원" : "원"}
            </span>
          </div>
        </div>
        {form.discountType !== "fixed" && (
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

      {form.discountType === "per_head" && (
        <p className="text-xs text-muted">
          신청 인원수만큼 곱해서 깎입니다 — 1인당 1,000원이면 3인 신청은 3,000원 할인.
          할인액은 <strong className="text-foreground">신청 시점의 실제 인원</strong>으로 계산되므로,
          신청자가 화면에서 인원을 바꾸면 따라 바뀝니다. 단체 신청의 할인액이 걱정되면 최대 할인액을 걸어두세요.
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.stackable}
          onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
        />
        다른 쿠폰과 중복 사용 가능
      </label>

      {/*
        사이트 우하단 인스타 버튼 위 말풍선. 말풍선이 알리는 게 결국 이 쿠폰 이벤트라
        쿠폰과 같은 자리에서 켜고 끈다(2026-09-16). 쿠폰을 끄거나 기간이 지나면 같이 사라진다.
      */}
      <div className="rounded border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showEventBubble}
            onChange={(e) => setForm({ ...form, showEventBubble: e.target.checked })}
          />
          사이트에 이벤트 말풍선 띄우기 (우하단 인스타 버튼 위)
        </label>
        {form.showEventBubble && (
          <div className="mt-2">
            <label className={label}>말풍선 문구 (줄바꿈하면 두 줄 · 비우면 쿠폰 이름)</label>
            <textarea
              className={`${field} min-h-16 leading-relaxed`}
              value={form.eventBubbleText}
              onChange={(e) => setForm({ ...form, eventBubbleText: e.target.value })}
              placeholder={"오픈기념 할인쿠폰 이벤트\n팔로우하고 5,000원 쿠폰 받기"}
            />
            <p className="mt-1 text-[11px] text-muted">
              방문자가 X 로 닫으면 그 방문 동안은 안 뜨고, 사이트에 다시 들어오면 또 보입니다.
              쿠폰을 &lsquo;사용 중지&rsquo; 하거나 사용 기간이 지나면 말풍선도 같이 사라져요.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        &lsquo;받은 분 번호로만&rsquo;을 켜면 양도가 막힙니다. 지인에게 선물하는 쿠폰이면 꺼두세요.
        <br />
        &lsquo;중복 사용 가능&rsquo;은 <strong className="text-foreground">겹쳐 쓸 쿠폰끼리 모두</strong>{" "}
        켜야 동작합니다. 한 장이라도 꺼져 있으면 그 쿠폰은 혼자서만 쓸 수 있어요. 같은 종류 쿠폰을
        두 장 쓰는 건 언제나 막힙니다.
      </p>

      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {/*
        계약으로 묶인 쿠폰의 조건을 바꿀 때만 뜬다.
        ⚠️ 네이티브 confirm() 을 쓰지 않는다 — 브라우저를 멈춰 세우고, 무엇이
           바뀌는지 목록으로 보여줄 수도 없다.
      */}
      {confirmChanges && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-400/5 p-4">
          <p className="font-semibold text-amber-300">
            ⚠️ 이 쿠폰은 잼핏(ZAMFIT) 제휴계약으로 조건이 정해져 있습니다
          </p>
          <p className="mt-1.5 text-sm text-muted">
            계약 제6조 7항 — <strong className="text-foreground">&ldquo;쿠폰 사용조건 또는 할인금액의
            변경은 양 당사자의 서면 합의로 정한다&rdquo;</strong>. 합의 없이 바꾸면 그 자체가 계약
            위반이 될 수 있습니다.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {confirmChanges.map((c) => (
              <li key={c} className="text-amber-200">· {c}</li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => save({ ...form, validFrom: toIso(from), validUntil: toIso(until) })}
              disabled={busy}
              className="rounded border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50"
            >
              {busy ? "저장 중…" : "합의됐습니다 — 변경"}
            </button>
            <button
              onClick={() => setConfirmChanges(null)}
              disabled={busy}
              className="rounded border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={requestSubmit}
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
