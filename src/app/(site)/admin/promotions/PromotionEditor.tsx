"use client";

import { useState, useTransition } from "react";
import {
  savePromotion,
  deletePromotion,
  setPromotionActive,
  type PromotionInput,
  type PromotionTierInput,
} from "./actions";
import { discountPercent } from "@/lib/promotion";

/**
 * 프로모션(얼리버드) 편집.
 *
 * ⚠️ 여기 숫자가 그대로 고객 청구액이 된다. 저장 전에 **기본가 대비 할인율
 *    미리보기**를 반드시 보여준다 — 0원을 실수로 넣은 걸 저장 뒤에 알면
 *    그 사이 신청한 사람에게 그 금액으로 나간다.
 */

export type PromotionRow = {
  id: string;
  name: string;
  is_active: boolean;
  applies_from: string | null;
  applies_until: string | null;
  session_from: string | null;
  session_to: string | null;
  days_before: number;
  badge_label: string;
  banner_title: string | null;
  banner_body: string | null;
  banner_highlight: string | null;
  banner_note: string | null;
  accent_color: string;
  tiers: PromotionTierInput[];
};

export type ThemeOption = {
  id: string;
  name: string;
  /** 기본 요금 구간. 할인율 미리보기에 쓴다. */
  tiers: { min_headcount: number; unit_price_krw: number }[];
};

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";
const section = "rounded-lg border border-border p-4 space-y-3";

/** timestamptz → datetime-local 칸에 넣을 'YYYY-MM-DDTHH:mm' (KST). */
function isoToKstLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

function emptyInput(): PromotionInput {
  return {
    name: "",
    is_active: false,
    applies_from: "",
    applies_until: "",
    session_from: "",
    session_to: "",
    /*
      새 프로모션의 기본 '며칠 전까지'.
      ⚠️ 10월 얼리버드를 **5일 전까지로 확정**해서 기본값도 맞춰 뒀다(2026-10-01).
         운영에 만들 때 손대지 않으면 이 값으로 들어간다.
    */
    days_before: 5,
    badge_label: "얼리버드",
    banner_title: "",
    banner_body: "",
    banner_highlight: "",
    banner_note: "",
    /*
      새 프로모션의 기본 강조색.
      ⚠️ 10월 얼리버드를 **노란색으로 확정**해서 기본값도 같이 맞춰 뒀다
         (2026-10-01, 테스트 어드민에서 고른 값). 운영에 프로모션을 만들 때도
         손대지 않으면 이 색으로 들어간다. 바꾸려면 어드민에서 고르면 된다.
    */
    accent_color: "#f4ff64",
    tiers: [],
  };
}

function toInput(p: PromotionRow): PromotionInput {
  return {
    id: p.id,
    name: p.name,
    is_active: p.is_active,
    applies_from: isoToKstLocal(p.applies_from),
    applies_until: isoToKstLocal(p.applies_until),
    session_from: p.session_from ?? "",
    session_to: p.session_to ?? "",
    days_before: p.days_before,
    badge_label: p.badge_label,
    banner_title: p.banner_title ?? "",
    banner_body: p.banner_body ?? "",
    banner_highlight: p.banner_highlight ?? "",
    banner_note: p.banner_note ?? "",
    accent_color: p.accent_color,
    tiers: p.tiers.map((t) => ({ ...t })),
  };
}

/** 기본가도 '구간 이상' 규칙이다. DB 의 resolve_unit_price() 와 같은 방식. */
function baseUnitPrice(theme: ThemeOption | undefined, headcount: number): number | null {
  if (!theme) return null;
  const matched = theme.tiers
    .filter((t) => t.min_headcount <= headcount)
    .sort((a, b) => b.min_headcount - a.min_headcount)[0];
  return matched ? matched.unit_price_krw : null;
}

export function PromotionEditor({
  promotions,
  themes,
}: {
  promotions: PromotionRow[];
  themes: ThemeOption[];
}) {
  const [editing, setEditing] = useState<PromotionInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(next: Partial<PromotionInput>) {
    setEditing((cur) => (cur ? { ...cur, ...next } : cur));
  }

  function submit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await savePromotion(editing);
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
    if (
      !confirm(
        `'${name}' 프로모션을 삭제할까요? 되돌릴 수 없습니다.\n` +
          `이미 이 프로모션으로 신청된 건의 금액은 신청 기록에 그대로 남습니다.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deletePromotion(id);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "삭제되었습니다." }
      );
    });
  }

  function toggle(id: string, next: boolean, name: string) {
    if (
      next &&
      !confirm(`'${name}' 를 켜면 조건에 맞는 회차에 **즉시** 할인가가 적용됩니다. 켤까요?`)
    )
      return;
    startTransition(async () => {
      const res = await setPromotionActive(id, next);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: next ? "켰습니다." : "껐습니다." }
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
          onClick={() => setEditing(emptyInput())}
          className="rounded bg-glow px-3 py-2 text-sm text-white"
        >
          + 프로모션 추가
        </button>
      </div>

      {editing && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{editing.id ? "프로모션 수정" : "새 프로모션"}</h2>

          <div className={section}>
            <h3 className="text-sm font-semibold">기본</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>이름 (어드민·신청 기록용)</label>
                <input
                  className={field}
                  value={editing.name}
                  placeholder="10월 얼리버드"
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>배지 문구 (달력·회차·가격표)</label>
                <input
                  className={field}
                  value={editing.badge_label}
                  onChange={(e) => patch({ badge_label: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => patch({ is_active: e.target.checked })}
              />
              켜기 (한 번에 하나만 켤 수 있습니다)
            </label>
          </div>

          <div className={section}>
            <h3 className="text-sm font-semibold">적용 조건</h3>
            <p className="text-xs text-muted">
              셋을 <strong>모두</strong> 만족해야 할인이 붙습니다. 비운 칸은 제한 없음입니다.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>접수 시작 (신청 시점·KST)</label>
                <input
                  type="datetime-local"
                  className={field}
                  value={editing.applies_from}
                  onChange={(e) => patch({ applies_from: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>접수 종료 (신청 시점·KST)</label>
                <input
                  type="datetime-local"
                  className={field}
                  value={editing.applies_until}
                  onChange={(e) => patch({ applies_until: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>회차 진행일 시작</label>
                <input
                  type="date"
                  className={field}
                  value={editing.session_from}
                  onChange={(e) => patch({ session_from: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>회차 진행일 종료</label>
                <input
                  type="date"
                  className={field}
                  value={editing.session_to}
                  onChange={(e) => patch({ session_to: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>진행일 며칠 전까지 신청</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={editing.days_before}
                  onChange={(e) => patch({ days_before: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={label}>강조색 (달력·배지)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 rounded border border-border bg-background"
                    value={editing.accent_color}
                    onChange={(e) => patch({ accent_color: e.target.value })}
                  />
                  <input
                    className={field}
                    value={editing.accent_color}
                    onChange={(e) => patch({ accent_color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 회차 범위를 비워 두면 1년 치 회차가 전부 대상이 된다. 실제로 겪기 전에 알린다. */}
            {!editing.session_from && !editing.session_to && (
              <p className="rounded border border-amber-500/50 px-3 py-2 text-xs text-amber-300">
                회차 진행일 범위를 비우면 <strong>앞으로 열린 모든 회차</strong>가 대상이 됩니다.
                회차는 1년 치가 미리 열려 있습니다.
              </p>
            )}
          </div>

          <div className={section}>
            <h3 className="text-sm font-semibold">얼리버드 금액 (인당)</h3>
            <p className="text-xs text-muted">
              해당 인원 <strong>이상</strong>일 때 적용되며, 조건을 만족하는 구간 중 가장 큰 것이
              쓰입니다. <strong>구간을 하나도 넣지 않은 테마는 기본가 그대로</strong>입니다.
            </p>

            <div className="space-y-2">
              {editing.tiers.map((t, i) => {
                const theme = themes.find((x) => x.id === t.theme_id);
                const base = baseUnitPrice(theme, t.min_headcount);
                const off = base !== null ? discountPercent(base, t.unit_price_krw) : 0;
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="w-44">
                      <label className={label}>테마</label>
                      <select
                        className={field}
                        value={t.theme_id}
                        onChange={(e) => {
                          const tiers = [...editing.tiers];
                          tiers[i] = { ...t, theme_id: e.target.value };
                          patch({ tiers });
                        }}
                      >
                        <option value="">선택</option>
                        {themes.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className={label}>인원 이상</label>
                      <input
                        type="number"
                        min={1}
                        className={field}
                        value={t.min_headcount}
                        onChange={(e) => {
                          const tiers = [...editing.tiers];
                          tiers[i] = { ...t, min_headcount: Number(e.target.value) };
                          patch({ tiers });
                        }}
                      />
                    </div>
                    <div className="w-32">
                      <label className={label}>얼리버드 인당가</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        className={field}
                        value={t.unit_price_krw}
                        onChange={(e) => {
                          const tiers = [...editing.tiers];
                          tiers[i] = { ...t, unit_price_krw: Number(e.target.value) };
                          patch({ tiers });
                        }}
                      />
                    </div>

                    {/* 기본가 대비 얼마나 싼지. 저장 전에 눈으로 확인할 수 있어야 한다. */}
                    <div className="min-w-[10rem] pb-2 text-xs">
                      {base === null ? (
                        <span className="text-amber-300">이 인원의 기본 요금이 없습니다</span>
                      ) : off > 0 ? (
                        <span className="text-muted">
                          기본 {base.toLocaleString()}원 &rarr;{" "}
                          <strong className="text-glow">{off}% 할인</strong>
                        </span>
                      ) : (
                        <span className="text-red-400">
                          기본 {base.toLocaleString()}원보다 싸지 않습니다
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => patch({ tiers: editing.tiers.filter((_, x) => x !== i) })}
                      className="rounded border border-red-500/50 px-2.5 py-2 text-xs text-red-400"
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() =>
                patch({
                  tiers: [
                    ...editing.tiers,
                    {
                      theme_id: editing.tiers.at(-1)?.theme_id ?? themes[0]?.id ?? "",
                      min_headcount: (editing.tiers.at(-1)?.min_headcount ?? 0) + 1,
                      unit_price_krw: 0,
                    },
                  ],
                })
              }
              className="rounded border border-border px-3 py-1.5 text-xs"
            >
              + 구간 추가
            </button>
          </div>

          <div className={section}>
            <h3 className="text-sm font-semibold">회차 선택 배너 문구</h3>
            <div>
              <label className={label}>제목</label>
              <input
                className={field}
                value={editing.banner_title}
                placeholder="10월 얼리버드 OPEN"
                onChange={(e) => patch({ banner_title: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>본문</label>
              <textarea
                className={`${field} h-16`}
                value={editing.banner_body}
                placeholder="진행일 5일 전까지 신청하면 인원별 얼리버드 할인가가 자동 적용됩니다."
                onChange={(e) => patch({ banner_body: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>할인폭 (비우면 자동 계산)</label>
                <input
                  className={field}
                  value={editing.banner_highlight}
                  placeholder="비우면 '최대 N% OFF'"
                  onChange={(e) => patch({ banner_highlight: e.target.value })}
                />
              </div>
              <div>
                <label className={label}>단서 한 줄</label>
                <input
                  className={field}
                  value={editing.banner_note}
                  placeholder="보유 쿠폰 중복 적용 가능"
                  onChange={(e) => patch({ banner_note: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded bg-glow px-4 py-2 text-sm text-white disabled:opacity-50"
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
        {promotions.length === 0 && (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
            등록된 프로모션이 없습니다.
          </p>
        )}
        {promotions.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.accent_color }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.name}{" "}
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-[11px] ${
                    p.is_active ? "bg-glow text-white" : "bg-muted/20 text-muted"
                  }`}
                >
                  {p.is_active ? "켜짐" : "꺼짐"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">
                회차 {p.session_from ?? "제한 없음"} ~ {p.session_to ?? "제한 없음"} · 진행일{" "}
                {p.days_before}일 전까지 · 접수{" "}
                {p.applies_until ? `${isoToKstLocal(p.applies_until)} 까지` : "종료일 없음"} ·
                금액 구간 {p.tiers.length}개
              </p>
            </div>
            <button
              onClick={() => toggle(p.id, !p.is_active, p.name)}
              disabled={pending}
              className="rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {p.is_active ? "끄기" : "켜기"}
            </button>
            <button
              onClick={() => setEditing(toInput(p))}
              className="rounded border border-border px-3 py-1.5 text-xs"
            >
              수정
            </button>
            <button
              onClick={() => remove(p.id, p.name)}
              disabled={pending}
              className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
