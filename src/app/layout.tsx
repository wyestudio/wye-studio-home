import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://wouldyouescape.com";
const SITE_DESCRIPTION =
  "방탈출과 로테이션 소개팅을 결합한 우주이스케이프 베타 오픈. 8/22 오후·저녁 회차 참가 신청.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "우주이스케이프",
  description: SITE_DESCRIPTION,
  keywords: [
    "방탈출",
    "소개팅",
    "로테이션 소개팅",
    "그룹 미팅",
    "커플매칭",
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
