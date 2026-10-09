import Link from "next/link";
import {
  GROUP_ACCENT,
  GROUP_ENTRY,
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  groupBookingHref,
  type GroupEntryKey,
} from "@/lib/groupBooking";

/**
 * 단체 예약을 **게임 선택 창과 같은 언어로** 세운 패널 (시안 2026-10-08).
 *
 * 왜 카드가 아니라 창인가
 *   위에서 「파티모드 / 노말모드」를 고르고 나면 손님 머릿속에 남는 질문은
 *   "고를 수 있는 게 둘뿐인가" 다. 단체 예약은 **세 번째 선택지**인데 지금까지는
 *   가격표 밑 작은 카드로만 있어서, 고르는 순간에는 보이지 않았다.
 *
 * ⚠️ 자리는 포스터와 모드 창 **둘 다의 아래**, 가로로 길게다(2026-10-09 대표님).
 *    모드 옆에 세우면 "모드 중 하나" 로 읽힌다. 첫 화면 안에 들어올 필요는 없다.
 *
 * ⚠️ 색은 단체 예약 안내 페이지와 같은 **자홍(GROUP_ACCENT)** 이다. 모드 강조색
 *    (민트/시안)과 섞이지 않고, 눌러서 넘어간 /group 과 같은 색이라 이어진다.
 *    한때 노말모드가 분홍이라 자홍과 겹쳐서 무채색으로 내렸던 적이 있는데,
 *    노말이 시안으로 바뀌어 그 이유가 사라졌다.
 *
 * ⚠️ 모양은 **도트 게임 쪽**이다 — 2px 테두리, 깎지 않은 모서리, 4px 단단한 그림자,
 *    갈무리11 글자. 모드 창(1px·둥근 모서리)과 일부러 다르게 둬서 "다른 종류의
 *    선택지" 로 보이게 한다.
 *
 * ⚠️ 가격표 아래 GroupBookingCta 와 **둘 다 남겨둔다.** 하는 일이 다르다 —
 *    저쪽은 표에서 자기 인원 칸을 못 찾은 사람에게 길을 알려주는 것이고,
 *    이쪽은 아직 아무것도 안 고른 사람에게 선택지를 보여주는 것이다.
 */
export function PrivateRoomPanel({
  entry = GROUP_ENTRY.price,
  className = "",
}: {
  entry?: GroupEntryKey;
  className?: string;
}) {
  return (
    <section
      aria-label="단체 대관 안내"
      className={`border-2 ${className}`}
      style={{
        borderColor: `${GROUP_ACCENT}73`,
        backgroundColor: `${GROUP_ACCENT}0f`,
        boxShadow: `4px 4px 0 ${GROUP_ACCENT}40`,
      }}
    >
      {/* 창 머리 — 모드 창과 같은 타이틀바. */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5"
        style={{ borderColor: `${GROUP_ACCENT}40` }}
      >
        <span className="font-galmuri text-micro tracking-[0.12em]" style={{ color: GROUP_ACCENT }}>
          + PRIVATE ROOM
        </span>
        <span
          className="shrink-0 px-2 py-0.5 text-micro font-bold"
          style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
        >
          {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}인
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5 sm:py-5">
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold" style={{ color: GROUP_ACCENT }}>
            단체 대관
          </p>
          <p className="mt-1 text-h3 font-extrabold">우리 모임만의 방을 열까요?</p>
          <p className="mt-1.5 text-body-sm leading-relaxed text-muted">
            동아리 · 워크숍 · 친구 모임도 우리끼리 단독 진행.
          </p>
        </div>

        {/*
          누르는 자리. 눌리면 그림자가 줄면서 실제로 내려앉는다 — 도트 게임 버튼.
          ⚠️ 한 줄이다. 아래에 작은 설명을 덧대면 버튼이 두 줄로 커져 패널이
             무거워진다(2026-10-09 대표님).
        */}
        <Link
          href={groupBookingHref(entry)}
          className="shrink-0 px-5 py-3 text-center font-galmuri text-label transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          style={{
            backgroundColor: GROUP_ACCENT,
            color: "#141414",
            boxShadow: `3px 3px 0 ${GROUP_ACCENT}59`,
          }}
        >
          <span className="block whitespace-nowrap">단체 예약 안내 ↗</span>
        </Link>
      </div>
    </section>
  );
}
