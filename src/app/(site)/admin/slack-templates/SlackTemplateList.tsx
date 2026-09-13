"use client";

import { useMemo, useState } from "react";
import { MessageTemplateEditor } from "@/components/admin/MessageTemplateEditor";
import { updateSlackTemplate } from "./actions";
import {
  SLACK_PLACEHOLDER_LABELS,
  BLOCK_HINTS_BY_KEY,
  sampleBlocks,
} from "./slackPlaceholders";

export type SlackTemplateRow = {
  key: string;
  label: string;
  body: string;
  placeholders: string[];
  updatedAt: string;
};

export type PreviewThemeOption = {
  id: string;
  name: string;
  examples: Record<string, string>;
  basis: string;
};

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/** 테마와 무관한 값들. 미리보기에서만 쓰는 샘플이다. */
const SAMPLE_VARS: Record<string, string> = {
  confirmation_code: "384920",
  headcount: "3",
  depositor_name: "홍길동",
  status: "확정",
  status_suffix: "",
  discount: "5,000원",
  discount_suffix: " (쿠폰 −5,000원)",
  created_at: "2026.09.26 14:02",
  payment_deadline: "2026.09.26 14:32",
  confirmed_count: "12",
  waiting_count: "2",
  notes: "",
  rep_name: "홍길동",
  rep_phone: "010-1234-5678",
  rep_nickname: "길동",
  rep_birth_year: "1996",
  rep_gender: "남",
  rep_experience: "10~30회",
  cancelled_by: "고객",
  refund_account_block: "은행: 카카오뱅크\n계좌: 3333-05-2843942\n예금주: 홍길동",
  refund_bank: "카카오뱅크",
  refund_account: "3333-05-2843942",
  refund_holder: "홍길동",
  count: "2",
  total_amount: "186,000원",
  deadline_minutes: "30",
  overflow_line: "",
  overflow_count: "0",
  admin_url: "https://admin.wouldyouescape.com/applications?status=confirmed&payment=pending",
};

/**
 * 슬랙 포맷 목록.
 *
 * 문자 포맷 화면과 같은 구조다 — 미리보기 기준 테마를 고르면 금액·일시가 그
 * 테마의 실제 값으로 채워진다. 참여자는 실제 신청자가 아니라 샘플 3명이다
 * (포맷 보려고 연 화면에서 남의 개인정보가 보일 이유가 없다).
 */
export function SlackTemplateList({
  templates,
  themes,
}: {
  templates: SlackTemplateRow[];
  themes: PreviewThemeOption[];
}) {
  const [themeId, setThemeId] = useState(themes[0]?.id ?? "");
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];

  // 렌더마다 새 객체를 만들면 편집기의 미리보기 memo 가 매번 깨진다.
  const blocksByKey = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.key, sampleBlocks(t.key)])),
    [templates]
  );

  const examples = useMemo(() => {
    const t = theme?.examples ?? {};
    return {
      ...SAMPLE_VARS,
      theme_name: t.theme_name ?? "바-ㅇ탈출",
      session_label: `${t.event_date ?? ""} ${t.start_time ?? ""}`.trim(),
      amount: t.price ?? "124,000원",
      base_amount: t.price ?? "124,000원",
      refund_amount: t.refund_amount ?? "124,000원",
    };
  }, [theme]);

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
            금액·일시는 <strong className="text-foreground">{theme.name}</strong> 의 실제 값입니다 —{" "}
            {theme.basis}. 참여자는 샘플 3명(대표 1 · 동행 2)입니다.
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
            labels={SLACK_PLACEHOLDER_LABELS}
            examples={examples}
            blockExamples={blocksByKey[t.key]}
            blockHints={BLOCK_HINTS_BY_KEY[t.key] ?? []}
            onSave={updateSlackTemplate}
          />
        ))}
      </div>
    </>
  );
}
