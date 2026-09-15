"use client";

import { useState } from "react";
import { GENRE_MAX_COUNT, GENRE_MAX_LENGTH } from "@/types/catalog";
import { Chevron } from "@/components/ui/Chevron";

/**
 * 장르 태그 입력. 적고 Enter(또는 쉼표)로 하나씩 붙이고, × 로 뗀다.
 *
 * '#로맨스' 로 적어도 # 는 떼고 담는다 — 화면이 # 를 붙여 그린다.
 * 붙인 순서가 곧 화면에 보이는 순서라 좌우 화살표로 옮길 수 있게 했다.
 */
export function GenreInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= GENRE_MAX_COUNT;

  function add(raw: string) {
    // 붙여넣기로 '#문제방 #경쟁' 을 한 번에 넣어도 나눠 담는다.
    const tags = raw
      .split(/[,#\s]+/)
      .map((t) => t.trim().slice(0, GENRE_MAX_LENGTH))
      .filter(Boolean);
    const next = [...value];
    for (const t of tags) {
      if (next.length >= GENRE_MAX_COUNT) break;
      if (!next.includes(t)) next.push(t);
    }
    onChange(next);
    setDraft("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded border border-border bg-background px-2 py-1.5">
        {value.map((g, i) => (
          <span
            key={g}
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-white/5 py-0.5 pl-1 pr-1 text-xs"
          >
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="p-0.5 text-muted disabled:opacity-20"
              aria-label={`${g} 앞으로`}
            >
              <Chevron dir="left" className="h-3 w-3" />
            </button>
            <span className="font-bold">#{g}</span>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              className="p-0.5 text-muted disabled:opacity-20"
              aria-label={`${g} 뒤로`}
            >
              <Chevron dir="right" className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== g))}
              className="px-1 text-muted hover:text-red-400"
              aria-label={`${g} 삭제`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
          value={draft}
          disabled={full}
          maxLength={GENRE_MAX_LENGTH + 1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter 는 조합 확정용이다. 여기서 받으면 마지막 글자가 두 번 들어간다.
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={full ? `최대 ${GENRE_MAX_COUNT}개` : value.length ? "추가…" : "문제방 입력 후 Enter"}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Enter 나 쉼표로 하나씩 추가합니다. 최대 {GENRE_MAX_COUNT}개, 하나당 {GENRE_MAX_LENGTH}자.
        태그 양옆 화살표로 순서를 바꿀 수 있어요.
      </p>
    </div>
  );
}
