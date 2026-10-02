"use client";

import { GROUP_EVENT, pushGa4Event } from "@/lib/analytics";
import { GROUP_PAGE_LABEL } from "@/lib/groupBooking";

/**
 * 페이지 안에서 견적 폼으로 내려보내는 버튼.
 *
 * 누른 자리(`where`)를 같이 보낸다 — 첫 화면에서 바로 누르는 사람과 끝까지 읽고
 * 누르는 사람의 비율이 다르면, 페이지를 짧게 가는 편이 나은지 알 수 있다.
 */
export function GroupQuoteCta({
  where,
  children,
  variant = "solid",
}: {
  where: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
}) {
  const base =
    "flex min-h-[52px] w-full items-center justify-center rounded-full px-6 text-center text-base font-extrabold transition sm:text-lg";
  const skin =
    variant === "solid"
      ? "bg-[#f082f4] text-[#141414] hover:bg-[#f6a8f9]"
      : "border border-[#f082f4] text-[#f082f4] hover:bg-[#f082f4]/10";

  return (
    <a
      href="#quote"
      className={`${base} ${skin}`}
      onClick={() =>
        pushGa4Event(GROUP_EVENT.ctaClick, {
          themeLabel: GROUP_PAGE_LABEL,
          sectionKey: where,
        })
      }
    >
      {children}
    </a>
  );
}
