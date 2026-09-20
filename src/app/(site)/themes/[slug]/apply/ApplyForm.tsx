"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { formatKrw } from "@/lib/format";
import { PriceTable } from "@/components/contents/PriceTable";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";
import { Select } from "@/components/ui/Select";
import { ApplyStepper } from "@/components/apply/ApplyStepper";
import { AttendeeTabs } from "@/components/apply/AttendeeTabs";
import { ValidationToast } from "@/components/apply/ValidationToast";
import { isValidPhoneDigits } from "@/lib/phone";
import {
  getValidationErrorMessage,
  isValidKoreanName,
  isValidNickname,
} from "@/lib/validation";
import { normalizeCouponCode, formatCouponCode } from "@/lib/coupon";
import {
  applyToSession,
  checkCoupon,
  checkNickname,
  checkThemeConflicts,
  type AttendeeInput,
  type ApplyResult,
  type CouponPreview,
  type AppliedCoupon,
} from "./actions";
import { readAttribution } from "@/lib/attribution";
import { AttendeeFields, type NicknameCheckState } from "./AttendeeFields";
import {
  ConsentStep,
  EMPTY_CONSENTS,
  allRequiredChecked,
  firstMissingConsentId,
  type ConsentState,
} from "./ConsentStep";
import { ApplyComplete } from "./ApplyComplete";
import { pushDataLayerEvent } from "@/lib/analytics";

// 넓은 화면에서 칸·글자를 키운다(테마 상세 비율). 모바일 크기는 그대로.
const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50 sm:py-3.5 sm:text-base lg:py-4 lg:text-lg";
const fieldInvalid =
  "w-full rounded-lg border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger outline-none sm:py-3.5 sm:text-base lg:py-4 lg:text-lg";
const label = "block text-xs font-medium text-muted mb-1.5 sm:text-sm lg:mb-2 lg:text-base";

/** 인원 선택 상한. 테마에 max_group_size 가 있으면 그쪽이 우선이다. */
const DEFAULT_MAX_ATTENDEES = 8;

/**
 * 폼에서 쓰는 참여자 상태.
 *
 * 전화번호는 칸(3-4-4)별로 들고 있다가 보낼 때만 이어붙인다. 이어붙인 한 줄만
 * 들고 자를 경우, 가운데 칸을 비우면 뒷 칸이 앞으로 당겨진다.
 */
export type AttendeeForm = AttendeeInput & { phoneParts: string[] };

function emptyAttendee(): AttendeeForm {
  return {
    name: "", phone: "", birth_year: 0, nickname: "", gender: "", experience_range: "",
    phoneParts: ["", "", ""],
  };
}

/** 칸별 값 → 서버로 보낼 한 줄 */
const joinPhone = (parts: string[]) => parts.join("").replace(/[^0-9]/g, "");

/** 폼 상태에서 서버로 보낼 모양만 남긴다. */
function toPayload(a: AttendeeForm): AttendeeInput {
  return {
    name: a.name,
    phone: joinPhone(a.phoneParts),
    birth_year: a.birth_year,
    nickname: a.nickname,
    gender: a.gender,
    experience_range: a.experience_range,
  };
}

/**
 * 4+4 쿠폰 칸 중 한 칸에 들어온 값을 두 칸에 나눠 담는다.
 *
 * 붙여넣기는 onPaste 에서 잡지만, 앱 안에서 열린 웹뷰처럼 paste 이벤트가 오지 않는
 * 브라우저에서는 8자가 한 칸에 통째로 들어온다. 그래서 onChange 에서도 4자를 넘는
 * 값은 나눠 담는다(이 때문에 칸에 maxLength 를 걸지 않는다 — 걸면 브라우저가 4자로
 * 잘라버려 뒷 4자를 되살릴 수 없다).
 * 반대로 이미 4자가 찬 칸에 한 글자 더 친 것뿐이면 넘치는 글자를 버린다 —
 * 타이핑이 옆 칸을 덮어쓰면 안 된다.
 */
function spreadCouponParts(prev: string[], half: number, raw: string): string[] {
  const value = normalizeCouponCode(raw);
  const typedOver = value.length === 5 && prev[half].length === 4 && value.startsWith(prev[half]);
  if (value.length > 4 && !typedOver) return [value.slice(0, 4), value.slice(4, 8)];
  return prev.map((p, i) => (i === half ? value.slice(0, 4) : p));
}

type FieldError = { field: string; message: string };

/**
 * 참가 신청 — 정보입력 · 약관동의 · 제출 3단계.
 *
 * 다음 단계로는 현재 단계를 통과해야만 갈 수 있고, 지나온 단계는 진행 표시줄에서
 * 눌러 돌아갈 수 있다. 검사 항목은 8/29 회차 폼의 것을 그대로 옮기되 테마 구조에
 * 맞춰 조정했다 — 출생연도는 고정 연도 범위가 아니라 회차의 최소 연령으로 판정한다.
 */
/** 적용에 성공한 쿠폰 상태 */
type AppliedState = { items: AppliedCoupon[]; discountKrw: number };

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
  const [attendees, setAttendees] = useState<AttendeeForm[]>([emptyAttendee()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [consents, setConsents] = useState<ConsentState>({ ...EMPTY_CONSENTS });
  const [depositorName, setDepositorName] = useState("");
  // 쿠폰도 같은 이유로 4+4 칸을 따로 들고 있는다.
  const [couponParts, setCouponParts] = useState<string[]>([
    initialCouponCode.slice(0, 4),
    initialCouponCode.slice(4, 8),
  ]);
  const couponCode = couponParts.join("");
  /**
   * 이미 적용된 쿠폰 코드들. 중복 가능한 캠페인끼리는 여러 장을 붙일 수 있다.
   * 어떤 조합이 되는지는 DB 의 preview_coupons() 가 판정한다 — 화면에서
   * 규칙을 흉내 내면 두 곳이 갈라진다.
   */
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);
  /**
   * ⚠️ **마지막으로 성공한 적용 결과**와 **마지막 실패 사유**를 따로 들고 있는다.
   *    하나로 합치면, 쿠폰을 하나 더 넣었다가 거부됐을 때 이미 적용해 둔 쿠폰이
   *    화면에서 사라지고 제출에서도 빠진다 — 고객이 할인을 통째로 잃는다.
   */
  const [applied, setApplied] = useState<AppliedState | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [nicknameChecks, setNicknameChecks] = useState<Record<number, NicknameCheckState>>({});
  const [conflictPhones, setConflictPhones] = useState<Set<string>>(new Set());
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [checkingNicknames, setCheckingNicknames] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<ApplyResult, { success: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  const headcount = attendees.length;
  const maxAttendees = maxGroupSize ?? DEFAULT_MAX_ATTENDEES;

  /*
    GA4 신청 퍼널.

    ⚠️ 옛 폼(components/apply/ApplyForm.tsx)에만 붙어 있어서, 테마 구조로
       넘어온 뒤로 apply_start/apply_complete 가 사실상 멈춰 있었다
       (2026-09-13 확인: /themes/[slug]/apply 조회 64회에 이벤트는 1건).
       Slack 알림이 누락됐던 것과 같은 종류의 구멍이다.

    ⚠️ dataLayer 이벤트명과 키는 **옛 폼과 똑같이** 쓴다. GTM 트리거
       ('CE - 신청 시작'/'CE - 신청 완료')와 변수(DLV - sessionId 등)가
       그 이름에 묶여 있어서, 이름을 바꾸면 GTM 을 같이 고쳐야 한다.
       배경: ANALYTICS.md
  */
  useEffect(() => {
    pushDataLayerEvent("신청 시작", { sessionId, themeLabel: themeName });
  }, [sessionId, themeName]);

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
  const appliedDiscount = applied?.discountKrw ?? 0;
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

      const digits = joinPhone(a.phoneParts);
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
      const d = joinPhone(a.phoneParts);
      if (d) phoneCount.set(d, (phoneCount.get(d) ?? 0) + 1);
    }
    attendees.forEach((a, i) => {
      const d = joinPhone(a.phoneParts);
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
      if (conflictPhones.has(joinPhone(a.phoneParts))) set.add(i);
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
    // 인원이 바뀌면 정가가 바뀐다. 인당 할인·정률 쿠폰은 할인액도 달라진다.
    setApplied(null);
    setCouponError(null);
    setAppliedCodes([]);
    setAttendees((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(emptyAttendee());
      next.length = count;
      return next;
    });
  }

  function patchAttendee(i: number, patch: Partial<AttendeeForm>) {
    setAttendees((cur) => cur.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
    if ("nickname" in patch) setNicknameChecks((prev) => ({ ...prev, [i]: "idle" }));
    if ("phoneParts" in patch) setConflictPhones(new Set());
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

  /** 새 코드를 기존 적용분에 더해 확인한다. 통과하면 목록에 넣고 입력칸을 비운다. */
  async function verifyCoupon() {
    if (total === null || !couponCode) return;
    setCouponChecking(true);
    setCouponError(null);
    const next = [...appliedCodes, couponCode];
    const result = await checkCoupon({
      codes: next,
      themeId,
      headcount,
      baseAmountKrw: total,
      phone: attendees[0] ? joinPhone(attendees[0].phoneParts) : "",
    });
    setCouponChecking(false);
    if (result.ok) {
      setAppliedCodes(next);
      setApplied({ items: result.items, discountKrw: result.discountKrw });
      setCouponParts(["", ""]);
    } else {
      // ⚠️ 이미 적용된 쿠폰은 건드리지 않는다. 새로 넣은 것만 거부한다.
      setCouponError(result.reason);
    }
  }

  /** 한 장만 뺀다. 남은 게 있으면 다시 확인해 금액을 맞춘다. */
  async function removeCoupon(code: string) {
    const next = appliedCodes.filter((c) => c !== code);
    setAppliedCodes(next);
    setCouponError(null);
    if (next.length === 0 || total === null) {
      setApplied(null);
      return;
    }
    setCouponChecking(true);
    const result = await checkCoupon({
      codes: next,
      themeId,
      headcount,
      baseAmountKrw: total,
      phone: attendees[0] ? joinPhone(attendees[0].phoneParts) : "",
    });
    setCouponChecking(false);
    if (result.ok) setApplied({ items: result.items, discountKrw: result.discountKrw });
    else setCouponError(result.reason);
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

      // ⚠️ '중복확인' 버튼을 눌렀는지와 무관하게 여기서 반드시 확인한다.
      //    예전에는 버튼을 눌러 생긴 'taken' 상태만 봤기 때문에, 버튼을 안 누르면
      //    중복이어도 다음 단계로 넘어갔다. 그러면 제출 시점에 DB 트리거가
      //    거부해서(enforce_session_nickname_unique) 사용자는 한참 뒤에야
      //    같은 오류를 만난다. 판정 기준은 DB 와 같은 함수를 쓴다.
      const nicknamed = attendees
        .map((a, i) => ({ i, nickname: a.nickname.trim() }))
        .filter((x) => x.nickname && isValidNickname(x.nickname));

      if (nicknamed.length > 0) {
        setCheckingNicknames(true);
        const results = await Promise.all(
          nicknamed.map(async (x) => ({
            ...x,
            res: await checkNickname(sessionId, x.nickname),
          }))
        );
        setCheckingNicknames(false);

        setNicknameChecks((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.i] = "error" in r.res ? "error" : r.res.available ? "available" : "taken";
          }
          return next;
        });

        const taken = results.find((r) => !("error" in r.res) && !r.res.available);
        if (taken) {
          setSubmitAttempted(true);
          setActiveIndex(taken.i);
          setToast("이미 사용 중인 닉네임이 있어요. 다른 닉네임으로 바꿔주세요.");
          focusField(`attendee-${taken.i}-nickname`);
          return;
        }
        // 조회 자체가 실패하면 막지 않고 넘긴다. 최종 판정은 DB 가 한다.
      }

      // 같은 테마 중복 신청은 제출 전에 미리 걸러준다.
      setCheckingConflicts(true);
      const result = await checkThemeConflicts(attendees.map((a) => joinPhone(a.phoneParts)), sessionId);
      setCheckingConflicts(false);

      if (!("error" in result) && result.conflictPhones.length > 0) {
        setConflictPhones(new Set(result.conflictPhones));
        setSubmitAttempted(true);
        setToast("같은 테마에 이미 신청하신 분이 포함되어 있어요.");
        const idx = attendees.findIndex((a) => result.conflictPhones.includes(joinPhone(a.phoneParts)));
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
        // ⚠️ 마지막 '적용' 시도가 거부됐더라도, 이미 성공한 쿠폰은 그대로 보낸다.
        couponCodes: appliedCodes,
        depositorName,
        attendees: attendees.map(toPayload),
        notes: "",
        consentRequired: allRequiredChecked(consents, headcount),
        // 기존 폼과 같은 기준 — 선택 항목을 '전부' 동의했을 때만 참이다.
        consentOptional: consents.photo && consents.marketing,
        consentPhoto: consents.photo,
        consentMarketing: consents.marketing,
        // 어디를 타고 들어와 신청까지 왔는지. 처음 도착한 순간에 잡아둔 값이다
        // (신청 시점 주소에는 utm 이 이미 없다). 실패해도 신청은 그대로 진행된다.
        attribution: readAttribution(),
      });
      if ("error" in res) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const rep = attendees[0];
        pushDataLayerEvent("신청 완료", {
          sessionId,
          themeLabel: themeName,
          confirmationCode: res.confirmationCode,
          // 동행자는 출생연도가 제각각이라 대표 신청자 값을 근사치로 보낸다
          // (옛 폼과 같은 규칙 — ANALYTICS.md 에 근거가 적혀 있다).
          birthYear: rep?.birth_year || null,
          gender: rep?.gender || null,
        });
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
        attendees={attendees.map(toPayload)}
        accentColor={accentColor}
      />
    );
  }

  const errOf = (list: FieldError[], f: string) => list.find((e) => e.field === f)?.message;
  const busy = pending || checkingConflicts || checkingNicknames;

  return (
    <>
      <ValidationToast message={toast} onClose={() => setToast(null)} />

      <div className="mb-4 sm:mb-5">
        <a href={backHref} className="text-sm text-muted underline sm:text-base">
          ← 날짜 다시 선택
        </a>
      </div>
      <h1 className="mb-4 text-2xl font-extrabold sm:mb-6 sm:text-3xl lg:text-4xl">참여 신청</h1>

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

      <div className="space-y-6 py-8 pb-28 sm:space-y-8 sm:py-10 sm:pb-32">
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:px-5 sm:py-4 sm:text-base">
            {error}
          </div>
        )}

        {/* ── 회차 요약 ── */}
        <div className="rounded-lg border border-white/15 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-semibold sm:text-lg lg:text-xl">{themeName}</p>
            {categoryName && (
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-bold sm:px-2.5 sm:text-xs"
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
          <p className="mt-1 text-sm text-muted sm:mt-1.5 sm:text-base lg:text-lg">{sessionLabel}</p>
        </div>

        {/* ══ 1. 정보입력 ══ */}
        {step === 0 && (
          <div className="space-y-4 sm:space-y-5">
            <div className="space-y-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-muted sm:px-5 sm:py-4 sm:text-base">
              <p>참여자 확인을 위해 정확한 정보를 입력해주세요.</p>
              <p>연령 확인이 필요한 회차는 현장에서 신분증 확인이 진행될 수 있습니다.</p>
            </div>

            <div>
              <label className={label} htmlFor="attendeeCount">인원</label>
              <Select
                id="attendeeCount"
                variant="glass"
                size="lg"
                value={String(headcount)}
                onChange={(v) => setCount(Number(v))}
                options={Array.from({ length: maxAttendees }, (_, i) => i + 1).map((n) => ({
                  value: String(n),
                  label: `${n}명`,
                }))}
              />
              <p className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">
                ※ 10인 이상 단체 문의는{" "}
                <a
                  href="http://pf.kakao.com/_EGNBX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  카카오톡 채널
                </a>
                로 문의바랍니다.
              </p>
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
                isConflict={conflictPhones.has(joinPhone(attendees[activeIndex].phoneParts))}
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
            minAge={minAge}
            consents={consents}
            onChange={setConsents}
            showError={submitAttempted}
          />
        )}

        {/* ══ 3. 제출 ══ */}
        {step === 2 && (
          <div className="space-y-4 sm:space-y-5">
            {/*
              인원별 참가비 표. 테마 상세에서 본 것과 같은 표를 결제 직전에 한 번 더 보여준다
              (2026-09-16 요청) — 인원이 늘수록 싸진다는 걸 여기서 다시 확인하고,
              바로 아래 총액이 어떻게 나온 값인지도 같이 읽힌다.
            */}
            {tiers.length > 0 && (
              <div className="rounded-lg border border-white/15 bg-white/5 p-4 sm:p-6">
                <p className="mb-3 text-sm font-bold sm:mb-4 sm:text-base">인원별 참가비</p>
                <PriceTable tiers={tiers} maxGroupSize={maxGroupSize} accent={accentColor} />
              </div>
            )}

            <div className="rounded-lg border border-white/15 bg-white/5 p-4 sm:p-6">
              {unitPrice !== null && total !== null && payable !== null ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted sm:text-base lg:text-lg">
                      {headcount}명 × {formatKrw(unitPrice)}
                    </span>
                    <span
                      className={
                        appliedDiscount > 0
                          ? "text-sm text-muted line-through sm:text-base"
                          : "text-2xl font-extrabold sm:text-3xl lg:text-4xl"
                      }
                      style={appliedDiscount > 0 ? undefined : { color: accentColor }}
                    >
                      {formatKrw(total)}
                    </span>
                  </div>

                  {appliedDiscount > 0 && (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between text-sm sm:mt-2 sm:text-base lg:text-lg">
                        <span className="text-muted">쿠폰 할인</span>
                        <span className="text-glow">- {formatKrw(appliedDiscount)}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2 sm:mt-3 sm:pt-3">
                        <span className="text-sm font-semibold sm:text-base lg:text-lg">입금하실 금액</span>
                        <span className="text-2xl font-extrabold sm:text-3xl lg:text-4xl" style={{ color: accentColor }}>
                          {formatKrw(payable)}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted sm:text-base">요금 정보를 불러올 수 없습니다.</p>
              )}
            </div>

            {/* 입력란은 하나의 카드로 묶는다 */}
            <div className="space-y-4 rounded-lg border border-white/15 p-4 sm:space-y-6 sm:p-6">
              <div>
                <label className={label} htmlFor="couponCode">쿠폰 코드</label>
                <div className="flex items-center gap-2">
                  {[0, 1].map((half) => (
                    <div key={half} className="contents">
                      {half === 1 && <span className="text-muted">-</span>}
                      <input
                        id={half === 0 ? "couponCode" : "couponCode2"}
                        className={`${field} text-center font-mono uppercase tracking-widest`}
                        value={couponParts[half]}
                        placeholder="XXXX"
                        onChange={(e) => {
                          // maxLength 대신 여기서 자른다 — spreadCouponParts 주석 참고
                          const next = spreadCouponParts(couponParts, half, e.target.value);
                          setCouponParts(next);
                          setCouponError(null); // 새로 치는 중이니 이전 오류만 지운다
                          if (next[half].length === 4 && half === 0) {
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
                          setCouponParts([pasted.slice(0, 4), pasted.slice(4, 8)]);
                          setCouponError(null);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={verifyCoupon}
                    disabled={couponChecking || !couponCode || total === null}
                    className="shrink-0 self-stretch rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 sm:px-5 sm:text-base"
                  >
                    {couponChecking ? "확인 중…" : "적용"}
                  </button>
                </div>

                {/* 적용된 쿠폰들. 겹쳐 쓸 수 있는 조합이면 여러 줄이 된다. */}
                {applied && applied.items.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {applied.items.map((it) => (
                      <li
                        key={it.code}
                        className="flex items-center justify-between gap-2 rounded-lg border border-glow/25 bg-glow/5 px-3 py-2"
                      >
                        <span className="min-w-0 text-xs sm:text-sm">
                          <span className="text-glow">✓ {it.campaignName}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-muted">
                            {formatCouponCode(it.code)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-glow sm:text-sm">
                            -{formatKrw(it.discountKrw)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCoupon(it.code)}
                            disabled={couponChecking}
                            className="rounded border border-white/20 px-2 py-0.5 text-[11px] text-muted disabled:opacity-40"
                          >
                            빼기
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {couponError ? (
                  <p className="mt-1.5 text-xs text-amber-400 sm:mt-2 sm:text-sm">{couponError}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">
                    쿠폰이 있으시면 코드를 입력하고 적용을 눌러주세요.
                    {" "}쿠폰에 따라 여러 장을 함께 쓸 수 있어요.
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
                  <p className="mt-1 text-[11px] text-danger sm:text-xs lg:text-sm">{errOf(step3Errors, "depositorName")}</p>
                )}
                <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 sm:mt-3 sm:px-4 sm:py-3 sm:text-sm">
                  <p className="font-semibold">⚠️ 실제로 입금하실 분의 성함과 정확히 일치해야 합니다.</p>
                  <p className="mt-1 opacity-90">이름이 다르면 처리가 늦어질 수 있어요.</p>
                </div>
                {depositorName.trim() &&
                  attendees[0]?.name.trim() &&
                  depositorName.trim() !== attendees[0].name.trim() && (
                    <p className="mt-2 text-xs text-amber-300 sm:text-sm">
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
        {/* 폭은 page.tsx 의 main 과 같게(lg:max-w-3xl) 맞춘다 — 다르면 버튼만 폼보다 좁거나 넓어 보인다. */}
        <div className="mx-auto max-w-2xl px-1 lg:max-w-3xl">
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="w-full rounded-lg px-6 py-4 text-base font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 lg:py-[18px] lg:text-lg"
            style={{ backgroundColor: accentColor, color: "#0a0a12" }}
          >
            {pending
              ? "신청 중…"
              : checkingConflicts || checkingNicknames
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
