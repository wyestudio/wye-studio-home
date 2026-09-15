import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StarfieldCanvas } from "@/components/space/StarfieldCanvas";
import { MascotCursor } from "@/components/space/MascotCursor";
import { MascotSelectionProvider } from "@/components/space/MascotSelectionContext";
import TestEnvBanner from "@/components/layout/TestEnvBanner";
import { CopyProtectionProvider } from "@/components/layout/CopyProtection";
import "../globals.css";
import { headers } from "next/headers";
import { isProductionHost } from "@/lib/hosts";

// SUIT(가변 폰트, SIL OFL) — https://github.com/sun-typeface/SUIT
const suit = localFont({
  src: "./fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
});

// 갈무리11(SIL OFL) — https://github.com/quiple/galmuri
// 테마별로 골라 쓰는 8비트 도트 글꼴이라 기본 폰트가 아니다. preload 를 끄고
// 실제로 쓰는 화면에서만 받아오게 한다.
const galmuri = localFont({
  src: "./fonts/Galmuri11-Bold.woff2",
  variable: "--font-galmuri-src",
  display: "swap",
  weight: "400 700",
  preload: false,
});

/*
  SUIT 에 없는 기호만 담은 6KB 보조 글꼴. 자세한 내용은 fonts/WyeSymbols-README.md.
  ⚠️ preload 하지 않는다 — 평소에는 쓰일 일이 없고, 브라우저는 해당 글자가
     실제로 나올 때만 받아온다.
  ⚠️ adjustFontFallback 을 끈다. 켜두면 Arial 기반 대체 글꼴이 또 하나 끼어들어
     globals.css 에 적어둔 한글 대체 순서보다 앞서버린다.
*/
const wyeSymbols = localFont({
  src: "./fonts/WyeSymbols-Variable.woff2",
  variable: "--font-symbols",
  display: "swap",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
// 검색 결과에서 사이트 이름 바로 아래 보이는 한 줄이다. 홈뿐 아니라 설명을
// 따로 안 정한 페이지(컨텐츠·About·Notice 등) 전부가 이 문장을 쓴다.
// ⚠️ 소개팅 회차를 더 이상 운영하지 않아 2026-09-13에 그 문구를 뺐다.
const SITE_DESCRIPTION =
  "Would You Escape? 여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출. 같이 갈 사람이 없어도 — 문만 열고 들어오세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "우주이스케이프",
    template: "우주이스케이프 | %s",
  },
  description: SITE_DESCRIPTION,
  // Google 은 keywords 메타를 아예 안 본다. 네이버 쪽을 위해 남겨둘 뿐이라
  // 지금 실제로 파는 것만 적는다(소개팅·커플매칭은 더 이상 운영하지 않는다).
  keywords: [
    "방탈출",
    "팀대항 방탈출",
    "파티형 방탈출",
    "이색 방탈출",
    "그룹 방탈출",
    "신림 방탈출",
    "우주이스케이프",
    "wouldyouescape",
  ],
  openGraph: {
    title: "우주이스케이프",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "우주이스케이프",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "우주이스케이프",
    description: SITE_DESCRIPTION,
  },
  verification: {
    other: {
      "naver-site-verification": "66e18faedf271c624d7ed1edfca8b421c6b02dbf",
    },
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "우주이스케이프",
  alternateName: ["WYE", "Would You Escape"],
  url: SITE_URL,
  logo: `${SITE_URL}/logo-black.png`,
  description: SITE_DESCRIPTION,
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * 어드민·테스트 서브도메인에서는 GTM 을 아예 싣지 않는다.
 *
 * ⚠️ 지금까지 운영자가 어드민을 쓰는 것도 전부 방문자로 집계되고 있었다
 *    (2026-09-13 GA4 확인: 최근 7일 /applications 65회, /themes 45회,
 *     /sessions 22회 — 전부 어드민 화면이다). 방문 수가 부풀려지니
 *    "방문 대비 신청 전환율" 같은 지표가 통째로 틀어진다.
 *
 * 판단 기준은 hosts.ts 의 화이트리스트다 — 새 서브도메인이 생겨도 추가하지
 * 않는 한 자동으로 집계에서 빠진다.
 */
async function shouldTrack(): Promise<boolean> {
  if (!GTM_ID) return false;
  try {
    const host = (await headers()).get("host") || "";
    return isProductionHost(host);
  } catch {
    return false;
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const track = await shouldTrack();
  return (
    <html
      lang="ko"
      className={`${suit.variable} ${wyeSymbols.variable} ${geistMono.variable} ${galmuri.variable} h-full antialiased`}
    >
      {track ? (
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
      <body className="min-h-full flex flex-col">
        {track ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <CopyProtectionProvider>
          <MascotSelectionProvider>
            <StarfieldCanvas />
            <MascotCursor />
            <TestEnvBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </MascotSelectionProvider>
        </CopyProtectionProvider>
      </body>
    </html>
  );
}
