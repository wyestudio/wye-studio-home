"use client";

import { useState, useTransition } from "react";
import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";
import { applyToSession, type AttendeeInput, type ApplyResult } from "./actions";
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

export function ApplyForm({
  sessionId,
  themeName,
  sessionLabel,
  minAge,
  maxGroupSize,
  tiers,
  accentColor,
  bankInfo,
}: {
  sessionId: string;
  themeName: string;
  sessionLabel: string;
  minAge: number;
  maxGroupSize: number | null;
  tiers: ThemePriceTier[];
  accentColor: string;
  bankInfo: { bankName: string; accountNumber: string; accountHolder: string };
}) {
  const [attendees, setAttendees] = useState<AttendeeInput[]>([emptyAttendee()]);
  const [depositorName, setDepositorName] = useState("");
  const [notes, setNotes] = useState("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentOptional, setConsentOptional] = useState(false);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
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

  const canAdd = maxGroupSize === null || headcount < maxGroupSize;

  function patchAttendee(i: number, p: Partial<AttendeeInput>) {
    setAttendees((cur) => cur.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await applyToSession({
        sessionId,
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
              onClick={() => setAttendees([...attendees, emptyAttendee()])}
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
                    onClick={() => setAttendees(attendees.filter((_, x) => x !== i))}
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

      {/* ── 결제 ── */}
      <section>
        <h2 className="mb-3 font-bold">참가비</h2>
        <div className="rounded-lg border border-white/15 bg-white/5 p-4">
          {unitPrice !== null && total !== null ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  {headcount}명 × {formatKrw(unitPrice)}
                </span>
                <span className="text-2xl font-extrabold" style={{ color: accentColor }}>
                  {formatKrw(total)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                인원이 늘면 1인당 참가비가 자동으로 낮아집니다.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">요금 정보를 불러올 수 없습니다.</p>
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
