"use client";

import { useState } from "react";

export type ConsentState = {
  ageSelf: boolean;
  terms: boolean;
  pii: boolean;
  privacyPolicy: boolean;
  noRebooking: boolean;
  phoneCollection: boolean;
  proxyForGroup: boolean;
  photo: boolean;
  marketing: boolean;
};

export const EMPTY_CONSENTS: ConsentState = {
  ageSelf: false,
  terms: false,
  pii: false,
  privacyPolicy: false,
  noRebooking: false,
  phoneCollection: false,
  proxyForGroup: false,
  photo: false,
  marketing: false,
};

type Item = {
  key: keyof ConsentState;
  id: string;
  required: boolean;
  /** 2인 이상일 때만 보인다 */
  groupOnly?: boolean;
  /** 회차 최소 연령처럼 회차마다 달라지는 값이 들어가면 함수로 둔다. */
  label: React.ReactNode | ((minAge: number) => React.ReactNode);
  /** 펼쳐서 보여줄 요약. 오른쪽 '보기' 로 연다. */
  detail?: React.ReactNode;
  /** 별도 문서로 보낼 때. detail 대신 쓴다. */
  href?: string;
};

/**
 * 동의 항목. 문구는 8/29 회차 화면의 것을 그대로 옮겼다 —
 * 약관 조항 번호와 연결돼 있어 임의로 줄이면 안 된다.
 */
const ITEMS: Item[] = [
  {
    key: "ageSelf",
    id: "age-self",
    required: true,
    // 약관 제9조 1항 — 참가 연령은 회차 종료 시각에 따라 16세/19세로 갈린다.
    // 문구를 19세로 박아두면 16세 회차에서는 사실이 아닌 항목에 동의하게 된다.
    label: (minAge: number) => `만 ${minAge}세 이상이며 본인이 직접 신청합니다.`,
  },
  {
    key: "terms", id: "terms", required: true,
    label: "이용약관에 동의합니다.",
    detail: (
      <>
        참가 중 알게 된 <strong>문제·시나리오·정답 등 콘텐츠는 기간 제한 없이 외부에 공개·공유하지 않습니다.</strong>{" "}
        시설·장비 파손 시 실제 손해를 배상하며, 부적절한 행위 시 참여가 제한될 수 있습니다. (약관 제10·11조)
        <br />
        <a href="/terms" target="_blank" className="underline decoration-dotted underline-offset-2">
          이용약관 전문 보기
        </a>
      </>
    ),
  },
  {
    key: "pii", id: "pii", required: true,
    label: "개인정보 수집·이용에 동의합니다.",
    detail: (
      <>
        <strong>항목:</strong> 이름, 연락처, 예약정보, 성별, 출생년도, 방탈출 경험 횟수, 입금자명·환불계좌
        <br />
        <strong>목적:</strong> 예약 관리·현장 본인확인·팀 편성·결제/환불
        <br />
        <strong>보유:</strong> 행사 종료 후 5년. 필수항목 미동의 시 예약이 제한됩니다.
      </>
    ),
  },
  {
    key: "privacyPolicy", id: "privacy-policy", required: true,
    label: "개인정보처리방침을 확인했습니다.",
    href: "/privacy",
  },
  {
    key: "noRebooking", id: "no-rebooking", required: true,
    label: "동일 테마 재예약 불가를 확인했습니다.",
    detail: (
      <>
        팀 대항 방탈출 특성상 이미 참여한 테마는 정답을 알고 있어 공정성이 훼손됩니다.{" "}
        <strong>pre-open 테스트 참여 이력을 포함해,</strong> 이미 참여한 테마는 다시 신청할 수 없습니다.
        재참여를 원하시면 <strong>다른 테마</strong>를 선택해 주세요. (약관 제5조)
      </>
    ),
  },
  {
    key: "phoneCollection", id: "phone-collection", required: true,
    label: "1부 진행 중 휴대폰 수거·보관에 동의합니다.",
    detail: (
      <>
        공정성·몰입·콘텐츠 유출 방지를 위해 <strong>1부 시작 직전 수거 → 종료 직후 즉시 반환</strong>합니다.
        <br />• 개별 식별 봉투/보관함에 잠금 보관, 스태프 관리
        <br />• 긴급 시 스태프에게 요청하면 즉시 사용 가능
        <br />• 회사는 선량한 관리자의 주의를 다하되, 기존 파손·본인 부주의 손상은 책임지지 않음
      </>
    ),
  },
  {
    key: "proxyForGroup", id: "proxy-for-group", required: true, groupOnly: true,
    label: "모든 동행자에게 안내하고 동의를 받았습니다.",
    detail: (
      <>
        2인 이상 신청 시 대표 신청자는 각 동행자에게 이용약관·개인정보·휴대폰 수거·촬영 안내를 미리 전달하고
        동의를 받은 후 신청합니다. 동행자 정보 제공 및 동의에 대한 책임은 대표 신청자에게 있습니다. (방침 제3조)
      </>
    ),
  },
  {
    key: "photo", id: "photo", required: false,
    label: "사진·영상 촬영 및 활용에 동의합니다.",
    detail: (
      <>
        촬영물을 공식 SNS·홈페이지·홍보 콘텐츠에 활용합니다. 미동의 시 홍보 대상에서 제외하거나
        식별 불가 처리하며, 동의는 언제든 철회할 수 있습니다.
      </>
    ),
  },
  {
    key: "marketing", id: "marketing", required: false,
    label: "마케팅 정보(문자) 수신에 동의합니다. (이벤트·프로모션 안내)",
  },
];

export function visibleConsentItems(attendeeCount: number) {
  return ITEMS.filter((it) => !it.groupOnly || attendeeCount >= 2);
}

/** 필수 항목이 모두 체크됐는가. 동행자 대리 동의는 2인 이상일 때만 센다. */
export function allRequiredChecked(consents: ConsentState, attendeeCount: number): boolean {
  return visibleConsentItems(attendeeCount)
    .filter((it) => it.required)
    .every((it) => consents[it.key]);
}

/** 아직 체크 안 된 첫 필수 항목의 id. 포커스를 옮길 때 쓴다. */
export function firstMissingConsentId(consents: ConsentState, attendeeCount: number): string | null {
  const miss = visibleConsentItems(attendeeCount).find((it) => it.required && !consents[it.key]);
  return miss?.id ?? null;
}

/**
 * 약관 동의 단계.
 *
 * 필수와 선택을 **다른 상자로 갈라** 놓는다. 한 줄씩 [필수]/[선택] 을 붙여
 * 늘어놓던 때는 어디까지 꼭 눌러야 하는지가 한눈에 안 들어왔다.
 * 자세한 내용은 각 줄 오른쪽 끝의 '보기' 로 연다 — 줄 아래에 링크를 달면
 * 항목 자체보다 링크가 먼저 읽힌다.
 *
 * 맨 위 전체 동의는 그대로 둔다 — 대부분은 그것만 누른다.
 */
export function ConsentStep({
  attendeeCount,
  minAge,
  consents,
  onChange,
  showError,
}: {
  attendeeCount: number;
  /** 이 회차의 최소 연령. 동의 문구에 그대로 들어간다. */
  minAge: number;
  consents: ConsentState;
  onChange: (next: ConsentState) => void;
  showError: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const items = visibleConsentItems(attendeeCount);
  const allChecked = items.every((it) => consents[it.key]);

  function toggleAll() {
    const next = { ...consents };
    for (const it of items) next[it.key] = !allChecked;
    onChange(next);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function row(it: Item) {
    return (
      <div key={it.id}>
        <div className="flex items-start gap-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
            <input
              id={it.id}
              type="checkbox"
              className="mt-0.5 shrink-0 accent-[var(--glow)]"
              checked={consents[it.key]}
              onChange={() => onChange({ ...consents, [it.key]: !consents[it.key] })}
            />
            <span className="text-sm leading-snug">
              {typeof it.label === "function" ? it.label(minAge) : it.label}
            </span>
          </label>

          {it.href ? (
            <a
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 whitespace-nowrap text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              보기 ›
            </a>
          ) : it.detail ? (
            <button
              type="button"
              onClick={() => toggleExpand(it.id)}
              aria-expanded={expanded.has(it.id)}
              className="shrink-0 whitespace-nowrap text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              {expanded.has(it.id) ? "닫기 ˄" : "보기 ›"}
            </button>
          ) : null}
        </div>

        {it.detail && expanded.has(it.id) && (
          <div className="ml-7 mt-2 max-h-32 overflow-y-auto rounded border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-muted">
            {it.detail}
          </div>
        )}
      </div>
    );
  }

  function group(title: string, tone: "required" | "optional", list: Item[]) {
    if (list.length === 0) return null;
    return (
      <section className="rounded-lg border border-white/15 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 pb-2.5">
          <span className="text-sm font-bold">{title}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
              tone === "required"
                ? "bg-[var(--glow)]/15 text-glow"
                : "bg-white/10 text-muted"
            }`}
          >
            {tone === "required" ? "필수" : "선택"}
          </span>
        </div>
        <div className="space-y-3">{list.map(row)}</div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/20 bg-white/5 px-4 py-3.5">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="h-5 w-5 shrink-0 accent-[var(--glow)]"
        />
        <span className="text-sm font-bold">전체 동의합니다</span>
        <span className="text-xs text-muted">필수·선택 항목에 모두 동의합니다.</span>
      </label>

      {group("필수 동의", "required", items.filter((it) => it.required))}
      {group("선택 동의", "optional", items.filter((it) => !it.required))}

      {showError && !allRequiredChecked(consents, attendeeCount) && (
        <p className="text-sm text-danger">필수 항목에 모두 동의해주세요.</p>
      )}
    </div>
  );
}
