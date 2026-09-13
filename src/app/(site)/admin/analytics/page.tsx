"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AdminNav } from "@/components/admin/AdminNav";
import type { TrafficSource, LandingPage, DailyTraffic, PathFunnel } from "@/lib/ga4";
import type { ApplicationStats } from "@/lib/adminStats";
import { sourceLabel, isUnknownSource, pathLabel } from "@/lib/analyticsLabels";

interface GuideItem {
  id: string;
  title: string;
  summary: string;
  description: string;
  steps: string[];
  example: string;
  href: string;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "path",
    title: "방문자 흐름 & 경로 탐색",
    summary: "페이지 간 이동 경로 시각화",
    description: "방문자가 어느 페이지에서 어디로 이동했는지, 어디서 이탈했는지 시각적으로 볼 수 있습니다.",
    steps: [
      "좌측 메뉴에서 '탐색(Explore)' 클릭",
      "템플릿 갤러리에서 '경로 탐색' 선택",
      "기본 시작점 'session_start'에서 뻗어나가는 나뭇가지 그래프 확인",
      "각 가지를 클릭하면 다음 단계로 확장 가능",
    ],
    example:
      "예시: 나뭇가지에서 '홈 → 상품목록 → 상세페이지'에서 가지가 끝나면, 그 인원이 상세페이지까지만 보고 이탈한 사람 수입니다.",
    href: "https://analytics.google.com/analytics/web/",
  },
  {
    id: "funnel",
    title: "상세 이탈 분석 (유입경로 탐색)",
    summary: "단계별 전환율 & 이탈률",
    description: "홈 → 상세페이지 → 신청폼 → 완료 같은 특정 경로별로 이탈률을 세분화해 볼 수 있습니다.",
    steps: [
      "좌측 메뉴에서 '탐색(Explore)' 클릭",
      "템플릿 갤러리에서 '유입경로 탐색' 선택",
      "우측 '단계' 패널에서 '+' 눌러 단계별 조건 추가:",
      "  • 1단계: page_view (페이지 경로에 /sessions/ 포함)",
      "  • 2단계: eventName = '신청 시작'",
      "  • 3단계: eventName = '신청 완료'",
      "저장하면 막대 사이 꺾쇠에 '이탈 X%' 표시됨",
    ],
    example:
      "예시: 1단계→2단계 사이에 '이탈 65%'라고 뜨면, 상세페이지를 본 사람 중 65%가 신청 폼도 안 열어본 것입니다.",
    href: "https://analytics.google.com/analytics/web/",
  },
  {
    id: "realtime",
    title: "실시간 방문자",
    summary: "지금 이 순간의 방문자",
    description: "지금 이 순간 사이트를 방문한 사람의 수와 어디서 들어왔는지 실시간으로 확인합니다.",
    steps: [
      "좌측 메뉴에서 '보고서' 클릭",
      "'실시간' 선택",
      "상단의 큰 숫자가 '지난 30분 사용자 수'입니다",
    ],
    example:
      "예시: 인스타 스토리에 링크를 올린 직후 이 화면을 열어두면, 숫자가 실시간으로 올라가는 것을 확인할 수 있습니다.",
    href: "https://analytics.google.com/analytics/web/",
  },
  {
    id: "source",
    title: "상세 소스 분석 & 기간 비교",
    summary: "채널별 트래픽 변화 추이",
    description: "일주일 단위, 월 단위로 시간대별 트래픽 변화와 캠페인별 상세 분석이 가능합니다.",
    steps: [
      "좌측 메뉴에서 '보고서' 클릭",
      "'획득' → '트래픽 획득' 선택",
      "표 상단 드롭다운을 '세션 소스/매체'로 변경 (채널+플랫폼별 세분화)",
      "우측 상단 날짜 범위 클릭",
      "'이전 기간과 비교' 체크박스 선택",
    ],
    example:
      "예시: 이번 28일 vs 지난 28일을 비교해서 인스타 유입이 %로 얼마나 늘었는지 확인할 수 있습니다.",
    href: "https://analytics.google.com/analytics/web/",
  },
  {
    id: "internal",
    title: "내 테스트 트래픽 제외하기",
    summary: "테스트 방문 자동 필터링",
    description:
      "자신의 IP를 등록해서 본인이 방문한 데이터를 리포트에서 자동으로 제외하도록 설정합니다.",
    steps: [
      "⚙️ 관리(톱니바퀴 아이콘) 클릭",
      "'데이터 스트림' → 웹 스트림 선택",
      "아래로 스크롤해 '태그 설정 구성' → '더보기' 클릭",
      "'내부 트래픽 정의' → '규칙 만들기'",
      "'내 IP 주소 확인' 버튼 클릭 (자동 입력됨)",
      "저장 후, 관리 → 데이터 설정 → 데이터 필터 → '필터 만들기'",
      "'내부 트래픽' 선택 → 처음엔 '테스트'로 저장",
      "며칠 확인 후 '실제 운영'으로 전환",
    ],
    example:
      "예시: 사무실 와이파이 IP를 등록하면, 그 IP에서의 모든 세션에 'internal' 표시가 붙고, 필터를 켜면 리포트에서 자동 제외됩니다. 💡 주의: GA4는 개별 IP를 저장하지 않으며(GDPR), 필터는 켠 시점 이후만 적용됩니다.",
    href: "https://analytics.google.com/analytics/web/",
  },
];


type ApiPayload = {
  days: number;
  trafficSources: TrafficSource[];
  landingPages: LandingPage[];
  dailyTraffic: DailyTraffic[];
  funnel: PathFunnel;
  applications: ApplicationStats;
};

const PERIODS: { key: string; label: string }[] = [
  { key: "daily", label: "오늘" },
  { key: "weekly", label: "최근 7일" },
  { key: "monthly", label: "최근 28일" },
];

const won = (n: number) => `${n.toLocaleString()}원`;
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "-");
/** 'YYYY-MM-DD' → '9/13' */
const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 큰 숫자 하나 + 보조 설명. 대시보드에서 제일 먼저 눈에 들어와야 하는 칸. */
function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "glow" | "warn";
}) {
  const color =
    tone === "glow" ? "text-glow" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** 퍼널 한 단계. 막대 길이로 크기를, 오른쪽 숫자로 이탈률을 보여준다. */
function FunnelRow({
  label,
  value,
  top,
  prev,
  hint,
}: {
  label: string;
  value: number;
  top: number;
  prev?: number;
  hint?: string;
}) {
  const width = top > 0 ? Math.max(2, (value / top) * 100) : 0;
  const drop = prev != null && prev > 0 ? prev - value : null;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span>
          {label}
          {hint && <span className="ml-1.5 text-xs text-muted">{hint}</span>}
        </span>
        <span className="shrink-0">
          <strong>{value.toLocaleString()}</strong>
          <span className="ml-2 text-xs text-muted">{pct(value, top)}</span>
        </span>
      </div>
      <div className="h-2.5 w-full rounded bg-muted/30">
        <div className="h-full rounded bg-glow" style={{ width: `${width}%` }} />
      </div>
      {drop != null && drop > 0 && (
        <p className="mt-1 text-xs text-amber-400/80">
          ↓ 이 단계에서 {drop.toLocaleString()}명 이탈 ({pct(drop, prev!)})
        </p>
      )}
    </div>
  );
}

/** 박스 맨 위 한 줄 요약. 숫자를 읽기 전에 "그래서 뭔데" 를 먼저 알려준다. */
function Summary({ text }: { text: string }) {
  return (
    <p className="mb-3 rounded border border-glow/25 bg-glow/5 px-3 py-2 text-sm">{text}</p>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("weekly");
  const [selectedGuideId, setSelectedGuideId] = useState("path");

  const selectedGuide = GUIDE_ITEMS.find((item) => item.id === selectedGuideId) || GUIDE_ITEMS[0];

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/analytics?period=${period}`)
      .then((res) => res.json())
      .then((d) => alive && setData(d))
      .catch((err) => console.error("Failed to fetch analytics:", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  /** 기간을 바꾸면 이전 기간 숫자가 남지 않도록 로딩 상태로 되돌린다. */
  function changePeriod(next: string) {
    if (next === period) return;
    setLoading(true);
    setPeriod(next);
  }

  const sessions = data?.funnel.sessions ?? 0;
  const totals = data?.applications.totals;

  // 1위가 '출처 불명' 이면 요약으로 쓸모가 없다 — 뜻이 있는 값 중 1위를 뽑는다.
  const topSource = (data?.trafficSources ?? []).find((s) => !isUnknownSource(s.source));
  const sourceTotal = (data?.trafficSources ?? []).reduce((a, s) => a + s.sessions, 0);
  const unknown = (data?.trafficSources ?? [])
    .filter((s) => isUnknownSource(s.source))
    .reduce((a, s) => a + s.sessions, 0);
  const sourceSummary = topSource
    ? `가장 많이 들어온 곳은 ${sourceLabel(topSource.source)}입니다 — ${topSource.sessions}회` +
      `${sourceTotal > 0 ? ` (전체의 ${((topSource.sessions / sourceTotal) * 100).toFixed(0)}%)` : ""}.` +
      `${unknown > 0 ? ` 출처를 알 수 없는 방문이 ${unknown}회 있습니다.` : ""}`
    : "출처를 알 수 있는 방문이 아직 없습니다.";

  const topLanding = (data?.landingPages ?? [])[0];
  const landingTotal = (data?.landingPages ?? []).reduce((a, p) => a + p.sessions, 0);
  const homeFirst = (data?.landingPages ?? []).find((p) => p.page === "/" || p.page === "직접");
  const landingSummary = topLanding
    ? `처음 도착한 화면 1위는 ${pathLabel(topLanding.page)}입니다 — ${topLanding.sessions}회` +
      `${landingTotal > 0 ? ` (전체의 ${((topLanding.sessions / landingTotal) * 100).toFixed(0)}%)` : ""}.` +
      `${
        homeFirst && homeFirst !== topLanding
          ? ` 홈으로 바로 온 방문은 ${homeFirst.sessions}회입니다.`
          : ""
      }`
    : "아직 데이터가 없습니다.";

  // 방문과 신청을 한 차트에 겹쳐 본다. 둘의 크기 차이가 커서 축을 나눈다.
  const chart = (data?.dailyTraffic ?? []).map((t) => {
    const a = data?.applications.daily.find((x) => x.date === t.date);
    return {
      date: shortDate(t.date),
      방문: t.sessions,
      신청: a?.applications ?? 0,
      입금: a?.paid ?? 0,
    };
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/analytics" />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold">분석</h1>
            <p className="text-sm text-muted">
              방문(GA4)과 신청·입금(우리 DB)을 같이 봅니다. 방문 수만 보면 장사가 되는지 알 수
              없어서, <strong className="text-foreground">방문 대비 신청 전환율</strong>을 가장
              위에 둡니다.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => changePeriod(p.key)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                  period === p.key
                    ? "border-glow bg-glow/10 text-foreground"
                    : "border-border bg-background/50 text-muted hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-20 text-center text-muted">분석 데이터를 불러오는 중…</p>
        ) : !data ? (
          <p className="py-20 text-center text-red-400">데이터를 불러오지 못했습니다.</p>
        ) : (
          <>
            {/* ── 한눈에 ── */}
            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="방문 (세션)" value={sessions.toLocaleString()} />
              <Kpi
                label="신청"
                value={`${totals?.applications ?? 0}건`}
                sub={`${totals?.headcount ?? 0}명`}
              />
              <Kpi
                label="방문 → 신청 전환율"
                value={pct(totals?.applications ?? 0, sessions)}
                sub="예약형 사업 평균 2~5%"
                tone="glow"
              />
              <Kpi
                label="입금 완료"
                value={`${totals?.paid ?? 0}건`}
                sub={`신청 대비 ${pct(totals?.paid ?? 0, totals?.applications ?? 0)}`}
              />
              <Kpi
                label="매출 (입금 기준)"
                value={won(totals?.revenueKrw ?? 0)}
                sub={totals?.cancelled ? `취소 ${totals.cancelled}건` : undefined}
                tone={totals?.cancelled ? "warn" : "default"}
              />
            </div>

            {/* ── 일별 추이 ── */}
            <div className="mb-8 rounded-lg border border-border bg-background/50 p-5">
              <h2 className="mb-1 text-lg font-semibold">일별 추이</h2>
              <p className="mb-4 text-sm text-muted">
                막대는 방문 수(왼쪽 축), 선은 신청·입금 건수(오른쪽 축)입니다. 홍보한 날 방문이
                튀는지, 그 방문이 신청으로 이어졌는지를 같이 봅니다.
              </p>
              {chart.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--muted)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="방문" fill="var(--border)" />
                    <Line yAxisId="right" type="monotone" dataKey="신청" stroke="var(--glow)" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="입금" stroke="#f59e0b" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted">데이터 없음</p>
              )}
            </div>

            {/* ── 퍼널 ── */}
            <div className="mb-8 rounded-lg border border-border bg-background/50 p-5">
              <h2 className="mb-1 text-lg font-semibold">어디서 떨어지나</h2>
              <p className="mb-4 text-sm text-muted">
                앞 단계 대비 몇 명이 빠졌는지를 봅니다. 가장 크게 빠지는 칸이 지금 고쳐야 할
                화면입니다.
              </p>
              <FunnelRow label="사이트 방문" value={sessions} top={sessions} />
              <FunnelRow
                label="테마 상세 조회"
                value={data.funnel.themeSessions}
                top={sessions}
                prev={sessions}
              />
              <FunnelRow
                label="신청 폼 열람"
                value={data.funnel.applySessions}
                top={sessions}
                prev={data.funnel.themeSessions}
              />
              <FunnelRow
                label="신청 완료"
                value={totals?.applications ?? 0}
                top={sessions}
                prev={data.funnel.applySessions}
                hint="(우리 DB)"
              />
              <FunnelRow
                label="입금 완료"
                value={totals?.paid ?? 0}
                top={sessions}
                prev={totals?.applications ?? 0}
                hint="(우리 DB)"
              />
              <p className="mt-3 text-xs text-muted">
                앞 세 단계는 GA4 의 <strong>페이지 경로</strong>로 셉니다 — 이벤트 태그에 기대면
                GTM 설정이 어긋날 때 조용히 0이 되는데, 경로는 페이지가 열리기만 하면 잡힙니다.
              </p>
            </div>

            {/* ── 유입 ── */}
            <div className="mb-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-background/50 p-5">
                <h2 className="mb-1 text-lg font-semibold">어디서 들어오나</h2>
                <p className="mb-3 text-sm text-muted">
                  어느 홍보가 사람을 데려오는지 비교할 때 씁니다.
                </p>
                {data.trafficSources.length > 0 ? (
                  <>
                    <Summary text={sourceSummary} />
                    <ul className="space-y-2">
                      {data.trafficSources.slice(0, 8).map((s, i) => {
                        const top = data.trafficSources[0].sessions || 1;
                        return (
                          <li key={i}>
                            <div className="mb-1 flex items-baseline justify-between text-sm">
                              <span className="truncate pr-2">
                                {sourceLabel(s.source)}
                                <span className="ml-1.5 font-mono text-[11px] text-muted">
                                  {s.source}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium">
                                {s.sessions.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded bg-muted/30">
                              <div
                                className="h-full rounded bg-glow/70"
                                style={{ width: `${(s.sessions / top) * 100}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted">데이터 없음</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-5">
                <h2 className="mb-1 text-lg font-semibold">첫 화면으로 뭘 보나</h2>
                <p className="mb-3 text-sm text-muted">
                  방문자가 처음 도착한 페이지입니다. 광고·공유 링크가 어디로 보내고 있는지
                  확인합니다.
                </p>
                {data.landingPages.length > 0 ? (
                  <>
                    <Summary text={landingSummary} />
                    <ul className="space-y-2">
                      {data.landingPages.slice(0, 8).map((p, i) => {
                        const top = data.landingPages[0].sessions || 1;
                        return (
                          <li key={i}>
                            <div className="mb-1 flex items-baseline justify-between text-sm">
                              <span className="truncate pr-2">
                                {pathLabel(p.page)}
                                <span className="ml-1.5 font-mono text-[11px] text-muted">
                                  {p.page}
                                </span>
                              </span>
                              <span className="shrink-0 font-medium">
                                {p.sessions.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded bg-muted/30">
                              <div
                                className="h-full rounded bg-glow/70"
                                style={{ width: `${(p.sessions / top) * 100}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted">데이터 없음</p>
                )}
              </div>
            </div>

            {/* ── 날짜별 표 ── */}
            <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-background/50 p-5">
              <h2 className="mb-1 text-lg font-semibold">날짜별 숫자</h2>
              <p className="mb-3 text-sm text-muted">
                차트에서 튀는 날을 찾았을 때 정확한 숫자를 보는 표입니다. 입금·취소는 그 일이
                <strong className="text-foreground"> 실제로 일어난 날</strong>에 셉니다(신청일이 아닙니다).
              </p>
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">날짜</th>
                    <th className="py-2 pr-3 text-right">방문</th>
                    <th className="py-2 pr-3 text-right">신청</th>
                    <th className="py-2 pr-3 text-right">전환율</th>
                    <th className="py-2 pr-3 text-right">입금</th>
                    <th className="py-2 pr-3 text-right">매출</th>
                    <th className="py-2 text-right">취소</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.applications.daily ?? []).map((d) => {
                    const t = data.dailyTraffic.find((x) => x.date === d.date);
                    const v = t?.sessions ?? 0;
                    return (
                      <tr key={d.date} className="border-b border-border/40">
                        <td className="py-2 pr-3">{d.date.slice(5)}</td>
                        <td className="py-2 pr-3 text-right">{v.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right font-medium">{d.applications}</td>
                        <td className="py-2 pr-3 text-right text-muted">{pct(d.applications, v)}</td>
                        <td className="py-2 pr-3 text-right">{d.paid}</td>
                        <td className="py-2 pr-3 text-right">{d.revenueKrw ? won(d.revenueKrw) : "-"}</td>
                        <td className="py-2 text-right text-muted">{d.cancelled || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 가이드 섹션 */}
        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-2xl font-semibold mb-2">이 대시보드에 없는 지표는 어디서 봐요?</h2>
          <p className="text-sm text-muted mb-6">
            더 자세한 분석이 필요하면 Google Analytics에서 직접 확인할 수 있습니다. 왼쪽 항목을 선택하면 오른쪽에 단계별 설명이 나타납니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            {/* 왼쪽: 지표 목록 */}
            <div className="space-y-2">
              {GUIDE_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedGuideId(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    selectedGuideId === item.id
                      ? "border-glow bg-glow/10 text-foreground"
                      : "border-border bg-background/50 text-muted hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted/80 mt-1">{item.summary}</p>
                </button>
              ))}
            </div>

            {/* 오른쪽: 상세 내용 */}
            <div className="border border-border rounded-lg p-6 bg-background/50">
              <h3 className="text-xl font-semibold mb-3">{selectedGuide.title}</h3>

              <p className="text-sm text-muted mb-4">{selectedGuide.description}</p>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3 text-foreground">단계별 설명</h4>
                <ol className="space-y-2">
                  {selectedGuide.steps.map((step, idx) => (
                    <li key={idx} className="text-sm text-muted flex gap-3">
                      <span className="font-semibold text-glow shrink-0">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mb-6 bg-muted/30 p-4 rounded-lg border border-border/50">
                <p className="text-sm font-semibold mb-2">예시로 보면</p>
                <p className="text-sm text-muted">{selectedGuide.example}</p>
              </div>

              <a
                href={selectedGuide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-glow text-glow-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold"
              >
                Google Analytics 열기 →
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 text-xs text-muted border-t border-border pt-6">
          <p>• 데이터 기준: {PERIODS.find((p) => p.key === period)?.label ?? period}</p>
          <p>• 업데이트: 5분 캐시 · 방문 수는 GA4, 신청·입금·매출은 우리 DB</p>
          <p>• GA4 측정 ID: G-EG7FHGECVK</p>
        </div>
      </div>
    </div>
  );
}
