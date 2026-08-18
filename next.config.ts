import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // 인스타그램 프로필에는 UTM 파라미터가 붙은 URL을 그대로 노출하지 않기 위해
        // 짧은 링크(/ig.go)를 걸어두고 실제 목적지로 리다이렉트한다.
        source: "/ig.go",
        destination:
          "/contents?utm_source=instagram&utm_medium=profile&utm_campaign=preopening",
        permanent: false,
      },
      {
        // 인스타그램 게시물(소개팅 회차)용 짧은 링크.
        source: "/ig-dating.go",
        destination:
          "/sessions/0829-dating?utm_source=instagram&utm_medium=post&utm_campaign=0829_dating",
        permanent: false,
      },
      {
        // 인스타그램 게시물(모임 회차)용 짧은 링크.
        source: "/ig-meeting.go",
        destination:
          "/sessions/0829-meeting?utm_source=instagram&utm_medium=post&utm_campaign=0829_meeting",
        permanent: false,
      },
    ];
  },
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
