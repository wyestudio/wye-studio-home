import { RAINBOW_GRADIENT } from "./CardArt";

const HASHTAGS = ["#운세", "#타로", "#사주", "#연애운", "#결혼운", "#궁합"];

export function IntroSection() {
  return (
    <header className="relative">
      <div className="h-3 w-full" style={{ background: RAINBOW_GRADIENT }} />
      <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
        <h1
          className="font-[family-name:var(--font-black-han-sans)] text-5xl text-white sm:text-6xl"
          style={{
            WebkitTextStroke: "1.5px white",
            textShadow:
              "0 0 8px #fff, 0 0 22px #fff, 0 0 42px #c084fc, 0 0 70px #60a5fa",
          }}
        >
          꿈의 포문
        </h1>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-white/70">
          {HASHTAGS.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="h-3 w-full" style={{ background: RAINBOW_GRADIENT }} />
    </header>
  );
}
