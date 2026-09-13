import { ImageResponse } from "next/og";
import { getThemeBySlug } from "@/lib/themes";
import { loadOgFont } from "@/lib/ogFont";

/**
 * 테마를 카카오톡·슬랙 등에 공유했을 때 보이는 카드 이미지.
 *
 * ⚠️ 이 파일이 없으면 og:image 자체가 안 붙는다. 그러면 카카오가 페이지에서
 *    아무 그림이나 골라 쓰는데, 실제로 헤더의 검은 로고(투명 배경)를 집어서
 *    흰 사각형만 뜨고 있었다. 2026-09-13에 이 파일을 만들어 해결했다.
 *
 * 포스터를 왼쪽에 그대로 싣는다 — 이미 잘 만들어둔 그림이 있는데 글자만
 * 얹은 카드를 따로 만들 이유가 없다. 포스터가 없는 테마는 글자만 나온다.
 */

export const alt = "우주이스케이프 테마";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_ACCENT = "#3dffb0";
const BRAND = "우주이스케이프";
const FALLBACK_TAGLINE = "여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = await getThemeBySlug(slug);

  const name = theme?.name ?? BRAND;
  const tagline = theme?.tagline?.trim() || FALLBACK_TAGLINE;
  const accent = theme?.accent_color || DEFAULT_ACCENT;

  // 난이도 0 · 0분은 '미정'이라 줄 자체를 감춘다. 화면 카드와 같은 규칙이다.
  const facts = [
    theme && theme.difficulty > 0 ? `난이도 ${theme.difficulty}` : null,
    theme && theme.duration_minutes > 0 ? `${theme.duration_minutes}분` : null,
    theme?.venue?.area_label ?? null,
  ].filter(Boolean) as string[];

  const factLine = facts.join("  ·  ");
  // 그릴 글자만 폰트로 받아온다. 여기 안 넣은 글자는 빈칸으로 나온다.
  const fontData = await loadOgFont(`${name}${tagline}${factLine}${BRAND}·`);

  const poster = theme?.hero_image_path ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0a0a12",
          fontFamily: "Noto Sans KR",
          fontWeight: 700,
        }}
      >
        {poster && (
          // 포스터는 4:5라 세로를 꽉 채우고 가로는 잘라낸다(object-fit: cover).
          <div style={{ display: "flex", width: 460, height: "100%", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              width={460}
              height={630}
              style={{ width: 460, height: 630, objectFit: "cover" }}
            />
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: poster ? "0 64px" : "0 96px",
            // 포스터와 글자 사이에 강조색 실선 하나. 테마마다 색이 다르다.
            borderLeft: poster ? `6px solid ${accent}` : "none",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: accent, letterSpacing: 2 }}>
            {BRAND}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 84,
              color: "#ffffff",
              letterSpacing: -2,
              marginTop: 18,
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#c9c9d6",
              marginTop: 24,
              lineHeight: 1.4,
            }}
          >
            {tagline}
          </div>

          {factLine && (
            <div style={{ display: "flex", fontSize: 26, color: "#8b8ba0", marginTop: 36 }}>
              {factLine}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Sans KR", data: fontData, weight: 700, style: "normal" }],
    }
  );
}
