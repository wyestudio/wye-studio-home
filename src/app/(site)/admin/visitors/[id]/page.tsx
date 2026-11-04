import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull, formatSessionDateTime } from "@/lib/format";
import { backLabel, safeBack, withBack } from "@/lib/adminBack";
import { CLARITY_URL, eventLabel, pageLabel, visitorTag } from "../visitLabels";

export const dynamic = "force-dynamic";

type Ev = {
  at: string;
  visit_id: string;
  kind: "page" | "click" | "event";
  name: string;
  path: string | null;
  meta: Record<string, unknown> | null;
  internal: boolean;
};

type Line = { at: string; kind: Ev["kind"]; text: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

const KIND: Record<Ev["kind"], { label: string; cls: string }> = {
  page: { label: "화면", cls: "bg-fill-strong text-foreground" },
  click: { label: "클릭", cls: "bg-brand text-brand-foreground" },
  event: { label: "행동", cls: "bg-glow text-black" },
};

/** "14:03:21" — 한국 시간 */
const clock = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 19);

/**
 * 방문자 한 명이 지나간 길 — 방문(30분 쉬면 새 방문)마다 묶어 시간순으로(2026-11-04 대표님).
 *
 * 상세 블록을 내려가며 본 기록(detail_section_view)은 한 줄로 접는다. 하나씩 늘어놓으면
 * 정작 "무엇을 눌렀나" 가 묻힌다.
 */
export default async function AdminVisitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const back = safeBack((await searchParams).back, "/visitors");
  const here = withBack(`/visitors/${id}`, back);

  const supabase = createAdminClient();
  const [{ data, error }, { data: links }, { data: themes }] = await Promise.all([
    supabase.rpc("admin_visitor_events", { p_visitor: id }),
    supabase.from("visitor_links").select("application_id, group_inquiry_id, created_at").eq("visitor_id", id),
    supabase.from("themes").select("slug, name, variant_label"),
  ]);
  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">방문 기록을 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }
  const events = (data ?? []) as Ev[];
  if (events.length === 0) notFound();

  const themeNames = new Map(
    ((themes ?? []) as { slug: string; name: string; variant_label: string | null }[]).map((t) => [
      t.slug,
      [t.name, t.variant_label].filter(Boolean).join(" "),
    ]),
  );

  // 이벤트에 실린 회차 id → "11/7(토) 13:30"
  const sessionIds = [
    ...new Set(
      events
        .flatMap((e) => [e.meta?.appSessionId, e.meta?.sessionId])
        .filter((v): v is string => typeof v === "string" && UUID.test(v)),
    ),
  ];
  const { data: sessions } = sessionIds.length
    ? await supabase.from("sessions").select("id, start_at").in("id", sessionIds)
    : { data: [] };
  const sessionLabels = new Map(
    ((sessions ?? []) as { id: string; start_at: string }[]).map((s) => [s.id, formatSessionDateTime(s.start_at)]),
  );

  // 신청으로 이어졌으면 그 사람
  const linkRows = (links ?? []) as { application_id: string | null; group_inquiry_id: string | null }[];
  const { data: owner } = linkRows.some((l) => l.application_id)
    ? await supabase.rpc("admin_visitor_owner", { p_visitor: id })
    : { data: [] };
  const me = ((owner ?? []) as { name: string | null; phone_hash: string | null }[])[0];
  const repName = me?.name ?? null;
  const groupIds = linkRows.map((l) => l.group_inquiry_id).filter((v): v is string => !!v);

  // 방문마다 묶고, 상세 블록 열람은 연달아 나오면 한 줄로 접는다
  const visits: { id: string; lines: Line[]; src: string | null; start: string; end: string }[] = [];
  for (const e of events) {
    let v = visits.at(-1);
    if (!v || v.id !== e.visit_id) {
      v = { id: e.visit_id, lines: [], src: null, start: e.at, end: e.at };
      visits.push(v);
    }
    v.end = e.at;
    if (e.kind === "page" && typeof e.meta?.src === "string" && !v.src) {
      const extra = ["medium", "campaign", "content"].map((k) => e.meta?.[k]).filter((x) => typeof x === "string");
      v.src = [e.meta.src, ...extra].join(" / ");
    }
    if (e.kind === "event" && (e.name === "detail_section_view" || e.name === "group_section_view")) {
      const label = String(e.meta?.sectionLabel ?? e.meta?.sectionKey ?? "");
      const last = v.lines.at(-1);
      if (last?.kind === "event" && last.text.startsWith("블록 봄: ")) {
        last.text += `, ${label}`;
        continue;
      }
      v.lines.push({ at: e.at, kind: "event", text: `블록 봄: ${label}` });
      continue;
    }
    const text =
      e.kind === "page"
        ? pageLabel(e.name, themeNames)
        : e.kind === "click"
          ? `「${e.name}」${typeof e.meta?.to === "string" ? ` → ${e.meta.to}` : ""}${typeof e.meta?.y === "number" ? ` · 화면 ${e.meta.y}% 지점` : ""}`
          : eventLabel(e.name, e.meta, sessionLabels);
    v.lines.push({ at: e.at, kind: e.kind, text });
  }

  const minutes = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href={back} className="mb-4 inline-block text-body-sm text-glow hover:underline">
          ← {backLabel(back)}
        </Link>

        <header className="mb-6 rounded-xl border border-border p-4 md:p-5">
          <p className="text-h2 font-semibold">{repName ?? visitorTag(id)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-muted">
            <span>방문 {visits.length}번</span>
            <span>· 처음 {formatDateTimeFull(events[0].at)}</span>
            <span>· 마지막 {formatDateTimeFull(events.at(-1)!.at)}</span>
            {events.some((e) => e.internal) && (
              <span className={`${tag} border border-amber-400/60 text-amber-400`}>우리 기기</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {me?.phone_hash && (
              <Link
                href={withBack(`/customers/${encodeURIComponent(me.phone_hash)}`, here)}
                className="rounded-lg border border-border px-3 py-1.5 text-body-sm font-semibold hover:bg-fill-subtle"
              >
                고객 기록 보기
              </Link>
            )}
            {groupIds.map((g) => (
              <Link
                key={g}
                href={withBack(`/group-bookings/${g}`, here)}
                className="rounded-lg border border-border px-3 py-1.5 text-body-sm font-semibold hover:bg-fill-subtle"
              >
                단체 문의 보기
              </Link>
            ))}
          </div>
          {/* 녹화는 Clarity 안에서만 볼 수 있다 — 이 사람의 번호를 태그(wye_vid)로 보내 두었으니 필터로 찾는다 */}
          <div className="mt-3 rounded-lg bg-fill-subtle p-3 text-body-sm text-muted">
            <p>
              화면 녹화는 Clarity 의 <strong className="text-foreground">레코딩 → 필터 → 사용자 지정 태그</strong> 에서{" "}
              <code className="text-foreground">wye_vid</code> 를 아래 번호로 고르면 이 사람 것만 나옵니다.
              우리 기기는 녹화하지 않습니다.
            </p>
            <p className="mt-1 break-all font-mono text-foreground">{id}</p>
            {CLARITY_URL && (
              <a href={CLARITY_URL} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-glow hover:underline">
                Clarity 열기 ↗
              </a>
            )}
          </div>
        </header>

        <ol className="flex flex-col gap-4">
          {visits.map((v, i) => (
            <li key={v.id} className="rounded-xl border border-border">
              <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-3">
                <span className="text-body font-semibold">방문 {i + 1}</span>
                <span className="text-body-sm tabular-nums text-muted">
                  {formatDateTimeFull(v.start)} · {minutes(v.start, v.end)}분
                </span>
                {v.src && <span className="text-body-sm text-muted">· {v.src}</span>}
              </div>
              <ul className="flex flex-col">
                {v.lines.map((l, j) => (
                  <li key={j} className="flex items-start gap-3 border-b border-border/40 px-4 py-2 last:border-0">
                    <span className="w-16 shrink-0 pt-0.5 text-body-sm tabular-nums text-muted">{clock(l.at)}</span>
                    <span className={`${tag} shrink-0 ${KIND[l.kind].cls}`}>{KIND[l.kind].label}</span>
                    <span className="min-w-0 break-words text-body-sm">{l.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
