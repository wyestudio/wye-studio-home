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
  // 조건 덩어리 — 미리보기에서는 둘 다 한 번씩 보여준다(실제 문자에는 둘 중 하나만 나온다).
  deposit: [{}],
  fullpay: [{}],
};
const BLOCK_HINTS = [
  { name: "lines", label: "옵션 · 조정 줄(줄 수만큼 반복 · 없으면 통째로 빠짐)", fields: ["label", "amount"] },
  { name: "deposit", label: "예약금 30% 로 안내할 때만 나오는 덩어리", fields: ["deposit_suggest", "balance_suggest"] },
  { name: "fullpay", label: "전액 입금으로 안내할 때만 나오는 덩어리(행사 7일 이내 + 계좌이체 + 회사가 아닌 단체)", fields: ["total"] },
];
const BLOCK_NAMES = BLOCK_HINTS.map((b) => b.name);

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
          // 덩어리 이름(lines · deposit · fullpay)은 치환값 목록에서 뺀다(아래 덩어리 안내에 따로 나온다).
          placeholders={t.placeholders.filter((p) => !BLOCK_NAMES.includes(p))}
          updatedAt={t.updatedAt}
          labels={LABELS}
          examples={EXAMPLES}
          blockExamples={BLOCK_EXAMPLES}
          blockHints={BLOCK_HINTS.filter((b) => t.placeholders.includes(b.name))}
          previewNote="미리보기 (예시 값 — 실제 단체의 값은 단체 상세의 「설문 · 문자」 탭에서 봅니다)"
          blockNote="{{#이름}} 과 {{/이름}} 사이는 덩어리입니다. 조건에 맞을 때만 나오거나(예약금 · 전액 안내) 줄 수만큼 반복됩니다(옵션 · 조정)."
          onSave={updateGroupMessage}
        />
      ))}
    </div>
  );
}
