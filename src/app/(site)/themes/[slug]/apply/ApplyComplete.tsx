"use client";

import Link from "next/link";
import { formatKrw } from "@/lib/format";
import { formatPhoneDigits } from "@/lib/phone";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import type { ApplyResult, AttendeeInput } from "./actions";

type Ok = Extract<ApplyResult, { success: true }>;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/8 py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

/**
 * 신청 완료 화면.
 *
 * 계좌번호는 여기에 띄우지 않는다. 입금 안내는 대표 신청자에게 가는 문자에만
 * 담고, 화면에서는 문자를 보냈다는 사실만 알린다 — 계좌를 공개 화면에 두면
 * 신청하지 않은 사람에게도 그대로 노출된다.
 *
 * 대신 방금 제출한 내용을 그대로 한 번 더 보여준다. 고치려면 문의해야 하므로
 * 잘못 넣은 게 있는지 이 자리에서 알아차릴 수 있어야 한다.
 */
export function ApplyComplete({
  result,
  themeName,
  sessionLabel,
  depositorName,
  attendees,
  accentColor,
}: {
  result: Ok;
  themeName: string;
  sessionLabel: string;
  depositorName: string;
  attendees: AttendeeInput[];
  accentColor: string;
}) {
  const isWaiting = result.status === "waiting";
  const representativePhone = formatPhoneDigits(attendees[0]?.phone ?? "");

  return (
    <div className="space-y-6">
      <div className="pt-2 text-center">
        <h1 className="text-2xl font-extrabold">
          {isWaiting ? "대기 신청이 접수되었습니다." : "신청이 완료되었습니다."}
        </h1>
        <p className="mt-1 text-sm text-muted">신청해주셔서 감사합니다 (__)</p>
      </div>

      {/* ── 접수번호 ── */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-6 text-center">
        <p className="text-xs text-muted">접수번호</p>
        <p className="mt-1 text-3xl font-extrabold tracking-wider" style={{ color: accentColor }}>
          {result.confirmationCode}
        </p>
        <p className="mt-2 text-xs text-muted">참여 내역 조회에 쓰입니다. 꼭 저장해주세요.</p>

        {isWaiting && (
          <p className="mt-4 text-sm text-amber-300">
            현재 대기 {result.waitingNumber ?? "-"}번입니다. 자리가 나면 개별 연락드립니다.
            <span className="mt-1 block text-xs text-muted">
              앞선 신청이 취소되면 순번은 앞당겨질 수 있습니다.
            </span>
          </p>
        )}
      </div>

      {/* ── 입금 안내: 계좌는 문자로만 ── */}
      {!isWaiting && (
        <div className="rounded-xl border-2 p-5" style={{ borderColor: accentColor }}>
          <h2 className="text-center font-bold">입금 안내를 문자로 보내드렸어요</h2>
          <p className="mt-2 text-center text-sm text-muted">
            <strong className="text-foreground">{representativePhone}</strong> 으로 입금하실 계좌와
            금액을 보냈습니다.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white/5 p-4 text-center">
              <p className="text-xs text-muted">입금액</p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: accentColor }}>
                {formatKrw(result.amountKrw)}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-4 text-center">
              <p className="text-xs text-muted">입금자명</p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: accentColor }}>
                {depositorName}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-xs text-amber-200">
            <p>⚠️ 입금자명이 다르면 처리가 늦어질 수 있습니다.</p>
            <p>⏱ 입금 확인까지 최대 10분 정도 걸릴 수 있습니다.</p>
            <p>⏱ 시간 내 미입금 시 자동으로 취소될 수 있습니다.</p>
            {/* 계좌가 문자에만 있으므로, 문자가 안 오면 입금할 방법이 없어진다. */}
            <p>💬 문자가 오지 않으면 카카오 채널로 문의해주세요.</p>
          </div>
        </div>
      )}

      {/* ── 제출한 내용 ── */}
      <div className="rounded-xl border border-white/15 p-5">
        <h2 className="mb-2 font-bold">제출하신 내용</h2>

        <Row label="테마" value={themeName} />
        <Row label="일시" value={sessionLabel} />
        <Row label="입금자명" value={depositorName} />
        <Row
          label="참가비"
          value={
            result.discountKrw > 0 ? (
              <>
                {formatKrw(result.amountKrw)}
                <span className="ml-1.5 text-xs text-muted">
                  ({result.headcount}명 × {formatKrw(result.unitPriceKrw)} ={" "}
                  {formatKrw(result.baseAmountKrw)}
                </span>
                <span className="text-xs text-glow">
                  {" "}− 쿠폰 {formatKrw(result.discountKrw)}
                </span>
                <span className="text-xs text-muted">)</span>
              </>
            ) : (
              <>
                {formatKrw(result.amountKrw)}
                <span className="ml-1.5 text-xs text-muted">
                  ({result.headcount}명 × {formatKrw(result.unitPriceKrw)})
                </span>
              </>
            )
          }
        />

        <div className="mt-4 space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="rounded-lg border border-white/12 bg-white/[0.03] p-4">
              <p className="mb-1 text-xs font-bold text-muted">
                {i === 0 ? (attendees.length > 1 ? "대표 신청자 (본인)" : "신청자") : `동행자 ${i}`}
              </p>
              <Row
                label="이름"
                value={
                  <>
                    {a.name}
                    {a.nickname.trim() && (
                      <span className="ml-1 text-muted">({a.nickname.trim()})</span>
                    )}
                  </>
                }
              />
              <Row label="휴대폰" value={formatPhoneDigits(a.phone)} />
              <Row label="출생연도" value={`${a.birth_year}년생`} />
              <Row
                label="방탈출 경험"
                value={EXPERIENCE_RANGE_LABELS[a.experience_range] ?? "-"}
              />
              <Row
                label="성별"
                value={a.gender === "M" ? "남성" : a.gender === "F" ? "여성" : "선택 안 함"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 다음 ── */}
      <div className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm">
        <p className="font-semibold">참여 내역은 언제든 확인할 수 있어요</p>
        <p className="mt-1 text-muted">
          휴대폰 번호와 접수번호 <strong>{result.confirmationCode}</strong>로 조회하실 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/lookup"
            className="rounded-lg px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: accentColor, color: "#0a0a12" }}
          >
            참여 내역 조회
          </Link>
          <Link href="/contents" className="rounded-lg border border-white/25 px-4 py-2.5 text-sm">
            다른 컨텐츠 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
