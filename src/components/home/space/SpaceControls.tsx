"use client";

/**
 * 장면 조작 버튼 — 확대 · 축소 · 처음 시점 · 일시정지, 그리고 시네마틱(자동 탐색). 넓은 화면용.
 * 휴대폰은 아래 낱개 버튼(Reset · Pause)을 넘기기 줄에 끼운다.
 * 마우스 없이도 장면의 모든 기능을 쓸 수 있게 하는 길이다. 아이콘은 글자가 아니라 SVG
 * (SUIT 에 없는 기호가 기기마다 다른 글꼴로 떨어진다 — wye-customer-facing).
 */
const BTN =
  "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-background/70 text-muted backdrop-blur transition-colors hover:border-line-strong hover:text-white";
const BTN_TOUCH = BTN.replace("h-10 w-10", "h-11 w-11");

export function SpaceControls({
  paused,
  cinema,
  onZoom,
  onReset,
  onPause,
  onCinema,
}: {
  paused: boolean;
  cinema: boolean;
  onZoom: (step: number) => void;
  onReset: () => void;
  onPause: () => void;
  onCinema: () => void;
}) {
  const btn = BTN;

  return (
    <div className="absolute bottom-6 right-[5%] flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onCinema}
        aria-pressed={cinema}
        data-track="홈 행성 시네마틱"
        className={`mb-1 rounded-full border px-3 py-1.5 text-micro font-semibold transition-colors ${
          cinema ? "border-line-strong bg-fill-strong text-white" : "border-line bg-background/70 text-muted hover:text-white"
        }`}
      >
        시네마틱 뷰
      </button>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => onZoom(0.15)} aria-label="확대" data-track="홈 행성 확대">
          <Icon d="M12 6v12M6 12h12" />
        </button>
        <button type="button" className={btn} onClick={() => onZoom(-0.15)} aria-label="축소" data-track="홈 행성 축소">
          <Icon d="M6 12h12" />
        </button>
        <button type="button" className={btn} onClick={onReset} aria-label="처음 시점으로" data-track="홈 행성 시점 초기화">
          <Icon d={RESET} />
        </button>
        <button
          type="button"
          className={btn}
          onClick={onPause}
          aria-pressed={paused}
          aria-label={paused ? "움직임 다시 재생" : "움직임 멈추기"}
          data-track="홈 행성 일시정지"
        >
          {paused ? <Icon d={PLAY} fill /> : <Icon d={PAUSE} />}
        </button>
      </div>
    </div>
  );
}

/** 휴대폰 넘기기 줄에 끼우는 낱개 버튼 — 손가락 기준 44px */
SpaceControls.Reset = function Reset({ onReset }: { onReset: () => void }) {
  return (
    <button type="button" className={BTN_TOUCH} onClick={onReset} aria-label="처음 시점으로" data-track="홈 행성 시점 초기화">
      <Icon d={RESET} />
    </button>
  );
};

SpaceControls.Pause = function Pause({ paused, onPause }: { paused: boolean; onPause: () => void }) {
  return (
    <button
      type="button"
      className={BTN_TOUCH}
      onClick={onPause}
      aria-pressed={paused}
      aria-label={paused ? "움직임 다시 재생" : "움직임 멈추기"}
      data-track="홈 행성 일시정지"
    >
      {paused ? <Icon d={PLAY} fill /> : <Icon d={PAUSE} />}
    </button>
  );
};

const RESET = "M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6";
const PLAY = "M8 5l11 7-11 7z";
const PAUSE = "M8 5v14M16 5v14";

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d={d}
        fill={fill ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
