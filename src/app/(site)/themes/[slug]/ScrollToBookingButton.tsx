"use client";

import { Chevron } from "@/components/ui/Chevron";
import { scrollToBooking } from "./scrollToBooking";

/**
 * 첫 화면(테마 소개) 아래의 '날짜 선택하기' 버튼. 누르면 날짜 선택으로 부드럽게 내려간다.
 *
 * 첫 화면을 소개 블록만으로 채우면서 날짜 선택이 화면 밖으로 밀려났다. 모바일은
 * 하단 고정 버튼이 있지만 넓은 화면(sm 이상)은 그게 없어 '아래에 뭐가 더 있다' 는
 * 신호가 필요했다. 그래서 모바일에서는 감추고 sm 이상에서만 보인다.
 */
export function ScrollToBookingButton({ accent }: { accent: string }) {
  return (
    <a
      href="#booking"
      onClick={scrollToBooking}
      className="group mx-auto mt-10 hidden items-center gap-2 rounded-full border px-6 py-3 text-base font-bold transition-colors sm:flex md:mt-12"
      style={{ borderColor: `${accent}80`, color: accent }}
    >
      날짜 선택하기
      <Chevron dir="down" className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
    </a>
  );
}
