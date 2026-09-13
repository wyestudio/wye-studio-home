"use client";

import { useMemo, useState } from "react";
import { PlaceholderHints } from "@/components/admin/PlaceholderHints";
import { renderTemplate, type TemplateBlocks } from "@/lib/messageTemplate";

/** 반복 블록 안내 — 어떤 블록이 있고 그 안에서 어떤 변수를 쓸 수 있는지. */
export type BlockHint = {
  name: string;
  label: string;
  fields: string[];
};

/**
 * 문자·슬랙 포맷 편집기.
 *
 * 왼쪽에서 고치면 오른쪽 미리보기가 즉시 바뀐다. 미리보기는 **지금 실제로
 * 쓰이는 값**(고른 테마의 가격·시간, 샘플 참여자)으로 채운다 — 코드에 박힌
 * 옛 예시로 그리면 "이 값으로 나가나?" 하는 불안만 만든다.
 */
export function MessageTemplateEditor({
  templateKey,
  label,
  initialBody,
  placeholders,
  updatedAt,
  labels,
  examples,
  blockExamples = {},
  blockHints = [],
  onSave,
}: {
  templateKey: string;
  label: string;
  initialBody: string;
  placeholders: string[];
  updatedAt: string;
  labels?: Record<string, string>;
  examples: Record<string, string>;
  /** 미리보기에서 반복 블록을 채울 샘플 행 */
  blockExamples?: TemplateBlocks;
  blockHints?: BlockHint[];
  onSave: (key: string, body: string) => Promise<{ error?: string; success?: true }>;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = body !== savedBody;
  const preview = useMemo(
    () => renderTemplate(body, examples, blockExamples),
    [body, examples, blockExamples]
  );

  async function handleSave() {
    setIsLoading(true);
    setError(null);
    setSaved(false);
    try {
      const result = await onSave(templateKey, body);
      if (result.error) {
        setError(result.error);
      } else {
        setSavedBody(body);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-muted shrink-0">마지막 수정: {updatedAt}</span>
      </div>

      <div className="mb-3">
        <p className="text-xs text-muted mb-1.5">
          사용 가능한 변수 (hover로 설명 확인, 클릭하면 복사돼요)
        </p>
        <PlaceholderHints placeholders={placeholders} labels={labels} examples={examples} />
      </div>

      {blockHints.length > 0 && (
        <div className="mb-3 rounded border border-border/60 bg-surface/40 p-3">
          <p className="text-xs text-muted">
            인원수만큼 반복되는 블록입니다. 블록 안에 원하는 항목만 골라 쓰세요.
          </p>
          {blockHints.map((b) => (
            <div key={b.name} className="mt-2">
              <p className="font-mono text-xs text-glow">
                {`{{#${b.name}}}`} … {`{{/${b.name}}}`}{" "}
                <span className="font-sans text-muted">— {b.label}</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {b.fields.map((f) => `{{${f}}}`).join("  ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
            rows={14}
            className="w-full p-3 text-sm font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-glow"
          />

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSave}
              disabled={isLoading || !isDirty}
              className="px-3 py-1.5 text-xs bg-glow text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? "저장중..." : "저장"}
            </button>
            {saved && !isDirty && <span className="text-glow text-xs font-semibold">✓ 저장됨</span>}
            {isDirty && !isLoading && <span className="text-xs text-muted">저장되지 않은 변경사항</span>}
            {error && <span className="text-red-500 text-xs">{error}</span>}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-1.5">실제 발송 예시 (위에서 고른 테마의 실제 값 기준)</p>
          <div className="h-[calc(100%-1.375rem)] min-h-[280px] whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm text-foreground">
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
