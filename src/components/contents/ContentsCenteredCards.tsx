"use client";

import { useLayoutEffect, useState } from "react";
import { SessionCardFan } from "@/components/home/SessionCardFan";
import type { Session } from "@/types/domain";

export function ContentsCenteredCards({ sessions }: { sessions: Session[] }) {
  const [spaceToRemove, setSpaceToRemove] = useState(0);

  useLayoutEffect(() => {
    function updateSpaces() {
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      const headerHeight = header?.offsetHeight || 0;
      const footerHeight = footer?.offsetHeight || 0;
      setSpaceToRemove(headerHeight + footerHeight);
    }

    updateSpaces();

    // 윈도우 리사이즈 시에도 업데이트
    window.addEventListener("resize", updateSpaces);

    // ResizeObserver로 헤더/푸터 높이 변화 감지(반응형 텍스트 줄바꿈 등)
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const resizeObserver = new ResizeObserver(updateSpaces);
    if (header) resizeObserver.observe(header);
    if (footer) resizeObserver.observe(footer);

    return () => {
      window.removeEventListener("resize", updateSpaces);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="flex items-center justify-center px-5 overflow-hidden"
      style={{
        height: `calc(100dvh - ${spaceToRemove}px)`,
      }}
    >
      <div className="mx-auto w-full max-w-4xl">
        <SessionCardFan sessions={sessions} />
      </div>
    </div>
  );
}
