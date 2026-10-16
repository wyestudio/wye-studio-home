import "server-only";
import {
  extractSpreadsheetId,
  listSheetTitles,
  quoteSheetTitle,
  readSheet,
} from "@/lib/googleSheets";

/**
 * 설문(구글 폼) 응답에서 평점을 집계한다.
 *
 * 폼 자체 API 가 아니라 **응답 시트**를 읽는다 — 폼 API 는 권한 설정이 더 복잡한데,
 * 어차피 구글 폼은 응답을 시트로 떨어뜨리므로 시트를 읽는 쪽이 단순하다.
 *
 * ⚠️ 운영자가 손으로 적어 둔 수치를 **덮어쓰지 않는다.** 블록의 stats 중
 *    `auto` 표시가 붙은 항목만 갱신한다 — 그 표시가 없으면 사람이 적은 값이다.
 */

export type RatingSummary = {
  /** 평균. 응답이 없으면 null. */
  average: number | null;
  /** 점수로 읽힌 응답 수. 빈 칸·글자 응답은 빼고 센다. */
  count: number;
  /** 어느 열을 점수로 읽었는지. 설정이 맞는지 확인할 때 쓴다. */
  column: string | null;
};

/**
 * 점수 열을 찾는다.
 *
 * `configured` 에 머리글을 적어 두면 그 열을 쓴다(일부만 적어도 된다). 없으면 머리글에
 * 평점처럼 보이는 말이 든 열을 찾는다 — 폼 문항은 "전반적인 만족도를 평가해주세요"
 * 처럼 길어서 완전 일치로는 못 찾는다.
 */
function findRatingColumn(header: string[], configured: string | undefined): number {
  if (configured) {
    const exact = header.findIndex((h) => h.trim() === configured);
    if (exact !== -1) return exact;
    const loose = header.findIndex((h) => h.includes(configured));
    if (loose !== -1) return loose;
    return -1;
  }
  const HINTS = ["평점", "만족도", "별점", "점수", "rating", "score"];
  return header.findIndex((h) => {
    const low = h.toLowerCase();
    return HINTS.some((k) => low.includes(k.toLowerCase()));
  });
}

/**
 * 한 칸을 점수로 읽는다.
 *
 * 폼 응답은 모양이 제각각이다 — `5`, `5점`, `★★★★★`, `4.5 / 5`. 숫자가 보이면
 * 그걸 쓰고, 별만 있으면 별 개수를 센다. 못 읽으면 null 이고 **평균에서 빠진다**
 * (0 으로 세면 평균이 통째로 내려간다).
 */
function parseScore(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const stars = (s.match(/★/g) ?? []).length;
  if (stars > 0 && !/\d/.test(s)) return stars;

  const m = s.match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  // 5점 척도를 벗어난 값은 설정이 틀린 것(예: 타임스탬프 열을 읽음)이라 버린다.
  if (n < 0 || n > 10) return null;
  return n;
}

type Tab = { range: string; header: string[]; body: string[][] };
type SummaryResult = { ok: true; summary: RatingSummary } | { ok: false; error: string };

/** 한 문항(열)의 평균과 응답 수. 탭마다 같은 문항을 찾아 합친다. */
function summarize(tabs: Tab[], configured: string | undefined, envName: string): SummaryResult {
  const scores: number[] = [];
  const columns: string[] = [];
  const missing: string[] = [];

  for (const { range, header, body } of tabs) {
    const col = findRatingColumn(header, configured);
    if (col === -1) {
      // 응답 탭이 아닌 탭(메모·집계용)일 수 있으니 이것만으로 실패시키지 않는다.
      missing.push(`${range} (머리글: ${header.slice(0, 6).join(" | ")})`);
      continue;
    }
    for (const r of body) {
      const n = parseScore(r[col] ?? "");
      if (n !== null) scores.push(n);
    }
    if (!columns.includes(header[col])) columns.push(header[col]);
  }

  // 어느 탭에서도 열을 못 찾았다면 설정이 틀린 것이다 — 조용히 0명으로 넘기면
  // 화면 수치가 영영 안 바뀌는데도 아무도 모른다.
  if (columns.length === 0 && missing.length > 0) {
    return {
      ok: false,
      error:
        `시트에서 평점 열을 찾지 못했습니다. ${missing.join(" / ")}` +
        ` — ${envName} 에 문항 이름을 적어주세요.`,
    };
  }

  const column = columns.length > 0 ? columns.join(" + ") : null;
  if (scores.length === 0) return { ok: true, summary: { average: null, count: 0, column } };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return {
    ok: true,
    summary: {
      // 소수 한 자리. 4.63 을 4.6 으로 — 화면 수치는 자릿수가 들쭉날쭉하면 지저분하다.
      average: Math.round(avg * 10) / 10,
      count: scores.length,
      column,
    },
  };
}

/**
 * 설문 응답 탭을 모두 읽는다. 평점 집계와 한줄 후기 후보가 같이 쓴다.
 *
 * 폼 여러 개(정식 운영 + 프리오프닝)를 한 스프레드시트에 연결해 두므로 탭이 여럿이다.
 * 기본은 **모든 탭**을 읽어 합친다. 특정 탭만 쓰려면 REVIEW_RATING_RANGE 에
 * "'설문지 응답 시트1';'설문지 응답 시트2'" 처럼 ; 로 이어 적는다.
 *
 * ⚠️ 범위를 `A:Z` 로 자르지 않는다. 폼 문항이 26개를 넘어 서술형 문항이 AA 열 뒤에
 *    있다 — 잘라 읽으면 그 문항이 시트에 없는 것처럼 보인다(실제로 그렇게 오판했다).
 */
export async function readSurveyTabs(): Promise<Tab[]> {
  const raw = process.env.REVIEW_RATING_SHEET;
  if (!raw) throw new Error("REVIEW_RATING_SHEET(설문 응답 시트 주소)이 없습니다.");

  const id = extractSpreadsheetId(raw);
  if (!id) throw new Error("REVIEW_RATING_SHEET 에서 시트 ID 를 읽지 못했습니다.");

  const configured = process.env.REVIEW_RATING_RANGE?.trim();
  const ranges = configured
    ? configured.split(";").map((r) => r.trim()).filter(Boolean)
    : (await listSheetTitles(id)).map(quoteSheetTitle);

  const tabs: Tab[] = [];
  for (const range of ranges) {
    const rows = await readSheet(id, range);
    if (rows.length < 2) continue;
    const [header, ...body] = rows;
    tabs.push({ range, header, body });
  }
  return tabs;
}

/**
 * 설문 시트에서 문항별 평균을 집계한다.
 *   rating  — 전반 만족도. `REVIEW_RATING_COLUMN` (없으면 머리글로 추정)
 *   quality — 문제 퀄리티. `REVIEW_QUALITY_COLUMN` 이 있을 때만 (없으면 null)
 *
 * 시트는 한 번만 읽고 문항별로 나눠 센다 — 문항마다 따로 읽으면 API 호출이 배로 는다.
 */
export async function fetchSurveySummaries(): Promise<
  { ok: true; rating: SummaryResult; quality: SummaryResult | null } | { ok: false; error: string }
> {
  try {
    const tabs = await readSurveyTabs();
    const qualityColumn = process.env.REVIEW_QUALITY_COLUMN?.trim();
    return {
      ok: true,
      rating: summarize(tabs, process.env.REVIEW_RATING_COLUMN?.trim(), "REVIEW_RATING_COLUMN"),
      // 추정하지 않는다 — 머리글 추정은 "만족도" 같은 말을 찾으므로 전반 만족도 열을 잡는다.
      quality: qualityColumn ? summarize(tabs, qualityColumn, "REVIEW_QUALITY_COLUMN") : null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 설문 서술형 답 하나. 한줄 후기 후보로 어드민에 뜬다. */
export type SurveyQuote = {
  text: string;
  /** "2026.08.29" — 폼 타임스탬프에서 날짜만. 못 읽으면 null. */
  date: string | null;
  /** 어느 문항의 답인지(머리글). */
  question: string;
};

/** 폼 타임스탬프("2026. 8. 29 오후 3:12:00" 또는 "2026-08-29 15:12:00")에서 날짜만. */
function toDate(raw: string): string | null {
  const m = raw.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}.${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}`;
}

/**
 * 한줄 후기 후보 — `REVIEW_QUOTE_COLUMNS` 문항들의 답을 모은다.
 *
 * 문항 이름은 ; 로 여러 개 적는다(일부만 적어도 된다): "기억에 남는 순간;하고 싶은 말".
 * 사이트에 싣는 건 어드민에서 사람이 고른다 — 서술형에는 불만·건의가 섞여 있다.
 * 최근 응답이 앞에 온다.
 */
export async function fetchSurveyQuotes(): Promise<
  { ok: true; quotes: SurveyQuote[] } | { ok: false; error: string }
> {
  const names = (process.env.REVIEW_QUOTE_COLUMNS ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) {
    return { ok: false, error: "REVIEW_QUOTE_COLUMNS(한줄 후기로 쓸 문항)가 없습니다." };
  }

  try {
    const tabs = await readSurveyTabs();
    const quotes: SurveyQuote[] = [];
    const seen = new Set<string>();

    for (const { header, body } of tabs) {
      const cols = names
        .map((n) => header.findIndex((h) => h.includes(n)))
        .filter((c) => c !== -1);
      for (const r of body) {
        const date = toDate(r[0] ?? "");
        for (const c of cols) {
          const text = (r[c] ?? "").trim();
          // 같은 글을 두 번 보이지 않는다 — 실리는 기준이 글 내용이라 중복이면 헷갈린다.
          if (!text || seen.has(text)) continue;
          seen.add(text);
          quotes.push({ text, date, question: header[c] });
        }
      }
    }

    quotes.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { ok: true, quotes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
