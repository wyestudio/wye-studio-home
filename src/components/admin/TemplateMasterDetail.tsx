"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminBadge, AdminEmpty, adminButtonClass } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";

export type TemplateItem = { key: string; label: string };

/**
 * 템플릿 화면의 틀 — 왼쪽에 목록, 오른쪽에 **한 개**만 편집(관리자 개편 docs/01 5장, 2026-11-27 대표님).
 * 휴대폰에서는 목록 → 한 개로 넘어가고 「목록」 으로 돌아온다.
 *
 * 편집기는 전부 그려 두고 고른 것만 보인다 — 다른 템플릿을 보고 와도 적던 글이 남는다.
 * 저장하지 않은 템플릿은 목록에 「저장 안 됨」 으로 표시하고, 그 상태로 창을 닫거나 새로고침하면 브라우저가 한 번 묻는다.
 */
export function TemplateMasterDetail({
  items,
  visibleKeys,
  listLabel,
  toolbar,
  emptyTitle = "등록된 템플릿이 없어요",
  renderEditor,
}: {
  /** 전체 템플릿. 편집기는 전부 그려 둔다(탭을 바꿔도 적던 글이 남게). */
  items: TemplateItem[];
  /** 목록에 보일 것(탭으로 거른 결과). 없으면 전부. */
  visibleKeys?: string[];
  /** 화면낭독기가 읽는 목록 이름 */
  listLabel: string;
  /** 편집기 위에 두는 것(미리보기 기준 테마 고르기) */
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  renderEditor: (item: TemplateItem, onDirtyChange: (key: string, dirty: boolean) => void) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // 휴대폰에서 편집 화면을 보고 있는가. 컴퓨터에서는 늘 둘 다 보인다.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());

  const onDirtyChange = useCallback((key: string, isDirty: boolean) => {
    setDirty((prev) => {
      if (prev.has(key) === isDirty) return prev;
      const next = new Set(prev);
      if (isDirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const hasDirty = dirty.size > 0;
  useEffect(() => {
    if (!hasDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDirty]);

  const visible = visibleKeys ? items.filter((i) => visibleKeys.includes(i.key)) : items;
  const selectedVisible = visible.some((i) => i.key === selected);
  // 고른 것이 지금 목록에 없으면(탭을 바꿨으면) 첫 번째를 연다.
  const currentKey = selectedVisible ? selected : (visible[0]?.key ?? null);
  const showEditorOnMobile = mobileOpen && selectedVisible;

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <nav aria-label={listLabel} className={`lg:col-span-1 ${showEditorOnMobile ? "hidden lg:block" : ""}`}>
        {visible.length === 0 ? (
          <AdminEmpty title={emptyTitle} />
        ) : (
          <ul className="rounded-xl border border-border bg-surface p-1.5">
            {visible.map((i) => {
              const active = i.key === currentKey;
              return (
                <li key={i.key}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      setSelected(i.key);
                      setMobileOpen(true);
                    }}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active ? "text-foreground lg:bg-fill-strong lg:font-semibold" : "text-muted hover:bg-fill hover:text-foreground"
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-keep">{i.label}</span>
                    {dirty.has(i.key) && <AdminBadge tone="warn">저장 안 됨</AdminBadge>}
                    <Chevron className="h-4 w-4 shrink-0 text-muted lg:hidden" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className={`min-w-0 lg:col-span-3 ${showEditorOnMobile ? "" : "hidden lg:block"}`}>
        <button type="button" onClick={() => setMobileOpen(false)} className={`${adminButtonClass("secondary")} mb-3 lg:hidden`}>
          <Chevron dir="left" className="h-4 w-4" />
          목록
        </button>
        {toolbar}
        {items.map((i) => (
          <div key={i.key} hidden={i.key !== currentKey}>
            {renderEditor(i, onDirtyChange)}
          </div>
        ))}
      </div>
    </div>
  );
}
