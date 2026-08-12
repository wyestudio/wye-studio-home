export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// startAt(timestamptz)은 Supabase에서 UTC로 정규화된 문자열로 내려온다. 서버
// 런타임(Vercel은 기본 UTC)의 로컬 타임존으로 getHours() 등을 읽으면 배포
// 환경에 따라 시각이 9시간 어긋난다(로컬 개발 환경이 KST라 여태 안 걸렸음) —
// 그래서 Intl로 Asia/Seoul 기준 값을 명시적으로 뽑아써야 한다.
function seoulParts(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour) % 24;
  const minute = Number(map.minute);
  // 순수 캘린더 날짜(연/월/일)만으로 요일을 구하면 타임존 왕복 오차가 없다.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { month, day, weekday, hour, minute };
}

export function formatSessionDateTime(startAt: string): string {
  const { month, day, weekday, hour, minute } = seoulParts(startAt);
  const hh = hour.toString().padStart(2, "0");
  const mm = minute.toString().padStart(2, "0");
  return `${month}/${day}(${weekday}) ${hh}:${mm}`;
}

export function formatSessionDate(eventDate: string): string {
  const d = new Date(eventDate + "T00:00:00");
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  return `${month}월 ${date}일(${weekday})`;
}

export function formatSessionTime(startAt: string): string {
  const { hour, minute } = seoulParts(startAt);
  const hh = hour.toString().padStart(2, "0");
  const mm = minute.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// 시작~종료 시각 사이의 플레이타임을 "N시간 (M분)" 형식으로 반환.
export function formatDuration(startAt: string, endAt: string): string {
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

// 환불 기한(행사 전날)을 "OO월 OO일(요일)" 형식으로 반환.
export function formatRefundDeadline(eventDate: string): string {
  const d = new Date(eventDate + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  return `${month}월 ${date}일(${weekday})`;
}
