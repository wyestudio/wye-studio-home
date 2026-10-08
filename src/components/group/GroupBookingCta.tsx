import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import {
  GROUP_ENTRY,
  GROUP_HEADCOUNT_MIN,
  groupBookingHref,
  type GroupEntryKey,
} from "@/lib/groupBooking";

/**
 * 단체 예약으로 보내는 안내 카드.
 *
 * 쓰이는 곳 두 군데
 *   - 테마 상세의 **인원별 참가비 표 바로 아래**(`lg`) — 참가비 표는 1~9명 기준이라
 *     10명 이상인 사람은 자기 칸을 못 찾고 "우리는 안 되나" 하고 나간다. 숫자를 보는
 *     그 자리에서 다른 길을 알려줘야 한다.
 *   - **신청 1단계 인원 선택 아래**(`sm`) — 인원 선택 상한이 10명보다 낮아서 여기까지
 *     온 단체 손님은 더 갈 데가 없다.
 *
 * ⚠️ 한 줄짜리 작은 글씨(`※ …`)로 두면 아무도 안 본다(2026-10-02 지적). 두 자리
 *    모두 **같은 모양의 카드**로 세운다 — 크기만 다르다.
 *
 * ⚠️ **색을 쓰지 않는다**(2026-10-08 결정). 예전엔 안내 페이지 색(GROUP_ACCENT,
 *    자홍 298°)을 그대로 썼는데, 노말모드 분홍(326°)과 28° 차이라 **모드 강조색의
 *    일부처럼** 보였다. 상세에서 색이 맡는 역할은 모드와 할인 둘뿐이고, 단체는
 *    테두리와 자리로 구분한다 — 같은 이유로 PrivateRoomPanel 도 무채색이다.
 *    GROUP_ACCENT 는 안내 페이지(/group) 안에서만 쓴다. 거긴 경쟁할 색이 없다.
 *
 * ⚠️ 단체 예약을 받는 테마에서만 그린다 — 판정은 부르는 쪽에서 `hasGroupBooking()`
 *    으로 한다. 안내 페이지 내용이 테마별로 다르기 때문이다.
 */
export function GroupBookingCta({
  entry = GROUP_ENTRY.price,
  size = "lg",
  title = `${GROUP_HEADCOUNT_MIN}명 이상이신가요?`,
  desc = "우리 모임끼리 단독 진행 · 단체 전용 견적 안내",
}: {
  entry?: GroupEntryKey;
  size?: "lg" | "sm";
  title?: string;
  desc?: string;
}) {
  const lg = size === "lg";

  return (
    <Link
      href={groupBookingHref(entry)}
      className={`flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-fill transition hover:bg-fill-strong ${
        lg ? "mt-4 px-5 py-4 sm:mt-5 sm:px-6 sm:py-5" : "mt-3 px-4 py-3.5"
      }`}
    >
      <span className="min-w-0">
        <span className={`block font-extrabold ${lg ? "text-h3" : "text-body"}`}>
          {title}
        </span>
        <span
          className={`mt-0.5 block leading-relaxed text-muted ${lg ? "text-body-sm" : "text-micro"}`}
        >
          {desc}
        </span>
      </span>
      {/* Chevron 은 currentColor 를 쓴다 — 감싸는 칸에서 색을 준다. */}
      <span className="shrink-0 text-muted">
        <Chevron className={lg ? "h-5 w-5" : "h-4 w-4"} />
      </span>
    </Link>
  );
}
