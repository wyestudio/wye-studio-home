"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TrafficSource, LandingPage, PageView, FunnelStep } from "@/lib/ga4";

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

type Period = "weekly" | "monthly";

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "최근 7일",
  monthly: "최근 28일",
};

export default function AnalyticsDashboard() {
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [topPages, setTopPages] = useState<PageView[]>([]);
  const [applyFunnel, setApplyFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("monthly");
  const [selectedGuideId, setSelectedGuideId] = useState("path");

  const selectedGuide = GUIDE_ITEMS.find((item) => item.id === selectedGuideId) || GUIDE_ITEMS[0];

  useEffect(() => {
    fetch(`/api/admin/analytics?period=${period}`)
      .then((res) => res.json())
      .then((data) => {
        setTrafficSources(data.trafficSources || []);
        setLandingPages(data.landingPages || []);
        setTopPages(data.topPages || []);
        setApplyFunnel(data.applyFunnel || []);
      })
      .catch((err) => console.error("Failed to fetch analytics:", err))
      .finally(() => setLoading(false));
  }, [period]);

  const handlePeriodChange = (next: Period) => {
    setLoading(true);
    setPeriod(next);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted">분석 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">분석 대시보드</h1>
            <p className="text-muted">GA4 데이터 기반 {PERIOD_LABELS[period]}간의 분석 — 팀원도 쉽게 이해할 수 있도록 주요 지표만 요약해 보여줍니다.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  period === p
                    ? "border-glow bg-glow/10 text-foreground"
                    : "border-border bg-background/50 text-muted hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {p === "weekly" ? "주간" : "월간"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {/* 트래픽 소스 */}
          <div className="border border-border rounded-lg p-6 bg-background/50">
            <h2 className="text-xl font-semibold mb-2">트래픽 소스</h2>
            <p className="text-sm text-muted mb-4">
              방문자가 어떤 경로로 들어왔는지 보여줍니다. '소스/매체' 형식(예: <code className="bg-muted/50 px-1 rounded text-xs">instagram / social</code>은 인스타그램 공유 링크)으로 표시되며, 어느 채널 홍보가 효과적인지 비교할 때 씁니다.
            </p>
            {trafficSources.length > 0 ? (
              <>
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">소스/매체</th>
                        <th className="text-right py-2 px-3">세션수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trafficSources.map((source, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3">{source.source}</td>
                          <td className="text-right py-2 px-3 font-medium">{source.sessions.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trafficSources}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="source" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }} />
                    <Bar dataKey="sessions" fill="var(--glow)" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-muted">데이터 없음</p>
            )}
          </div>

          {/* 유입 페이지 */}
          <div className="border border-border rounded-lg p-6 bg-background/50">
            <h2 className="text-xl font-semibold mb-2">유입 페이지</h2>
            <p className="text-sm text-muted mb-4">
              방문자가 사이트에서 처음 연 페이지 순위입니다. 공유한 링크나 검색 결과가 실제로 어떤 페이지로 사람들을 데려오는지 확인할 때 씁니다.
            </p>
            {landingPages.length > 0 ? (
              <>
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">페이지</th>
                        <th className="text-right py-2 px-3">세션수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {landingPages.map((page, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 text-xs">{page.page}</td>
                          <td className="text-right py-2 px-3 font-medium">{page.sessions.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={landingPages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--muted-foreground)" />
                    <YAxis dataKey="page" type="category" width={120} stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }} />
                    <Bar dataKey="sessions" fill="var(--glow)" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-muted">데이터 없음</p>
            )}
          </div>

          {/* 페이지별 조회수 */}
          <div className="border border-border rounded-lg p-6 bg-background/50">
            <h2 className="text-xl font-semibold mb-2">페이지별 조회수</h2>
            <p className="text-sm text-muted mb-4">
              가장 많이 조회된 페이지 순위입니다. 어떤 회차/콘텐츠에 관심이 많은지, 어느 페이지가 방문자를 끌어들이는지 파악할 때 씁니다.
            </p>
            {topPages.length > 0 ? (
              <>
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">페이지</th>
                        <th className="text-right py-2 px-3">조회수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPages.map((page, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 text-xs">{page.path}</td>
                          <td className="text-right py-2 px-3 font-medium">{page.views.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topPages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="path" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }} />
                    <Bar dataKey="views" fill="var(--glow)" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-muted">데이터 없음</p>
            )}
          </div>

          {/* 신청 전환 퍼널 */}
          <div className="border border-border rounded-lg p-6 bg-background/50">
            <h2 className="text-xl font-semibold mb-2">신청 전환 퍼널</h2>
            <p className="text-sm text-muted mb-4">
              신청 폼에 들어온 방문자 중 실제로 신청까지 완료한 비율을 보여줍니다. 괄호 안 %가 낮으면 신청 폼 단계에서 이탈이 많다는 뜻입니다.
            </p>
            {applyFunnel.length > 0 && applyFunnel.some((s) => s.events > 0) ? (
              <>
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3">단계</th>
                        <th className="text-right py-2 px-3">이벤트 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applyFunnel.map((step, idx) => {
                        const startEvents = applyFunnel[0]?.events || 1;
                        const conversionRate = ((step.events / startEvents) * 100).toFixed(1);
                        return (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3">{step.step}</td>
                            <td className="text-right py-2 px-3">
                              <span className="font-medium">{step.events.toLocaleString()}</span>
                              {idx > 0 && <span className="text-xs text-muted ml-2">({conversionRate}%)</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={applyFunnel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="step" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)" }} />
                    <Bar dataKey="events" fill="var(--glow)" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <p className="text-muted">데이터 없음</p>
            )}
          </div>
        </div>

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
          <p>• 데이터 기준: {PERIOD_LABELS[period]}</p>
          <p>• 업데이트: 매시간 1회 (캐시)</p>
          <p>• GA4 측정 ID: G-EG7FHGECVK</p>
        </div>
      </div>
    </div>
  );
}
