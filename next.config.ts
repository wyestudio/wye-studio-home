import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 포스터 업로드가 서버 액션으로 간다. 기본 1MB 라 2~3MB 짜리 포스터가
      // "Body exceeded 1 MB limit" 로 막혔다(500). 버킷 제한(5MB)에 맞춘다.
      // 여유를 조금 둬야 multipart 부가 데이터까지 들어간다.
      bodySizeLimit: "6mb",
    },
  },

  images: {
    remotePatterns: [
      {
        // 테마 포스터는 Supabase Storage(theme-assets 버킷)에 올라간다.
        // 호스트를 명시하지 않으면 Next/Image 가 외부 이미지를 거부한다.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async redirects() {
    return [
      {
        // 프리오픈 회차 URL 은 이미 SNS·문자에 배포돼 있다. 주소를 살려두고
        // 테마 페이지로 넘겨 SEO 점수를 한 URL 에 모은다.
        source: "/sessions/0829-meeting",
        destination: "/themes/baotalchul",
        permanent: true,
      },
      {
        source: "/sessions/0829-dating",
        destination: "/themes/baotalchul",
        permanent: true,
      },
      {
        // 후기 페이백 안내 페이지용 짧은 링크.
        source: "/review.go",
        destination: "/review-guide",
        permanent: false,
      },
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
          "/themes/baotalchul?utm_source=instagram&utm_medium=post&utm_campaign=0829_dating",
        permanent: false,
      },
      {
        // 인스타그램 게시물(모임 회차)용 짧은 링크.
        source: "/ig-meeting.go",
        destination:
          "/themes/baotalchul?utm_source=instagram&utm_medium=post&utm_campaign=0829_meeting",
        permanent: false,
      },
      {
        // 당근마켓 프로필에는 UTM 파라미터가 붙은 URL을 그대로 노출하지 않기 위해
        // 짧은 링크(/dg.go)를 걸어두고 실제 목적지로 리다이렉트한다.
        source: "/dg.go",
        destination:
          "/contents?utm_source=daangn&utm_medium=profile&utm_campaign=preopening",
        permanent: false,
      },
      {
        // 당근마켓 게시물(소개팅 회차)용 짧은 링크.
        source: "/dg-dating.go",
        destination:
          "/themes/baotalchul?utm_source=daangn&utm_medium=post&utm_campaign=0829_dating",
        permanent: false,
      },
      {
        // 당근마켓 게시물(모임 회차)용 짧은 링크.
        source: "/dg-meeting.go",
        destination:
          "/themes/baotalchul?utm_source=daangn&utm_medium=post&utm_campaign=0829_meeting",
        permanent: false,
      },
      {
        // 유튜브 프로필/채널 기본 링크.
        source: "/yt.go",
        destination:
          "/contents?utm_source=youtube&utm_medium=profile&utm_campaign=channel",
        permanent: false,
      },
      {
        // 유튜브 쇼츠용 짧은 링크.
        source: "/yt-shorts.go",
        destination:
          "/contents?utm_source=youtube&utm_medium=shorts&utm_campaign=content",
        permanent: false,
      },
      {
        // 유튜브 영상(소개팅 회차)용 짧은 링크.
        source: "/yt-dating.go",
        destination:
          "/themes/baotalchul?utm_source=youtube&utm_medium=video&utm_campaign=0829_dating",
        permanent: false,
      },
      {
        // 유튜브 영상(모임/비소개팅 회차)용 짧은 링크.
        source: "/yt-meeting.go",
        destination:
          "/themes/baotalchul?utm_source=youtube&utm_medium=video&utm_campaign=0829_meeting",
        permanent: false,
      },
      {
        // 틱톡 프로필용 짧은 링크.
        source: "/tiktok.go",
        destination:
          "/contents?utm_source=tiktok&utm_medium=profile&utm_campaign=content",
        permanent: false,
      },
      {
        // 틱톡 영상용 짧은 링크.
        source: "/tiktok-video.go",
        destination:
          "/contents?utm_source=tiktok&utm_medium=video&utm_campaign=content",
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
