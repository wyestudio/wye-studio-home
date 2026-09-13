"use client";

import { useState } from "react";

/**
 * 어드민에서 회차 하나를 고르는 3단계 선택기 — 테마 → 날짜(달력) → 시각.
 *
 * ⚠️ 회차를 한 줄 목록으로 고르게 하면 안 된다. 롤링 오픈이라 회차가 몇 달 치
 *    미리 만들어져 있어(지금도 150개 가까이, 2027년까지) 콤보가 끝없이 길어진다.
 *    테마로 한 번 좁히고, 날짜는 달력으로 고르고, 그날 회차(보통 3개)만 남긴다.
 *
 * 신청 목록 필터와 쿠폰 발송 화면이 같은 것을 쓴다 — 한쪽만 고치면 두 화면이
 * 서로 다르게 동작하게 된다.
 */

export type PickerSession = {
  id: string;
  start_at: string;
  /** 이관 전 옛 회차는 테마가 없다 */
  theme_id: string | null;
  theme_name: string;
  /** 시각 옆에 덧붙일 꼬리표 (옛 회차의 그룹/소개팅 등) */
  note?: string | null;
};

const field = "rounded border border-border bg-background px-3 py-2 text-sm";

/** ISO(UTC) → KST 기준 'YYYY-MM-DD'. `<input type="date">` 가 쓰는 형식이다. */
export function kstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** ISO(UTC) → KST 'HH:MM'. */
export function kstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 16);
}

/** 테마가 없는 옛 회차도 이름으로 묶어 한 칸을 차지하게 한다. */
function themeKeyOf(s: PickerSession): string {
  return s.theme_id ?? `legacy:${s.theme_name}`;
}

export function SessionPicker({
  sessions,
  value,
  onChange,
}: {
  sessions: PickerSession[];
  /** 선택된 회차 id. 없으면 빈 문자열 */
  value: string;
  onChange: (sessionId: string) => void;
}) {
  const selected = sessions.find((s) => s.id === value);

  // 주소나 바깥 상태에 회차가 이미 있으면 그 회차의 테마·날짜를 채워 보여준다.
  const [themeKey, setThemeKey] = useState(selected ? themeKeyOf(selected) : "");
  const [date, setDate] = useState(selected ? kstDate(selected.start_at) : "");

  // 테마 목록은 회차에서 뽑는다. themes 테이블을 따로 읽으면 회차가 하나도 없는
  // 테마까지 나와서 고르면 빈 달력이 된다.
  const themes: { key: string; name: string }[] = [];
  for (const s of sessions) {
    const key = themeKeyOf(s);
    if (themes.some((t) => t.key === key)) continue;
    // 이관 전 옛 회차는 테마와 이름이 같아도 다른 칸이다. 그대로 두면 똑같은
    // 이름 두 개가 나란히 떠서 어느 쪽을 골라야 할지 알 수 없다.
    themes.push({ key, name: s.theme_id ? s.theme_name : `${s.theme_name} (옛 회차)` });
  }

  const ofTheme = themeKey ? sessions.filter((s) => themeKeyOf(s) === themeKey) : [];
  const dates = ofTheme.map((s) => kstDate(s.start_at)).sort();
  const onDate = ofTheme
    .filter((s) => kstDate(s.start_at) === date)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  function pickTheme(key: string) {
    setThemeKey(key);
    // 테마가 바뀌면 날짜·회차는 무효다. 남겨두면 다른 테마의 날짜가 그대로
    // 보이면서 "그날 회차가 없습니다" 만 뜬다.
    setDate("");
    onChange("");
  }

  function pickDate(next: string) {
    setDate(next);
    const first = ofTheme
      .filter((s) => kstDate(s.start_at) === next)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
    // ⚠️ 날짜를 고르면 **항상** 그날의 한 회차가 선택되게 한다. '그날 전체'
    //    같은 선택지를 두면 실제로는 회차 조건이 풀려 전체가 나오는데, 쓰는
    //    사람은 그날 것만 나온다고 읽는다. 시각은 옆에서 바꾸면 된다.
    onChange(first?.id ?? "");
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted">테마</label>
        <select className={field} value={themeKey} onChange={(e) => pickTheme(e.target.value)}>
          <option value="">테마 선택</option>
          {themes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">날짜</label>
        <input
          type="date"
          className={field}
          value={date}
          disabled={!themeKey}
          min={dates[0]}
          max={dates[dates.length - 1]}
          aria-label="회차 날짜"
          onChange={(e) => pickDate(e.target.value)}
        />
      </div>

      {date && onDate.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-muted">회차</label>
          <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
            {onDate.map((s) => (
              <option key={s.id} value={s.id}>
                {kstTime(s.start_at)}
                {s.note ? ` (${s.note})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {date && onDate.length === 0 && (
        <span className="self-end pb-2 text-sm text-muted">그날 회차가 없습니다</span>
      )}
    </>
  );
}
