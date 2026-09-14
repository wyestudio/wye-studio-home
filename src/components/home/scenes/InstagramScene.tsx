"use client";

import { useEffect, useRef, useState } from "react";

import { useInstagramEmbedHeight } from "@/lib/useInstagramEmbedHeight";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";

/**
 * 우리 인스타 게시물 섹션.
 *
 * 테마 상세의 '후기' 와 헷갈리기 쉬운데 성격이 다르다. 저긴 **참여자가 쓴
 * 후기**고, 여긴 **우리가 올린 소식**이다. 그래서 홈에 따로 둔다.
 *
 * 게시물은 인스타 공식 임베드를 그대로 쓴다.
 *   · API 키·토큰이 필요 없다 (Graph API 는 비즈니스 계정 + 페이지 연결 + 토큰
 *     갱신이 필요하고, CDN 이미지 주소는 서명이 붙어 곧 만료된다)
 *   · 게시물을 수정하면 사이트도 알아서 따라온다
 *   ⚠️ 영상은 인라인 재생이 안 된다. 썸네일 + 재생 버튼이 뜨고 누르면 인스타로 간다.
 *
 * ⚠️ 목록이 코드에 박혀 있다. 어드민에서 고치려면 테이블과 화면이 하나씩
 *    더 필요해서 지금은 여기서 주소만 갈아끼운다. 새 게시물을 넣고 싶으면
 *    아래 POSTS 에 주소를 추가하면 된다.
 */
const HANDLE = "wouldyouescape";

/** 임베드를 그릴 기준 폭. 이보다 좁히면 임베드가 레이아웃을 다시 잡아 오히려 키가 커진다. */
const BASE_WIDTH = 320;

/**
 * 카드 아래에서 잘라낼 높이.
 *
 * 임베드 맨 아래에는 '댓글 달기…' 줄이 붙는다. 우리 사이트에서는 댓글을 달 수
 * 없으므로(눌러도 인스타로 갈 뿐) 헛된 입력칸이다. 지우라는 요청을 받았는데
 * 크로스 오리진 iframe 이라 안을 건드릴 수 없어, 그 높이만큼 아래를 덮어 가린다.
 */
const COMMENT_BAR = 50;

const POSTS = [
  "https://www.instagram.com/p/DdOQX1TE9Ht/",
  "https://www.instagram.com/reel/DcN-6Zzzhvg/",
  "https://www.instagram.com/reel/DcbPf1BzfZb/",
  "https://www.instagram.com/p/DcYEb-hExBe/",
  "https://www.instagram.com/p/DcNDCV_zCEO/",
];

/*
  ⚠️ 여기서는 `/embed/captioned/` 를 쓰지 않는다.
     캡션까지 넣으면 임베드가 알려주는 높이가 게시물에 따라 650~1200px 까지
     벌어진다. 홈은 한 화면에 고정된 씬이라 그 높이가 들어가지 않는다
     (고정 높이로 잘랐더니 아래가 잘린다는 제보를 받았다 — 2026-09-14).
     캡션 없는 기본 임베드는 머리말 + 사진 + 아이콘 줄로 끝나 훨씬 납작하다.
     여기는 "인스타에 소식이 있다"를 보여주는 자리지 글을 읽는 자리가 아니다.
*/
function toEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/embed/` : null;
}

export function InstagramScene({
  index = 0,
  total = 1,
  range,
}: {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan?: number };
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);

  /*
    임베드를 언제 붙일지.

    ⚠️ IntersectionObserver 도, 씬 진행도(local)도 쓰지 않는다.
       · IO : 스크롤 스테이지는 씬을 한 자리에 겹쳐 쌓으므로 모든 씬이 늘 '화면 안'이다.
       · local : 컨텍스트 갱신 타이밍에 따라 안 붙는 경우가 있었다(2026-09-14).
       가장 단순하고 확실한 신호인 **문서 스크롤 위치**를 쓴다. 한 화면쯤
       내려왔으면 곧 이 섹션이 나온다는 뜻이므로 그때 붙인다.
       한 번 붙으면 떼지 않는다 — 되감을 때마다 다시 불러오면 깜빡인다.
  */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (reduceMotion) {
      setMounted(true);
      return;
    }
    const check = () => {
      if (window.scrollY > window.innerHeight * 0.6) {
        setMounted(true);
        window.removeEventListener("scroll", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [reduceMotion]);

  /*
    카드 축소 비율.

    ⚠️ 인스타 임베드는 폭을 좁혀도 키가 그만큼 줄지 않는다(머리말·아이콘 줄은
       높이가 고정이다). 그래서 폭이 아니라 **통째로 축소**한다.

    ⚠️ 예전에는 "화면 높이 - 200px" 같은 어림수로 계산했는데, 기기마다
       제목 줄 높이도 브라우저 UI 높이도 달라서 여전히 위가 잘렸다
       (2026-09-14 제보). 어림수를 버리고 **실제로 남는 높이를 재서** 맞춘다.
  */
  const areaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const area = areaRef.current;
    const header = headerRef.current;
    if (!area || !header || naturalHeight <= 0) return;

    const fit = () => {
      // 가로 스크롤 막대와 카드 아래 여백 몫으로 조금 남긴다.
      const room = area.clientHeight - header.offsetHeight - 40;
      setScale(Math.max(0.45, Math.min(1, room / naturalHeight)));
    };
    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(area);
    ro.observe(header);
    return () => ro.disconnect();
  }, [naturalHeight]);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      <div ref={areaRef} className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-5">
        <div ref={headerRef} className="shrink-0 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-glow">INSTAGRAM</p>
          <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">소식은 인스타에 먼저 올라와요</h2>
          <a
            href={`https://www.instagram.com/${HANDLE}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            @{HANDLE} →
          </a>
        </div>

        <PostRail
          mounted={mounted}
          scale={scale}
          onNaturalHeight={(h) => setNaturalHeight((prev) => Math.max(prev, h))}
        />
      </div>
    </SceneShell>
  );
}

/** 옆으로 미는 게시물 줄. 스크롤 막대는 감춘다 — 우주 화면에 막대가 뜨면 튄다. */
function PostRail({
  mounted,
  scale,
  onNaturalHeight,
}: {
  mounted: boolean;
  scale: number;
  onNaturalHeight: (h: number) => void;
}) {
  return (
    <div
      /* ⚠️ pointer-events-auto 를 주면 안 된다. 씬들은 한 자리에 겹쳐 쌓이고
         SceneShell 이 '보이는 씬만' 클릭을 받도록 pointer-events 를 꺼 두는데,
         자식이 auto 로 되살리면 안 보이는 씬이 위 레이어에서 클릭을 가로챈다.
         실제로 이것 때문에 히어로의 YES 가 안 눌렸다(2026-09-14). */
      className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-1 pb-2
                 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {POSTS.map((url) => (
        <EmbedCard
          key={url}
          url={url}
          mounted={mounted}
          scale={scale}
          onNaturalHeight={onNaturalHeight}
        />
      ))}
    </div>
  );
}

/** 씬이 등장한 뒤에야 iframe 을 붙인다. 다섯 개를 처음부터 띄우면 홈이 무거워진다. */
function EmbedCard({
  url,
  mounted,
  scale,
  onNaturalHeight,
}: {
  url: string;
  mounted: boolean;
  scale: number;
  onNaturalHeight: (h: number) => void;
}) {
  const { ref, height } = useInstagramEmbedHeight();
  const embed = toEmbedUrl(url);

  // '댓글 달기…' 줄을 잘라낸 뒤의 높이가 이 카드가 실제로 차지하는 키다.
  const visibleHeight = Math.max(200, height - COMMENT_BAR);

  useEffect(() => {
    onNaturalHeight(visibleHeight);
  }, [visibleHeight, onNaturalHeight]);

  if (!embed) return null;

  return (
    <div
      className="shrink-0 snap-start self-center overflow-hidden rounded-xl border border-panel-border bg-white"
      style={{ width: BASE_WIDTH * scale, height: visibleHeight * scale }}
    >
      {mounted ? (
        <iframe
          ref={ref}
          src={embed}
          title="인스타그램 게시물"
          loading="lazy"
          scrolling="no"
          style={{
            border: 0,
            width: BASE_WIDTH,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          allow="encrypted-media; picture-in-picture"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-panel">
          <span className="text-xs text-muted">불러오는 중…</span>
        </div>
      )}
    </div>
  );
}
