import {
  Black_Han_Sans,
  Caveat,
  Courier_Prime,
  Nanum_Myeongjo,
  Nanum_Pen_Script,
  Special_Elite,
} from "next/font/google";
import "./codename.css";

// 이 라우트 전용 글꼴 — 사건 서류철(CASE FILE) 느낌.
// 글자마다 역할을 나눠야 서류로 읽힌다. 한 벌로 다 쓰면 그냥 웹페이지가 된다.
//   본문·라벨 : Courier Prime(로마자 타자기) + 나눔명조(한글) — 예전 관공서 서류
//   표제      : Special Elite(로마자) + 나눔명조 800(한글)
//   손글씨    : Caveat(로마자) + 나눔 펜 스크립트(한글) — 조사관이 눌러 적은 메모
//   도장      : Black Han Sans — 고무도장처럼 두껍게 눌러 찍힌 글자
// 사이트 공용 SUIT 과 섞이지 않게 이 격리된 root layout 에만 스코프한다
// (공용 (site)/layout.tsx 에는 절대 추가하지 않는다).
const korean = Nanum_Myeongjo({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-cn-kr",
  display: "swap",
});

const courier = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-cn-courier",
  display: "swap",
});

const display = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cn-display",
  display: "swap",
});

const hand = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cn-hand",
  display: "swap",
});

const handLatin = Caveat({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-cn-hand-latin",
  display: "swap",
});

const stamp = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-cn-stamp",
  display: "swap",
});

export default function CodenameLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${korean.variable} ${courier.variable} ${display.variable} ${hand.variable} ${handLatin.variable} ${stamp.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
