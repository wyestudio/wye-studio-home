"use client";

import { useState } from "react";
import { ThemeBlockView } from "@/components/contents/ThemeBlocks";
import {
  THEME_BLOCK_LABELS,
  type ThemeBlock,
  type ThemeBlockType,
} from "@/types/catalog";

const field = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm";
// ⚠️ 줄 편집기는 flex 라 w-full 을 쓰면 안 된다. width:100% 인 칸이 basis:auto 로
//    공간을 다 먹어 나머지 칸이 0 폭으로 찌그러진다(실제로 그랬다).
const cell = "rounded border border-border bg-background px-2 py-1.5 text-sm";

function emptyBlock(type: ThemeBlockType): ThemeBlock {
  switch (type) {
    case "text":
      return { type, title: "", body: "" };
    case "list":
      return { type, title: "", items: [{ emoji: "", title: "", desc: "" }] };
    case "timetable":
      return { type, title: "진행 순서", eyebrow: "SCHEDULE", items: [{ title: "", desc: "" }] };
    case "callout":
      return { type, title: "", items: [{ title: "", desc: "" }] };
    case "faq":
      return { type, title: "자주 묻는 질문", eyebrow: "FAQ", items: [{ q: "", a: "" }] };
    case "image":
      return { type, title: "", src: "", alt: "" };
  }
}

/**
 * 상세 페이지 콘텐츠 편집기.
 *
 * 블록은 고객 화면과 **같은 컴포넌트(ThemeBlockView)** 로 미리 그린다.
 * 어드민용 미리보기를 따로 만들면 실제 화면과 반드시 어긋난다.
 *
 * 추가 버튼은 목록 아래 한 곳이 아니라 블록 사이사이에 둔다 — 중간에
 * 끼워넣으려고 추가한 뒤 ↑ 를 여러 번 누를 일이 없어진다.
 */
export function ContentBlocksEditor({
  blocks,
  accent,
  onChange,
}: {
  blocks: ThemeBlock[];
  accent: string;
  onChange: (blocks: ThemeBlock[]) => void;
}) {
  /** 폼이 열려 있는 블록. 미리보기만 보고 싶을 때가 대부분이라 기본은 닫힘. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const patch = (i: number, next: Partial<ThemeBlock>) =>
    onChange(blocks.map((b, x) => (x === i ? ({ ...b, ...next } as ThemeBlock) : b)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpenIndex(openIndex === i ? j : openIndex === j ? i : openIndex);
  };

  const remove = (i: number) => {
    onChange(blocks.filter((_, x) => x !== i));
    setOpenIndex(null);
  };

  /** i 번째 자리에 새 블록을 끼운다. 갓 만든 블록은 비어 있으니 폼을 열어둔다. */
  const insert = (i: number, type: ThemeBlockType) => {
    onChange([...blocks.slice(0, i), emptyBlock(type), ...blocks.slice(i)]);
    setOpenIndex(i);
  };

  return (
    <div>
      {blocks.length === 0 && (
        <p className="mb-1 rounded border border-dashed border-border py-6 text-center text-sm text-muted">
          아직 내용이 없습니다. 아래에서 블록을 추가해주세요.
        </p>
      )}

      <InsertRow onInsert={(t) => insert(0, t)} />

      {blocks.map((b, i) => {
        const open = openIndex === i;
        return (
          <div key={i}>
            <div className="rounded-lg border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-white/[0.02] px-3 py-2">
                <span className="shrink-0 rounded bg-muted/20 px-2 py-0.5 text-[11px] text-muted">
                  {THEME_BLOCK_LABELS[b.type]}
                </span>
                <span className="flex-1 truncate text-xs text-muted">
                  {b.title || "(제목 없음)"}
                </span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">위로</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">아래로</button>
                <button type="button" onClick={() => setOpenIndex(open ? null : i)}
                  className="rounded border border-border px-2 py-1 text-xs">
                  {open ? "접기" : "편집"}
                </button>
                <button type="button" onClick={() => remove(i)}
                  className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400">삭제</button>
              </div>

              {/* 미리보기 — 고객 화면과 같은 컴포넌트 */}
              <div className="px-4 py-4">
                <ThemeBlockView block={b} accent={accent} />
              </div>

              {open && (
                <div className="space-y-2 border-t border-border bg-white/[0.02] p-3">
                  <div className="flex gap-2">
                    <input
                      className={`${field} w-32 shrink-0`}
                      value={b.eyebrow ?? ""}
                      onChange={(e) => patch(i, { eyebrow: e.target.value })}
                      placeholder="라벨 (FOR YOU)"
                    />
                    <input
                      className={field}
                      value={b.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      placeholder="블록 제목 (비우면 제목 없이 나갑니다)"
                    />
                  </div>

                  {b.type === "list" && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      모양
                      <select
                        className={`${field} w-44`}
                        value={b.variant ?? "card"}
                        onChange={(e) =>
                          patch(i, { variant: e.target.value as "card" | "step" } as Partial<ThemeBlock>)
                        }
                      >
                        <option value="card">카드 (이모지 + 설명)</option>
                        <option value="step">STEP 1·2·3</option>
                      </select>
                    </label>
                  )}

                  {b.type === "text" && (
                    <textarea
                      className={`${field} min-h-28`}
                      value={b.body}
                      onChange={(e) => patch(i, { body: e.target.value })}
                      placeholder="내용. 줄바꿈은 그대로 보이고 https:// 주소는 자동으로 링크가 됩니다."
                    />
                  )}

                  {b.type === "image" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={field} value={b.src}
                        onChange={(e) => patch(i, { src: e.target.value })}
                        placeholder="/theme-detail.png 또는 https://..." />
                      <input className={field} value={b.alt}
                        onChange={(e) => patch(i, { alt: e.target.value })}
                        placeholder="이미지 설명 (화면에 안 보임)" />
                    </div>
                  )}

                  {(b.type === "list" ||
                    b.type === "timetable" ||
                    b.type === "callout" ||
                    b.type === "faq") && (
                    <RowsEditor block={b} onChange={(items) => patch(i, { items } as Partial<ThemeBlock>)} />
                  )}
                </div>
              )}
            </div>

            <InsertRow onInsert={(t) => insert(i + 1, t)} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * 블록과 블록 사이의 삽입 자리.
 * 평소에는 얇은 선이고, + 를 누르면 블록 종류가 펼쳐진다.
 */
function InsertRow({ onInsert }: { onInsert: (type: ThemeBlockType) => void }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="my-2 flex flex-wrap items-center gap-1.5 rounded border border-border p-2">
        {(Object.keys(THEME_BLOCK_LABELS) as ThemeBlockType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              onInsert(t);
              setOpen(false);
            }}
            className="rounded border border-border px-3 py-1.5 text-xs hover:border-glow"
          >
            {THEME_BLOCK_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto px-2 py-1.5 text-xs text-muted"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="group relative flex h-7 items-center justify-center">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border opacity-0 transition-opacity group-hover:opacity-100" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="여기에 블록 추가"
        className="relative rounded-full border border-border bg-background px-2.5 text-xs leading-5 text-muted opacity-40 transition-opacity hover:border-glow hover:text-glow group-hover:opacity-100"
      >
        +
      </button>
    </div>
  );
}

type RowBlock = Extract<ThemeBlock, { items: unknown[] }>;

/** 목록·타임테이블·강조박스의 줄 편집. 블록 종류마다 칸 구성만 다르다. */
function RowsEditor({
  block,
  onChange,
}: {
  block: RowBlock;
  onChange: (items: RowBlock["items"]) => void;
}) {
  const items = block.items as Record<string, unknown>[];

  const cols: { key: string; label: string; numeric?: boolean; width?: string }[] =
    block.type === "faq"
      ? [
          { key: "q", label: "질문" },
          { key: "a", label: "답변" },
        ]
      : block.type === "timetable"
        ? [
            { key: "title", label: "제목" },
            { key: "desc", label: "설명" },
          ]
        : block.type === "list"
        ? [
            { key: "emoji", label: "이모지", width: "w-20" },
            { key: "title", label: "제목" },
            { key: "desc", label: "설명" },
          ]
        : [
            { key: "title", label: "제목" },
            { key: "desc", label: "설명" },
          ];

  const blank = Object.fromEntries(cols.map((c) => [c.key, c.numeric ? 0 : ""]));

  return (
    <div className="space-y-2">
      {block.type === "timetable" && (
        <p className="text-[11px] text-muted">
          시각은 적지 않습니다. 화면에는 <strong>1·2·3…</strong> 순서로만 나갑니다.
        </p>
      )}

      {items.map((row, r) => (
        <div key={r} className="flex items-start gap-2">
          {cols.map((c) => (
            <input
              key={c.key}
              className={`${cell} ${c.width ?? "min-w-0 flex-1"}`}
              type={c.numeric ? "number" : "text"}
              value={String(row[c.key] ?? "")}
              placeholder={c.label}
              onChange={(e) =>
                onChange(
                  items.map((x, i) =>
                    i === r
                      ? { ...x, [c.key]: c.numeric ? Number(e.target.value) || 0 : e.target.value }
                      : x
                  ) as RowBlock["items"]
                )
              }
            />
          ))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== r) as RowBlock["items"])}
            className="shrink-0 rounded border border-border px-2 py-1.5 text-xs text-muted"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, blank] as RowBlock["items"])}
        className="rounded border border-dashed border-border px-3 py-1.5 text-xs text-muted"
      >
        + 항목 추가
      </button>
    </div>
  );
}
