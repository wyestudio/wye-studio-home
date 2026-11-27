"use client";

import { MessageTemplateEditor } from "@/components/admin/MessageTemplateEditor";
import { GROUP_PLACEHOLDERS } from "@/lib/groupToolRules";
import { updateGroupMessage } from "../actions";

/**
 * 단체 안내 문자 문구 목록 — 일반 문자 템플릿과 같은 편집 부품(MessageTemplateEditor)을 쓴다.
 * 미리보기는 예시 값으로 그린다(실제 단체의 값은 단체 상세의 「설문 · 문자」 탭에서 본다).
 */
const LABELS = Object.fromEntries(Object.entries(GROUP_PLACEHOLDERS).map(([k, v]) => [k, v.label]));
const EXAMPLES = Object.fromEntries(Object.entries(GROUP_PLACEHOLDERS).map(([k, v]) => [k, v.example]));
const BLOCK_EXAMPLES = {
  lines: [
    { label: "애프터파티 2시간", amount: "100,000원" },
    { label: "근처 직장인 할인 10%", amount: "-68,800원" },
  ],
};
const BLOCK_HINTS = [{ name: "lines", label: "옵션 · 조정 줄(줄 수만큼 반복 · 없으면 통째로 빠짐)", fields: ["label", "amount"] }];

export function GroupMessageList({
  templates,
}: {
  templates: { key: string; label: string; body: string; placeholders: string[]; updatedAt: string }[];
}) {
  if (templates.length === 0) {
    return <p className="rounded-lg border border-border py-8 text-center text-body-sm text-muted">등록된 단체 안내 문구가 없습니다.</p>;
  }
  return (
    <div className="space-y-4">
      {templates.map((t) => (
        <MessageTemplateEditor
          key={t.key}
          templateKey={t.key}
          label={t.label}
          initialBody={t.body}
          // lines 는 블록 이름이라 치환값 목록에서는 뺀다(아래 블록 안내에 따로 나온다).
          placeholders={t.placeholders.filter((p) => p !== "lines")}
          updatedAt={t.updatedAt}
          labels={LABELS}
          examples={EXAMPLES}
          blockExamples={BLOCK_EXAMPLES}
          blockHints={t.placeholders.includes("lines") ? BLOCK_HINTS : []}
          previewNote="미리보기 (예시 값 — 실제 단체의 값은 단체 상세의 「설문 · 문자」 탭에서 봅니다)"
          blockNote="옵션 · 조정 줄 수만큼 반복되는 블록입니다. 줄이 하나도 없으면 블록이 통째로 빠집니다."
          onSave={updateGroupMessage}
        />
      ))}
    </div>
  );
}
