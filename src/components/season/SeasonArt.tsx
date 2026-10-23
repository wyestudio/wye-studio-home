/**
 * 시즌 장식 그림 — 로고 모자 · 포스터 거미줄 · 제목 옆 유령 같은 것.
 *
 * 켜고 끄는 건 이 컴포넌트가 아니라 **season.css** 다. 그림은 늘 그려 두고,
 * <html data-season="halloween"> 이 없으면 CSS 가 감춘다. 그래서 헤더처럼
 * 클라이언트 컴포넌트에서도 스킨 값을 내려받을 필요 없이 그냥 붙이면 된다.
 *
 * ⚠️ 그림은 승인 시안 패키지의 SVG 를 그대로 쓴다(public/season/halloween/ → seasonArtSvgs.ts).
 *    모양을 고치지 않는다. 위치·크기·회전은 season.css 에 있다.
 * ⚠️ 장식이라 aria-hidden 이고, 클릭을 받지 않는다(CSS 의 pointer-events).
 *
 * <img> 로 불러오지 않고 페이지 안에 직접 그린다. 안드로이드 카카오톡 인앱 브라우저에서
 * 왼쪽 위 거미줄 칸에 달 그림이 그려지고, 사이트 안에서 페이지를 옮겨도 계속 그대로인 일이
 * 있었다(2026-10-23 대표님). 서버는 각 파일을 제대로 내주고 있었고 칸의 위치·투명도도 거미줄
 * 그대로였다 — 브라우저가 그림 파일 두 장을 섞어 그린 것이다. 파일을 따로 불러오지 않으면
 * 섞일 여지가 없다. 그림이 0.1~0.6KB 라 페이지가 무거워지지 않는다.
 */
import { SEASON_ART_SVGS } from "@/components/season/seasonArtSvgs";

export type SeasonArtName =
  | "witch-hat"
  | "pumpkin"
  | "ghost"
  | "bat-orange"
  | "bat-dark"
  | "moon"
  | "corner-web-spider"
  | "castle-ground"
  | "poster-web"
  | "sparkle";

/**
 * fit — 칸과 그림 비율이 다를 때 맞추는 법(SVG preserveAspectRatio). 기본은 칸 안에 다 보이게.
 *   <img> 의 object-fit · object-position 은 <svg> 에 안 먹으므로 그 자리는 이걸로 정한다.
 */
export function SeasonArt({
  art,
  className = "",
  fit,
}: {
  art: SeasonArtName;
  className?: string;
  fit?: string;
}) {
  const { viewBox, attrs, inner } = SEASON_ART_SVGS[art];
  const [, , w, h] = viewBox.split(" ").map(Number);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      preserveAspectRatio={fit}
      {...attrs}
      aria-hidden
      focusable="false"
      // <img> 는 그림 비율을 스스로 알지만 <svg> 는 아니다 — 폭만 정한 자리에서 높이가 맞게.
      style={{ aspectRatio: `${w} / ${h}` }}
      className={`season-art ${className}`}
      // 내용은 저장소에 있는 고정 SVG 다(seasonArtSvgs.ts). 사용자 입력이 섞이지 않는다.
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/** 제목 위에 얹는 작은 영문 시즌 문구. 장식이라 읽어 주지 않는다. */
export function SeasonLabel({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p
      aria-hidden
      // 자간은 좁은 화면에서 줄인다 — 390px 에서 'NEWS FROM THE SPOOKY UNIVERSE' 가 두 줄로 꺾였다.
      className={`season-only season-label flex items-center justify-center gap-2 whitespace-nowrap text-micro tracking-[0.16em] sm:tracking-[0.3em] ${className}`}
    >
      <SeasonArt art="sparkle" className="season-label-spark" />
      {text}
      <SeasonArt art="sparkle" className="season-label-spark" />
    </p>
  );
}

/**
 * 포스터 장식 — 왼쪽 위 거미줄, 오른쪽 아래 호박, 오른쪽 위 HALLOWEEN EDITION 태그.
 * 테마 목록 카드와 테마 상세 포스터가 같이 쓴다.
 *
 * 부모(포스터 칸)에 position 이 있어야 한다. 장식은 칸 **안에** 붙어서 카드와 같이
 * 움직인다.
 * compact — 모바일 테마 상세처럼 포스터가 7rem 남짓일 때. 태그를 빼고 그림을 줄인다.
 */
export function PosterSeasonDecor({ compact = false }: { compact?: boolean }) {
  return (
    <span aria-hidden className={`season-only season-poster-decor ${compact ? "season-poster-decor--compact" : ""}`}>
      <SeasonArt art="poster-web" className="season-poster-web" />
      <SeasonArt art="pumpkin" className="season-poster-pumpkin" />
      <span className="season-poster-tag">
        <SeasonArt art="sparkle" className="season-poster-tag-spark" />
        HALLOWEEN
        {/* 좁은 카드(모바일 2열)에서는 길어서 거미줄과 겹친다 — 거기서는 'HALLOWEEN' 만. */}
        <span className="season-poster-tag-more">EDITION</span>
      </span>
    </span>
  );
}
