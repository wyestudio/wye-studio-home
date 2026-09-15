"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { PointerFillButton } from "@/components/ui/PointerFillButton";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/wouldyouescape?igsh=N2V2dXYyOHF2dDhr&igsi=N2V2dXYyOHF2dDhr",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-8 sm:w-8">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z" />
      </svg>
    ),
  },
  {
    name: "카카오 채널홈",
    url: "http://pf.kakao.com/_EGNBX",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-8 sm:w-8">
        <path d="M12 1C6.48 1 2 5.04 2 10.016c0 2.31.84 4.44 2.25 6.12-.15 2.34-.9 4.44-.9 4.44s2.16-.63 4.5-1.5c1.17.3 2.4.42 3.75.42 5.52 0 10-4.04 10-9.016S17.52 1 12 1z" />
      </svg>
    ),
  },
  {
    name: "Threads",
    url: "https://www.threads.com/@wouldyouescape",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-8 sm:w-8">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
      </svg>
    ),
  },
];

export function NoticeScene({
  index = 0,
  total = 1,
  range,
}: {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan?: number };
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <PointerFillButton href="/notice">공지사항 보러가기 →</PointerFillButton>
        <div className="flex justify-center gap-6 sm:gap-8">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-foreground"
              aria-label={link.name}
            >
              {link.icon}
            </a>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
