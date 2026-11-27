import Link from "next/link";
import { notFound } from "next/navigation";
import { backLabel, safeBack, withBack } from "@/lib/adminBack";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { contactMethodLabel, groupKindLabel, preferredTimeLabel, repeatPlayerLabel, teamStyleLabel } from "@/lib/groupBooking";
import { addMinutes, dateLabel, kstToday, won } from "@/lib/groupPricing";
import { groupRefund, isPayType, requiredDeposit } from "@/lib/groupSettlement";
import { AdminBadge, AdminCard, AdminNotice, AdminPage, AdminTabs, adminButtonClass, type AdminTone } from "@/components/admin/ui";
import { daysLeftOf, loadGroup, settlementFor } from "@/lib/groupAdmin";
import {
  GROUP_STAGES,
  ddayLabel,
  effectiveStage,
  isConfirmed,
  maskContact,
  maskName,
  nextAction,
  optionMinutes,
  scheduleOf,
  stageIndex,
  stageLabel,
  toSettlementOptions,
} from "@/lib/groupStage";
import { ContactReveal, GroupNameEditor, HeadActions, MemoEditor } from "./GroupDetailClient";
import { MoneyTab } from "./MoneyTab";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 한 건(관리자 개편 4단계).
 *
 * 머리: 모임명 · 단계 · D-day / 일시 · 인원 · 모임 성격 / 「일정 수정」 · 「취소 · 환불」.
 * 탭: 개요 · 금액. (설문 · 문자 / 참가자 / 팀 편성 / 리포트 탭은 그 화면을 만드는 단계에 더한다.)
 *
 * 예전 상세에 있던 것은 전부 남아 있다: 견적 신청 내용(담당자 · 견적 · 모임/요청사항 · 접수/유입) · 메모는 개요에,
 * 인원 · 구성 고치기는 금액 탭에(이제 기록이 남는다), 확정 일시는 금액 탭의 입금 확인과 머리의 일정 수정에.
 * 「진행 상태」 선택 상자는 없앴다 — 단계는 동작에 따라 넘어간다(2026-11-27 대표님).
 *
 * ⚠️ 연락처 · 담당자 이름은 **가려서** 내려간다. 전체 값은 「연락처 보기」 를 눌렀을 때만 온다(감사로그에 남는다).
 */
export default async function AdminGroupBookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // 들어온 목록(조건 포함) · 홈 달력 날짜로 돌아간다 — adminBack.ts
  const back = safeBack(sp.back, "/group-bookings");
  const tab = sp.tab === "money" ? "money" : "overview";

  const loaded = await loadGroup(id);
  if (!loaded) notFound();
  const { group: g, adjustments, history } = loaded;

  // 가린 연락처는 서버에서 만든다. 전체 값은 이 요청의 응답에 싣지 않는다.
  const { data: contactRow } = await createAdminClient()
    .from("admin_group_booking_inquiries_view")
    .select("contact")
    .eq("id", id)
    .maybeSingle();
  const maskedContact = maskContact(g.contact_method, (contactRow as { contact: string } | null)?.contact ?? null);

  const today = kstToday();
  const sch = scheduleOf(g);
  const left = daysLeftOf(g, today);
  const s = settlementFor(g, adjustments, today);
  const stage = effectiveStage(g, today);
  const cancelled = g.cancelled_at != null;
  const confirmed = isConfirmed(g);
  const payType = isPayType(g.pay_type) ? g.pay_type : "transfer";
  const deposit = g.deposit_amount ?? 0;
  const refund = sch.date ? groupRefund({ depositPaid: deposit, eventDate: sch.date, today }) : null;
  const refundView = {
    deposit,
    amount: refund ? refund.amount : deposit,
    label: refund ? `${refund.range} — ${refund.label}` : "행사 날짜가 없어 전액 환불",
    daysLeft: refund?.daysLeft ?? null,
  };
  const required = requiredDeposit({ total: s.total, eventDate: sch.date ?? today, today, payType });
  const todo = nextAction(g, today, left);
  const name = g.group_name ?? `${maskName(g.organizer_name)} 님`;
  const badge: { tone: AdminTone; label: string } = cancelled
    ? { tone: "danger", label: "취소" }
    : { tone: stage === "new" ? "warn" : stage === "contacted" ? "progress" : stage === "report" ? "idle" : "done", label: stageLabel(stage) };
  const self = (t: string) => withBack(`/group-bookings/${id}${t === "overview" ? "" : `?tab=${t}`}`, back);
  const o = g.options ?? {};
  const picks = [
    o.icebreaking === false ? "레크리에이션 뺌" : null,
    o.character ? "캐릭터 꾸미기" : null,
    o.after_party_hours ? `애프터파티 ${o.after_party_hours}시간` : null,
    o.cleanup ? "뒷정리" : null,
  ].filter(Boolean);

  return (
    <AdminPage title={name}>
      <Link href={back} className="-mt-4 mb-3 flex min-h-11 items-center text-body-sm text-glow underline">
        {backLabel(back)}으로 돌아가기
      </Link>

      {/* ── 머리 ── */}
      <section className="mb-4 rounded-xl border border-border bg-surface p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
          {left != null && !cancelled && <AdminBadge tone="idle">{ddayLabel(left)}</AdminBadge>}
          {g.source === "manual" && <AdminBadge tone="idle">직접 등록</AdminBadge>}
          {g.is_student_group && <AdminBadge tone="progress">학생 단체</AdminBadge>}
        </div>
        <p className="mt-2 text-h3 font-extrabold tabular-nums text-foreground">
          {sch.date ? dateLabel(sch.date) : "날짜 미정"}{" "}
          {sch.time ? `${sch.time} – ${addMinutes(sch.time, sch.minutes)}` : "시간 미정"}
          {!sch.fixed && <span className="ml-2 text-body font-normal text-muted">희망</span>}
        </p>
        <p className="mt-1 text-body text-muted">
          {g.headcount}명{g.group_kind ? ` · ${groupKindLabel(g.group_kind)}` : ""}
          {s.priced ? ` · 총 ${won(s.total)}` : " · 별도 상담"}
        </p>
        {cancelled && (
          <p className="mt-2 text-body-sm text-danger">
            {formatDateTimeFull(g.cancelled_at!)} 취소 · 사유: {g.cancel_reason ?? "-"}
            {g.refund_amount != null && ` · 환불 ${won(g.refund_amount)}`}
          </p>
        )}
        <GroupNameEditor id={id} groupName={g.group_name ?? ""} />
        <HeadActions
          id={id}
          cancelled={cancelled}
          confirmed={confirmed}
          schedule={{ date: sch.date ?? today, time: sch.time ?? "", minutes: sch.minutes }}
          refund={refundView}
        />
      </section>

      {/* ── 지금 할 일 ── */}
      {todo && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft p-4">
          <p className="text-body text-foreground">
            <span className="block text-label font-semibold text-brand">지금 할 일</span>
            <span className="font-semibold">{todo}</span>
          </p>
          {(stage === "contacted" || (stage === "confirmed" && g.deposit_paid_at == null)) && tab !== "money" && (
            <Link href={self("money")} className={adminButtonClass("primary")}>
              금액 탭에서 입금 확인
            </Link>
          )}
        </div>
      )}

      <AdminTabs
        current={tab}
        tabs={[
          { key: "overview", label: "개요", href: self("overview") },
          { key: "money", label: "금액", href: self("money") },
        ]}
      />

      {tab === "money" ? (
        <MoneyTab
          id={id}
          cancelled={cancelled}
          headcount={g.headcount}
          options={toSettlementOptions(g.options)}
          isStudent={g.is_student_group}
          studentCount={g.student_count}
          payType={payType}
          schedule={sch}
          optionMinutes={optionMinutes(g.options)}
          settlement={s}
          adjustments={adjustments.map((a) => ({ id: a.id, reason: a.reason_code, label: a.label, note: a.note }))}
          deposit={{
            amount: g.deposit_amount,
            paidAt: g.deposit_paid_at ? formatDateTimeFull(g.deposit_paid_at) : null,
            returnedAt: g.deposit_returned_at ? formatDateTimeFull(g.deposit_returned_at) : null,
          }}
          balancePaidAt={g.balance_paid_at ? formatDateTimeFull(g.balance_paid_at) : null}
          required={required}
          daysLeft={left}
          refund={refundView}
          history={history.map((h) => ({ id: h.id, summary: h.summary, reason: h.reason, actor: h.actor, at: formatDateTimeFull(h.created_at) }))}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* 단계 줄 — 7단계 중 어디인지. 색만으로 가르지 않게 지금 단계에 글자를 붙인다 */}
          {!cancelled && (
            <ol className="flex flex-wrap gap-x-1 gap-y-2 rounded-xl border border-border bg-surface p-4" aria-label="진행 단계">
              {GROUP_STAGES.map((st, i) => {
                const cur = stageIndex(stage);
                const state = i < cur ? "지남" : i === cur ? "지금" : "남음";
                return (
                  <li key={st.code} className="flex items-center gap-1 text-body-sm">
                    <span
                      className={`rounded-md px-2 py-1 ${
                        i === cur ? "bg-foreground font-semibold text-background" : i < cur ? "bg-fill-strong text-foreground" : "text-muted"
                      }`}
                    >
                      {st.label}
                      {i === cur && <span className="ml-1 text-micro">(지금)</span>}
                      <span className="sr-only"> — {state}</span>
                    </span>
                    {i < GROUP_STAGES.length - 1 && <span aria-hidden className="text-muted">→</span>}
                  </li>
                );
              })}
            </ol>
          )}

          <AdminNotice title="모임장 신청서 · 준비 체크리스트는 다음 묶음에서 들어옵니다">
            지금은 견적 신청 때 받은 내용과 메모만 보입니다. 예약금이 들어오면 신청서 없이도 금액 탭에서 확정할 수 있습니다.
          </AdminNotice>

          <div className="grid gap-4 md:grid-cols-2">
            <AdminCard title="담당자 · 연락">
              <ContactReveal id={id} maskedName={maskName(g.organizer_name)} maskedContact={maskedContact} methodLabel={contactMethodLabel(g.contact_method)} />
            </AdminCard>

            <AdminCard title="견적 신청 내용 (접수 시점)">
              <Info
                rows={[
                  ["구성", picks.length ? picks.join(", ") : "기본 구성"],
                  ["예상 금액", g.estimate_total != null ? won(g.estimate_total) : "상담 후 안내"],
                  ["1인", g.unit_price != null ? won(g.unit_price) : "-"],
                  ["희망 일시", `${g.preferred_date ? dateLabel(g.preferred_date) : "날짜 미정"} ${preferredTimeLabel(g.preferred_time)}`],
                ]}
              />
              <p className="mt-2 text-body-sm text-muted">지금 금액은 금액 탭에서 봅니다. 위는 접수할 때 계산한 기록입니다.</p>
            </AdminCard>

            <AdminCard title="모임 · 요청사항">
              <Info
                rows={[
                  ["모임 이름", g.group_name ?? "-"],
                  ["모임 성격", g.group_kind ? `${groupKindLabel(g.group_kind)}${g.group_kind_note ? ` (${g.group_kind_note})` : ""}` : "-"],
                  ["팀 구성", g.team_style ? teamStyleLabel(g.team_style) : "-"],
                  ["재참여", g.repeat_player ? repeatPlayerLabel(g.repeat_player) : "-"],
                  ["기념일", g.occasion ?? "-"],
                  ["요청사항", g.note ? <span key="n" className="whitespace-pre-line">{g.note}</span> : "-"],
                ]}
              />
            </AdminCard>

            <AdminCard title="접수">
              <Info
                rows={[
                  ["접수 시각", formatDateTimeFull(g.created_at)],
                  ["경로", g.source === "manual" ? "운영자 직접 등록" : "홈페이지 단체 견적"],
                  [
                    "유입",
                    !g.utm_source && !g.referrer ? (
                      "직접 방문"
                    ) : (
                      <span key="u" className="break-all">
                        {[g.utm_source && `${g.utm_source}${g.utm_medium ? ` / ${g.utm_medium}` : ""}`, g.utm_campaign, g.referrer, g.landing_path]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ),
                  ],
                ]}
              />
            </AdminCard>
          </div>

          <AdminCard title="운영 메모">
            <MemoEditor id={id} memo={g.admin_memo ?? ""} />
          </AdminCard>
        </div>
      )}
    </AdminPage>
  );
}

function Info({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-body-sm text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-body-sm text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
