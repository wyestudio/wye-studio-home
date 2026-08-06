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
