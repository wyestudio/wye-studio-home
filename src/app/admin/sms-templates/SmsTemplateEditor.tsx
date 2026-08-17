"use client";

import { useState } from "react";
import { updateSmsTemplate } from "./actions";

export function SmsTemplateEditor({
  templateKey,
  label,
  initialBody,
  placeholders,
  updatedAt,
}: {
  templateKey: string;
  label: string;
  initialBody: string;
  placeholders: string[];
  updatedAt: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = body !== savedBody;

  async function handleSave() {
    setIsLoading(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateSmsTemplate(templateKey, body);
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
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h2 className="font-semibold text-foreground">{label}</h2>
          <p className="text-xs text-muted mt-1">
            사용 가능한 변수: {placeholders.map((p) => `{{${p}}}`).join(", ")}
          </p>
        </div>
        <span className="text-xs text-muted shrink-0">마지막 수정: {updatedAt}</span>
      </div>

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        rows={12}
        className="w-full mt-2 p-3 text-sm font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-glow"
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
  );
}
