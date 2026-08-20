import type { TarotCard } from "./cards";

export const RAINBOW_GRADIENT =
  "linear-gradient(90deg, #ff00c8, #ff003c, #ff7a00, #ffe600, #00e676, #00d9ff, #3d5bff, #ff00c8)";

const MOTIFS: Array<(props: { className?: string }) => React.ReactElement> = [
  // 0 별의 문 — 별 폭죽
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path
        d="M50 12 L58 40 L86 46 L58 54 L50 82 L42 54 L14 46 L42 40 Z"
        strokeLinejoin="round"
      />
      <circle cx="78" cy="22" r="3" fill="currentColor" stroke="none" />
      <circle cx="20" cy="76" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 1 달의 문 — 초승달
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M60 18 A34 34 0 1 0 60 82 A26 26 0 1 1 60 18 Z" strokeLinejoin="round" />
      <circle cx="76" cy="30" r="2" fill="currentColor" stroke="none" />
      <circle cx="82" cy="46" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 2 시계의 문 — 시계
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="50" cy="50" r="34" />
      <path d="M50 50 L50 28" strokeLinecap="round" />
      <path d="M50 50 L68 58" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  // 3 열쇠의 문 — 열쇠
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="34" cy="34" r="16" />
      <path d="M45 45 L78 78" strokeLinecap="round" />
      <path d="M68 68 L78 58" strokeLinecap="round" />
      <path d="M74 74 L82 66" strokeLinecap="round" />
    </svg>
  ),
  // 4 미로의 문 — 미로
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="16" y="16" width="68" height="68" rx="4" />
      <path d="M30 16 V56 H70 V30 H44" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M84 60 H50 V70" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // 5 불꽃의 문 — 불꽃
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path
        d="M50 14 C60 32 74 40 66 58 C74 56 80 66 74 76 C68 88 32 88 26 76 C20 64 28 58 34 62 C24 44 40 34 50 14 Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // 6 거울의 문 — 손거울
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <ellipse cx="50" cy="38" rx="26" ry="30" />
      <path d="M50 68 L50 90" strokeLinecap="round" />
      <path d="M36 90 L64 90" strokeLinecap="round" />
    </svg>
  ),
  // 7 바람의 문 — 바람 소용돌이
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M14 36 H66 a12 12 0 1 0 -12 -12" strokeLinecap="round" />
      <path d="M14 58 H78 a12 12 0 1 1 -12 12" strokeLinecap="round" />
      <path d="M24 78 H58" strokeLinecap="round" />
    </svg>
  ),
  // 8 지도의 문 — 접힌 지도
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 24 L40 16 L60 24 L82 16 L82 76 L60 84 L40 76 L18 84 Z" strokeLinejoin="round" />
      <path d="M40 16 V76" strokeLinecap="round" />
      <path d="M60 24 V84" strokeLinecap="round" />
      <path d="M28 50 L34 44 L40 52" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // 9 꿈의 문 — 문
  ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M28 86 V30 A22 22 0 0 1 72 30 V86" strokeLinejoin="round" />
      <path d="M20 86 H80" strokeLinecap="round" />
      <circle cx="58" cy="58" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  ),
];

export function CardBack() {
  return (
    <div
      className="h-full w-full overflow-hidden rounded-xl p-[3px]"
      style={{ background: RAINBOW_GRADIENT }}
    >
      <div className="relative flex h-full w-full items-center justify-center rounded-[0.6rem] bg-black">
        <svg viewBox="0 0 100 100" className="h-16 w-16 text-white/25" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M28 86 V30 A22 22 0 0 1 72 30 V86" strokeLinejoin="round" />
          <path d="M20 86 H80" strokeLinecap="round" />
        </svg>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)",
          }}
        />
      </div>
    </div>
  );
}

export function CardFront({ card }: { card: TarotCard }) {
  const Motif = MOTIFS[card.motif] ?? MOTIFS[0];
  return (
    <div
      className="h-full w-full overflow-hidden rounded-xl p-[3px]"
      style={{ background: RAINBOW_GRADIENT }}
    >
      <div className="flex h-full w-full flex-col items-center justify-start gap-2 rounded-[0.6rem] bg-black px-3 py-4 text-center">
        <Motif className="h-10 w-10 shrink-0 text-white" />
        <p className="text-sm font-bold text-white">{card.name}</p>
        <p className="text-[11px] leading-snug text-white/80">{card.fortune}</p>
      </div>
    </div>
  );
}
