"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { Venue, ThemeWithTiers, ThemeContent, ThemeCategory } from "@/types/catalog";
import { EMPTY_THEME_CONTENT, normalizeThemeContent, resolveUnitPrice } from "@/types/catalog";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { saveTheme, deleteTheme, type ThemeInput, type PriceTierInput } from "./actions";
import { ContentBlocksEditor } from "./ContentBlocksEditor";
import { ImageUploadField } from "./ImageUploadField";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";
const section = "rounded-lg border border-border p-4 space-y-4";

/** 강조색을 안 정한 테마가 쓰는 기본값. 고객 화면의 DEFAULT_ACCENT 와 같아야 한다. */
const DEFAULT_ACCENT = "#3dffb0";
/** 포스터를 안 올린 테마가 쓰는 기본 아트웍. 고객 화면과 같은 파일. */
const FALLBACK_POSTER = "/bar-o-title.png";

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
    logo_image_path: "",
    category_id: null,
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
    // 폼에서 뺀 값이지만 저장할 때 날려버리지 않도록 그대로 들고 다닌다.
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
    logo_image_path: t.logo_image_path ?? "",
    category_id: t.category_id ?? null,
    // 옛 4칸 구조로 저장된 테마도 블록으로 읽어준다. 저장하면 새 구조로 덮인다.
    content: normalizeThemeContent(t.content),
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
  categories,
}: {
  themes: ThemeWithTiers[];
  venues: Venue[];
  categories: ThemeCategory[];
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

  const accent = editing?.accent_color?.trim() || DEFAULT_ACCENT;
  const categoryName = categories.find((c) => c.id === editing?.category_id)?.name ?? null;

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

      {/*
        편집 중에는 목록과 '추가' 버튼을 숨긴다.
        예전에는 편집 폼이 목록 위에 열려서, 수정을 누르면 한참 스크롤해야
        내가 고치는 테마가 보였다.
      */}
      {!editing && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(emptyTheme(activeVenues[0].id))}
            className="rounded bg-glow px-3 py-2 text-sm text-glow-foreground"
          >
            + 테마 추가
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-4">
          {/*
            ── 최상단: 좌 포스터 / 우 정보 ──
            고객이 보는 상세 페이지와 같은 배치다. 어디를 고치면 어디가
            바뀌는지 폼만 보고 알 수 있어야 한다.
          */}
          <div className={section}>
            <h2 className="font-semibold">{editing.id ? "테마 수정" : "새 테마"}</h2>

            <div className="flex flex-col gap-6 md:flex-row">
              <div className="w-full shrink-0 space-y-4 md:w-56">
                <ImageUploadField
                  label="포스터"
                  value={editing.hero_image_path}
                  onChange={(hero_image_path) => patch({ hero_image_path })}
                  hint="상세 페이지 왼쪽에 이 크기로 보입니다. 세로로 긴 이미지(4:5)가 잘 맞아요."
                />
                <ImageUploadField
                  label="행성 로고"
                  shape="circle"
                  value={editing.logo_image_path}
                  onChange={(logo_image_path) => patch({ logo_image_path })}
                  hint="컨텐츠 목록에서 행성으로 떠 있는 그림입니다. 배경이 비어 있는 PNG 를 권합니다."
                />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className={label}>테마 이름 *</label>
                  <input
                    className={`${field} text-lg font-bold`}
                    value={editing.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </div>

                <div>
                  <label className={label}>카테고리</label>
                  <select
                    className={field}
                    value={editing.category_id ?? ""}
                    onChange={(e) => patch({ category_id: e.target.value || null })}
                  >
                    <option value="">분류 없음</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    상세 화면에서 테마명 바로 아래에 강조색으로 보입니다.
                    {categoryName && ` 지금은 '${categoryName}'.`}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>난이도 (1~5)</label>
                    <input
                      type="number" min={1} max={5} className={field}
                      value={editing.difficulty}
                      onChange={(e) => patch({ difficulty: Number(e.target.value) })}
                    />
                    <div className="mt-1.5">
                      <DifficultyLocks rating={editing.difficulty} />
                    </div>
                  </div>
                  <div>
                    <label className={label}>소요시간 (분) *</label>
                    <input
                      type="number" min={1} className={field}
                      value={editing.duration_minutes}
                      onChange={(e) => patch({ duration_minutes: Number(e.target.value) })}
                    />
                  </div>
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
                    영문 소문자·숫자·하이픈만. 주소는 <code>/themes/{editing.slug || "…"}</code>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 설명 · 강조색 ── */}
          <div className={section}>
            <div>
              <label className={label}>설명</label>
              <textarea
                className={`${field} min-h-24`}
                value={editing.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="상세 페이지 상단, 테마 정보 아래에 그대로 보입니다."
              />
            </div>

            <div>
              <label className={label}>강조색</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 shrink-0 cursor-pointer rounded border border-border bg-background"
                  value={/^#[0-9a-fA-F]{6}$/.test(editing.accent_color) ? editing.accent_color : DEFAULT_ACCENT}
                  onChange={(e) => patch({ accent_color: e.target.value })}
                />
                <input
                  className={field}
                  value={editing.accent_color}
                  onChange={(e) => patch({ accent_color: e.target.value })}
                  placeholder={`비우면 ${DEFAULT_ACCENT}`}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                카테고리·선택한 날짜·신청 버튼 등 상세 페이지 곳곳에 쓰입니다.
              </p>
            </div>
          </div>

          {/* ── 상세 콘텐츠 ── */}
          <div className={section}>
            <h3 className="text-sm font-semibold">상세 페이지 콘텐츠</h3>
            <p className="text-xs text-muted">
              아래는 고객 화면과 같은 미리보기입니다. 블록 사이의 <strong>+</strong> 를 눌러 원하는
              자리에 끼워넣을 수 있어요.
            </p>
            <ContentBlocksEditor
              blocks={editing.content.blocks}
              accent={accent}
              onChange={(blocks) => patchContent({ blocks })}
            />
          </div>

          {/* ── 요금 구간 · 정원/연령 (둘 다 좁아서 2열로 붙인다) ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={section}>
              <h3 className="text-sm font-semibold">요금 구간 (인당 가격)</h3>
              <p className="text-xs text-muted">
                해당 인원 <strong>이상</strong>일 때 적용되며, 조건을 만족하는 구간 중 가장 큰 것이 쓰입니다.
                예를 들어 4인 구간이 마지막이면 5인·6인도 4인 가격이 적용됩니다.
              </p>

              <div className="space-y-2">
                {editing.tiers.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="w-20">
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
                    <div className="w-28">
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
                    <div className="w-28">
                      <label className={label}>정가 (할인 표시)</label>
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

            <div className={section}>
              <h3 className="text-sm font-semibold">정원 · 연령</h3>
              <div>
                <label className={label}>즉시확정 인원 *</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.capacity_confirm_line}
                  onChange={(e) => patch({ capacity_confirm_line: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-muted">여기까지는 바로 확정됩니다.</p>
              </div>
              <div>
                <label className={label}>정원 (대기 포함) *</label>
                <input
                  type="number" min={1} className={field}
                  value={editing.capacity_max}
                  onChange={(e) => patch({ capacity_max: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-muted">이 수를 넘으면 신청이 거부됩니다.</p>
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

          <div className="flex flex-wrap gap-2">
            <button onClick={submit} disabled={pending} className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50">
              {pending ? "저장 중…" : "저장"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded border border-border px-4 py-2 text-sm">
              취소
            </button>
            {/* 목록이 행성 격자가 되면서 줄별 삭제 버튼이 사라졌다. 편집 화면에 둔다. */}
            {editing.id && (
              <button
                onClick={() => remove(editing.id!, editing.name)}
                disabled={pending}
                className="ml-auto rounded border border-red-500/50 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
              >
                이 테마 삭제
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 (행성 + 정보) ── */}
      {!editing && (
        <div>
          {themes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">등록된 테마가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {themes.map((t) => {
                const prices = t.tiers.map((x) => x.unit_price_krw);
                // 고객 화면과 같은 대체 규칙 — 로고가 없으면 포스터, 포스터도 없으면 기본 아트웍.
                const logo = t.logo_image_path;
                return (
                  <button
                    key={t.id}
                    onClick={() => setEditing(toInput(t))}
                    className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-glow"
                  >
                    <div className="relative aspect-square bg-background">
                      <Image
                        src={logo || t.hero_image_path || FALLBACK_POSTER}
                        alt={t.name}
                        fill
                        className={logo ? "object-contain p-3" : "object-cover"}
                        sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                      />

                      {(!t.is_active || !t.is_listed) && (
                        <div className="absolute left-2 top-2 flex flex-col gap-1">
                          {!t.is_active && (
                            <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] text-black">
                              신청 중지
                            </span>
                          )}
                          {!t.is_listed && (
                            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                              목록 숨김
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border p-3">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        난이도 {t.difficulty} · {t.duration_minutes}분
                      </p>
                      <p className="text-[11px] text-muted">
                        {prices.length > 0
                          ? `인당 ${Math.min(...prices).toLocaleString()}~${Math.max(...prices).toLocaleString()}원`
                          : "요금 미설정"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
