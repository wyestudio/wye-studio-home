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

/**
 * 골라온(또는 끌어다 놓은) CSV 파일을 문자열로 읽는다.
 *
 * ⚠️ 엑셀에서 「CSV (쉼표로 분리)」로 저장하면 UTF-8 이 아니라 CP949 로 나온다.
 *    UTF-8 로 읽어 한글이 깨지면(U+FFFD) euc-kr 로 다시 읽는다. 코드·인스타
 *    아이디는 영문이라 깨진 채로도 반영은 되지만, 메모가 깨진 것을 보고
 *    잘못 올린 줄 알고 되돌리는 일이 없게 한다.
 *
 * BOM 은 parseCsv 가 떼므로 여기서 건드리지 않는다.
 */
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("\uFFFD")) return utf8; // U+FFFD = 깨진 글자
  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return utf8; // euc-kr 를 모르는 브라우저
  }
}

/**
 * 발송 기록 CSV 의 「코드」·「인스타아이디」 칸 위치.
 *
 * ⚠️ 화면 미리보기와 서버 반영이 **같은 규칙**을 써야 한다. 따로 두면
 *    "11건 반영된다"고 보여주고 실제로는 다른 칸을 읽는 일이 생긴다.
 */
export function findIssueColumns(header: string[]): { codeAt: number; handleAt: number } {
  const h = header.map((x) => x.trim());
  return {
    codeAt: h.findIndex((x) => x.includes("코드")),
    handleAt: h.findIndex((x) => x.includes("아이디")),
  };
}
