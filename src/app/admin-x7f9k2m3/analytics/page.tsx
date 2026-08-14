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
          <p className="text-muted">GA4 데이터 기반 최근 28일간의 분석</p>
        </div>

        <div className="space-y-8">
          {/* 트래픽 소스 */}
          <div className="border border-border rounded-lg p-6 bg-background/50">
            <h2 className="text-xl font-semibold mb-4">트래픽 소스</h2>
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
            <h2 className="text-xl font-semibold mb-4">유입 페이지</h2>
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
            <h2 className="text-xl font-semibold mb-4">페이지별 조회수</h2>
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
            <h2 className="text-xl font-semibold mb-4">신청 전환 퍼널</h2>
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

        <div className="mt-8 text-xs text-muted">
          <p>• 데이터 기준: 최근 28일</p>
          <p>• 업데이트: 매시간 1회 (캐시)</p>
          <p>• GA4 측정 ID: G-EG7FHGECVK</p>
        </div>
      </div>
    </div>
  );
}
