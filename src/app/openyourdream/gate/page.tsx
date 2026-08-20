import type { Metadata } from "next";
import { RAINBOW_GRADIENT } from "../CardArt";
import { GateForm } from "./GateForm";

export const metadata: Metadata = {
  title: { absolute: "꿈의 포문" },
  robots: { index: false, follow: false },
};

const HASHTAGS = ["#운세", "#타로", "#사주", "#연애운", "#결혼운", "#궁합"];

export default async function OpenYourDreamGatePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect && redirect.startsWith("/openyourdream") ? redirect : "/openyourdream";

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="h-3 w-full" style={{ background: RAINBOW_GRADIENT }} />
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-12 text-center">
        <h1
          className="font-[family-name:var(--font-black-han-sans)] text-5xl text-white sm:text-6xl"
          style={{
            WebkitTextStroke: "1.5px white",
            textShadow: "0 0 4px #fff, 0 0 10px #fff",
          }}
        >
          꿈의 포문
        </h1>
        <GateForm redirectTo={redirectTo} />
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-white/70">
          {HASHTAGS.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="h-3 w-full" style={{ background: RAINBOW_GRADIENT }} />
    </div>
  );
}
