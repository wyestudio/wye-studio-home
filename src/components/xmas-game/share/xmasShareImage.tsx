import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { characterSvg, type Kind } from "../xmasGameArt";
import { XMAS_GAME_TITLE, type ShareRecord } from "../xmasGameShared";

/**
 * 「산타의 어드벤트 캘린더」 공유 카드 그림(1200×630) — 카카오톡 · 인스타 DM 에 링크를 붙였을 때 뜨는 그림.
 *
 * 짜임(2026-11-26 대표님)
 *   - 바탕은 게임 화면과 같다: 솔잎색 밤 + 눈 + 아래 눈 언덕.
 *   - 왼쪽에 달력 문 한 칸과 캐릭터(눈사람 · 루돌프 · 산타 — 공유할 때마다 하나를 뽑아 주소에 싣는다).
 *   - 오른쪽에 공유한 사람의 랭킹 · 점수(게임 점수판의 종이 칸 · 빨간 칸과 같은 모양)와 "도전해 보세요" 한 줄.
 *     랭킹에 등록하지 않은 사람은 라운드 · 점수. 기록 없는 주소(/santa-calendar)는 "게임하고 크리스마스 선물 받아가세요!".
 *   - 오른쪽 위에 산타모자 쓴 로고와 이름 — 작지만 누가 만든 것인지는 보이게.
 *
 * ⚠️ 그림은 주소마다 한 번 그려 두고 다시 쓴다(src/app/santa-calendar 아래의 opengraph-image.tsx 두 곳). 요청마다 달라지는 값
 *    (쿠키 · 헤더 · DB)을 여기서 읽지 않는다 — 읽는 순간 요청마다 그리는 그림이 되고, 그리는 값이 비싸다(wye-server-cost).
 * ⚠️ 글꼴(Jua-share.ttf)에는 **이 카드에 나오는 글자만** 들어 있다. 문구를 고치면 빠진 글자가 네모로 찍힌다 —
 *    같은 폴더의 README 대로 다시 만든다.
 * ⚠️ 색은 xmasScene.module.css 의 이름표와 같은 값을 적어 둔 것이다(그림은 CSS 를 못 읽는다). 저쪽을 바꾸면 여기도 맞춘다.
 * ⚠️ 여기 JSX 는 브라우저가 아니라 그림 엔진(satori)이 그린다. 자식이 둘 이상인 칸에는 display:flex 를 꼭 적는다.
 */

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
export const SHARE_IMAGE_ALT = `우주이스케이프 크리스마스 이벤트 — ${XMAS_GAME_TITLE}`;

const DIR = "src/components/xmas-game/share";

const C = {
  pineLight: "#1a5745",
  pine: "#0f3d33",
  pineDeep: "#0a2a23",
  snow: "#fff6dc",
  snowDim: "#cfe3d6",
  hill: "#9fc4b3",
  paper: "#fff9e8",
  paperLip: "#b79d62",
  ink: "#153e35",
  inkMute: "#5d7268",
  red: "#c8372f",
  gold: "#f1b74c",
  goldSoft: "#fff3cc",
  shadow: "rgba(0, 0, 0, 0.35)",
};

// 눈송이 — 난수로 찍되 씨앗을 고정해 언제 그려도 같은 그림이 나온다. 글 · 점수 칸 · 로고 위에는 찍지 않는다(글자가 얼룩져 보인다)
const SNOW = (() => {
  let seed = 20261225;
  const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const onText = (x: number, y: number) => (x > 490 && x < 1010 && y > 130 && y < 500) || (x > 830 && y < 140);
  const flakes: { x: number; y: number; r: number; o: number }[] = [];
  while (flakes.length < 44) {
    const flake = { x: next() * 1200, y: next() * 520, r: 3 + next() * 7, o: 0.18 + next() * 0.5 };
    if (!onText(flake.x, flake.y)) flakes.push(flake);
  }
  return flakes;
})();

let assets: Promise<{ font: Buffer; logo: string }> | undefined;
function loadAssets() {
  assets ??= Promise.all([
    readFile(join(process.cwd(), DIR, "Jua-share.ttf")),
    readFile(join(process.cwd(), DIR, "logo-santa.png"), "base64"),
  ]).then(([font, logo]) => ({ font, logo: `data:image/png;base64,${logo}` }));
  return assets;
}

/** 캐릭터 SVG 문자열을 <img> 가 읽을 수 있는 주소로. */
function characterSrc(kind: Kind): string {
  const svg = characterSvg(kind, null, false).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="412" ');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** 점수판 한 칸 — 작은 이름표 위에 큰 숫자와 단위. */
function Stat({ label, value, unit, red }: { label: string; value: string; unit: string; red?: boolean }) {
  // 숫자가 길어지면(랭킹 1234위) 칸이 그림 밖으로 나가지 않게 한 단계씩 줄인다
  const size = value.length <= 2 ? 108 : value.length === 3 ? 92 : 76;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "22px 36px 24px",
        borderRadius: 30,
        color: red ? C.paper : C.ink,
        background: red ? C.red : C.paper,
        boxShadow: `0 10px 0 ${C.shadow}`,
      }}
    >
      <div style={{ fontSize: 30, color: red ? C.goldSoft : C.inkMute }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 4 }}>
        <div style={{ fontSize: size, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 48, marginLeft: 6 }}>{unit}</div>
      </div>
    </div>
  );
}

/** record 가 없으면 기록 없는 카드(게임 주소를 그대로 공유했을 때). */
export async function renderShareImage(record: ShareRecord | null): Promise<ImageResponse> {
  const { font, logo } = await loadAssets();
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          color: C.snow,
          background: `linear-gradient(180deg, ${C.pineLight} 0%, ${C.pine} 55%, ${C.pineDeep} 100%)`,
          fontFamily: "Jua",
        }}
      >
        {SNOW.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: 9999,
              background: "#fff",
              opacity: s.o,
            }}
          />
        ))}

        {/* 눈 언덕 — 뒤 언덕, 앞 언덕 */}
        <svg width="1200" height="170" viewBox="0 0 1200 170" style={{ position: "absolute", left: 0, bottom: 0 }}>
          <path d="M0 96Q260 10 600 78T1200 40V170H0Z" fill={C.hill} />
          <path d="M0 132Q330 62 700 124T1200 104V170H0Z" fill={C.snow} />
        </svg>

        {/* 산타모자 쓴 로고와 이름 */}
        <div style={{ position: "absolute", top: 34, right: 52, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 32, marginRight: 14, marginTop: 22 }}>우주이스케이프</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- 화면이 아니라 그림 엔진이 그리는 JSX 다 */}
          <img src={logo} width={98} height={88} alt="" />
        </div>

        {/* 달력 문 한 칸과 캐릭터 */}
        <div
          style={{
            position: "absolute",
            left: 84,
            top: 122,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: 376,
            height: 376,
            overflow: "hidden",
            border: `14px solid ${C.paper}`,
            borderRadius: 48,
            background: "radial-gradient(ellipse at bottom, #769383, #243f36)",
            boxShadow: `0 12px 0 ${C.paperLip}, 0 26px 40px ${C.shadow}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같다 */}
          <img src={characterSrc(record?.who ?? "snow")} width={320} height={330} alt="" style={{ marginBottom: -26 }} />
        </div>

        <div style={{ position: "absolute", left: 524, top: 150, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 38, color: C.gold }}>{XMAS_GAME_TITLE}</div>
          {record ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", marginTop: 26 }}>
                {record.rank ? (
                  <Stat label="내 랭킹" value={String(record.rank)} unit="위" />
                ) : (
                  <Stat label="내 기록" value={String(record.round)} unit="라운드" />
                )}
                <div style={{ display: "flex", marginLeft: 24 }}>
                  <Stat label="내 점수" value={String(record.score)} unit="점" red />
                </div>
              </div>
              <div style={{ marginTop: 44, fontSize: 46 }}>내 기록에 도전해 보세요!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 82, lineHeight: 1.22 }}>
              <div>게임하고</div>
              <div style={{ color: C.gold }}>크리스마스 선물</div>
              <div>받아가세요!</div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [{ name: "Jua", data: font, style: "normal", weight: 400 }],
      // 오래 쥐고 있으라고 직접 적는다. 안 적으면 "받자마자 낡은 것"(max-age=0)으로 나가서, Vercel 이 요청이 올 때마다
      // 뒤에서 그림을 다시 그린다(테스트 서버에서 x-vercel-cache: STALE 로 확인). 그림이 바뀌면 주소 뒤의 ?값이 바뀐다.
      headers: { "cache-control": "public, immutable, no-transform, max-age=31536000, s-maxage=31536000" },
    },
  );
}
