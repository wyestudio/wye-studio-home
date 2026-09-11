"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";
import { Select } from "@/components/ui/Select";
import { ApplyStepper } from "@/components/apply/ApplyStepper";
import { AttendeeTabs } from "@/components/apply/AttendeeTabs";
import { ValidationToast } from "@/components/apply/ValidationToast";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import {
  getValidationErrorMessage,
  isValidKoreanName,
  isValidNickname,
} from "@/lib/validation";
import { normalizeCouponCode } from "@/lib/coupon";
import {
  applyToSession,
  checkCoupon,
  checkNickname,
  checkThemeConflicts,
  type AttendeeInput,
  type ApplyResult,
  type CouponPreview,
} from "./actions";
import { AttendeeFields, type NicknameCheckState } from "./AttendeeFields";
import {
  ConsentStep,
  EMPTY_CONSENTS,
  allRequiredChecked,
  firstMissingConsentId,
  type ConsentState,
} from "./ConsentStep";
import { ApplyComplete } from "./ApplyComplete";

const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50";
const fieldInvalid =
  "w-full rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger outline-none";
const label = "block text-xs font-medium text-muted mb-1.5";

/** 인원 선택 상한. 테마에 max_group_size 가 있으면 그쪽이 우선이다. */
const DEFAULT_MAX_ATTENDEES = 8;

function emptyAttendee(): AttendeeInput {
  return { name: "", phone: "", birth_year: 0, nickname: "", gender: "", experience_range: "" };
}

type FieldError = { field: string; message: string };

/**
 * 참가 신청 — 정보입력 · 약관동의 · 제출 3단계.
 *
 * 다음 단계로는 현재 단계를 통과해야만 갈 수 있고, 지나온 단계는 진행 표시줄에서
 * 눌러 돌아갈 수 있다. 검사 항목은 8/29 회차 폼의 것을 그대로 옮기되 테마 구조에
 * 맞춰 조정했다 — 출생연도는 고정 연도 범위가 아니라 회차의 최소 연령으로 판정한다.
 */
export function ApplyForm({
  sessionId,
  themeName,
  sessionLabel,
  minAge,
  maxGroupSize,
  tiers,
  accentColor,
  themeId,
  initialCouponCode,
  categoryName,
  backHref,
}: {
  sessionId: string;
  themeId: string;
  initialCouponCode: string;
  /** 테마명 옆 알약 배지. 없으면 배지를 안 그린다. */
  categoryName: string | null;
  /** 날짜 다시 선택 링크. 제출이 끝나면 감춘다. */
  backHref: string;
  themeName: string;
  sessionLabel: string;
  minAge: number;
  maxGroupSize: number | null;
  tiers: ThemePriceTier[];
  accentColor: string;
}) {
  const [step, setStep] = useState(0);
  const [attendees, setAttendees] = useState<AttendeeInput[]>([emptyAttendee()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [consents, setConsents] = useState<ConsentState>({ ...EMPTY_CONSENTS });
  const [depositorName, setDepositorName] = useState("");
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [nicknameChecks, setNicknameChecks] = useState<Record<number, NicknameCheckState>>({});
  const [conflictPhones, setConflictPhones] = useState<Set<string>>(new Set());
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<ApplyResult, { success: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const headcount = attendees.length;
  const maxAttendees = maxGroupSize ?? DEFAULT_MAX_ATTENDEES;

  // 출생연도 선택지는 회차의 min_age 로 매번 계산한다.
  // 연도를 상수로 박으면 해가 바뀔 때 사람이 고쳐야 한다.
  const thisYear = new Date().getFullYear();
  const maxBirthYear = thisYear - (minAge + 1);
  const birthYears = useMemo(
    () => Array.from({ length: 70 }, (_, i) => maxBirthYear - i),
    [maxBirthYear]
  );

  const unitPrice = resolveUnitPrice(tiers, headcount);
  const total = unitPrice !== null ? unitPrice * headcount : null;
  const appliedDiscount = coupon?.ok ? coupon.discountKrw : 0;
  const payable = total !== null ? Math.max(0, total - appliedDiscount) : null;

  // ── 검사 ──────────────────────────────────────────────────
  const validateStep1 = useCallback((): FieldError[] => {
    const errors: FieldError[] = [];

    attendees.forEach((a, i) => {
      if (!a.name.trim()) {
        errors.push({ field: `attendee-${i}-name`, message: getValidationErrorMessage("name", "required") });
      } else if (!isValidKoreanName(a.name)) {
        errors.push({ field: `attendee-${i}-name`, message: getValidationErrorMessage("name", "invalid") });
      }

      const digits = phoneDigits(a.phone);
      if (!digits) {
        errors.push({ field: `attendee-${i}-phone`, message: getValidationErrorMessage("phone", "required") });
      } else if (!isValidPhoneDigits(digits)) {
        errors.push({ field: `attendee-${i}-phone`, message: getValidationErrorMessage("phone", "invalid") });
      }

      if (!a.birth_year) {
        errors.push({ field: `attendee-${i}-birthYear`, message: getValidationErrorMessage("birthYear", "required") });
      } else if (a.birth_year > maxBirthYear) {
        errors.push({
          field: `attendee-${i}-birthYear`,
          message: `이 회차는 만 ${minAge}세 이상만 신청할 수 있어요.`,
        });
      }

      if (!a.experience_range) {
        errors.push({
          field: `attendee-${i}-experienceRange`,
          message: getValidationErrorMessage("experienceRange", "required"),
        });
      }

      if (a.nickname.trim() && !isValidNickname(a.nickname)) {
        errors.push({ field: `attendee-${i}-nickname`, message: getValidationErrorMessage("nickname", "invalid") });
      }
    });

    // 그룹 안 전화번호 중복
    const phoneCount = new Map<string, number>();
    for (const a of attendees) {
      const d = phoneDigits(a.phone);
      if (d) phoneCount.set(d, (phoneCount.get(d) ?? 0) + 1);
    }
    attendees.forEach((a, i) => {
      const d = phoneDigits(a.phone);
      if (d && (phoneCount.get(d) ?? 0) > 1) {
        errors.push({
          field: `attendee-${i}-phone`,
          message: "그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.",
        });
      }
    });

    // 그룹 안 닉네임 중복 (빈 값은 여러 명이 비워도 중복이 아니다)
    const nickCount = new Map<string, number>();
    for (const a of attendees) {
      const n = a.nickname.trim();
      if (n) nickCount.set(n, (nickCount.get(n) ?? 0) + 1);
    }
    attendees.forEach((a, i) => {
      const n = a.nickname.trim();
      if (n && (nickCount.get(n) ?? 0) > 1) {
        errors.push({
          field: `attendee-${i}-nickname`,
          message: "그룹 안에서 닉네임이 중복돼요. 참여자별로 다른 닉네임을 입력해주세요.",
        });
      }
    });

    return errors;
  }, [attendees, maxBirthYear, minAge]);

  const validateStep3 = useCallback((): FieldError[] => {
    const errors: FieldError[] = [];
    if (!depositorName.trim()) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "required") });
    } else if (!isValidKoreanName(depositorName)) {
      errors.push({ field: "depositorName", message: getValidationErrorMessage("depositorName", "invalid") });
    }
    return errors;
  }, [depositorName]);

  const step1Errors = useMemo(
    () => (submitAttempted && step === 0 ? validateStep1() : []),
    [submitAttempted, step, validateStep1]
  );
  const step3Errors = useMemo(
    () => (submitAttempted && step === 2 ? validateStep3() : []),
    [submitAttempted, step, validateStep3]
  );

  const errorIndexes = useMemo(() => {
    const set = new Set<number>();
    for (const e of step1Errors) {
      const m = /^attendee-(\d+)-/.exec(e.field);
      if (m) set.add(Number(m[1]));
    }
    attendees.forEach((a, i) => {
      if (conflictPhones.has(phoneDigits(a.phone))) set.add(i);
    });
    return set;
  }, [step1Errors, attendees, conflictPhones]);

  // 단계가 바뀌면 위로.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /**
   * 오류가 난 칸으로 데려간다.
   *
   * ⚠️ state + effect 로 하면 "effect 안에서 setState" 가 되어 렌더가 한 번 더 돈다.
   *    화면이 그려진 뒤 DOM 을 만지기만 하면 되는 일이라 다음 틱이면 충분하다.
   * ⚠️ requestAnimationFrame 을 쓰면 안 된다 — 탭이 뒤에 있을 때는 콜백이 아예
   *    돌지 않아 포커스가 조용히 사라진다(실제로 그랬다). setTimeout 은 돈다.
   *    참여자 탭을 바꾸는 경우 대상 칸이 아직 안 그려져 있어 한 틱을 기다려야 한다.
   */
  function focusField(id: string) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus?.({ preventScroll: true });
    }, 0);
  }

  // ── 조작 ──────────────────────────────────────────────────
  function setCount(count: number) {
    setActiveIndex((prev) => Math.min(prev, count - 1));
    setCoupon(null); // 인원이 바뀌면 정가가 바뀐다. 정률 쿠폰은 할인액도 달라진다.
    setAttendees((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(emptyAttendee());
      next.length = count;
      return next;
    });
  }

  function patchAttendee(i: number, patch: Partial<AttendeeInput>) {
    setAttendees((cur) => cur.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
    if ("nickname" in patch) setNicknameChecks((prev) => ({ ...prev, [i]: "idle" }));
    if ("phone" in patch) setConflictPhones(new Set());
  }

  async function runNicknameCheck(i: number) {
    const nickname = attendees[i].nickname;
    if (!nickname.trim() || !isValidNickname(nickname)) return;
    setNicknameChecks((prev) => ({ ...prev, [i]: "checking" }));
    const res = await checkNickname(sessionId, nickname);
    setNicknameChecks((prev) => ({
      ...prev,
      [i]: "error" in res ? "error" : res.available ? "available" : "taken",
    }));
  }

  async function verifyCoupon() {
    if (total === null) return;
    setCouponChecking(true);
    const result = await checkCoupon({
      code: couponCode,
      themeId,
      headcount,
      baseAmountKrw: total,
      phone: phoneDigits(attendees[0]?.phone ?? ""),
    });
    setCouponChecking(false);
    setCoupon(result);
  }

  function focusFirstStep1Error(errors: FieldError[]) {
    const order = ["name", "phone", "birthYear", "experienceRange", "nickname"];
    let best: { index: number; priority: number } | null = null;
    for (const e of errors) {
      const m = /^attendee-(\d+)-(.+)$/.exec(e.field);
      if (!m) continue;
      const idx = Number(m[1]);
      const priority = order.indexOf(m[2]);
      if (priority === -1) continue;
      if (!best || idx < best.index || (idx === best.index && priority < best.priority)) {
        best = { index: idx, priority };
      }
    }
    if (!best) return;
    setActiveIndex(best.index);
    setToast(best.index > 0 ? "동행자 정보를 확인해주세요." : "신청자 정보를 확인해주세요.");
    focusField(`attendee-${best.index}-${order[best.priority]}`);
  }

  async function goNext() {
    setError(null);

    if (step === 0) {
      const errors = validateStep1();
      if (errors.length > 0) {
        setSubmitAttempted(true);
        focusFirstStep1Error(errors);
        return;
      }

      const takenIndex = attendees.findIndex((_, i) => nicknameChecks[i] === "taken");
      if (takenIndex !== -1) {
        setSubmitAttempted(true);
        setActiveIndex(takenIndex);
        setToast("이미 사용 중인 닉네임이 있어요. 다른 닉네임으로 바꿔주세요.");
        focusField(`attendee-${takenIndex}-nickname`);
        return;
      }

      // 같은 테마 중복 신청은 제출 전에 미리 걸러준다.
      setCheckingConflicts(true);
      const result = await checkThemeConflicts(attendees.map((a) => a.phone), sessionId);
      setCheckingConflicts(false);

      if (!("error" in result) && result.conflictPhones.length > 0) {
        setConflictPhones(new Set(result.conflictPhones));
        setSubmitAttempted(true);
        setToast("같은 테마에 이미 신청하신 분이 포함되어 있어요.");
        const idx = attendees.findIndex((a) => result.conflictPhones.includes(phoneDigits(a.phone)));
        if (idx !== -1) {
          setActiveIndex(idx);
          focusField(`attendee-${idx}-phone`);
        }
        return;
      }

      setConflictPhones(new Set());
      setSubmitAttempted(false);
      setStep(1);
      return;
    }

    if (step === 1) {
      if (!allRequiredChecked(consents, headcount)) {
        setSubmitAttempted(true);
        setToast("약관 동의를 확인해주세요.");
        const id = firstMissingConsentId(consents, headcount);
        if (id) focusField(id);
        return;
      }
      setSubmitAttempted(false);
      setStep(2);
      return;
    }

    const errors = validateStep3();
    if (errors.length > 0) {
      setSubmitAttempted(true);
      setToast(errors[0].message);
      focusField(errors[0].field);
      return;
    }
    submit();
  }

  function submit() {
    startTransition(async () => {
      const res = await applyToSession({
        sessionId,
        // 확인을 통과한 쿠폰만 보낸다. 입력만 해두고 적용을 안 눌렀으면 할인 없이
        // 신청되는 게 맞다 — 화면에 안 보이던 할인이 붙는 게 더 혼란스럽다.
        couponCode: coupon?.ok ? coupon.code : "",
        depositorName,
        attendees: attendees.map((a) => ({ ...a, phone: phoneDigits(a.phone) })),
        notes: "",
        consentRequired: allRequiredChecked(consents, headcount),
        // 기존 폼과 같은 기준 — 선택 항목을 '전부' 동의했을 때만 참이다.
        consentOptional: consents.photo && consents.marketing,
        consentPhoto: consents.photo,
        consentMarketing: consents.marketing,
      });
      if ("error" in res) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setDone(res);
      }
    });
  }

  if (done) {
    // 제출이 끝나면 '날짜 다시 선택' 을 감춘다. 이미 접수된 뒤라 돌아갈 곳이 아니다.
    return (
      <ApplyComplete
        result={done}
        themeName={themeName}
        sessionLabel={sessionLabel}
        depositorName={depositorName}
        attendees={attendees.map((a) => ({ ...a, phone: phoneDigits(a.phone) }))}
        accentColor={accentColor}
      />
    );
  }

  const errOf = (list: FieldError[], f: string) => list.find((e) => e.field === f)?.message;
  const busy = pending || checkingConflicts;

  return (
    <>
      <ValidationToast message={toast} onClose={() => setToast(null)} />

      <div className="mb-4">
        <a href={backHref} className="text-sm text-muted underline">
          ← 날짜 다시 선택
        </a>
      </div>
      <h1 className="mb-4 text-2xl font-extrabold">참여 신청</h1>

      <ApplyStepper
        accentColor={accentColor}
        currentStep={step}
        onStepChange={(s) => {
          if (s < step) {
            setStep(s);
            setSubmitAttempted(false);
          }
        }}
      />

      <div className="space-y-6 py-8 pb-28">
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* ── 회차 요약 ── */}
        <div className="rounded-lg border border-white/15 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-semibold">{themeName}</p>
            {categoryName && (
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                style={{
                  color: accentColor,
                  borderColor: `${accentColor}59`,
                  backgroundColor: `${accentColor}1f`,
                }}
              >
                {categoryName}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{sessionLabel}</p>
        </div>

        {/* ══ 1. 정보입력 ══ */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm font-bold text-danger">
              <span className="shrink-0" aria-hidden>⚠️</span>
              <span>참여 시 신분증 검사가 진행됩니다. 정확한 정보를 입력해주세요.</span>
            </div>

            <div>
              <label className={label} htmlFor="attendeeCount">인원</label>
              <Select
                id="attendeeCount"
                variant="glass"
                value={String(headcount)}
                onChange={(v) => setCount(Number(v))}
                options={Array.from({ length: maxAttendees }, (_, i) => i + 1).map((n) => ({
                  value: String(n),
                  label: `${n}명`,
                }))}
              />
            </div>

            <AttendeeTabs
              count={headcount}
              activeIndex={activeIndex}
              errorIndexes={errorIndexes}
              onSelect={setActiveIndex}
            />

            {attendees[activeIndex] && (
              <AttendeeFields
                index={activeIndex}
                attendee={attendees[activeIndex]}
                attendeeCount={headcount}
                birthYears={birthYears}
                minAge={minAge}
                isConflict={conflictPhones.has(phoneDigits(attendees[activeIndex].phone))}
                conflictReason={conflictPhones.size > 0 ? "theme" : null}
                nicknameCheckState={nicknameChecks[activeIndex] ?? "idle"}
                errors={{
                  name: errOf(step1Errors, `attendee-${activeIndex}-name`),
                  phone: errOf(step1Errors, `attendee-${activeIndex}-phone`),
                  birthYear: errOf(step1Errors, `attendee-${activeIndex}-birthYear`),
                  experienceRange: errOf(step1Errors, `attendee-${activeIndex}-experienceRange`),
                  nickname: errOf(step1Errors, `attendee-${activeIndex}-nickname`),
                }}
                onChange={(patch) => patchAttendee(activeIndex, patch)}
                onNicknameCheck={() => runNicknameCheck(activeIndex)}
              />
            )}
          </div>
        )}

        {/* ══ 2. 약관동의 ══ */}
        {step === 1 && (
          <ConsentStep
            attendeeCount={headcount}
            consents={consents}
            onChange={setConsents}
            showError={submitAttempted}
          />
        )}

        {/* ══ 3. 제출 ══ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/15 bg-white/5 p-4">
              {unitPrice !== null && total !== null && payable !== null ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted">
                      {headcount}명 × {formatKrw(unitPrice)}
                    </span>
                    <span
                      className={appliedDiscount > 0 ? "text-sm text-muted line-through" : "text-2xl font-extrabold"}
                      style={appliedDiscount > 0 ? undefined : { color: accentColor }}
                    >
                      {formatKrw(total)}
                    </span>
                  </div>

                  {appliedDiscount > 0 && (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between text-sm">
                        <span className="text-muted">쿠폰 할인</span>
                        <span className="text-glow">− {formatKrw(appliedDiscount)}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
                        <span className="text-sm font-semibold">입금하실 금액</span>
                        <span className="text-2xl font-extrabold" style={{ color: accentColor }}>
                          {formatKrw(payable)}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">요금 정보를 불러올 수 없습니다.</p>
              )}
            </div>

            {/* 입력란은 하나의 카드로 묶는다 */}
            <div className="space-y-4 rounded-lg border border-white/15 p-4">
              <div>
                <label className={label} htmlFor="couponCode">쿠폰 코드</label>
                <div className="flex items-center gap-2">
                  {[0, 1].map((half) => (
                    <div key={half} className="contents">
                      {half === 1 && <span className="text-muted">-</span>}
                      <input
                        id={half === 0 ? "couponCode" : "couponCode2"}
                        className={`${field} text-center font-mono uppercase tracking-widest`}
                        value={couponCode.slice(half * 4, half * 4 + 4)}
                        maxLength={4}
                        placeholder={half === 0 ? "XXXX" : "XXXX"}
                        disabled={coupon?.ok}
                        onChange={(e) => {
                          const part = normalizeCouponCode(e.target.value).slice(0, 4);
                          const next =
                            half === 0 ? part + couponCode.slice(4) : couponCode.slice(0, 4) + part;
                          setCouponCode(next.slice(0, 8));
                          setCoupon(null); // 코드를 고치면 이전 적용은 무효다
                          if (part.length === 4 && half === 0) {
                            document.getElementById("couponCode2")?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && e.currentTarget.value === "" && half === 1) {
                            document.getElementById("couponCode")?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          // 어느 칸에 붙여넣든 앞에서부터 4자씩 나눠 담는다.
                          // 문자로 받은 코드는 M0EH-EVG1 처럼 하이픈이 섞여 있다.
                          const pasted = normalizeCouponCode(e.clipboardData.getData("text"));
                          if (!pasted) return;
                          e.preventDefault();
                          setCouponCode(pasted.slice(0, 8));
                          setCoupon(null);
                        }}
                      />
                    </div>
                  ))}
                  {coupon?.ok ? (
                    <button
                      type="button"
                      onClick={() => { setCoupon(null); setCouponCode(""); }}
                      className="shrink-0 self-stretch rounded-lg border border-white/20 px-4 py-2.5 text-sm text-muted"
                    >
                      해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={verifyCoupon}
                      disabled={couponChecking || !couponCode || total === null}
                      className="shrink-0 self-stretch rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      {couponChecking ? "확인 중…" : "적용"}
                    </button>
                  )}
                </div>
                {coupon?.ok ? (
                  <p className="mt-1.5 text-xs text-glow">
                    ✓ {coupon.campaignName} 적용됨 — {formatKrw(coupon.discountKrw)} 할인
                  </p>
                ) : coupon ? (
                  <p className="mt-1.5 text-xs text-amber-400">{coupon.reason}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted">
                    쿠폰이 있으시면 코드를 입력하고 적용을 눌러주세요. 신청 1건에 1장 사용할 수 있어요.
                  </p>
                )}
              </div>

              {/* ⭐ 입금자명 — 입금 자동 확인의 성패가 여기 달려 있다 */}
              <div>
                <label className={label} htmlFor="depositorName">입금자명 *</label>
                <input
                  id="depositorName"
                  className={errOf(step3Errors, "depositorName") ? fieldInvalid : field}
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="실제로 입금하실 분의 성함"
                />
                {errOf(step3Errors, "depositorName") && (
                  <p className="mt-1 text-[11px] text-danger">{errOf(step3Errors, "depositorName")}</p>
                )}
                <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
                  <p className="font-semibold">⚠️ 실제로 입금하실 분의 성함과 정확히 일치해야 합니다.</p>
                  <p className="mt-1 opacity-90">이름이 다르면 처리가 늦어질 수 있어요.</p>
                </div>
                {depositorName.trim() &&
                  attendees[0]?.name.trim() &&
                  depositorName.trim() !== attendees[0].name.trim() && (
                    <p className="mt-2 text-xs text-amber-300">
                      신청자({attendees[0].name})와 입금자명({depositorName})이 다릅니다. 맞나요?
                    </p>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 고정 하단 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl px-1">
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="w-full rounded-lg px-6 py-4 text-base font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: accentColor, color: "#0a0a12" }}
          >
            {pending
              ? "신청 중…"
              : checkingConflicts
                ? "확인 중…"
                : step === 2
                  ? "제출하기"
                  : "다음"}
          </button>
        </div>
      </div>
    </>
  );
}
