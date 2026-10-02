"use client";

import { DETAIL_EVENT } from "@/lib/analytics";
import { SectionViewTracker as Tracker } from "@/components/analytics/SectionViewTracker";

/**
 * 테마 상세의 블록 열람 기록.
 *
 * 재는 방법은 단체 예약 안내(`/group`)와 같아서 공용 컴포넌트로 옮겼다 —
 * 보내는 이벤트 이름만 다르다. 자세한 주석은 그쪽에 있다
 * (`src/components/analytics/SectionViewTracker.tsx`).
 */
export function SectionViewTracker({ themeLabel }: { themeLabel: string }) {
  return <Tracker event={DETAIL_EVENT.sectionView} themeLabel={themeLabel} />;
}
