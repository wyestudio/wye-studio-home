import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 공유 카드(OG 이미지)에 쓸 한글 폰트를 가져온다.
 *
 * 왜 이런 게 필요한가 —
 * 저장소에 있는 `NotoSansKR-Bold-subset.woff` 는 **글자 21자짜리 서브셋**이다
 * ("우주이스케이프" + "방탈출로 시작하는 자연스러운 만남" 에 쓰인 글자뿐).
 * 고정 문구 하나를 그릴 때는 충분했지만, 테마명처럼 내용이 바뀌는 글자를
 * 넣으면 없는 글자가 통째로 빈칸으로 나온다.
 *
 * 한글 전체를 담은 폰트는 5MB가 넘어 저장소에 넣기 부담스럽다. 그래서
 * **그릴 글자만** Google Fonts 에서 받아온다(`text=` 파라미터). 보통 몇 KB다.
 *
 * ⚠️ satori(next/og)는 woff2 를 못 읽는다. Google Fonts 는 최신 브라우저에게는
 *    woff2 를 주므로, **옛 User-Agent** 로 요청해 TTF 를 받아와야 한다.
 *
 * ⚠️ 네트워크에 기대는 부분이라 실패할 수 있다. 그때는 저장소의 서브셋으로
 *    돌아간다 — 글자가 일부 빠져도 이미지 생성 자체는 실패하지 않아야 한다.
 */

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";

/** 이 UA 로 요청해야 woff2 대신 truetype 을 준다. */
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko)";

async function loadLocalSubset(): Promise<ArrayBuffer> {
  const buf = await readFile(
    join(process.cwd(), "src/app/(site)/fonts/NotoSansKR-Bold-subset.woff")
  );
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function loadOgFont(text: string): Promise<ArrayBuffer> {
  // 중복 글자는 보낼 이유가 없다. URL 도 짧아진다.
  const chars = [...new Set(text)].join("");

  try {
    const cssUrl = `${GOOGLE_FONTS_CSS}?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(chars)}`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } }).then((r) => {
      if (!r.ok) throw new Error(`css ${r.status}`);
      return r.text();
    });

    const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
    if (!match) throw new Error("truetype URL 을 찾지 못함");

    const font = await fetch(match[1]).then((r) => {
      if (!r.ok) throw new Error(`font ${r.status}`);
      return r.arrayBuffer();
    });
    return font;
  } catch (err) {
    console.error("[og] Google Fonts 에서 폰트를 못 받아 저장소 서브셋으로 대체합니다", err);
    return loadLocalSubset();
  }
}
