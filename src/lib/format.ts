export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatSessionDateTime(startAt: string): string {
  const d = new Date(startAt);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  return `${month}/${date}(${weekday}) ${hh}:${mm}`;
}

export function formatSessionDate(eventDate: string): string {
  const d = new Date(eventDate + "T00:00:00");
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  return `${month}월 ${date}일(${weekday})`;
}

export function formatSessionTime(startAt: string): string {
  const d = new Date(startAt);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
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
