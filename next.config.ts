import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 브라우저가 이 도메인에는 앞으로 항상 HTTPS로만 접속하도록 강제(평문 HTTP로의
        // 다운그레이드/중간자 공격 방지). Vercel이 TLS 자체는 이미 기본 제공하지만,
        // HSTS 헤더는 별도로 명시해야 브라우저가 이 정책을 기억한다.
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
