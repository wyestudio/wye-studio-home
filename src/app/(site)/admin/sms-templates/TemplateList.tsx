"use client";

import { useState } from "react";
import { MessageTemplateEditor } from "@/components/admin/MessageTemplateEditor";
import { PLACEHOLDER_INFO } from "./placeholderInfo";
import { updateSmsTemplate } from "./actions";

export type PreviewThemeOption = {
  id: string;
  name: string;
  examples: Record<string, string>;
  basis: string;
};

export type TemplateRow = {
  key: string;
  label: string;
  body: string;
  placeholders: string[];
  updatedAt: string;
};

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

const LABELS = Object.fromEntries(
  Object.entries(PLACEHOLDER_INFO).map(([k, v]) => [k, v.label])
);
const FALLBACK_EXAMPLES = Object.fromEntries(
  Object.entries(PLACEHOLDER_INFO).map(([k, v]) => [k, v.example])
);

/**
 * 문자 포맷 목록 + 미리보기 기준 테마 선택.
 *
 * ⚠️ 미리보기를 코드에 박아둔 예시값으로 그리면, 가격·소요시간이 실제와
 *    달라져 있을 때 "이 값으로 나가는 건가?" 하는 불안만 준다. 미리보기는
 *    잘못 나가는 걸 막으려고 있는 장치이므로, 고른 테마의 **실제 값**으로
 *    채운다.
 */
export function TemplateList({
  templates,
  themes,
}: {
  templates: TemplateRow[];
  themes: PreviewThemeOption[];
}) {
  const [themeId, setThemeId] = useState(themes[0]?.id ?? "");
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <div>
          <label className="mb-1 block text-xs text-muted">미리보기 기준 테마</label>
          <select className={field} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {theme && (
          <p className="self-end pb-2 text-xs text-muted">
            가격·소요시간·장소·일시는 <strong className="text-foreground">{theme.name}</strong> 의
            실제 값입니다 — {theme.basis}.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {templates.map((t) => (
          <MessageTemplateEditor
            key={t.key}
            templateKey={t.key}
            label={t.label}
            initialBody={t.body}
            placeholders={t.placeholders}
            updatedAt={t.updatedAt}
            labels={LABELS}
            // 고른 테마의 실제 값이 먼저다. 테마와 무관한 변수만 고정 예시로 채운다.
            examples={{ ...FALLBACK_EXAMPLES, ...(theme?.examples ?? {}) }}
            onSave={updateSmsTemplate}
          />
        ))}
      </div>
    </>
  );
}
