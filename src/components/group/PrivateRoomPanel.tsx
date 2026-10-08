import Link from "next/link";
import {
  GROUP_ENTRY,
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  groupBookingHref,
  type GroupEntryKey,
} from "@/lib/groupBooking";

/**
 * 단체 예약을 **모드 선택 창과 같은 언어로** 세운 패널 (2026-10-08 시안).
 *
 * 왜 카드가 아니라 창인가
 *   바로 위에서 「파티모드 / 노말모드」를 고르고 나면, 손님 머릿속에 남는 질문은
 *   "고를 수 있는 게 둘뿐인가" 다. 단체 예약은 **세 번째 선택지**인데 지금까지는
 *   가격표 밑 작은 카드로만 있어서, 모드를 고르는 순간에는 보이지 않았다.
 *   그래서 같은 모양의 창으로 옆에 세워 "길이 셋" 임을 그 자리에서 보여준다.
 *
 * ⚠️ 색은 모드 강조색(파티 민트 / 노말 분홍)을 **쓰지 않는다.** 모드를 바꿔도 이
 *    패널은 그대로여야 한다 — 같이 변하면 "모드에 딸린 옵션" 으로 읽힌다.
 *    금색은 두 모드 색 어느 쪽과도 안 겹쳐서 골랐다.
 *
 * ⚠️ 가격표 아래 GroupBookingCta 와 **둘 다 남겨둔다.** 하는 일이 다르다 —
 *    저쪽은 표에서 자기 인원 칸을 못 찾은 사람에게 길을 알려주는 것이고,
 *    이쪽은 아직 아무것도 안 고른 사람에게 선택지를 보여주는 것이다.
 */

/**
 * 이 패널 전용 금색.
 *
 * ⚠️ 안내 페이지(/group)의 GROUP_ACCENT(자홍)와 **일부러 다르다.** 자홍은 노말모드
 *    분홍과 색상이 가까워서, 노말모드에서 보면 모드 강조색의 일부처럼 보인다.
 * ⚠️ Tailwind 클래스로 조립하지 말 것 — 클래스는 소스에 적힌 문자열을 훑어 만든다.
 *    inline style 로만 쓴다.
 */
const PRIVATE_GOLD = "#f1cf83";

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
      className={`overflow-hidden rounded-xl border bg-fill-subtle ${className}`}
      style={{
        borderColor: `${PRIVATE_GOLD}59`,
        boxShadow: `3px 3px 0 ${PRIVATE_GOLD}2e`,
      }}
    >
      {/* 창 머리 — 모드 창과 같은 타이틀바. */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5"
        style={{ borderColor: `${PRIVATE_GOLD}40` }}
      >
        <span
          className="font-mono text-micro tracking-[0.18em]"
          style={{ color: PRIVATE_GOLD }}
        >
          + PRIVATE ROOM
        </span>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-micro font-bold"
          style={{ backgroundColor: PRIVATE_GOLD, color: "#141414" }}
        >
          {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}인
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5 sm:py-5">
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold" style={{ color: PRIVATE_GOLD }}>
            단체 대관
          </p>
          <p className="mt-1 text-h3 font-extrabold">우리 모임만의 방을 열까요?</p>
          <p className="mt-1.5 text-body-sm leading-relaxed text-muted">
            동아리 · 워크숍 · 친구 모임도 우리끼리 단독 진행.
          </p>
          <p
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-micro"
            style={{ color: PRIVATE_GOLD }}
          >
            <span>◆ 우리 모임만</span>
            <span>◆ 일정·인원 협의</span>
          </p>
        </div>

        {/*
          누르는 자리. 모드 버튼과 같은 '눌리는 느낌'(아래 3px 그림자 → 눌리면 사라짐)을
          쓴다. 모양이 같아야 같은 종류의 선택지로 읽힌다.
        */}
        <Link
          href={groupBookingHref(entry)}
          className="shrink-0 rounded-lg px-5 py-3 text-center font-mono text-body-sm font-extrabold transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none"
          style={{
            backgroundColor: PRIVATE_GOLD,
            color: "#141414",
            boxShadow: `0 3px 0 ${PRIVATE_GOLD}66`,
          }}
        >
          <span className="block whitespace-nowrap">▶ 단체 예약 안내</span>
        </Link>
      </div>
    </section>
  );
}
