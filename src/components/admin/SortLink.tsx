import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";

export type SortDir = "asc" | "desc";

/**
 * 표 머리 칸을 누르면 그 칸으로 정렬 — 지금 정렬된 칸 옆에 화살표가 붙고, 다시 누르면 방향이 바뀐다
 * (2026-10-30 대표님). 정렬은 주소(?sort=&dir=)에 담는다 — 검색 조건과 같이 남아 돌아와도 그대로다.
 */
export function SortLink({
  label,
  active,
  dir,
  href,
  className = "",
}: {
  label: string;
  /** 지금 이 칸으로 정렬 중인가 */
  active: boolean;
  dir: SortDir;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${
        active ? "font-semibold text-foreground" : ""
      } ${className}`}
    >
      {label}
      {active ? (
        <Chevron dir={dir === "asc" ? "up" : "down"} className="h-3.5 w-3.5 text-glow" />
      ) : (
        <Chevron dir="down" className="h-3.5 w-3.5 opacity-25" />
      )}
    </Link>
  );
}

/**
 * 칸을 눌렀을 때 갈 정렬. 지금 그 칸이면 방향만 뒤집고, 다른 칸이면 그 칸의 기본 방향으로.
 */
export function nextSort(cur: { key: string; dir: SortDir }, key: string, defaultDir: SortDir): { key: string; dir: SortDir } {
  if (cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
  return { key, dir: defaultDir };
}
