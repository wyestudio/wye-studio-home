"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminBadge, AdminCard, AdminEmpty, adminButtonClass, type AdminTone } from "@/components/admin/ui";
import { downloadCsv, toCsv } from "@/lib/csv";

/**
 * 단체 상세 › 후기 탭 — 모임 후기 설문 답을 읽는다(2026-11-27 대표님).
 *
 * 위: 건수 · 평균 별점 · 점수별 건수 · 고르는 질문(추천 여부 · 연령대 등)의 분포. 아래: 답 한 건씩(최신순).
 * 읽기만 한다 — 답을 고치거나 지우는 버튼은 없다. 후기는 익명이라 이름 · 연락처가 없고, CSV 저장도 감사로그에 남기지 않는다.
 * ⚠️ 새 답은 「새로고침」 을 눌렀을 때 읽는다 — 주기적으로 서버를 부르지 않는다(wye-server-cost).
 */

export type ReviewsView = {
  count: number;
  /** '4.6' — 답이 없으면 null */
  average: string | null;
  dist: { score: number; label: string; count: number }[];
  breakdowns: { id: string; label: string; total: number; rows: { option: string; count: number }[] }[];
  items: {
    id: string;
    rating: number;
    ratingLabel: string;
    at: string;
    choices: { label: string; value: string }[];
    texts: { label: string; value: string }[];
  }[];
  csv: { fileName: string; headers: string[]; rows: (string | number)[][] };
};

// 색만으로 가르지 않는다 — 배지에 점수와 뜻(좋았어요 …)을 같이 적는다.
const ratingTone = (rating: number): AdminTone => (rating >= 4 ? "done" : rating === 3 ? "idle" : "warn");

export function ReviewsTab({ view, formsHref }: { view: ReviewsView; formsHref: string }) {
  const router = useRouter();

  if (view.count === 0) {
    return (
      <AdminEmpty
        title="아직 후기가 없어요"
        hint="「설문 · 문자」 탭의 모임 후기 설문 링크를 보내면, 참가자가 낸 답이 여기에 쌓입니다."
        action={
          <Link href={formsHref} className={adminButtonClass("secondary")}>
            후기 설문 링크 보기
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminCard title="모임 후기">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-body text-foreground">
            <strong className="text-h2 font-extrabold tabular-nums">평균 {view.average}점</strong>
            <span className="ml-2 text-body-sm text-muted">{view.count}건 · 5점 만점 · 익명</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.refresh()} className={adminButtonClass("secondary")}>
              새로고침
            </button>
            <button type="button" onClick={() => downloadCsv(view.csv.fileName, toCsv(view.csv.headers, view.csv.rows))} className={adminButtonClass("secondary")}>
              CSV 저장
            </button>
          </div>
        </div>
        <p className="mt-2 text-body-sm text-muted">새 답은 「새로고침」 을 눌렀을 때 반영됩니다.</p>

        <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Bars title="별점" total={view.count} rows={view.dist.map((d) => ({ name: `${d.score}점 · ${d.label}`, count: d.count }))} />
          {view.breakdowns.map((b) => (
            <Bars key={b.id} title={b.label} total={b.total} rows={b.rows.map((r) => ({ name: r.option, count: r.count }))} />
          ))}
        </div>
      </AdminCard>

      <ul className="flex flex-col gap-3">
        {view.items.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <AdminBadge tone={ratingTone(r.rating)}>
                {r.rating}점 · {r.ratingLabel}
              </AdminBadge>
              {r.choices.map((c) => (
                <AdminBadge key={c.label}>
                  {c.label}: {c.value}
                </AdminBadge>
              ))}
              <span className="ml-auto whitespace-nowrap text-body-sm tabular-nums text-muted">{r.at}</span>
            </div>
            {r.texts.length > 0 && (
              <dl className="mt-3 grid gap-3 text-body-sm">
                {r.texts.map((t) => (
                  <div key={t.label} className="min-w-0">
                    <dt className="text-label text-muted">{t.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{t.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 선택지별 건수 — 막대 + 숫자(막대 길이만으로 읽지 않게 건수와 비율을 같이 적는다). */
function Bars({ title, total, rows }: { title: string; total: number; rows: { name: string; count: number }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-label font-semibold text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-2 text-body-sm">
                <span className="min-w-0 break-words text-foreground">{r.name}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.count}건 · {pct}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-fill-strong" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
