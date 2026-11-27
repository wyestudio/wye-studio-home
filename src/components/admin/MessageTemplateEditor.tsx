"use client";

import { useEffect, useMemo, useState } from "react";
import { adminButtonClass, adminInputClass } from "@/components/admin/ui";
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
  previewNote = "실제 발송 예시 (위에서 고른 테마의 실제 값 기준)",
  blockNote = "인원수만큼 반복되는 블록입니다. 블록 안에 원하는 항목만 골라 쓰세요.",
  onSave,
  onDirtyChange,
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
  /** 미리보기 위의 설명. 테마 값으로 그리지 않는 화면(단체 안내 문구)은 바꿔 넣는다. */
  previewNote?: string;
  /** 반복 블록 안내. */
  blockNote?: string;
  onSave: (key: string, body: string) => Promise<{ error?: string; success?: true }>;
  /** 저장하지 않은 변경이 생기거나 없어질 때 알린다(목록의 「저장 안 됨」 표시용). 안정된 함수를 넘긴다. */
  onDirtyChange?: (key: string, dirty: boolean) => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = body !== savedBody;
  useEffect(() => {
    onDirtyChange?.(templateKey, isDirty);
  }, [onDirtyChange, templateKey, isDirty]);
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
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-h3 font-semibold text-foreground">{label}</h2>
        <span className="text-body-sm tabular-nums text-muted">마지막 수정: {updatedAt}</span>
      </div>

      <div className="mb-3">
        <p className="mb-1.5 text-body-sm text-muted">
          사용 가능한 변수 (hover로 설명 확인, 클릭하면 복사돼요)
        </p>
        <PlaceholderHints placeholders={placeholders} labels={labels} examples={examples} />
      </div>

      {blockHints.length > 0 && (
        <div className="mb-3 rounded-lg border border-border bg-fill-subtle p-3">
          <p className="text-body-sm text-muted">
            {blockNote}
          </p>
          {blockHints.map((b) => (
            <div key={b.name} className="mt-2">
              <p className="font-mono text-micro text-glow">
                {`{{#${b.name}}}`} … {`{{/${b.name}}}`}{" "}
                <span className="font-sans text-muted">— {b.label}</span>
              </p>
              <p className="mt-1 font-mono text-micro text-muted">
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
            aria-label={`${label} 본문`}
            className={`${adminInputClass} py-3 font-mono`}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleSave} disabled={isLoading || !isDirty} className={adminButtonClass("primary")}>
              {isLoading ? "저장 중…" : "저장"}
            </button>
            {saved && !isDirty && (
              <span role="status" className="text-body-sm font-semibold text-confirm">
                ✓ 저장됨
              </span>
            )}
            {isDirty && !isLoading && <span className="text-body-sm text-wait">저장되지 않은 변경사항</span>}
            {error && (
              <span role="alert" className="text-body-sm text-danger">
                {error}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="mb-1.5 text-body-sm text-muted">{previewNote}</p>
          {/* 왼쪽 입력칸과 키를 맞춘다(같은 줄의 높이를 다 채운다) */}
          <div className="min-h-72 flex-1 whitespace-pre-wrap break-words rounded-lg border border-border bg-fill-subtle p-3 text-body-sm text-foreground">
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
