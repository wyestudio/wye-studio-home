"use client";

import {
  THEME_BLOCK_LABELS,
  type ThemeBlock,
  type ThemeBlockType,
} from "@/types/catalog";

const field = "w-full rounded border border-border bg-background px-2 py-1.5 text-sm";

function emptyBlock(type: ThemeBlockType): ThemeBlock {
  switch (type) {
    case "text":
      return { type, title: "", body: "" };
    case "list":
      return { type, title: "", items: [{ emoji: "", title: "", desc: "" }] };
    case "timetable":
      return { type, title: "타임테이블", items: [{ offset_min: 0, title: "", desc: "" }] };
    case "callout":
      return { type, title: "", items: [{ title: "", desc: "" }] };
    case "image":
      return { type, title: "", src: "", alt: "" };
  }
}

/**
 * 상세 페이지 콘텐츠 편집기.
 *
 * 예전에는 '이런 분께 추천 / 진행 방식 / 타임테이블 / 주의사항' 4칸이 고정이라
 * 그 구성이 안 맞는 테마는 빈 칸을 남기거나 억지로 끼워야 했다.
 * 필요한 블록만 골라 쌓고 순서를 바꾼다.
 */
export function ContentBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ThemeBlock[];
  onChange: (blocks: ThemeBlock[]) => void;
}) {
  const patch = (i: number, next: Partial<ThemeBlock>) =>
    onChange(blocks.map((b, x) => (x === i ? ({ ...b, ...next } as ThemeBlock) : b)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => onChange(blocks.filter((_, x) => x !== i));

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="rounded border border-dashed border-border py-8 text-center text-sm text-muted">
          아직 내용이 없습니다. 아래에서 블록을 추가해주세요.
        </p>
      )}

      {blocks.map((b, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-muted/20 px-2 py-0.5 text-[11px] text-muted">
              {THEME_BLOCK_LABELS[b.type]}
            </span>
            <input
              className={`${field} flex-1`}
              value={b.title}
              onChange={(e) => patch(i, { title: e.target.value })}
              placeholder="블록 제목 (비우면 제목 없이 나갑니다)"
            />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}
              className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30">↓</button>
            <button type="button" onClick={() => remove(i)}
              className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400">삭제</button>
          </div>

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

          {(b.type === "list" || b.type === "timetable" || b.type === "callout") && (
            <RowsEditor block={b} onChange={(items) => patch(i, { items } as Partial<ThemeBlock>)} />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted">블록 추가</span>
        {(Object.keys(THEME_BLOCK_LABELS) as ThemeBlockType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange([...blocks, emptyBlock(t)])}
            className="rounded border border-border px-3 py-1.5 text-xs"
          >
            + {THEME_BLOCK_LABELS[t]}
          </button>
        ))}
      </div>
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
    block.type === "timetable"
      ? [
          { key: "offset_min", label: "경과(분)", numeric: true, width: "w-24" },
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
          ⭐ 시각이 아니라 <strong>시작 후 경과 분</strong>을 적습니다. 그래야 11:30 회차든 19:30 회차든
          같은 내용으로 자동 계산됩니다.
        </p>
      )}

      {items.map((row, r) => (
        <div key={r} className="flex items-start gap-2">
          {cols.map((c) => (
            <input
              key={c.key}
              className={`${field} ${c.width ?? "flex-1"}`}
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
