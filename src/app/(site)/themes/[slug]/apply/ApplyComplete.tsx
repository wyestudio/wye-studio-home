"use client";

import Link from "next/link";
import { formatKrw } from "@/lib/format";
import type { ApplyResult } from "./actions";

type Ok = Extract<ApplyResult, { success: true }>;

/**
 * 신청 완료 화면.
 *
 * 입금 안내가 화면의 주인공이다. 입금액과 입금자명이 정확해야 자동 확인이
 * 되므로, 폼에서 한 번 안내한 내용을 여기서 한 번 더 크게 보여준다.
 * 설계 근거: docs/08-architecture-screens-and-admin.md §2-3
 */
export function ApplyComplete({
  result,
  themeName,
  sessionLabel,
  depositorName,
  bankInfo,
  accentColor,
}: {
  result: Ok;
  themeName: string;
  sessionLabel: string;
  depositorName: string;
  bankInfo: { bankName: string; accountNumber: string; accountHolder: string };
  accentColor: string;
}) {
  const isWaiting = result.status === "waiting";

  return (
    <div className="space-y-6">
      {/* ── 접수 결과 ── */}
      <div className="rounded-xl border border-white/15 bg-white/5 p-6 text-center">
        <p className="text-3xl">{isWaiting ? "📋" : "✅"}</p>
        <h1 className="mt-2 text-xl font-extrabold">
          {isWaiting ? "대기 신청이 접수되었습니다" : "신청이 접수되었습니다"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {themeName} · {sessionLabel}
        </p>

        <div className="mt-5 inline-block rounded-lg border border-white/20 px-5 py-3">
          <p className="text-xs text-muted">접수번호</p>
          <p className="text-2xl font-extrabold tracking-wider" style={{ color: accentColor }}>
            {result.confirmationCode}
          </p>
        </div>

        {isWaiting && (
          <p className="mt-4 text-sm text-amber-300">
            현재 대기 {result.waitingNumber ?? "-"}번입니다. 자리가 나면 개별 연락드립니다.
            <span className="mt-1 block text-xs text-muted">
              앞선 신청이 취소되면 순번은 앞당겨질 수 있습니다.
            </span>
          </p>
        )}
      </div>

      {/* ── 입금 안내 (주인공) ── */}
      {!isWaiting && (
        <div className="rounded-xl border-2 p-6" style={{ borderColor: accentColor }}>
          <h2 className="text-center font-bold">아래 계좌로 입금해주세요</h2>

          <div className="mt-5 space-y-3">
            <div className="rounded-lg bg-white/5 p-4 text-center">
              <p className="text-sm text-muted">{bankInfo.bankName}</p>
              <p className="mt-1 text-xl font-extrabold tracking-wide">{bankInfo.accountNumber}</p>
              <p className="mt-1 text-sm text-muted">예금주 {bankInfo.accountHolder}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/5 p-4 text-center">
                <p className="text-xs text-muted">입금액</p>
                <p className="mt-1 text-2xl font-extrabold" style={{ color: accentColor }}>
                  {formatKrw(result.amountKrw)}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {result.headcount}명 × {formatKrw(result.unitPriceKrw)}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 text-center">
                <p className="text-xs text-muted">입금자명</p>
                <p className="mt-1 text-2xl font-extrabold" style={{ color: accentColor }}>
                  {depositorName}
                </p>
                <p className="mt-1 text-[11px] text-muted">이 이름으로 입금해주세요</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-xs text-amber-200">
            <p>
              ⚠️ <strong>입금자명이 다르면 자동 확인이 되지 않아</strong> 처리가 늦어질 수 있습니다.
            </p>
            <p>⏱ 입금 확인까지 최대 10분 정도 걸릴 수 있습니다.</p>
            <p>⏱ 시간 내 미입금 시 자동으로 취소될 수 있습니다.</p>
          </div>
        </div>
      )}

      {/* ── 다음 ── */}
      <div className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm">
        <p className="font-semibold">참여 내역은 언제든 확인할 수 있어요</p>
        <p className="mt-1 text-muted">
          휴대폰 번호와 접수번호 <strong>{result.confirmationCode}</strong>로 조회하실 수 있습니다.
          접수번호를 꼭 저장해주세요.
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
