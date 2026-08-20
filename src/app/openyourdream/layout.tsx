import { Black_Han_Sans } from "next/font/google";
import "../globals.css";

// 이 라우트 전용 네온 브러시/포스터체 한글 폰트 — 사이트 공용 SUIT과는 별개로,
// 이 격리된 root layout에만 스코프해서 로드한다(공용 layout.tsx에는 추가하지 않음).
const blackHanSans = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-black-han-sans",
  display: "swap",
});

export default function OpenYourDreamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${blackHanSans.variable} h-full`}>
      <body className="min-h-full bg-black">{children}</body>
    </html>
  );
}
