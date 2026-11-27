import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSkin } from "@/lib/siteSeason";
import { XmasGameLoader } from "./XmasGameLoader";
import { XMAS_GAME_PAGE_TITLE, XMAS_GIFT_GOAL, shareHeadline, type ShareRecord } from "./xmasGameShared";

/**
 * 게임 화면의 서버 쪽 — 주소가 둘이라(/santa-calendar, 기록을 실은 공유 주소 /santa-calendar/r/…) 같이 쓴다.
 *
 * 크리스마스 스킨이 켜져 있을 때만 게임을 연다(어드민 > 시즌 스킨). 끄면 1분 안에 닫힌다.
 * ⚠️ 요청마다 서버에서 그리지 않는다 — 두 주소 모두 한 번 그려 두고 1분마다 스킨만 다시 확인한다.
 *    headers() · cookies() · searchParams 를 여기서 읽으면 요청마다 그리는 화면으로 바뀐다. 주소의 ?칸(from)은
 *    브라우저에서 읽는다(xmasGameShared.ts).
 */
export async function XmasGameScreen() {
  if ((await getSiteSkin()) !== "christmas") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center text-white">
        <h1 className="text-h2 font-extrabold">{XMAS_GAME_PAGE_TITLE}</h1>
        <p className="text-body">지금은 이벤트 기간이 아니에요.</p>
        <Link href="/" className="rounded-lg bg-white px-5 py-3 text-body font-semibold text-black">
          홈으로
        </Link>
      </main>
    );
  }
  return <XmasGameLoader />;
}

/** 공유 카드의 설명 — 무슨 게임인지 한 줄, 받는 것 한 줄. */
const SHARE_DESCRIPTION =
  "크리스마스 어드벤트 캘린더 두더지 잡기! 눈사람과 루돌프는 터치, 산타는 터치 금지. 게임하고 크리스마스 선물 받아가세요.";

/**
 * 게임 화면의 제목 · 설명 · 공유 카드 글. record 가 있으면(공유 주소) 카드 제목이 그 사람의 기록으로 바뀐다 —
 * "랭킹 3위, 61점! 내 기록에 도전해 보세요 | 우주이스케이프". 카드 그림은 같은 폴더의 opengraph-image.tsx 가 붙인다.
 *
 * 검색에는 올리지 않는다 — 테마 상세의 이벤트 블록과 공유 링크로 닿는 화면이고, 기간이 끝나면 닫힌다(sitemap.ts 에도 없다).
 * ⚠️ robots.ts 로는 막지 않는다. 거기서 막으면 인스타 DM 같은 곳이 공유 카드를 읽어 가지 못한다.
 */
export function xmasGameMetadata(record: ShareRecord | null): Metadata {
  const pageTitle = `${XMAS_GAME_PAGE_TITLE} | 우주이스케이프`;
  const cardTitle = record ? `${shareHeadline(record)} 내 기록에 도전해 보세요 | 우주이스케이프` : pageTitle;
  return {
    title: { absolute: pageTitle },
    description: `문이 열리면 눈사람과 루돌프를 터치하세요. 다섯 라운드 동안 ${XMAS_GIFT_GOAL}점 이상이면 산타의 선물이 열려요.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: cardTitle,
      description: SHARE_DESCRIPTION,
      siteName: "우주이스케이프",
      locale: "ko_KR",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: cardTitle, description: SHARE_DESCRIPTION },
  };
}
