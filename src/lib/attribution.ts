/**
 * 유입경로(UTM) 수집.
 *
 * 왜 필요한가
 *   GA4 는 '방문' 까지만 본다. 잼핏 같은 외부 플랫폼 입점이 **실제 신청**으로
 *   이어지는지 보려면 신청 한 건 한 건에 출처를 붙여 DB 에 남겨야 한다.
 *
 * ⚠️ **첫 유입만 기록한다(first-touch).**
 *    잼핏에서 홈으로 들어와 → 컨텐츠 → 테마 상세 → 신청폼 순으로 넘어가는 동안
 *    주소창의 utm 은 사라진다. 신청 시점에 주소를 읽으면 전부 '직접 방문' 이 된다.
 *    그래서 **처음 도착한 순간** 한 번만 저장하고, 그 뒤로는 덮어쓰지 않는다.
 *
 * ⚠️ sessionStorage 를 쓴다. 탭을 닫으면 사라지는데 그게 맞다 —
 *    "이번에 들어와서 신청했다" 를 보려는 것이지 영구 꼬리표가 아니다.
 *    쿠키가 아니라서 서버로 새어나가지도 않는다.
 *
 * ⚠️ "use client" 를 붙이지 않는다. 클라이언트(수집)와 서버 액션(검증·저장)
 *    양쪽에서 쓴다. window 를 쓰는 함수는 전부 typeof 로 막아 뒀다.
 */
const KEY = "wye:attribution";
const MAX_LEN = 200;

export type Attribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
};

const EMPTY: Attribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  landing_path: null,
};

/** 주소창 값은 누구나 만들어 넣을 수 있다. 길이를 자르고 공백만 있으면 버린다. */
function clean(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim().slice(0, MAX_LEN);
  return t || null;
}

/** 외부에서 넘어온 주소. 쿼리스트링은 떼고 어디서 왔는지만 남긴다. */
function externalReferrer(): string | null {
  const raw = typeof document !== "undefined" ? document.referrer : "";
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname === window.location.hostname) return null; // 내부 이동은 출처가 아니다
    return clean(u.origin + (u.pathname === "/" ? "" : u.pathname));
  } catch {
    return null;
  }
}

/**
 * 처음 도착한 순간 한 번 호출한다. 이미 기록돼 있으면 아무것도 하지 않는다.
 * 단, 새 utm 을 달고 다시 들어오면(다른 캠페인을 타고 재방문) 그건 새 유입이므로 덮어쓴다.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  try {
    const q = new URLSearchParams(window.location.search);
    const hasUtm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].some(
      (k) => q.get(k)
    );
    if (!hasUtm && window.sessionStorage.getItem(KEY)) return;

    const next: Attribution = {
      utm_source: clean(q.get("utm_source")),
      utm_medium: clean(q.get("utm_medium")),
      utm_campaign: clean(q.get("utm_campaign")),
      utm_content: clean(q.get("utm_content")),
      utm_term: clean(q.get("utm_term")),
      referrer: externalReferrer(),
      landing_path: clean(window.location.pathname),
    };

    // 아무 단서도 없으면(직접 방문) 굳이 저장하지 않는다. 비어 있는 게 곧 '직접 방문' 이다.
    const meaningful = Object.entries(next).some(([k, v]) => k !== "landing_path" && v);
    if (!meaningful && window.sessionStorage.getItem(KEY)) return;

    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 사파리 비공개 모드 등에서 sessionStorage 가 막힐 수 있다. 분석값일 뿐이니 조용히 넘어간다.
  }
}

/** 신청을 보낼 때 읽는다. 없으면 전부 null. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Attribution>) };
  } catch {
    return EMPTY;
  }
}

/**
 * 옛 신청 폼은 FormData 로 넘어온다. 히든 필드에 담긴 JSON 을 서버에서 푼다.
 *
 * ⚠️ 폼 값은 사용자가 마음대로 바꿀 수 있다. 문자열만 받고, 길이를 자르고,
 *    모르는 키는 버린다.
 */
/**
 * 밖에서 들어온 값을 믿을 수 있는 모양으로 만든다.
 *
 * ⚠️ 서버 액션 인자든 폼 히든 필드든 전부 사용자가 바꿀 수 있다.
 *    문자열만 받고, 길이를 자르고, 모르는 키는 버린다.
 *    전부 비어 있으면(직접 방문) null 을 돌려준다 — 빈 칸이 곧 '직접 방문' 이다.
 */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof Attribution): string | null => {
    const v = o[k];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_LEN) : null;
  };
  const next: Attribution = {
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    referrer: pick("referrer"),
    landing_path: pick("landing_path"),
  };
  return Object.values(next).some(Boolean) ? next : null;
}

/** 옛 신청 폼은 FormData 로 넘어온다. 히든 필드에 담긴 JSON 을 서버에서 푼다. */
export function parseAttributionJson(raw: unknown): Attribution | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return sanitizeAttribution(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 옛 폼용 히든 필드 이름. 클라이언트와 서버가 같은 이름을 봐야 한다. */
export const ATTRIBUTION_FIELD = "attribution";
