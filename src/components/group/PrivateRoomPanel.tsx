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
 * ⚠️ **색을 쓰지 않는다. 무채색 토큰만 쓴다.** (2026-10-08 결정)
 *    상세 한 화면에서 색이 맡는 역할은 둘뿐이다 — 모드(민트/시안)와 할인(노랑).
 *    여기에 셋째 색을 주면 반드시 둘 중 하나와 닮는다: 금색은 얼리버드 노랑과
 *    ΔE 22, 자홍은 당시 노말 분홍과 ΔE 34 였다.
 *    구분은 색이 아니라 **모양**이 한다 — 타이틀바 · 또렷한 테두리 · 인원 배지.
 *
 * ⚠️ 모드 강조색도 쓰면 안 된다. 모드를 바꿀 때 같이 변하면 "모드에 딸린 옵션"
 *    으로 읽힌다. 이 패널은 모드와 **나란한** 선택지다.
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
      // 테두리를 line-strong 으로 둔다 — 모드 창(line)보다 한 단계 또렷해야
      // 색 없이도 '다른 종류의 창' 으로 읽힌다.
      className={`overflow-hidden rounded-xl border border-line-strong bg-fill-subtle ${className}`}
    >
      {/* 창 머리 — 모드 창과 같은 타이틀바. */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
        <span className="font-mono text-micro tracking-[0.18em] text-foreground">
          + PRIVATE ROOM
        </span>
        <span className="shrink-0 rounded-md border border-line-strong px-2 py-0.5 text-micro font-bold text-foreground">
          {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}인
        </span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5 sm:py-5">
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold text-muted">단체 대관</p>
          <p className="mt-1 text-h3 font-extrabold">우리 모임만의 방을 열까요?</p>
          <p className="mt-1.5 text-body-sm leading-relaxed text-muted">
            동아리 · 워크숍 · 친구 모임도 우리끼리 단독 진행.
          </p>
        </div>

        {/*
          누르는 자리. 모드 버튼과 같은 '눌리는 느낌'(아래 3px 그림자 → 눌리면 사라짐)을
          쓴다. 모양이 같아야 같은 종류의 선택지로 읽힌다.
          이 패널에서 꽉 찬 면은 **여기 하나뿐**이다 — 색이 없으니 눈길은 면적이 끈다.
        */}
        <Link
          href={groupBookingHref(entry)}
          className="shrink-0 rounded-lg bg-foreground px-5 py-3 text-center font-mono text-body-sm font-extrabold text-brand-foreground shadow-[0_3px_0_rgb(255_255_255/0.25)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-none"
        >
          <span className="block whitespace-nowrap">▶ 단체 예약 안내</span>
        </Link>
      </div>
    </section>
  );
}
