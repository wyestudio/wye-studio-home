"use client";

import { Chevron } from "@/components/ui/Chevron";
import { scrollToBooking } from "./scrollToBooking";

/**
 * 첫 화면(테마 소개) 아래의 '신청하기' 버튼. 누르면 날짜 선택으로 부드럽게 내려간다.
 *
 * 첫 화면을 소개 블록만으로 채우면서 날짜 선택이 화면 밖으로 밀려났다. 모바일은
 * 하단 고정 버튼이 있지만 넓은 화면(sm 이상)은 그게 없어 '아래에 뭐가 더 있다' 는
 * 신호가 필요했다. 그래서 모바일에서는 감추고 sm 이상에서만 보인다.
 */
export function ScrollToBookingButton({
  accent,
  direction = "down",
  className = "mt-10 md:mt-12",
}: {
  accent: string;
  /** 회차 선택이 버튼보다 위에 있으면 up — 화살표 방향만 바뀐다(페이지 맨 아래 버튼). */
  direction?: "down" | "up";
  className?: string;
}) {
  return (
    <a
      href="#booking"
      onClick={scrollToBooking}
      className={`group mx-auto hidden w-fit items-center gap-2 rounded-full border px-6 py-3 text-base font-bold transition-colors sm:flex lg:px-8 lg:py-4 lg:text-lg ${className}`}
      style={{ borderColor: `${accent}80`, color: accent }}
    >
      신청하기
      <Chevron
        dir={direction}
        className={`h-4 w-4 transition-transform ${direction === "down" ? "group-hover:translate-y-0.5" : "group-hover:-translate-y-0.5"}`}
      />
    </a>
  );
}
