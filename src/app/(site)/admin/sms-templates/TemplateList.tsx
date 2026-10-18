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
  solo: boolean;
};

type Group = "party" | "solo" | "etc";

/**
 * 템플릿을 탭으로 가른다. 노말모드 전용은 키가 '_solo_v2' 로 끝난다(smsV2.ts soloTemplateKey —
 * 노말 회차는 이 템플릿을 먼저 찾고, 없으면 파티 것을 쓴다). 나머지 회차 문자(_v2)는 파티,
 * 그 밖(쿠폰 등)은 기타.
 */
function groupOf(key: string): Group {
  if (key.endsWith("_solo_v2")) return "solo";
  if (key.endsWith("_v2")) return "party";
  return "etc";
}

const GROUPS: { id: Group; label: string; note: string }[] = [
  { id: "party", label: "파티모드", note: "파티모드와 모드가 없는 테마에 나가는 문자입니다." },
  {
    id: "solo",
    label: "노말모드",
    note: "노말모드 회차에 나가는 문자입니다. 여기 없는 문자(공석 안내 등)는 파티모드 문자가 나갑니다.",
  },
  { id: "etc", label: "쿠폰 · 기타", note: "회차와 관계없이 보내는 문자입니다." },
];

export type TemplateRow = {
  key: string;
  label: string;
  body: string;
  placeholders: string[];
  updatedAt: string;
};

const field = "rounded-md border border-border bg-background px-3 py-2 text-body-sm";

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
  const [group, setGroup] = useState<Group>("party");
  const [themeId, setThemeId] = useState(themes.find((t) => !t.solo)?.id ?? themes[0]?.id ?? "");
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];
  const shown = templates.filter((t) => groupOf(t.key) === group);
  const groupInfo = GROUPS.find((g) => g.id === group)!;

  // 탭을 바꾸면 미리보기 테마도 그 모드로 맞춘다 — 노말 문자를 파티 값으로 미리 보면 헷갈린다.
  function pickGroup(g: Group) {
    setGroup(g);
    if (g === "etc") return;
    const wantSolo = g === "solo";
    if (theme && theme.solo !== wantSolo) {
      const next = themes.find((t) => t.solo === wantSolo);
      if (next) setThemeId(next.id);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            onClick={() => pickGroup(g.id)}
            className={`rounded-md border px-3 py-1.5 text-label transition-colors ${
              group === g.id
                ? "border-line-strong bg-fill-strong text-foreground"
                : "border-line text-muted hover:bg-fill"
            }`}
          >
            {g.label} ({templates.filter((t) => groupOf(t.key) === g.id).length})
          </button>
        ))}
      </div>
      <p className="mb-4 text-body-sm text-muted">{groupInfo.note}</p>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <div>
          <label className="mb-1 block text-micro text-muted">미리보기 기준 테마</label>
          <select className={field} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {theme && (
          <p className="self-end pb-2 text-micro text-muted">
            가격·소요시간·장소·일시는 <strong className="text-foreground">{theme.name}</strong> 의
            실제 값입니다 — {theme.basis}.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {shown.length === 0 && (
          <div className="rounded-lg border border-border py-8 text-center text-muted">이 탭에 등록된 문자가 없습니다.</div>
        )}
        {shown.map((t) => (
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
