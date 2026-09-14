"use client";

import { useEffect, useState } from "react";

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

const POSTS = [
  "https://www.instagram.com/p/DdOQX1TE9Ht/",
  "https://www.instagram.com/reel/DcN-6Zzzhvg/",
  "https://www.instagram.com/reel/DcbPf1BzfZb/",
  "https://www.instagram.com/p/DcYEb-hExBe/",
  "https://www.instagram.com/p/DcNDCV_zCEO/",
];

function toEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/embed/captioned/` : null;
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
    ⚠️ IntersectionObserver 로는 안 된다 — 스크롤 스테이지는 씬을 한 자리에
       겹쳐 쌓고 진행도로 보여주는 구조라, 모든 씬이 늘 '화면 안' 이다.
       그래서 이 씬이 실제로 등장했는지(local)로 판단하고, 한 번 붙으면
       스크롤을 되돌려도 떼지 않는다(다시 로드하면 깜빡인다).
  */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted && (reduceMotion || local > 0.02)) setMounted(true);
  }, [mounted, local, reduceMotion]);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="text-center">
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

        <PostRail mounted={mounted} />
      </div>
    </SceneShell>
  );
}

/** 옆으로 미는 게시물 줄. 스크롤 막대는 감춘다 — 우주 화면에 막대가 뜨면 튄다. */
function PostRail({ mounted }: { mounted: boolean }) {
  return (
    <div
      className="pointer-events-auto flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2
                 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {POSTS.map((url) => (
        <EmbedCard key={url} url={url} mounted={mounted} />
      ))}
    </div>
  );
}

/** 씬이 등장한 뒤에야 iframe 을 붙인다. 다섯 개를 처음부터 띄우면 홈이 무거워진다. */
function EmbedCard({ url, mounted }: { url: string; mounted: boolean }) {
  const embed = toEmbedUrl(url);
  if (!embed) return null;

  return (
    <div
      className="h-[520px] w-[280px] shrink-0 snap-start overflow-hidden rounded-xl
                 border border-panel-border bg-white sm:w-[320px]"
    >
      {mounted ? (
        <iframe
          src={embed}
          title="인스타그램 게시물"
          loading="lazy"
          scrolling="no"
          className="h-full w-full"
          style={{ border: 0 }}
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
