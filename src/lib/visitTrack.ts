/**
 * 방문 발자취 기록 — 브라우저 쪽(2026-11-04 대표님).
 *
 * 브라우저에 무작위 번호(visitor_id)를 붙이고, 페이지 이동 · 버튼 클릭 · 분석 이벤트를 모아
 * 몇 초마다 Supabase 의 track_events 로 **바로** 보낸다. 어드민 「방문 발자취」 가 읽는다.
 *
 * ⚠️ Vercel 서버(서버 액션 · API 라우트)를 거치지 않는다 — 방문 × 클릭 수만큼 함수가 돌면
 *    무료 한도를 넘긴다(wye-server-cost). 공개 anon 키로 track_events 만 부를 수 있다.
 * ⚠️ 이름 · 전화번호 · 입력칸 값은 보내지 않는다. 분석 이벤트도 아래 SAFE_KEYS 만 남긴다.
 * ⚠️ initVisitTrack() 을 부르기 전에는 아무것도 보내지 않는다 — 어드민 화면은 부르지 않는다.
 * 저장소(localStorage · sessionStorage)가 막힌 브라우저에서는 조용히 아무것도 안 한다.
 */

const VISITOR_KEY = "wye_vid";
const VISIT_KEY = "wye_visit";
/** 이만큼 아무것도 안 하면 다음 행동은 새 방문으로 센다(GA4 와 같은 30분). */
const VISIT_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 4000;
const MAX_BATCH = 40;

/** 분석 이벤트에서 남길 값 — 사람을 알아볼 수 없는 것만. birthYear 등은 버린다. */
const SAFE_KEYS = [
  "themeLabel",
  "sectionKey",
  "sectionLabel",
  "sectionIndex",
  "appSessionId",
  "sessionId",
  "confirmationCode",
] as const;

type Queued = { kind: "page" | "click" | "event"; name: string; path: string; meta?: Record<string, unknown>; t: number };

let enabled = false;
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/**
 * 최근 1.5초 안에 남긴 것 — 같은 것이 또 오면 버린다(연타 · 개발 모드의 effect 두 번 실행).
 * 바로 앞 하나만 보면 안 된다 — 두 번 실행은 "페이지 → 신청 시작 → 페이지 → 신청 시작" 처럼 번갈아 온다.
 */
const recent = new Map<string, number>();
const DEDUPE_MS = 1500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16),
      );
}

/** 이 브라우저의 번호. 신청할 때 서버로 같이 보내 신청 건에 잇는다. 저장소가 막혔으면 null. */
export function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id || !UUID.test(id)) {
      id = newId();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** 지금 방문의 번호. 30분 넘게 쉬었으면 새로 만들고 isNew 를 알린다. */
function currentVisit(): { id: string; isNew: boolean } | null {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(VISIT_KEY);
    const saved = raw ? (JSON.parse(raw) as { id?: string; last?: number }) : null;
    const alive = saved?.id && UUID.test(saved.id) && typeof saved.last === "number" && now - saved.last < VISIT_IDLE_MS;
    const id = alive ? (saved!.id as string) : newId();
    window.sessionStorage.setItem(VISIT_KEY, JSON.stringify({ id, last: now }));
    return { id, isNew: !alive };
  } catch {
    return null;
  }
}

function isInternal(): boolean {
  try {
    return document.cookie.split("; ").includes("wye_internal=internal");
  } catch {
    return false;
  }
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const vid = visitorId();
  const visit = currentVisit();
  const batch = queue;
  queue = [];
  if (!url || !key || !vid || !visit) return;
  const now = Date.now();
  // keepalive: 페이지를 닫는 순간 보내도 끝까지 간다
  fetch(`${url}/rest/v1/rpc/track_events`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_visitor: vid,
      p_visit: visit.id,
      p_internal: isInternal(),
      p_events: batch.map(({ t, ...e }) => ({ ...e, ago: Math.max(0, now - t) })),
    }),
  }).catch(() => {});
}

function push(e: Omit<Queued, "t">) {
  if (!enabled) return;
  const key = `${e.kind}|${e.name}|${e.path}`;
  const now = Date.now();
  for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return;
  recent.set(key, now);
  queue.push({ ...e, name: e.name.slice(0, 80), path: e.path.slice(0, 200), t: Date.now() });
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** 고객 화면에서 한 번 켠다(VisitTracker). 화면을 떠날 때 남은 것을 보낸다. */
export function initVisitTrack(): () => void {
  enabled = true;
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  return () => {
    flush();
    enabled = false;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
  };
}

/** 어디서 왔나 — 방문의 첫 페이지에만 붙인다. utm_source → 다른 사이트 도메인 → 직접. */
function sourceMeta(): Record<string, string> {
  const meta: Record<string, string> = {};
  try {
    const sp = new URLSearchParams(window.location.search);
    const utm = sp.get("utm_source");
    let ref = "";
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname.replace(/^www\./, "")) ref = host;
    }
    meta.src = (utm || ref || "직접").slice(0, 60);
    for (const k of ["utm_medium", "utm_campaign", "utm_content"]) {
      const v = sp.get(k);
      if (v) meta[k.replace("utm_", "")] = v.slice(0, 60);
    }
    if (ref) meta.ref = ref.slice(0, 60);
  } catch {
    /* 못 읽으면 출처 없이 */
  }
  return meta;
}

export function trackPage(path: string) {
  if (!enabled) return;
  const visit = currentVisit();
  push({ kind: "page", name: path, path, meta: visit?.isNew ? sourceMeta() : undefined });
}

export function trackClick(label: string, path: string, meta?: Record<string, unknown>) {
  push({ kind: "click", name: label, path, meta });
}

/** 분석 이벤트(analytics.ts 의 pushDataLayerEvent)를 같이 남긴다. 안전한 값만 고른다. */
export function trackEvent(event: string, params?: Record<string, unknown>) {
  if (!enabled || typeof window === "undefined") return;
  const name = typeof params?.ga4Event === "string" ? params.ga4Event : event;
  const meta: Record<string, unknown> = {};
  for (const k of SAFE_KEYS) {
    const v = params?.[k];
    if (typeof v === "string" || typeof v === "number") meta[k] = typeof v === "string" ? v.slice(0, 80) : v;
  }
  push({ kind: "event", name, path: window.location.pathname, meta: Object.keys(meta).length ? meta : undefined });
}
