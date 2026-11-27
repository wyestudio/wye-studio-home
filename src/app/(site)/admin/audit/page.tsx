import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { AdminBadge, AdminEmpty, AdminPage, AdminTabs, adminButtonClass, adminInputClass } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";
import type { AuditAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

/**
 * 감사로그 — 어드민이 무엇을 언제 했는지.
 *
 * 되돌릴 수 없는 액션(입금확인·취소·환불완료·쿠폰 발송·회차 비활성화 등)이
 * 아무 기록도 남기지 않던 것을 2026-09-12 에 보완했다.
 * 설계 근거: docs/09-implementation-roadmap.md Phase 7
 *
 * ⚠️ **누가** 했는지는 계정 단위로 알 수 없다. 어드민 인증이 공유 비밀번호
 *    하나라 사람을 구분할 계정이 없다. IP·브라우저로 기기 정도만 구분된다.
 *
 * 화면(2026-11-27 대표님 — 관리자 개편): 종류 탭 + 기간 + 쪽 넘기기, 한 줄 요약을 누르면 자세히.
 * 예전에는 최근 200건을 한 표에 전부 늘어놓았다(15화면 길이). 읽기만 한다 — 기록을 고치거나 지우는 길은 없다.
 */

const PAGE_SIZE = 50;

type Kind = "application" | "session" | "group" | "marketing" | "content";

/**
 * 작업마다 이름(사람이 읽는 말)과 종류(탭)를 붙인다.
 * `Record<AuditAction, …>` 라서 auditLog.ts 에 작업을 더하면 여기에도 적어야 빌드가 된다 —
 * 이름 없이 영문 코드로 보이거나 어느 탭에도 안 나오는 기록이 생기지 않게 한다.
 */
const ACTIONS: Record<AuditAction, { label: string; kind: Kind }> = {
  "application.payment_confirmed": { label: "입금 확인", kind: "application" },
  "application.cancelled": { label: "신청 취소(문자 발송)", kind: "application" },
  "application.cancelled_silent": { label: "신청 취소(문자 없음)", kind: "application" },
  "application.promoted": { label: "대기 → 확정", kind: "application" },
  "application.refund_completed": { label: "환불 완료", kind: "application" },
  "application.manual_created": { label: "수동 등록", kind: "application" },
  "application.updated": { label: "신청 정보 수정", kind: "application" },

  "session.deactivated": { label: "회차 비활성화", kind: "session" },
  "session.reminder_sent": { label: "하루 전 안내 발송", kind: "session" },
  "session.status_changed": { label: "회차 상태 변경", kind: "session" },
  "session.min_age_changed": { label: "최소 연령 변경", kind: "session" },
  "session.badge_changed": { label: "회차 태그 변경", kind: "session" },
  "session.deleted": { label: "회차 삭제", kind: "session" },
  "schedule.saved": { label: "회차 편성 저장", kind: "session" },

  // 문의 상태뿐 아니라 담당자 이름 · 폼 링크 · 단체 도구(양식 · 리포트 기본값) 수정에도 이 코드를 쓴다 — 무엇을 고쳤는지는 요약 칸에 나온다.
  "group_booking.updated": { label: "단체 정보 · 양식 수정", kind: "group" },
  "group_booking.closure_added": { label: "단체 일정 마감 표시", kind: "group" },
  "group_booking.closure_removed": { label: "단체 일정 마감 해제", kind: "group" },
  "group_booking.created": { label: "단체 등록", kind: "group" },
  "group_booking.deposit_confirmed": { label: "단체 예약금 입금 확인", kind: "group" },
  "group_booking.deposit_unconfirmed": { label: "단체 입금 확인 취소", kind: "group" },
  "group_booking.rescheduled": { label: "단체 일정 변경", kind: "group" },
  "group_booking.cancelled": { label: "단체 예약 취소", kind: "group" },
  "group_booking.money_changed": { label: "단체 금액 변경", kind: "group" },
  "group_booking.contact_viewed": { label: "단체 연락처 열람", kind: "group" },
  "group_booking.leader_form_edited": { label: "모임장 신청서 수정", kind: "group" },
  "group_booking.leader_form_unlocked": { label: "모임장 신청서 수정 열어주기", kind: "group" },
  "group_booking.contact_changed": { label: "단체 담당자 연락처 변경", kind: "group" },
  "group_booking.participants_exported": { label: "참가자 명단 내려받기", kind: "group" },
  "group_booking.participants_copied": { label: "참가자 명단 복사", kind: "group" },

  "coupon.sent": { label: "쿠폰 문자 발송", kind: "marketing" },
  "coupon.issued": { label: "쿠폰 발행", kind: "marketing" },
  "coupon.campaign_saved": { label: "쿠폰 종류 저장", kind: "marketing" },
  "coupon.campaign_deleted": { label: "쿠폰 종류 삭제", kind: "marketing" },
  "coupon.deleted": { label: "쿠폰 삭제", kind: "marketing" },
  "promotion.saved": { label: "프로모션 저장", kind: "marketing" },
  "promotion.deleted": { label: "프로모션 삭제", kind: "marketing" },
  "promotion.activated": { label: "프로모션 켜기", kind: "marketing" },
  "promotion.deactivated": { label: "프로모션 끄기", kind: "marketing" },
  "marketing_sms.sent": { label: "광고 문자 발송", kind: "marketing" },
  "marketing_optout.added": { label: "광고 수신거부 등록", kind: "marketing" },
  "marketing_optout.removed": { label: "광고 수신거부 해제", kind: "marketing" },
  "settlement.snapshot_saved": { label: "잼핏 정산 내역 보관", kind: "marketing" },
  "utm_link.saved": { label: "유입경로 링크 저장", kind: "marketing" },
  "utm_link.status": { label: "유입경로 링크 사용 · 중단", kind: "marketing" },

  "theme.saved": { label: "테마 저장", kind: "content" },
  "theme.deleted": { label: "테마 삭제", kind: "content" },
  "venue.saved": { label: "장소 저장", kind: "content" },
  "venue.deleted": { label: "장소 삭제", kind: "content" },
  "notice.saved": { label: "공지 저장", kind: "content" },
  "notice.deleted": { label: "공지 삭제", kind: "content" },
  "faq.saved": { label: "FAQ 저장", kind: "content" },
  "faq.deleted": { label: "FAQ 삭제", kind: "content" },
  "site_setting.saved": { label: "사이트 설정 저장", kind: "content" },
  "sms_template.updated": { label: "문자 포맷 수정", kind: "content" },
  "slack_template.updated": { label: "슬랙 포맷 수정", kind: "content" },
  "popup.saved": { label: "접속 팝업 저장", kind: "content" },
  "popup.deleted": { label: "접속 팝업 삭제", kind: "content" },
  "ranking.saved": { label: "랭킹 기록 저장", kind: "content" },
  "ranking.deleted": { label: "랭킹 기록 삭제", kind: "content" },
  "review_candidate.published": { label: "후기 등록", kind: "content" },
  "review_candidate.ignored": { label: "후기 관련없음 처리", kind: "content" },
  "survey_quote.published": { label: "한줄 후기 등록", kind: "content" },
  "survey_quote.removed": { label: "한줄 후기 삭제", kind: "content" },
  "xmas_game.gift_redeemed": { label: "크리스마스 선물 지급", kind: "content" },
  "xmas_game.gift_restored": { label: "크리스마스 선물 지급 취소", kind: "content" },
  "xmas_game.hidden": { label: "크리스마스 게임 랭킹 숨김", kind: "content" },
};

/** 종류 탭. 「전체」 에는 위 표에 없는 옛 기록까지 다 나온다. */
const TABS: { key: "all" | Kind; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "application", label: "신청 · 입금" },
  { key: "session", label: "회차" },
  { key: "group", label: "단체" },
  { key: "marketing", label: "마케팅" },
  { key: "content", label: "콘텐츠 · 설정" },
];

const actionsOf = (kind: Kind): string[] =>
  (Object.keys(ACTIONS) as AuditAction[]).filter((a) => ACTIONS[a].kind === kind);

/** 되돌리기 어렵거나 고객에게 문자가 나가는 액션은 눈에 띄게 한다. */
const HEAVY = new Set([
  "application.cancelled",
  "application.cancelled_silent",
  "application.refund_completed",
  "session.deactivated",
  "session.deleted",
  "coupon.sent",
  "marketing_sms.sent",
  "marketing_optout.removed",
  "theme.deleted",
  "venue.deleted",
  "sms_template.updated",
]);

type AuditRow = {
  id: number;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

const actionLabel = (action: string): string => (ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const str = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const kind = TABS.some((t) => t.key === str("kind")) ? (str("kind") as "all" | Kind) : "all";
  const ymd = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");
  const from = ymd(str("from"));
  const to = ymd(str("to"));
  const page = Math.max(1, Number(str("page")) || 1);

  const supabase = createAdminClient();

  // 종류 · 기간을 건 조회. 날짜는 한국 시간 하루(00:00 ~ 23:59)로 읽는다.
  const fromIso = from ? `${from}T00:00:00+09:00` : null;
  const toIso = to ? `${to}T23:59:59.999+09:00` : null;
  const listQuery = (k: "all" | Kind) => {
    let q = supabase.from("audit_logs").select("*", { count: "exact" });
    if (k !== "all") q = q.in("action", actionsOf(k));
    if (fromIso) q = q.gte("created_at", fromIso);
    if (toIso) q = q.lte("created_at", toIso);
    return q;
  };
  // 다른 탭의 건수(같은 기간). 줄은 받지 않고 개수만 센다.
  const countQuery = (k: "all" | Kind) => {
    let q = supabase.from("audit_logs").select("id", { count: "exact", head: true });
    if (k !== "all") q = q.in("action", actionsOf(k));
    if (fromIso) q = q.gte("created_at", fromIso);
    if (toIso) q = q.lte("created_at", toIso);
    return q;
  };

  const [rowsRes, ...countRes] = await Promise.all([
    listQuery(kind)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...TABS.filter((t) => t.key !== kind).map((t) => countQuery(t.key)),
  ]);

  const rows = (rowsRes.data ?? []) as AuditRow[];
  const total = rowsRes.count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 탭 · 쪽을 바꿔도 기간은 그대로 둔다. 「초기화」 만 기간을 지운다.
  const href = (o: { kind?: "all" | Kind; page?: number; clearDates?: boolean }) => {
    const next = new URLSearchParams();
    const k = o.kind ?? kind;
    if (k !== "all") next.set("kind", k);
    if (from && !o.clearDates) next.set("from", from);
    if (to && !o.clearDates) next.set("to", to);
    if (o.page && o.page > 1) next.set("page", String(o.page));
    const q = next.toString();
    return q ? `/audit?${q}` : "/audit";
  };

  const others = TABS.filter((t) => t.key !== kind);
  const tabs = TABS.map((t) => {
    const i = others.findIndex((o) => o.key === t.key);
    const res = i >= 0 ? countRes[i] : null;
    // 건수를 못 읽은 탭은 숫자를 비워 둔다(0 으로 속이지 않는다).
    const count = t.key === kind ? (rowsRes.error ? undefined : total) : res && !res.error ? (res.count ?? undefined) : undefined;
    return { key: t.key, label: t.label, href: href({ kind: t.key }), count };
  });

  return (
    <AdminPage
      title="감사로그"
      description={
        <>
          어드민에서 실행한 되돌리기 어려운 작업의 기록입니다. 한 줄을 누르면 자세히 보입니다.{" "}
          <span className="text-wait">
            어드민이 공유 비밀번호라 &lsquo;누가&rsquo;는 사람 단위로 구분되지 않습니다(IP·브라우저만 기록).
          </span>
        </>
      }
    >
      <AdminTabs tabs={tabs} current={kind} />

      <details open={Boolean(from || to) || undefined} className="group mb-5 rounded-xl border border-border bg-surface">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
          기간
          {(from || to) && (
            <AdminBadge tone="progress">
              {from || "처음"} ~ {to || "오늘"}
            </AdminBadge>
          )}
          <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form action="/audit" className="grid grid-cols-2 gap-3 border-t border-border p-4 md:grid-cols-4">
          {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
          <div>
            <label htmlFor="audit-from" className="mb-1.5 block text-label font-semibold text-foreground">
              부터
            </label>
            <input id="audit-from" type="date" name="from" defaultValue={from} className={adminInputClass} />
          </div>
          <div>
            <label htmlFor="audit-to" className="mb-1.5 block text-label font-semibold text-foreground">
              까지
            </label>
            <input id="audit-to" type="date" name="to" defaultValue={to} className={adminInputClass} />
          </div>
          <div className="col-span-2 flex items-end justify-end gap-2">
            <Link href={href({ clearDates: true })} className={adminButtonClass("secondary")}>
              초기화
            </Link>
            <button type="submit" className={`${adminButtonClass("primary")} min-w-28`}>
              검색
            </button>
          </div>
        </form>
      </details>

      {rowsRes.error ? (
        <p role="alert" className="text-body-sm text-danger">
          불러올 수 없습니다: {rowsRes.error.message}
        </p>
      ) : rows.length === 0 ? (
        <AdminEmpty
          title="기록이 없어요"
          hint={
            from || to || kind !== "all"
              ? "다른 탭을 누르거나 기간을 넓혀 보세요."
              : "입금 확인·취소·환불 완료 같은 작업을 하면 여기에 쌓입니다."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-body-sm text-muted">
            총 <strong className="text-foreground">{total}</strong>건
            {totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
          </p>
          <ul className="rounded-xl border border-border bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="border-b border-border/50 last:border-0">
                <LogRow r={r} />
              </li>
            ))}
          </ul>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className={adminButtonClass("secondary")}>
              이전
            </Link>
          )}
          {page < totalPages && (
            <Link href={href({ page: page + 1 })} className={adminButtonClass("secondary")}>
              다음
            </Link>
          )}
        </div>
      )}
    </AdminPage>
  );
}

/** 한 줄 요약 — 누르면 대상 · IP · 브라우저 · 남겨 둔 값이 펼쳐진다. */
function LogRow({ r }: { r: AuditRow }) {
  const { ip, ua, ...rest } = r.detail ?? {};
  const hasRest = Object.keys(rest).length > 0;
  return (
    <details className="group/row">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-fill-subtle md:flex-nowrap [&::-webkit-details-marker]:hidden">
        <span className="whitespace-nowrap text-body-sm tabular-nums text-muted md:w-36 md:shrink-0">{formatDateTimeFull(r.created_at)}</span>
        <span className="md:w-52 md:shrink-0">
          {HEAVY.has(r.action) ? (
            <AdminBadge tone="warn">{actionLabel(r.action)}</AdminBadge>
          ) : (
            <span className="text-body-sm font-semibold text-foreground">{actionLabel(r.action)}</span>
          )}
        </span>
        <span className="order-last w-full min-w-0 text-body-sm text-foreground md:order-none md:w-auto md:flex-1">{r.summary ?? "-"}</span>
        <Chevron dir="down" className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-open/row:rotate-180" />
      </summary>
      <dl className="grid gap-3 border-t border-border/50 bg-fill-subtle px-4 py-3 text-body-sm md:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-label text-muted">대상</dt>
          <dd className="break-all">
            {r.target_type} · <span className="font-mono">{r.target_id}</span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-muted">IP</dt>
          <dd className="break-all font-mono">{typeof ip === "string" && ip ? ip : "-"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-label text-muted">브라우저</dt>
          <dd className="break-words text-muted">{typeof ua === "string" && ua ? ua : "-"}</dd>
        </div>
        {hasRest && (
          <div className="min-w-0 md:col-span-3">
            <dt className="text-label text-muted">남겨 둔 값</dt>
            <dd>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface p-3 font-mono text-body-sm">
                {JSON.stringify(rest, null, 2)}
              </pre>
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}
