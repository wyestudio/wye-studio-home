import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import {
  GROUP_ACCENT,
  GROUP_ENTRY,
  GROUP_HEADCOUNT_MIN,
  groupBookingHref,
} from "@/lib/groupBooking";

/**
 * 테마 상세의 인원별 참가비 표 **바로 아래**에 두는 단체 예약 안내.
 *
 * 왜 여기인가
 *   참가비 표는 1~9명 기준이다. 10명 이상인 사람은 그 표에서 자기 칸을 못 찾고
 *   "우리는 안 되나" 하고 나간다. 숫자를 보는 그 자리에서 다른 길을 알려줘야 한다.
 *
 * ⚠️ 단체 예약을 받는 테마에서만 그린다 — 판정은 ThemeBlocks 를 부르는 쪽에서
 *    `hasGroupBooking()` 으로 한다. 안내 페이지 내용이 테마별로 다르기 때문이다.
 */
export function GroupBookingCta() {
  return (
    <Link
      href={groupBookingHref(GROUP_ENTRY.price)}
      className="mt-4 flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition hover:brightness-110 sm:mt-5 sm:px-6 sm:py-5"
      style={{ borderColor: GROUP_ACCENT, backgroundColor: `${GROUP_ACCENT}14` }}
    >
      <span className="min-w-0">
        <span
          className="block font-extrabold sm:text-lg"
          style={{ color: GROUP_ACCENT }}
        >
          {GROUP_HEADCOUNT_MIN}명 이상이신가요?
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted sm:text-sm">
          우리 모임끼리 단독 진행 · 단체 전용 견적 안내
        </span>
      </span>
      {/* Chevron 은 currentColor 를 쓴다 — 강조색은 감싸는 칸에서 준다. */}
      <span className="shrink-0" style={{ color: GROUP_ACCENT }}>
        <Chevron className="h-5 w-5" />
      </span>
    </Link>
  );
}
