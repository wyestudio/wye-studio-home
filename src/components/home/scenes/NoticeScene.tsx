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
    // 실제 Threads 로고(「@」 모양) — Simple Icons(CC0) 13.21.0 의 threads.svg
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current sm:h-8 sm:w-8">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
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
              // 아이콘은 23px 그대로, 누르는 영역만 넓힌다(-m-3 로). ⚠️ 48px 인 이유 — 홈 씬은 transform 으로 살짝 줄어서 44 로 두면 41px 로 잡힌다(2026-10-05 실측).
              // 주변 여백을 먹어 배치는 그대로). WCAG 2.5.8 · Apple HIG 44pt.
              className="-m-3 flex h-12 w-12 items-center justify-center p-3 text-muted transition-colors hover:text-foreground"
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
