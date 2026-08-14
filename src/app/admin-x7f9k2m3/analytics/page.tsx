"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TrafficSource, LandingPage, PageView, FunnelStep } from "@/lib/ga4";

export default function AnalyticsDashboard() {
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [topPages, setTopPages] = useState<PageView[]>([]);
  const [applyFunnel, setApplyFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((data) => {
        setTrafficSources(data.trafficSources || []);
        setLandingPages(data.landingPages || []);
        setTopPages(data.topPages || []);
        setApplyFunnel(data.applyFunnel || []);
      })
      .catch((err) => console.error("Failed to fetch analytics:", err))
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted">분석 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">분석 대시보드</h1>
          <p className="text-muted">GA4 데이터 기반 최근 28일간의 분석 — 팀원도 쉽게 이해할 수 있도록 주요 지표만 요약해 보여줍니다.</p>
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
          <h2 className="text-2xl font-semibold mb-6">이 대시보드에 없는 지표는 어디서 봐요?</h2>
          <p className="text-sm text-muted mb-6">
            더 자세한 분석이 필요하면 Google Analytics에서 직접 확인할 수 있습니다. 아래 각 항목을 클릭해 GA4로 이동하세요. (로그인 후 '우주이스케이프' 속성을 선택하면 해당 리포트가 보입니다)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 방문자 경로 */}
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold mb-2">방문자 흐름 & 경로 탐색</h3>
              <p className="text-sm text-muted mb-3">
                어느 페이지 → 어느 페이지로 이동했는지, 어디서 이탈했는지 시각적으로 볼 수 있습니다.
              </p>
              <p className="text-xs text-muted/80">
                <strong>경로:</strong> 좌측 메뉴 탐색(Explore) → 경로 탐색 템플릿 선택
              </p>
            </a>

            {/* 이탈 퍼널 */}
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold mb-2">상세 이탈 분석 (유입경로 탐색)</h3>
              <p className="text-sm text-muted mb-3">
                홈 → 상세페이지 → 신청폼 → 완료 같은 특정 경로별로 이탈률을 세분화해 볼 수 있습니다.
              </p>
              <p className="text-xs text-muted/80">
                <strong>경로:</strong> 좌측 메뉴 탐색 → 유입경로 탐색 템플릿
              </p>
            </a>

            {/* 실시간 */}
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold mb-2">실시간 방문자</h3>
              <p className="text-sm text-muted mb-3">
                지금 이 순간 사이트를 방문한 사람의 수와 어디서 들어왔는지 실시간으로 확인합니다.
              </p>
              <p className="text-xs text-muted/80">
                <strong>경로:</strong> 보고서 → 실시간
              </p>
            </a>

            {/* 상세 소스 분석 */}
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold mb-2">상세 소스 분석 & 기간 비교</h3>
              <p className="text-sm text-muted mb-3">
                일주일 단위, 월 단위로 시간대별 트래픽 변화, 캠페인별 상세 분석이 가능합니다.
              </p>
              <p className="text-xs text-muted/80">
                <strong>경로:</strong> 보고서 → 획득 → 트래픽 획득
              </p>
            </a>

            {/* 내 테스트 트래픽 제외 */}
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <h3 className="font-semibold mb-2">내 테스트 트래픽 제외하기</h3>
              <p className="text-sm text-muted mb-3">
                자신의 IP를 등록해서 본인이 방문한 데이터를 리포트에서 자동 제외하도록 설정합니다.
              </p>
              <p className="text-xs text-muted/80">
                <strong>경로:</strong> 관리 → 데이터 스트림 → 내부 트래픽 정의 / 관리 → 데이터 필터 → 내부 트래픽
              </p>
              <p className="text-xs text-muted/80 mt-2">
                💡 <strong>주의:</strong> GA4는 개별 IP 주소를 저장하지 않습니다(GDPR 대응, 2022년부터 정책). 필터를 켠 시점 이후 데이터만 제외되며 과거 데이터는 지울 수 없습니다.
              </p>
            </a>
          </div>
        </div>

        <div className="mt-12 text-xs text-muted border-t border-border pt-6">
          <p>• 데이터 기준: 최근 28일</p>
          <p>• 업데이트: 매시간 1회 (캐시)</p>
          <p>• GA4 측정 ID: G-EG7FHGECVK</p>
        </div>
      </div>
    </div>
  );
}
