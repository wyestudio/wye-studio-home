/**
 * CSV 만들기 + 내려받기.
 *
 * ⚠️ 엑셀에서 한글이 깨지지 않게 **BOM 을 붙인다.** 이게 없으면 엑셀이 파일을
 *    CP949 로 읽어 "잼핏 제휴" 같은 글자가 전부 깨진다. 메모장·구글시트는
 *    BOM 이 없어도 되지만, 대표님이 여는 건 대부분 엑셀이다.
 *
 * ⚠️ 쉼표·따옴표·줄바꿈이 든 값은 따옴표로 감싸고 내부 따옴표는 두 번 쓴다
 *    (RFC 4180). 정산 자료에는 테마명·메모가 들어가므로 실제로 걸린다.
 */

/** 한 칸을 CSV 규칙에 맞게 감싼다. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 머리글 + 행들을 CSV 문자열로. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/**
 * 브라우저에서 파일로 내려받는다.
 *
 * ⚠️ 이 함수는 어드민(우리 도메인)에서만 쓴다. 외부에 게시되는 페이지에서는
 *    a[download] 가 막혀 아무 일도 일어나지 않는다.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 바로 해제하면 사파리에서 내려받기가 취소되는 일이 있어 한 박자 늦춘다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일명에 쓰는 오늘 날짜 (KST 기준 YYYYMMDD). */
export function kstStamp(d: Date = new Date()): string {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return k.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * CSV 문자열을 행 배열로 읽는다.
 *
 * ⚠️ 직접 파서를 두는 이유: 따옴표 안의 쉼표·줄바꿈 때문에 `split(",")` 로는
 *    안 된다. 발송 기록에는 메모가 들어가고 거기 쉼표가 섞일 수 있다.
 *
 * ⚠️ 맨 앞 BOM 을 떼어낸다. 엑셀로 열었다 다시 저장하면 붙는데,
 *    안 떼면 첫 칸 이름이 '﻿코드' 가 되어 못 찾는다.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }  // "" → 따옴표 한 개
        else quoted = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  // 마지막 줄에 줄바꿈이 없을 수 있다
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
