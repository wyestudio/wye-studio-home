"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { useSiteSkin } from "@/components/season/SeasonContext";
import { characterSvg } from "@/components/xmas-game/xmasGameArt";
import { XMAS_GAME_EVENT, XMAS_GAME_PATH, gameHref } from "@/components/xmas-game/xmasGameShared";
import { pushGa4Event } from "@/lib/analytics";
import { GROUP_ACCENT, GROUP_ENTRY, groupBookingHref } from "@/lib/groupBooking";

const SANTA = characterSvg("santa", null, false);
const noop = () => () => {};

/**
 * 홈 헤더 오른쪽의 바로가기 버튼(2026-11-27 대표님).
 *
 * 메뉴(소개 · 테마 · 신청조회 · 공지)는 "둘러보기" 이고, 이 버튼들은 "바로 하러 가기" 다. 흔히 쓰는 짜임대로
 * 메뉴 끝에 선 하나를 긋고 그 오른쪽에 버튼 모양으로 둔다 — 글자 링크와 구분되게.
 *   - 단체 예약: 늘 있다. 상세 페이지 · 단체 예약 페이지의 자홍(GROUP_ACCENT)으로 채운다(같은 날 대표님 — 눈에 띄게).
 *     글자는 단체 페이지 배지와 같은 검정.
 *   - 크리스마스 게임: 크리스마스 스킨 동안만. 시즌이 정한 brand 색.
 * 홈에서만 단다(Header 가 isHome 일 때). 휴대폰은 로고와 메뉴 버튼 사이에 작게(compact).
 *
 * - 단체 예약은 진입 지점(home_header)을 주소에 싣는다 — 단체 페이지가 어디서 왔는지 센다.
 * - 게임은 같은 창에서 연다. 게임의 「돌아가기」 는 실어 보낸 주소(/)로 돌아온다.
 */
export function HomeHeaderCtas({ compact = false }: { compact?: boolean }) {
  const christmas = useSiteSkin() === "christmas";
  // 서버가 그릴 때는 주소를 모른다 — 칸 없는 게임 주소로 그리고 브라우저에서 채운다
  const game = useSyncExternalStore(noop, gameHref, () => XMAS_GAME_PATH);

  // 버튼 크기 — 데스크톱은 메뉴 글자 옆에서 눌리기 쉬운 36px, 휴대폰은 헤더 줄 안에 들어가는 32px
  const size = compact ? "h-8 gap-1 px-2.5 text-micro" : "h-9 gap-1.5 px-3.5 text-label";
  const lift = "transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  return (
    <div className={`flex shrink-0 items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <Link
        href={groupBookingHref(GROUP_ENTRY.homeHeader)}
        className={`inline-flex items-center whitespace-nowrap rounded-lg font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${lift} ${size}`}
        style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
      >
        단체 예약
      </Link>
      {christmas && (
        <a
          href={game}
          onClick={() => pushGa4Event(XMAS_GAME_EVENT.open, { themeLabel: "홈 헤더" })}
          aria-label="크리스마스 게임"
          className={`inline-flex items-center whitespace-nowrap rounded-lg bg-brand font-semibold text-brand-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${lift} ${size}`}
        >
          {/* 산타 얼굴 — 글자 높이보다 조금 크게. 이모지는 기기마다 달라 그림(SVG)으로 */}
          <span
            aria-hidden
            className={`block shrink-0 [&>svg]:block [&>svg]:w-full ${compact ? "w-4" : "w-5"}`}
            dangerouslySetInnerHTML={{ __html: SANTA }}
          />
          {/* 380px 아래 휴대폰은 글자를 감추고 산타만 — 로고 · 단체 예약 · 메뉴 버튼과 한 줄에 들어가게 */}
          {compact ? <span className="max-[379px]:sr-only">게임</span> : "크리스마스 게임"}
        </a>
      )}
    </div>
  );
}
