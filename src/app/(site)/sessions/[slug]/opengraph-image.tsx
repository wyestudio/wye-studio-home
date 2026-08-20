import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionBySlug } from "@/lib/sessions";
import { formatSessionDateTime } from "@/lib/format";

export const alt = "우주이스케이프 — 방탈출로 시작하는 자연스러운 만남";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionBySlug(slug);

  const [fontData, mascotBuffer] = await Promise.all([
    readFile(join(process.cwd(), "src/app/(site)/fonts/NotoSansKR-Bold-subset.woff")),
    readFile(join(process.cwd(), "public/mascot-kape.png")),
  ]);
  const mascotSrc = `data:image/png;base64,${mascotBuffer.toString("base64")}`;

  // 세션이 없으면 기본 이미지로 폴백
  if (!session) {
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
            방탈출로 시작하는 자연스러운 만남
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

  const themeName = session.theme_name;
  const dateTime = formatSessionDateTime(session.start_at);
  const location = session.venue_area;

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
        <div style={{ display: "flex", fontSize: 72, color: "#ffffff", letterSpacing: -1 }}>
          {themeName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#e4e0ff",
            marginTop: 16,
            textAlign: "center",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div>{dateTime}</div>
          <div style={{ fontSize: 24 }}>📍 {location}</div>
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
