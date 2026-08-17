"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

export type ConsentState = {
  ageSelf: boolean;
  terms: boolean;
  noRebooking: boolean;
  pii: boolean;
  phoneCollection: boolean;
  privacyPolicy: boolean;
  proxyForGroup: boolean;
  photo: boolean;
  marketing: boolean;
};

const REQUIRED_ITEMS = [
  "ageSelf",
  "terms",
  "pii",
  "privacyPolicy",
  "noRebooking",
  "phoneCollection",
  "proxyForGroup",
] as const;

const OPTIONAL_ITEMS = ["photo", "marketing"] as const;

export function ApplyConsent({
  partySize,
  value,
  onChange,
  isDatingSession = false,
}: {
  partySize: number;
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  isDatingSession?: boolean;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isGroupApply = partySize >= 2;
  const visibleRequiredItems = isGroupApply
    ? REQUIRED_ITEMS
    : REQUIRED_ITEMS.filter((item) => item !== "proxyForGroup");

  const allRequiredChecked = useMemo(
    () =>
      visibleRequiredItems.every((item) => {
        if (item === "proxyForGroup" && !isGroupApply) return true;
        return value[item as keyof ConsentState];
      }),
    [value, visibleRequiredItems, isGroupApply]
  );

  const allItemsChecked = useMemo(
    () =>
      allRequiredChecked &&
      OPTIONAL_ITEMS.every((item) => value[item as keyof ConsentState]),
    [allRequiredChecked, value]
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleAllRequiredChange = useCallback(() => {
    const next = { ...value };
    const newChecked = !allRequiredChecked;
    visibleRequiredItems.forEach((item) => {
      next[item as keyof ConsentState] = newChecked;
    });
    onChange(next);
  }, [value, allRequiredChecked, visibleRequiredItems, onChange]);

  const handleAllChange = useCallback(() => {
    const next = { ...value };
    const newChecked = !allItemsChecked;
    const allKeys = [...visibleRequiredItems, ...OPTIONAL_ITEMS];
    allKeys.forEach((item) => {
      next[item as keyof ConsentState] = newChecked;
    });
    onChange(next);
  }, [value, allItemsChecked, visibleRequiredItems, onChange]);

  const handleItemChange = useCallback(
    (key: string) => {
      onChange({
        ...value,
        [key]: !value[key as keyof ConsentState],
      });
    },
    [value, onChange]
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-base font-bold text-foreground">
          참가 전 안내사항
        </h2>
        <p className="mt-1 text-xs text-muted">약관 및 동의 사항을 확인해주세요.</p>
        {isDatingSession && (
          <p className="mt-2 text-xs text-muted">
            2부부터는 음주가 가능합니다. 만 19세 이상만 참가 가능하며 현장에서 신분증을 확인합니다.
          </p>
        )}
      </div>

      {/* 전체 동의 (필수 + 선택) */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-brand/10 border border-brand/30">
        <input
          type="checkbox"
          id="all-consent"
          checked={allItemsChecked}
          onChange={handleAllChange}
          className="mt-1 w-5 h-5 accent-brand cursor-pointer"
        />
        <label htmlFor="all-consent" className="flex-1 cursor-pointer">
          <span className="text-sm font-bold text-foreground">전체 동의합니다</span>
          <p className="text-xs text-muted mt-0.5">필수 및 선택 항목에 모두 동의합니다.</p>
        </label>
      </div>

      {/* 필수 항목 섹션 */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">필수 동의</h3>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={allRequiredChecked}
              onChange={handleAllRequiredChange}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-foreground">모두 동의</span>
          </label>
        </div>

        <div className="space-y-2">
          {/* 1. 만 19세 이상 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="age-self"
              checked={value.ageSelf}
              onChange={() => handleItemChange("ageSelf")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <label htmlFor="age-self" className="flex-1 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">
                만 19세 이상이며 본인이 직접 신청합니다.
              </span>
            </label>
          </div>

          {/* 2. 이용약관 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="terms"
              checked={value.terms}
              onChange={() => handleItemChange("terms")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <div className="flex-1 cursor-pointer">
              <label htmlFor="terms" className="text-xs font-semibold text-foreground block">
                이용약관에 동의합니다.
              </label>
              <button
                type="button"
                onClick={() => toggleExpanded("terms")}
                className="text-xs text-brand hover:text-glow font-semibold mt-1"
              >
                {expandedItems.has("terms") ? "닫기 ▲" : "자세히 ▼"}
              </button>
              {expandedItems.has("terms") && (
                <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                  참가 중 알게 된 <strong>문제·시나리오·정답 등 콘텐츠는 기간 제한 없이 외부에 공개·공유하지 않습니다.</strong> 시설·장비 파손 시 실제 손해를 배상하며, 부적절한 행위 시 참여가 제한될 수 있습니다. (약관 제10·11조)
                </div>
              )}
            </div>
          </div>

          {/* 3. 개인정보 수집·이용 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="pii"
              checked={value.pii}
              onChange={() => handleItemChange("pii")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <div className="flex-1 cursor-pointer">
              <label htmlFor="pii" className="text-xs font-semibold text-foreground block">
                개인정보 수집·이용에 동의합니다.
              </label>
              <button
                type="button"
                onClick={() => toggleExpanded("pii")}
                className="text-xs text-brand hover:text-glow font-semibold mt-1"
              >
                {expandedItems.has("pii") ? "닫기 ▲" : "자세히 ▼"}
              </button>
              {expandedItems.has("pii") && (
                <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                  <strong>항목:</strong> 이름, 연락처, 예약정보, 성별, 출생년도, 방탈출 경험 횟수, 입금자명·환불계좌<br />
                  <strong>목적:</strong> 예약 관리·현장 본인확인·팀 편성·결제/환불<br />
                  <strong>보유:</strong> 행사 종료 후 5년. 필수항목 미동의 시 예약이 제한됩니다.
                </div>
              )}
            </div>
          </div>

          {/* 4. 개인정보처리방침 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="privacy-policy"
              checked={value.privacyPolicy}
              onChange={() => handleItemChange("privacyPolicy")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <label htmlFor="privacy-policy" className="flex-1 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">
                개인정보처리방침을 확인했습니다.
              </span>
            </label>
          </div>

          {/* 5. 동일 테마 재예약 불가 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="no-rebooking"
              checked={value.noRebooking}
              onChange={() => handleItemChange("noRebooking")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <div className="flex-1 cursor-pointer">
              <label htmlFor="no-rebooking" className="text-xs font-semibold text-foreground block">
                동일 테마 재예약 불가를 확인했습니다.
              </label>
              <button
                type="button"
                onClick={() => toggleExpanded("no-rebooking")}
                className="text-xs text-brand hover:text-glow font-semibold mt-1"
              >
                {expandedItems.has("no-rebooking") ? "닫기 ▲" : "자세히 ▼"}
              </button>
              {expandedItems.has("no-rebooking") && (
                <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                  팀 대항 방탈출 특성상 이미 참가한 테마는 정답을 알고 있어 공정성이 훼손됩니다. <strong>pre-open 테스트 참가 이력을 포함해,</strong> 이미 참가한 테마는 다시 신청할 수 없습니다. 재참여를 원하시면 <strong>다른 테마</strong>를 선택해 주세요. (약관 제5조)
                </div>
              )}
            </div>
          </div>

          {/* 6. 휴대폰 수거·보관 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="phone-collection"
              checked={value.phoneCollection}
              onChange={() => handleItemChange("phoneCollection")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <div className="flex-1 cursor-pointer">
              <label htmlFor="phone-collection" className="text-xs font-semibold text-foreground block">
                1부 진행 중 휴대폰 수거·보관에 동의합니다.
              </label>
              <button
                type="button"
                onClick={() => toggleExpanded("phone-collection")}
                className="text-xs text-brand hover:text-glow font-semibold mt-1"
              >
                {expandedItems.has("phone-collection") ? "닫기 ▲" : "자세히 ▼"}
              </button>
              {expandedItems.has("phone-collection") && (
                <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                  공정성·몰입·콘텐츠 유출 방지를 위해 <strong>1부 시작 직전 수거 → 종료 직후 즉시 반환</strong>합니다.<br />
                  • 개별 식별 봉투/보관함에 잠금 보관, 스태프 관리<br />
                  • 긴급 시 스태프에게 요청하면 즉시 사용 가능<br />
                  • 회사는 선량한 관리자의 주의를 다하되, 기존 파손·본인 부주의 손상은 책임지지 않음
                </div>
              )}
            </div>
          </div>

          {/* 7. 동행자 대리 동의 (그룹만) */}
          {isGroupApply && (
            <div className="flex items-start gap-3 p-2">
              <input
                type="checkbox"
                id="proxy-for-group"
                checked={value.proxyForGroup}
                onChange={() => handleItemChange("proxyForGroup")}
                className="mt-1 w-4 h-4 accent-brand cursor-pointer"
              />
              <div className="flex-1 cursor-pointer">
                <label htmlFor="proxy-for-group" className="text-xs font-semibold text-foreground block">
                  모든 동행자에게 안내하고 동의를 받았습니다.
                </label>
                <button
                  type="button"
                  onClick={() => toggleExpanded("proxy-for-group")}
                  className="text-xs text-brand hover:text-glow font-semibold mt-1"
                >
                  {expandedItems.has("proxy-for-group") ? "닫기 ▲" : "자세히 ▼"}
                </button>
                {expandedItems.has("proxy-for-group") && (
                  <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                    2인 이상 신청 시 대표 신청자는 각 동행자에게 이용약관·개인정보·휴대폰 수거·촬영 안내를 미리 전달하고 동의를 받은 후 신청합니다. 동행자 정보 제공 및 동의에 대한 책임은 대표 신청자에게 있습니다. (방침 제3조)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 선택 항목 섹션 */}
      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-bold text-foreground mb-2">선택 동의</h3>
        <p className="text-xs text-muted mb-3">아래 항목은 동의하지 않아도 신청할 수 있습니다.</p>

        <div className="space-y-2">
          {/* 8. 사진·영상 촬영 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="photo"
              checked={value.photo}
              onChange={() => handleItemChange("photo")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <div className="flex-1 cursor-pointer">
              <label htmlFor="photo" className="text-xs font-semibold text-foreground block">
                사진·영상 촬영 및 활용에 동의합니다.
              </label>
              <button
                type="button"
                onClick={() => toggleExpanded("photo")}
                className="text-xs text-brand hover:text-glow font-semibold mt-1"
              >
                {expandedItems.has("photo") ? "닫기 ▲" : "자세히 ▼"}
              </button>
              {expandedItems.has("photo") && (
                <div className="mt-2 p-2 bg-surface rounded text-xs text-muted leading-relaxed max-h-[120px] overflow-y-auto">
                  촬영물을 공식 SNS·홈페이지·홍보 콘텐츠에 활용합니다. 미동의 시 홍보 대상에서 제외하거나 식별 불가 처리하며, 동의는 언제든 철회할 수 있습니다.
                </div>
              )}
            </div>
          </div>

          {/* 9. 마케팅 정보 수신 */}
          <div className="flex items-start gap-3 p-2">
            <input
              type="checkbox"
              id="marketing"
              checked={value.marketing}
              onChange={() => handleItemChange("marketing")}
              className="mt-1 w-4 h-4 accent-brand cursor-pointer"
            />
            <label htmlFor="marketing" className="flex-1 cursor-pointer">
              <span className="text-xs font-semibold text-foreground">
                마케팅 정보(문자) 수신에 동의합니다.
              </span>
              <span className="text-xs text-muted ml-1">(이벤트·프로모션 안내)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
