import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadOgFont } from "@/lib/ogFont";

// ⚠️ 2026-09-13: 소개팅 회차를 접으면서 "방탈출로 시작하는 자연스러운 만남" 을
//    지금 파는 것에 맞춰 바꿨다. 저장소의 서브셋 폰트는 옛 문구 글자만 담고
//    있어서, 문구를 바꾸는 순간 글자가 빈칸으로 나온다 — 그래서 폰트도
//    loadOgFont 로 바꿨다(그릴 글자만 받아온다).
const TAGLINE = "여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출";

export const alt = `우주이스케이프 — ${TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [fontData, mascotBuffer] = await Promise.all([
    loadOgFont(`우주이스케이프${TAGLINE}`),
    readFile(join(process.cwd(), "public/mascot-kape.png")),
  ]);
  const mascotSrc = `data:image/png;base64,${mascotBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5b4bff 0%, #241f5c 100%)",
          fontFamily: "Noto Sans KR",
          fontWeight: 700,
        }}
      >
        <img src={mascotSrc} alt="" width={140} height={101} style={{ marginBottom: 28 }} />
        <div style={{ display: "flex", fontSize: 88, color: "#ffffff", letterSpacing: -2 }}>
          우주이스케이프
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#e4e0ff", marginTop: 24 }}>
          {TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans KR",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );
}
