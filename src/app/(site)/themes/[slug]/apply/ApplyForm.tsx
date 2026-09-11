"use client";

import { useState, useTransition } from "react";
import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";
import {
  applyToSession,
  checkCoupon,
  type AttendeeInput,
  type ApplyResult,
  type CouponPreview,
} from "./actions";
import { formatCouponCode, normalizeCouponCode } from "@/lib/coupon";
import { ApplyComplete } from "./ApplyComplete";

const field =
  "w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50";
const label = "block text-xs font-medium text-muted mb-1.5";

const EXPERIENCE_OPTIONS = [
  { v: "0", label: "처음이에요" },
  { v: "1-50", label: "1~50회" },
  { v: "50-100", label: "50~100회" },
  { v: "100-200", label: "100~200회" },
  { v: "200+", label: "200회 이상" },
];

function emptyAttendee(): AttendeeInput {
  return { name: "", phone: "", birth_year: 0, nickname: "", gender: "", experience_range: "" };
}

/** 로그인한 사람의 정보로 첫 참여자를 채운다. 값은 그대로 고칠 수 있다. */
function firstAttendee(
  prefill: { name: string; phone: string; birthYear: number | null; gender: string | null } | null
): AttendeeInput {
  if (!prefill) return emptyAttendee();
  return {
    name: prefill.name,
    phone: prefill.phone,
    birth_year: prefill.birthYear ?? 0,
    nickname: "",
    gender: prefill.gender ?? "",
    experience_range: "",
  };
}

export function ApplyForm({
  sessionId,
  themeName,
  sessionLabel,
  minAge,
  maxGroupSize,
  tiers,
  accentColor,
  bankInfo,
  themeId,
  initialCouponCode,
  prefill,
}: {
  sessionId: string;
  themeId: string;
  /** 쿠폰 링크(/c/{코드})로 들어온 경우 미리 채워진다. 손으로 칠 일이 없다. */
  initialCouponCode: string;
  /** 로그인 상태면 신청자 정보가 미리 채워진다 (D-06 실익 1). */
  prefill: { name: string; phone: string; birthYear: number | null; gender: string | null } | null;
  themeName: string;
  sessionLabel: string;
  minAge: number;
  maxGroupSize: number | null;
  tiers: ThemePriceTier[];
  accentColor: string;
  bankInfo: { bankName: string; accountNumber: string; accountHolder: string };
}) {
  const [attendees, setAttendees] = useState<AttendeeInput[]>([firstAttendee(prefill)]);
  const [depositorName, setDepositorName] = useState(prefill?.name ?? "");
  const [notes, setNotes] = useState("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentOptional, setConsentOptional] = useState(false);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<ApplyResult, { success: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  // 출생연도 선택지는 회차의 min_age 기준으로 매번 계산한다.
  // 연도를 상수로 박으면 해가 바뀔 때 사람이 고쳐야 한다.
  const thisYear = new Date().getFullYear();
  const maxBirthYear = thisYear - (minAge + 1);
  const birthYears = Array.from({ length: 70 }, (_, i) => maxBirthYear - i);

  const headcount = attendees.length;
  const unitPrice = resolveUnitPrice(tiers, headcount);
  const total = unitPrice !== null ? unitPrice * headcount : null;

  // 적용된 쿠폰이 있으면 할인 후 금액이 실제 입금액이다.
  const appliedDiscount = coupon?.ok ? coupon.discountKrw : 0;
  const payable = total !== null ? Math.max(0, total - appliedDiscount) : null;

  /**
   * 쿠폰 확인.
   * ⚠️ 인원이 바뀌면 정가가 바뀌므로 할인액도 다시 계산해야 한다(정률 쿠폰).
   *    그래서 인원 변경 시 적용을 풀고 다시 누르게 한다.
   */
  async function verifyCoupon() {
    if (total === null) return;
    setCouponChecking(true);
    const result = await checkCoupon({
      code: couponCode,
      themeId,
      headcount,
      baseAmountKrw: total,
      phone: attendees[0]?.phone ?? "",
    });
    setCouponChecking(false);
    setCoupon(result);
  }

  const canAdd = maxGroupSize === null || headcount < maxGroupSize;

  function patchAttendee(i: number, p: Partial<AttendeeInput>) {
    setAttendees((cur) => cur.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await applyToSession({
        sessionId,
        // 적용 확인을 통과한 쿠폰만 보낸다. 입력만 해두고 확인을 안 눌렀다면
        // 할인 없이 신청되는 게 맞다(화면에 안 보이던 할인이 붙으면 더 혼란스럽다).
        couponCode: coupon?.ok ? coupon.code : "",
        depositorName,
        attendees,
        notes,
        consentRequired,
        consentOptional,
        consentPhoto,
        consentMarketing,
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
    return (
      <ApplyComplete
        result={done}
        themeName={themeName}
        sessionLabel={sessionLabel}
        depositorName={depositorName}
        bankInfo={bankInfo}
        accentColor={accentColor}
      />
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── 회차 요약 ── */}
      <div className="rounded-lg border border-white/15 bg-white/5 p-4">
        <p className="font-semibold">{themeName}</p>
        <p className="mt-1 text-sm text-muted">{sessionLabel}</p>
        <p className="mt-1 text-xs" style={{ color: accentColor }}>
          만 {minAge}세 이상 참여 가능
        </p>
      </div>

      {/* ── 참여자 ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">참여자 정보 ({headcount}명)</h2>
          {canAdd && (
            <button
              onClick={() => {
                setAttendees([...attendees, emptyAttendee()]);
                setCoupon(null); // 인원이 바뀌면 할인액이 달라진다. 다시 확인시킨다.
              }}
              className="rounded-lg border border-white/25 px-3 py-1.5 text-xs"
            >
              + 동행자 추가
            </button>
          )}
        </div>

        <div className="space-y-4">
          {attendees.map((a, i) => (
            <div key={i} className="rounded-lg border border-white/15 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {i === 0 ? "신청자 (대표)" : `동행자 ${i}`}
                </p>
                {i > 0 && (
                  <button
                    onClick={() => {
                      setAttendees(attendees.filter((_, x) => x !== i));
                      setCoupon(null);
                    }}
                    className="text-xs text-red-400"
                  >
                    삭제
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>이름 *</label>
                  <input
                    className={field}
                    value={a.name}
                    onChange={(e) => patchAttendee(i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>휴대폰 번호 *</label>
                  <input
                    className={field}
                    inputMode="numeric"
                    placeholder="01012345678"
                    value={a.phone}
                    onChange={(e) => patchAttendee(i, { phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>출생연도 *</label>
                  <select
                    className={field}
                    value={a.birth_year || ""}
                    onChange={(e) => patchAttendee(i, { birth_year: Number(e.target.value) })}
                  >
                    <option value="">선택</option>
                    {birthYears.map((y) => (
                      <option key={y} value={y}>{y}년생</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">
                    이 회차는 만 {minAge}세 이상만 참여할 수 있어요.
                  </p>
                </div>
                <div>
                  <label className={label}>방탈출 경험</label>
                  <select
                    className={field}
                    value={a.experience_range}
                    onChange={(e) => patchAttendee(i, { experience_range: e.target.value })}
                  >
                    <option value="">선택 안 함</option>
                    {EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.v} value={o.v}>{o.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">팀 배정에 참고합니다.</p>
                </div>
                <div>
                  <label className={label}>닉네임 (선택)</label>
                  <input
                    className={field}
                    value={a.nickname}
                    onChange={(e) => patchAttendee(i, { nickname: e.target.value })}
                    placeholder="현장에서 부를 이름"
                  />
                </div>
                <div>
                  <label className={label}>성별 (선택)</label>
                  <select
                    className={field}
                    value={a.gender}
                    onChange={(e) => patchAttendee(i, { gender: e.target.value })}
                  >
                    <option value="">선택 안 함</option>
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {prefill && (
        <p className="rounded-lg border border-glow/30 bg-glow/5 px-4 py-2.5 text-xs text-glow">
          ✓ 로그인 정보로 신청자 칸을 채웠어요. 다르면 그대로 고치셔도 됩니다.
        </p>
      )}

      {/* ── 결제 ── */}
      <section>
        <h2 className="mb-3 font-bold">참가비</h2>
        <div className="rounded-lg border border-white/15 bg-white/5 p-4">
          {unitPrice !== null && total !== null && payable !== null ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  {headcount}명 × {formatKrw(unitPrice)}
                </span>
                <span
                  className={
                    appliedDiscount > 0
                      ? "text-sm text-muted line-through"
                      : "text-2xl font-extrabold"
                  }
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

              <p className="mt-2 text-xs text-muted">
                인원이 늘면 1인당 참가비가 자동으로 낮아집니다.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">요금 정보를 불러올 수 없습니다.</p>
          )}
        </div>

        {/* ── 쿠폰 ── */}
        <div className="mt-4">
          <label className={label}>쿠폰 코드</label>
          <div className="flex gap-2">
            <input
              className={`${field} font-mono uppercase tracking-wider`}
              value={formatCouponCode(couponCode)}
              onChange={(e) => {
                setCouponCode(normalizeCouponCode(e.target.value));
                setCoupon(null); // 코드를 고치면 이전 적용은 무효다
              }}
              placeholder="M0EH-EVG1"
              maxLength={9}
              disabled={coupon?.ok}
            />
            {coupon?.ok ? (
              <button
                type="button"
                onClick={() => {
                  setCoupon(null);
                  setCouponCode("");
                }}
                className="shrink-0 rounded-lg border border-white/20 px-4 text-sm text-muted"
              >
                해제
              </button>
            ) : (
              <button
                type="button"
                onClick={verifyCoupon}
                disabled={couponChecking || !couponCode || total === null}
                className="shrink-0 rounded-lg border border-white/30 px-4 text-sm font-semibold disabled:opacity-40"
              >
                {couponChecking ? "확인 중…" : "적용"}
              </button>
            )}
          </div>

          {coupon?.ok && (
            <p className="mt-1.5 text-xs text-glow">
              ✓ {coupon.campaignName} 적용됨 — {formatKrw(coupon.discountKrw)} 할인
            </p>
          )}
          {coupon && !coupon.ok && (
            <p className="mt-1.5 text-xs text-amber-400">{coupon.reason}</p>
          )}
          {!coupon && (
            <p className="mt-1.5 text-xs text-muted">
              쿠폰이 있으시면 코드를 입력하고 적용을 눌러주세요. 신청 1건에 1장 사용할 수 있어요.
            </p>
          )}
        </div>

        {/* ⭐ 입금자명 — 입금 자동 확인의 성패가 여기 달려 있다 */}
        <div className="mt-4">
          <label className={label}>입금자명 *</label>
          <input
            className={field}
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            placeholder="실제로 입금하실 분의 성함"
          />
          <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
            <p className="font-semibold">⚠️ 실제로 입금하실 분의 성함과 정확히 일치해야 합니다.</p>
            <p className="mt-1 opacity-90">
              이름이 다르면 자동 확인이 되지 않아 처리가 늦어질 수 있어요. 가족·지인 명의로
              입금하시는 경우 <strong>그분의 성함</strong>을 적어주세요.
            </p>
          </div>
          {depositorName.trim() &&
            attendees[0]?.name.trim() &&
            depositorName.trim() !== attendees[0].name.trim() && (
              <p className="mt-2 text-xs text-amber-300">
                신청자({attendees[0].name})와 입금자명({depositorName})이 다릅니다. 맞나요?
              </p>
            )}
        </div>

        <div className="mt-4">
          <label className={label}>요청사항 (선택)</label>
          <textarea
            className={`${field} min-h-20`}
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      {/* ── 동의 ── */}
      <section>
        <h2 className="mb-3 font-bold">약관 동의</h2>
        <div className="space-y-2.5 rounded-lg border border-white/15 p-4 text-sm">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentRequired}
              onChange={(e) => setConsentRequired(e.target.checked)}
            />
            <span>
              <strong>[필수]</strong> 이용약관 · 개인정보 수집 및 이용 · 환불규정에 동의합니다.
              <span className="mt-0.5 block text-xs text-muted">
                <a href="/terms" target="_blank" className="underline">이용약관</a>
                {" · "}
                <a href="/privacy" target="_blank" className="underline">개인정보처리방침</a>
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentOptional}
              onChange={(e) => setConsentOptional(e.target.checked)}
            />
            <span>[선택] 동행자 정보 제공에 대해 본인이 대리 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentPhoto}
              onChange={(e) => setConsentPhoto(e.target.checked)}
            />
            <span>[선택] 현장 사진·영상 촬영 및 홍보 활용에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
            />
            <span>[선택] 새 회차·이벤트 안내 수신에 동의합니다.</span>
          </label>
        </div>
      </section>

      <button
        onClick={submit}
        disabled={pending || !consentRequired}
        className="w-full rounded-lg px-6 py-4 text-base font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: accentColor, color: "#0a0a12" }}
      >
        {pending ? "신청 중…" : total !== null ? `${formatKrw(total)} 신청하기` : "신청하기"}
      </button>
    </div>
  );
}
