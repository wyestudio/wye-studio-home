"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useInstagramEmbedHeight } from "@/lib/useInstagramEmbedHeight";

/**
 * 크리에이터 후기 게시물 슬라이더.
 *
 * 채널이 섞인다(인스타 임베드 + 네이버 블로그 카드). 카드 폭·높이를 맞춰
 * 한 줄로 세우고 옆으로 민다.
 *
 * 인스타는 **공식 임베드 iframe** 을 그대로 쓴다. API 키가 필요 없고 게시물이
 * 수정되면 알아서 따라온다. 다만 iframe 하나가 가볍지 않아 **화면에 들어올 때
 * 비로소 로드**한다(IntersectionObserver). 안 그러면 상세 페이지 첫 로딩이
 * 눈에 띄게 느려진다.
 */
/**
 * 카드 한 장의 높이.
 *
 * 채널마다, 같은 인스타끼리도 키가 다르다 — 사진이 정사각이냐 세로냐,
 * 좋아요 수가 붙었냐에 따라 임베드가 알려주는 높이가 달라진다.
 * 한 줄에 늘어놓으니 들쭉날쭉해서 "맞춰달라"는 요청을 받았다(2026-09-14).
 *
 * 그래서 **높이를 하나로 못 박고 넘치는 아래를 덮어 가린다.**
 * 잘리는 건 '좋아요 N개 / 댓글 달기…' 줄이라 후기를 읽는 데 지장이 없고,
 * 인스타 그리드도 세로 사진을 잘라 보여주므로 낯설지 않다.
 */
const CARD_HEIGHT = 520;

export type ReviewLink = {
  channel: "instagram" | "naver";
  url: string;
  author?: string;
  title?: string;
  excerpt?: string;
  image?: string;
  date?: string;
};

/**
 * 인스타 게시물 주소에서 임베드 주소를 만든다. /p/ 와 /reel/ 둘 다 받는다.
 *
 * ⚠️ `/embed/captioned/` 를 쓰지 않는다. 캡션까지 넣으면 게시물에 따라
 *    650~1200px 까지 늘어나 카드가 지나치게 길어진다(2026-09-14 제보).
 *    캡션 없는 기본 임베드는 머리말 + 사진 + 아이콘 줄로 끝나 한눈에 들어오고,
 *    본문은 카드를 눌러 인스타에서 읽으면 된다 — 네이버 카드와 같은 방식이다.
 */
function toEmbedUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? `https://www.instagram.com/p/${m[1]}/embed/` : null;
}

export function ReviewLinkSlider({ links, accent }: { links: ReviewLink[]; accent: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // 화살표를 언제 흐리게 할지. 끝에 닿았는데 누를 수 있어 보이면 눌러보고 실망한다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [links.length]);

  const nudge = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (links.length === 0) return null;

  return (
    <div className="relative">
      {/* 화살표는 hover 가 있는 기기에서만. 터치에서는 그냥 밀면 된다. */}
      <div className="mb-3 hidden justify-end gap-2 sm:[@media(hover:hover)]:flex">
        <SliderButton dir={-1} disabled={atStart} onClick={() => nudge(-1)} />
        <SliderButton dir={1} disabled={atEnd} onClick={() => nudge(1)} />
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-2
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/*
          카드 높이는 채널마다 다르다(인스타는 캡션 길이에 따라 제각각).
          줄 전체를 items-stretch 로 두고 네이버 카드는 늘어나게 해서,
          높이를 하나로 못 박지 않고도 아랫줄이 들쭉날쭉해 보이지 않게 한다.
        */}
        {links.map((link, i) => (
          <div key={i} className="flex w-[280px] shrink-0 snap-start sm:w-[300px]">
            {link.channel === "instagram" ? (
              <InstagramCard link={link} />
            ) : (
              <NaverCard link={link} accent={accent} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SliderButton({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "이전 후기" : "다음 후기"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-panel-border
                 bg-panel text-sm text-foreground transition-opacity disabled:opacity-30"
    >
      {dir === -1 ? "‹" : "›"}
    </button>
  );
}

/** 인스타 공식 임베드. 화면에 들어오기 전에는 자리만 잡아 둔다. */
function InstagramCard({ link }: { link: ReviewLink }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const { ref: iframeRef, height } = useInstagramEmbedHeight();
  const embed = toEmbedUrl(link.url);

  useEffect(() => {
    const el = holderRef.current;
    if (!el || show) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShow(true)),
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);

  if (!embed) return null;

  return (
    <div
      ref={holderRef}
      className="w-full overflow-hidden rounded-xl border border-panel-border bg-white"
      style={{ height: CARD_HEIGHT }}
    >
      {show ? (
        <iframe
          ref={iframeRef}
          src={embed}
          title={`인스타그램 후기${link.author ? ` · ${link.author}` : ""}`}
          loading="lazy"
          scrolling="no"
          className="w-full"
          style={{ border: 0, height: Math.max(height, CARD_HEIGHT) }}
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

/** 네이버 블로그 카드. 임베드 수단이 없어 미리보기를 우리가 그린다. */
function NaverCard({ link, accent }: { link: ReviewLink; accent: string }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-panel-border bg-panel"
      style={{ height: CARD_HEIGHT }}
    >
      <div className="flex items-center gap-2.5 border-b border-panel-border px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#03C75A] text-[13px] font-black text-white">
          N
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-foreground">{link.author || "네이버 블로그"}</p>
          {link.date && <p className="text-[11px] text-muted">{link.date}</p>}
        </div>
      </div>

      {link.image && (
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden">
          <Image
            src={link.image}
            alt={link.title || "후기 썸네일"}
            fill
            sizes="320px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      )}

      <div className="flex shrink-0 flex-col p-4">
        {link.title && (
          <p className="line-clamp-3 text-sm font-bold leading-relaxed text-foreground">
            {link.title}
          </p>
        )}
        {link.excerpt && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">{link.excerpt}</p>
        )}
        <span className="pt-3 text-xs font-semibold" style={{ color: accent }}>
          네이버 블로그에서 읽기 →
        </span>
      </div>
    </a>
  );
}
