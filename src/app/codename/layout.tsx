import { Gowun_Batang, Hahmlet, IBM_Plex_Mono, Nanum_Brush_Script } from "next/font/google";
import "./codename.css";

// 이 라우트 전용 글꼴 — 먹·한지 분위기를 내는 명조 계열 + 붓글씨.
// 사이트 공용 SUIT 과 섞이지 않게 이 격리된 root layout 에만 스코프한다
// (공용 (site)/layout.tsx 에는 절대 추가하지 않는다).
const serif = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-cn-serif",
  display: "swap",
});

const display = Hahmlet({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-cn-display",
  display: "swap",
});

const brush = Nanum_Brush_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cn-brush",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-cn-mono",
  display: "swap",
});

export default function CodenameLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${serif.variable} ${display.variable} ${brush.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
