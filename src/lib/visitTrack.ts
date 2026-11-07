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

/** 기록하지 않는 화면 — 사이트 잠금(비밀번호) 화면과 우리 기기 표시 화면은 손님의 길이 아니다 */
const SKIP_PATH = /^\/(site-gate|internal)(\/|-|$)/;

function push(e: Omit<Queued, "t">) {
  if (!enabled) return;
  if (SKIP_PATH.test(window.location.pathname)) return;
  const key = `${e.kind}|${e.name}|${e.path}`;
  const now = Date.now();
  for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return;
  recent.set(key, now);
  queue.push({ ...e, name: e.name.slice(0, 80), path: e.path.slice(0, 200), t: Date.now() });
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** 지금 화면에서 어디까지 내려왔나(%) — 화면 아래 끝 기준 */
export function scrollPct(clientY?: number): number {
  const doc = document.documentElement;
  const h = Math.max(doc.scrollHeight, 1);
  const y = clientY == null ? window.scrollY + window.innerHeight : window.scrollY + clientY;
  return Math.min(100, Math.max(0, Math.round((y / h) * 100)));
}

/**
 * 지금 보고 있는 화면 — 체류 시간(보이는 동안만)과 가장 깊이 내려온 곳.
 * 화면을 떠날 때(다른 화면으로 · 탭을 숨김 · 닫음) page_leave 한 건으로 남긴다.
 * 탭을 숨겼다 돌아오면 다음에 떠날 때 그 사이 시간만 한 건 더 남는다 — 어드민이 방문 안에서 더한다.
 */
let cur: { path: string; activeMs: number; segStart: number | null; maxScroll: number } | null = null;

function leavePage() {
  if (!cur) return;
  if (cur.segStart != null) {
    cur.activeMs += performance.now() - cur.segStart;
    cur.segStart = null;
  }
  cur.maxScroll = Math.max(cur.maxScroll, scrollPct()); // 떠나는 순간의 위치도 센다
  const secs = Math.round(cur.activeMs / 1000);
  if (secs > 0) push({ kind: "event", name: "page_leave", path: cur.path, meta: { secs, scroll: cur.maxScroll } });
  cur.activeMs = 0;
}

/** 고객 화면에서 한 번 켠다(VisitTracker). 화면을 떠날 때 남은 것을 보낸다. */
export function initVisitTrack(): () => void {
  enabled = true;
  // 다시 켜질 때(개발 모드의 effect 두 번 실행) 지금 화면의 시간을 이어서 잰다
  if (cur && cur.segStart == null && document.visibilityState === "visible") cur.segStart = performance.now();
  // 떠나는 기록(page_leave)을 먼저 쌓고 보낸다 — 순서가 바뀌면 마지막 화면의 체류 시간이 빠진다
  const onHide = () => {
    if (document.visibilityState === "hidden") {
      leavePage();
      flush();
    } else if (cur) {
      cur.segStart = performance.now();
    }
  };
  const onPageHide = () => {
    leavePage();
    flush();
  };
  // 스크롤은 0.2초에 한 번만 잰다(passive) — 손님 화면 움직임에 끼어들지 않게.
  // ⚠️ requestAnimationFrame 으로 미루지 않는다 — 탭이 뒤에 있으면 멈춰서 깊이를 못 잰다
  let lastScroll = 0;
  const onScroll = () => {
    const now = performance.now();
    if (now - lastScroll < 200) return;
    lastScroll = now;
    if (cur) cur.maxScroll = Math.max(cur.maxScroll, scrollPct());
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    leavePage();
    flush();
    enabled = false;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("scroll", onScroll);
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
    // 휴대폰 · 컴퓨터 — 어드민 「방문 분석」 의 기기 비율. 768px 은 사이트의 md 경계다
    meta.dev = window.innerWidth < 768 ? "mobile" : "desktop";
  } catch {
    /* 못 읽으면 출처 없이 */
  }
  return meta;
}

/**
 * 기록에 쓸 지금 화면의 경로 — 보통은 pathname, 테마 상세는 모드(?mode=)까지 붙여 파티 · 노말을
 * 따로 센다(2026-11-07 대표님). 주소창의 ?mode= 는 서버가 늘 정식 값으로 고쳐 두므로
 * (themes/[slug]/page.tsx 의 redirect) 화면과 같다고 믿어도 된다.
 */
export function pagePath(): string {
  const p = window.location.pathname;
  if (!/^\/themes\/[^/]+$/.test(p)) return p;
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode ? `${p}?mode=${mode}` : p;
}

export function trackPage(path: string) {
  if (!enabled) return;
  if (cur && cur.path === path) return; // 같은 화면을 다시 알린 것(개발 모드의 두 번 실행)
  leavePage();
  cur = {
    path,
    activeMs: 0,
    segStart: document.visibilityState === "visible" ? performance.now() : null,
    maxScroll: scrollPct(),
  };
  const visit = currentVisit();
  push({ kind: "page", name: path, path, meta: visit?.isNew ? sourceMeta() : undefined });
}

export function trackClick(label: string, path: string, meta?: Record<string, unknown>) {
  push({ kind: "click", name: label, path, meta });
}

/** 입력칸을 채웠다 — 무엇을 적었는지는 남기지 않고 칸 이름만(data-track-field) */
export function trackField(field: string) {
  push({ kind: "event", name: "field_filled", path: pagePath(), meta: { sectionLabel: field.slice(0, 40) } });
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
  push({ kind: "event", name, path: pagePath(), meta: Object.keys(meta).length ? meta : undefined });
}
