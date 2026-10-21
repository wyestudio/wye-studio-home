"use client";

import { Chevron } from "@/components/ui/Chevron";
import { scrollToBooking } from "./scrollToBooking";

/** 할로윈 이벤트 섹션의 '회차 확인하기'. 기존 회차 선택(#booking)으로 부드럽게 옮긴다. */
export function HalloweenEventBookingLink() {
  return (
    <a href="#booking" onClick={scrollToBooking} className="hw-event-booking text-body-sm font-extrabold">
      회차 확인하기
      <Chevron className="h-4 w-4" />
    </a>
  );
}
