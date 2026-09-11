"use client";

import { useState, useTransition } from "react";
import type { Venue, ThemeWithTiers, ThemeContent } from "@/types/catalog";
import { EMPTY_THEME_CONTENT, resolveUnitPrice } from "@/types/catalog";
import { saveTheme, deleteTheme, type ThemeInput, type PriceTierInput } from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";
const section = "rounded-lg border border-border p-4 space-y-4";

/** 확정된 기본 요금표. 새 테마를 만들 때 출발점으로 깔아준다. */
const DEFAULT_TIERS: PriceTierInput[] = [
  { min_headcount: 1, unit_price_krw: 68000, original_unit_price_krw: null },
  { min_headcount: 2, unit_price_krw: 62000, original_unit_price_krw: null },
  { min_headcount: 3, unit_price_krw: 56000, original_unit_price_krw: null },
  { min_headcount: 4, unit_price_krw: 50000, original_unit_price_krw: null },
];

/**
 * 이름에서 slug 후보를 만든다.
 * 한글은 URL 로 쓰기 어려워 로마자 변환 대신 안전한 임의값을 붙인다.
 * 운영자가 slug 규칙을 몰라도 저장이 막히지 않게 하는 것이 목적이다.
 */
function suggestSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return `theme-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyTheme(venueId: string): ThemeInput {
  return {
    slug: "",
    name: "",
    tagline: "",
    description: "",
    difficulty: 3,
    duration_minutes: 180,
    min_age_floor: null,
    capacity_confirm_line: 24,
    capacity_max: 40,
    capacity_min: null,
    max_group_size: null,
    venue_id: venueId,
    accent_color: "",
    hero_image_path: "",
    content: structuredClone(EMPTY_THEME_CONTENT),
    is_active: true,
    is_listed: true,
    sort_order: 0,
    tiers: structuredClone(DEFAULT_TIERS),
  };
}

function toInput(t: ThemeWithTiers): ThemeInput {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline ?? "",
    description: t.description ?? "",
    difficulty: t.difficulty,
    duration_minutes: t.duration_minutes,
    min_age_floor: t.min_age_floor,
    capacity_confirm_line: t.capacity_confirm_line,
    capacity_max: t.capacity_max,
    capacity_min: t.capacity_min,
    max_group_size: t.max_group_size,
    venue_id: t.venue_id,
    accent_color: t.accent_color ?? "",
    hero_image_path: t.hero_image_path ?? "",
    content: { ...EMPTY_THEME_CONTENT, ...(t.content ?? {}) },
    is_active: t.is_active,
    is_listed: t.is_listed,
    sort_order: t.sort_order,
    tiers: t.tiers
      .map((x) => ({
        min_headcount: x.min_headcount,
        unit_price_krw: x.unit_price_krw,
        original_unit_price_krw: x.original_unit_price_krw,
      }))
      .sort((a, b) => a.min_headcount - b.min_headcount),
  };
}

const num = (v: string) => (v === "" ? null : Number(v));

export function ThemeEditor({
  themes,
  venues,
}: {
  themes: ThemeWithTiers[];
  venues: Venue[];
}) {
  const [editing, setEditing] = useState<ThemeInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const activeVenues = venues.filter((v) => v.is_active);

  function patch(p: Partial<ThemeInput>) {
    setEditing((cur) => (cur ? { ...cur, ...p } : cur));
  }
  function patchContent(p: Partial<ThemeContent>) {
    setEditing((cur) => (cur ? { ...cur, content: { ...cur.content, ...p } } : cur));
  }

  function submit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveTheme(editing);
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
    if (!confirm(`'${name}' 테마를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      const res = await deleteTheme(id);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "삭제되었습니다." }
      );
    });
  }

  if (activeVenues.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
        사용 가능한 장소가 없습니다. <strong>장소</strong> 메뉴에서 먼저 등록해주세요.
      </div>
    );
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
          onClick={() => setEditing(emptyTheme(activeVenues[0].id))}
          className="rounded bg-glow px-3 py-2 text-sm text-glow-foreground"
        >
          + 테마 추가
        </button>
      </div>

      {editing && (
        <div className="space-y-4">
          {/* ── 기본 정보 ── */}
          <div className={section}>
            <h2 className="font-semibold">{editing.id ? "테마 수정" : "새 테마"}</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>테마 이름 *</label>
                <input className={field} value={editing.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div>
                <label className={label}>slug * (주소창에 쓰일 영문 이름)</label>
                <div className="flex gap-2">
                  <input
                    className={field}
                    value={editing.slug}
                    onChange={(e) => patch({ slug: e.target.value })}
                    placeholder="baotalchul"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ slug: suggestSlug(editing.name) })}
                    className="shrink-0 rounded border border-border px-3 text-xs"
                  >
                    자동
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  영문 소문자·숫자·하이픈만. 예) <code>baotalchul</code> → 주소는{" "}
                  <code>/themes/baotalchul</code>
                </p>
              </div>
            </div>

            <div>
              <label className={label}>한 줄 소개</label>
              <input className={field} value={editing.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
            </div>

            <div>
              <label className={label}>설명</label>
              <textarea
                className={`${field} min-h-24`}
                value={editing.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={label}>난이도 (1~5)</label>
                <input
                  type="number" min={1} max={5} className={field}
                  value={editing.difficulty}
                  onChange={(e) => patch({ difficulty: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={label}>소요시간 (분) *</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.duration_minutes}
                  onChange={(e) => patch({ duration_minutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={label}>장소 *</label>
                <select className={field} value={editing.venue_id} onChange={(e) => patch({ venue_id: e.target.value })}>
                  {activeVenues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>강조색</label>
                <input className={field} value={editing.accent_color} onChange={(e) => patch({ accent_color: e.target.value })} placeholder="#3dffb0" />
              </div>
            </div>

            <div>
              <label className={label}>대표 이미지 경로</label>
              <input
                className={field}
                value={editing.hero_image_path}
                onChange={(e) => patch({ hero_image_path: e.target.value })}
                placeholder="/bar-o-title.png"
              />
              <p className="mt-1 text-[11px] text-muted">
                홈·목록의 포스터로 쓰입니다. 비우면 기본 아트웍이 나옵니다.
                (현재는 <code>public/</code> 폴더에 있는 파일 경로만 가능 — 업로드 기능은 준비 중)
              </p>
            </div>
          </div>

          {/* ── 정원 · 연령 ── */}
          <div className={section}>
            <h3 className="text-sm font-semibold">정원 · 연령</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={label}>즉시확정 인원 *</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.capacity_confirm_line}
                  onChange={(e) => patch({ capacity_confirm_line: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-muted">여기까지는 바로 확정</p>
              </div>
              <div>
                <label className={label}>정원 (대기 포함) *</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.capacity_max}
                  onChange={(e) => patch({ capacity_max: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-muted">이 수를 넘으면 신청 거부</p>
              </div>
              <div>
                <label className={label}>최대 그룹 인원</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.max_group_size ?? ""}
                  onChange={(e) => patch({ max_group_size: num(e.target.value) })}
                  placeholder="비우면 제한 없음"
                />
              </div>
              <div>
                <label className={label}>테마 최소 연령</label>
                <input
                  type="number" min={0} className={field}
                  value={editing.min_age_floor ?? ""}
                  onChange={(e) => patch({ min_age_floor: num(e.target.value) })}
                  placeholder="비우면 시각 규칙만"
                />
                <p className="mt-1 text-[11px] text-muted">
                  기본은 회차 시각 기준(18시 전 16세 / 후 19세). 여기 값이 더 높으면 그게 적용됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* ── 요금 구간 ── */}
          <div className={section}>
            <h3 className="text-sm font-semibold">요금 구간 (인당 가격)</h3>
            <p className="text-xs text-muted">
              해당 인원 <strong>이상</strong>일 때 적용되며, 조건을 만족하는 구간 중 가장 큰 것이 쓰입니다.
              예를 들어 4인 구간이 마지막이면 5인·6인도 4인 가격이 적용됩니다.
            </p>

            <div className="space-y-2">
              {editing.tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <div className="w-24">
                    <label className={label}>인원 이상</label>
                    <input
                      type="number" min={1} className={field}
                      value={t.min_headcount}
                      onChange={(e) => {
                        const tiers = [...editing.tiers];
                        tiers[i] = { ...t, min_headcount: Number(e.target.value) };
                        patch({ tiers });
                      }}
                    />
                  </div>
                  <div className="w-36">
                    <label className={label}>인당 가격</label>
                    <input
                      type="number" min={0} step={1000} className={field}
                      value={t.unit_price_krw}
                      onChange={(e) => {
                        const tiers = [...editing.tiers];
                        tiers[i] = { ...t, unit_price_krw: Number(e.target.value) };
                        patch({ tiers });
                      }}
                    />
                  </div>
                  <div className="w-36">
                    <label className={label}>정가 (할인 표시용)</label>
                    <input
                      type="number" min={0} step={1000} className={field}
                      value={t.original_unit_price_krw ?? ""}
                      onChange={(e) => {
                        const tiers = [...editing.tiers];
                        tiers[i] = { ...t, original_unit_price_krw: num(e.target.value) };
                        patch({ tiers });
                      }}
                      placeholder="없으면 비움"
                    />
                  </div>
                  <button
                    onClick={() => patch({ tiers: editing.tiers.filter((_, x) => x !== i) })}
                    className="rounded border border-red-500/50 px-2.5 py-2 text-xs text-red-400"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                patch({
                  tiers: [
                    ...editing.tiers,
                    {
                      min_headcount: (editing.tiers.at(-1)?.min_headcount ?? 0) + 1,
                      unit_price_krw: editing.tiers.at(-1)?.unit_price_krw ?? 0,
                      original_unit_price_krw: null,
                    },
                  ],
                })
              }
              className="rounded border border-border px-3 py-1.5 text-xs"
            >
              + 구간 추가
            </button>

            <div className="rounded bg-muted/10 p-3 text-xs">
              <p className="mb-1 font-medium">미리보기</p>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const unit = resolveUnitPrice(
                  editing.tiers.map((t) => ({ ...t, theme_id: "" })),
                  n
                );
                return (
                  <span key={n} className="mr-3 inline-block text-muted">
                    {n}인 {unit === null ? "—" : `${unit.toLocaleString()}원 (총 ${(unit * n).toLocaleString()}원)`}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── 상세 콘텐츠 ── */}
          <div className={section}>
            <h3 className="text-sm font-semibold">상세 페이지 콘텐츠</h3>

            <BlockEditor
              title="이런 분께 추천"
              rows={editing.content.for_you}
              cols={["emoji", "title", "desc"]}
              colLabels={["이모지", "제목", "설명"]}
              onChange={(for_you) => patchContent({ for_you })}
              blank={{ emoji: "", title: "", desc: "" }}
            />

            <BlockEditor
              title="진행 방식"
              rows={editing.content.steps}
              cols={["emoji", "title", "desc"]}
              colLabels={["이모지", "제목", "설명"]}
              onChange={(steps) => patchContent({ steps })}
              blank={{ emoji: "", title: "", desc: "" }}
            />

            <div>
              <p className="mb-1 text-xs font-medium">타임테이블</p>
              <p className="mb-2 text-[11px] text-muted">
                ⭐ 시각이 아니라 <strong>시작 후 경과 분</strong>을 적습니다. 그래야 11:30 회차든 19:30 회차든
                같은 내용으로 자동 계산됩니다.
              </p>
              <BlockEditor
                title=""
                rows={editing.content.timetable}
                cols={["offset_min", "title", "desc"]}
                colLabels={["경과(분)", "제목", "설명"]}
                onChange={(timetable) => patchContent({ timetable })}
                blank={{ offset_min: 0, title: "", desc: "" }}
                numericCols={["offset_min"]}
              />
            </div>

            <BlockEditor
              title="주의사항"
              rows={editing.content.precautions}
              cols={["title", "desc"]}
              colLabels={["제목", "설명"]}
              onChange={(precautions) => patchContent({ precautions })}
              blank={{ title: "", desc: "" }}
            />
          </div>

          {/* ── 노출 ── */}
          <div className={section}>
            <h3 className="text-sm font-semibold">노출</h3>
            <div className="flex flex-wrap gap-6">
              <label className="flex max-w-xs items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editing.is_active}
                  onChange={(e) => patch({ is_active: e.target.checked })}
                />
                <span>
                  신청 받기
                  <span className="mt-0.5 block text-xs text-muted">
                    끄면 <strong>신청 버튼만</strong> 비활성화됩니다. 테마 페이지는 계속 보입니다.
                  </span>
                </span>
              </label>
              <label className="flex max-w-xs items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editing.is_listed}
                  onChange={(e) => patch({ is_listed: e.target.checked })}
                />
                <span>
                  목록에 노출
                  <span className="mt-0.5 block text-xs text-muted">
                    끄면 컨텐츠 목록·검색엔진에 안 나옵니다. 주소를 아는 사람은 볼 수 있습니다.
                  </span>
                </span>
              </label>
              <div className="w-28">
                <label className={label}>정렬 순서</label>
                <input
                  type="number" className={field}
                  value={editing.sort_order}
                  onChange={(e) => patch({ sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* 폼이 길어서 맨 위 메시지가 화면 밖에 있을 수 있다. 버튼 옆에도 보여준다. */}
          {message?.kind === "err" && (
            <div className="rounded border border-red-500 px-3 py-2 text-sm text-red-400">
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={submit} disabled={pending} className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50">
              {pending ? "저장 중…" : "저장"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded border border-border px-4 py-2 text-sm">
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      <div className="space-y-2">
        {themes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">등록된 테마가 없습니다.</p>
        ) : (
          themes.map((t) => {
            const venue = venues.find((v) => v.id === t.venue_id);
            const prices = t.tiers.map((x) => x.unit_price_krw);
            return (
              <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.name}
                    <span className="ml-2 text-xs text-muted">/{t.slug}</span>
                    {!t.is_active && <span className="ml-2 text-xs text-amber-400">신청 중지</span>}
                    {!t.is_listed && <span className="ml-2 text-xs text-muted">목록 숨김</span>}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    난이도 {t.difficulty} · {t.duration_minutes}분 · 확정 {t.capacity_confirm_line} / 정원 {t.capacity_max}
                    {venue && ` · ${venue.name}`}
                  </p>
                  <p className="text-xs text-muted">
                    {prices.length > 0
                      ? `인당 ${Math.min(...prices).toLocaleString()}~${Math.max(...prices).toLocaleString()}원 (구간 ${t.tiers.length}개)`
                      : "요금 구간 없음"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditing(toInput(t))} className="rounded border border-border px-3 py-1.5 text-xs">
                    수정
                  </button>
                  <button onClick={() => remove(t.id, t.name)} className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400">
                    삭제
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** 콘텐츠 블록(배열) 편집기. 행 추가/삭제/순서변경. */
function BlockEditor<T extends Record<string, string | number>>({
  title,
  rows,
  cols,
  colLabels,
  onChange,
  blank,
  numericCols = [],
}: {
  title: string;
  rows: T[];
  cols: (keyof T & string)[];
  colLabels: string[];
  onChange: (rows: T[]) => void;
  blank: T;
  numericCols?: string[];
}) {
  const move = (i: number, d: number) => {
    const next = [...rows];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {title && <p className="mb-2 text-xs font-medium">{title}</p>}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            {cols.map((c, ci) => (
              <div key={c} className={ci === cols.length - 1 ? "min-w-48 flex-1" : "w-28"}>
                <label className={label}>{colLabels[ci]}</label>
                <input
                  type={numericCols.includes(c) ? "number" : "text"}
                  className={field}
                  value={row[c] as string | number}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = {
                      ...row,
                      [c]: numericCols.includes(c) ? Number(e.target.value) : e.target.value,
                    };
                    onChange(next);
                  }}
                />
              </div>
            ))}
            <button onClick={() => move(i, -1)} className="rounded border border-border px-2 py-2 text-xs" title="위로">↑</button>
            <button onClick={() => move(i, 1)} className="rounded border border-border px-2 py-2 text-xs" title="아래로">↓</button>
            <button
              onClick={() => onChange(rows.filter((_, x) => x !== i))}
              className="rounded border border-red-500/50 px-2 py-2 text-xs text-red-400"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...rows, structuredClone(blank)])}
        className="mt-2 rounded border border-border px-3 py-1.5 text-xs"
      >
        + 항목 추가
      </button>
    </div>
  );
}
