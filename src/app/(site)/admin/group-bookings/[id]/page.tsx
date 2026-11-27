import Link from "next/link";
import { notFound } from "next/navigation";
import { backLabel, safeBack, withBack } from "@/lib/adminBack";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { contactMethodLabel, groupKindLabel, preferredTimeLabel, repeatPlayerLabel, teamStyleLabel } from "@/lib/groupBooking";
import { addMinutes, dateLabel, kstToday, won } from "@/lib/groupPricing";
import { ensureFormLinks, formUrl } from "@/lib/groupFormLinks";
import { groupRefund, isPayType, requiredDeposit } from "@/lib/groupSettlement";
import { AdminBadge, AdminCard, AdminPage, AdminTabs, adminButtonClass, type AdminTone } from "@/components/admin/ui";
import { daysLeftOf, loadGroup, loadGroupTemplates, settlementFor } from "@/lib/groupAdmin";
import {
  MESSAGE_KINDS,
  fullPaymentNotice,
  messageBlockedReason,
  previewName,
  renderGroupMessage,
  stageAfterCopy,
  templateKeyOf,
} from "@/lib/groupMessages";
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
import { MessagesTab, type FormLinkView, type MessageView } from "./MessagesTab";
import { Checklist, OrganizerNameEditor, StageBackButton } from "./OverviewClient";
import { ContactEditor, LeaderCard } from "./LeaderCard";
import { consultItems } from "@/lib/groupForms/leaderForm";
import { loadLeaderAnswers, loadLeaderResponse } from "@/lib/groupLeader";
import { loadNametagMode, loadParticipants, loadSavedTeams, loadTeamPeople } from "@/lib/groupPeople";
import { ParticipantsTab } from "./ParticipantsTab";
import { TeamsTab } from "./TeamsTab";
import { ReportTab } from "./ReportTab";
import { ReviewsTab } from "./ReviewsTab";
import { countReviews, loadReviewQuestions, loadReviews } from "@/lib/groupReviews";
import { choiceBreakdowns, ratingSummary, reviewItems, reviewsCsv } from "@/lib/groupReviewSummary";
import { flattenTemplate, leaderParts } from "@/lib/groupForms/template";
import { loadTemplate, loadTemplateVersion } from "@/lib/groupFormTemplates";
import { answerText } from "@/lib/groupForms/leaderForm";
import type { Answers } from "@/lib/groupForms/validate";

const PARTICIPANT_FIXED_IDS = ["name", "phone", "nick", "age", "exp", "terms", "privacy", "phoneBox", "photo"];

export const dynamic = "force-dynamic";

/**
 * 단체 예약 한 건(관리자 개편 4단계).
 *
 * 머리: 모임명 · 단계 · D-day / 일시 · 인원 · 모임 성격 / 「일정 수정」 · 「취소 · 환불」.
 * 탭: 개요 · 금액 · 설문/문자. (참가자 / 팀 편성 / 리포트 탭은 그 화면을 만드는 단계에 더한다.)
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
  const TABS = ["overview", "money", "forms", "people", "teams", "report", "reviews"] as const;
  const tab = TABS.find((t) => t === sp.tab) ?? "overview";

  const loaded = await loadGroup(id);
  if (!loaded) notFound();
  const { group: g, adjustments, history, checklist } = loaded;

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
  // 안내 문자 미리보기 — 설문 · 문자 탭을 볼 때만 만든다. 담당자 이름은 가린 채 넣는다.
  let messages: MessageView[] = [];
  let links: FormLinkView[] = [];
  // 모임장 신청서 — 개요 탭에서만 읽는다(휴대폰 번호 · 새 담당자 이름은 가린 값으로 온다).
  const leader = tab === "overview" ? await loadLeaderResponse(id) : null;
  // 신청서는 그때의 양식으로 읽는다(양식을 고친 뒤에도 문항 이름 · 선택지가 어긋나지 않게).
  const leaderTemplate = leader ? (await loadTemplateVersion("leader", leader.templateVersion)).template : null;
  // 참가자 탭 — 명단(전화번호는 가린 값)과 명찰 색 기준. 팀 편성 탭 — 닉네임 · 방수와 저장된 편성 · 모임장 요청.
  const peopleData = tab === "people" ? await Promise.all([loadParticipants(id), loadNametagMode(id), loadTemplate("participant")]) : null;
  // 양식에 더한 질문(전용 칸이 없는 질문) — 참가자 줄에 답을 같이 보여준다.
  const extraQuestions = peopleData ? flattenTemplate(peopleData[2].template).filter((q) => !PARTICIPANT_FIXED_IDS.includes(q.id)) : [];
  const teamsData = tab === "teams" ? await Promise.all([loadTeamPeople(id), loadSavedTeams(id), loadLeaderAnswers(id)]) : null;
  // 리포트 탭 — 저장해 둔 내용이 있는지만 본다(내용은 열 때 읽는다).
  const reportSavedAt =
    tab === "report"
      ? ((await createAdminClient().from("group_reports").select("updated_at").eq("inquiry_id", id).maybeSingle()).data as { updated_at: string } | null)?.updated_at ?? null
      : null;
  // 후기 탭 — 모임 후기 설문 답(익명). 답은 그때의 양식으로 읽는다. 다른 탭에서는 건수만 센다(탭의 숫자).
  const reviewList = tab === "reviews" ? await loadReviews(id) : null;
  const reviewQuestions = reviewList ? await loadReviewQuestions(reviewList) : null;
  const reviewCount = reviewList ? reviewList.length : await countReviews(id);
  if (tab === "forms") {
    // 폼 링크 셋(없으면 이때 만든다)과 현황. 참가자는 수만, 후기는 건수와 평균 별점만 읽는다.
    const admin = createAdminClient();
    const [tokens, leaderRes, partRes, reviewRes] = await Promise.all([
      ensureFormLinks(id),
      admin.from("group_leader_responses").select("submitted_at, locked, edit_request").eq("inquiry_id", id).maybeSingle(),
      admin.from("group_participants").select("id", { count: "exact", head: true }).eq("inquiry_id", id),
      admin.from("group_reviews").select("rating").eq("inquiry_id", id),
    ]);
    const urls = { leader: formUrl(tokens.leader), participant: formUrl(tokens.participant), review: formUrl(tokens.review) };
    const ratings = ((reviewRes.data ?? []) as { rating: number }[]).map((r) => r.rating);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
    const lr = leaderRes.data as { submitted_at: string; locked: boolean; edit_request: string | null } | null;
    const leaderStat = !lr ? "미제출" : lr.edit_request ? "제출 완료 · 수정 요청 있음" : lr.locked ? "제출 완료" : "수정 열어 둠";
    const file = (k: string) => `${(g.group_name ?? "단체").replace(/[\\/:*?"<>|\s]+/g, "_")}_${k}_QR`;
    links = [
      { key: "leader", label: "모임장용 신청서", url: urls.leader, stat: leaderStat, fileName: file("모임장") },
      { key: "participant", label: "참가자용 사전 설문", url: urls.participant, stat: `${partRes.count ?? 0} / ${g.headcount}명`, fileName: file("참가자") },
      {
        key: "review",
        label: "모임 후기 설문",
        url: urls.review,
        stat: avg ? `${ratings.length}건 · 평균 ${avg}점` : "0건",
        fileName: file("후기"),
        // 답 내용은 후기 탭에서 읽는다.
        detailHref: withBack(`/group-bookings/${id}?tab=reviews`, back),
        detailLabel: "답변 보기",
      },
    ];
    const templates = await loadGroupTemplates();
    messages = MESSAGE_KINDS.map((m) => {
      const key = templateKeyOf(m.kind, g.pay_type);
      const body = templates.get(key);
      const blocked = messageBlockedReason(m.kind, g, today) ?? (body ? null : `문자 문구(${key})를 찾을 수 없습니다.`);
      const to = stageAfterCopy(m.kind, g, today);
      const copied = g.messages_copied?.[key];
      return {
        kind: m.kind,
        label: m.label,
        preview: blocked || !body ? null : renderGroupMessage({ kind: m.kind, body, group: g, adjustments, today, leaderName: previewName(g), urls }),
        blocked,
        copiedAt: copied ? formatDateTimeFull(copied) : null,
        nextStage: to ? stageLabel(to) : null,
        warning: m.kind === "quote" && !blocked ? fullPaymentNotice(g, adjustments, today) : null,
      };
    });
  }
  const dbStageIdx = stageIndex(g.stage);
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
          {(stage === "new" || stage === "d7" || stage === "done" || (stage === "confirmed" && g.deposit_paid_at != null)) && tab !== "forms" && (
            <Link href={self("forms")} className={adminButtonClass("primary")}>
              설문 · 문자 탭에서 문자 복사
            </Link>
          )}
        </div>
      )}

      <AdminTabs
        current={tab}
        tabs={[
          { key: "overview", label: "개요", href: self("overview") },
          { key: "money", label: "금액", href: self("money") },
          { key: "forms", label: "설문 · 문자", href: self("forms") },
          { key: "people", label: "참가자", href: self("people") },
          { key: "teams", label: "팀 편성", href: self("teams") },
          { key: "report", label: "리포트", href: self("report") },
          { key: "reviews", label: "후기", href: self("reviews"), count: reviewCount ?? undefined },
        ]}
      />

      {tab === "people" && peopleData ? (
        <ParticipantsTab
          id={id}
          cancelled={cancelled}
          headcount={g.headcount}
          mode={peopleData[1]}
          teamsHref={self("teams")}
          people={peopleData[0].map((p) => ({
            id: p.id,
            name: p.name,
            phoneMasked: p.phoneMasked,
            nick: p.nick,
            ageBand: p.ageBand,
            count: p.count,
            photo: p.photo,
            at: formatDateTimeFull(p.edited ? p.updatedAt : p.submittedAt),
            edited: p.edited,
            recent: p.recent,
            extras: extraQuestions
              .map((q) => ({ label: q.label, value: answerText(q, p.answers as Answers) }))
              .filter((x) => x.value !== "-"),
          }))}
        />
      ) : tab === "teams" && teamsData ? (
        <TeamsTab
          id={id}
          cancelled={cancelled}
          people={teamsData[0]}
          saved={teamsData[1]}
          leaderRequest={
            teamsData[2]?.answers.team
              ? {
                  text: [teamsData[2].answers.team, teamsData[2].answers.teamHow].filter((v) => typeof v === "string" && v).join(" · "),
                  custom: teamsData[2].answers.team === "직접 구성해서 전달",
                }
              : null
          }
        />
      ) : tab === "reviews" && reviewList && reviewQuestions ? (
        <ReviewsTab
          formsHref={self("forms")}
          view={(() => {
            const summary = ratingSummary(reviewList.map((r) => r.rating));
            return {
              count: summary.count,
              average: summary.average === null ? null : summary.average.toFixed(1),
              dist: summary.dist,
              breakdowns: choiceBreakdowns(reviewList, reviewQuestions),
              items: reviewItems(reviewList, reviewQuestions).map((r) => ({
                id: r.id,
                rating: r.rating,
                ratingLabel: r.ratingLabel,
                at: formatDateTimeFull(r.submittedAt),
                choices: r.choices,
                texts: r.texts,
              })),
              csv: {
                fileName: `${(g.group_name ?? "단체").replace(/[\\/:*?"<>|\s]+/g, "_")}_모임후기.csv`,
                ...reviewsCsv(reviewList, reviewQuestions, formatDateTimeFull),
              },
            };
          })()}
        />
      ) : tab === "report" ? (
        <ReportTab id={id} cancelled={cancelled} savedAt={reportSavedAt ? formatDateTimeFull(reportSavedAt) : null} />
      ) : tab === "forms" ? (
        <MessagesTab id={id} messages={messages} links={links} />
      ) : tab === "money" ? (
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

          {!cancelled && dbStageIdx > 0 && g.stage !== "confirmed" && (
            <div className="-mt-2 px-1">
              <StageBackButton id={id} from={stageLabel(g.stage)} to={GROUP_STAGES[dbStageIdx - 1].label} />
            </div>
          )}

          <AdminCard title="모임장 신청서">
            {leader ? (
              <LeaderCard
                id={id}
                cancelled={cancelled}
                baseQuestions={leaderTemplate ? leaderParts(leaderTemplate).base : []}
                questions={leaderTemplate ? flattenTemplate(leaderTemplate, { skip: ["base"] }) : []}
                data={{
                  answers: leader.answers,
                  submittedAt: formatDateTimeFull(leader.submittedAt),
                  submitCount: leader.submitCount,
                  locked: leader.locked,
                  phoneMasked: leader.phoneMasked,
                  newLeaderMasked: leader.newLeaderMasked,
                  editRequest: leader.editRequest,
                  editRequestedAt: leader.editRequestedAt ? formatDateTimeFull(leader.editRequestedAt) : null,
                  pending: leader.pending.map((p) => ({ key: p.key, label: p.label })),
                  consult: consultItems(leader.answers),
                  adminUpdatedAt: leader.adminUpdatedAt ? formatDateTimeFull(leader.adminUpdatedAt) : null,
                }}
              />
            ) : (
              <>
                <p className="text-body-sm text-foreground">아직 신청서가 없어요. 예약금이 들어오면 신청서 없이도 확정됩니다.</p>
                <p className="mt-1 text-body-sm text-muted">신청서 링크와 재촉 문자는 「설문 · 문자」 탭에 있어요.</p>
                {!cancelled && (
                  <Link href={self("forms")} className={`${adminButtonClass("secondary")} mt-3`}>
                    {confirmed ? "신청서 재촉 문자 보기" : "신청서 링크 보기"}
                  </Link>
                )}
              </>
            )}
          </AdminCard>

          <AdminCard title="준비 체크리스트">
            <Checklist
              id={id}
              confirmed={confirmed}
              cancelled={cancelled}
              items={checklist.map((c) => ({ id: c.id, label: c.label, owner: c.owner, done: c.done_at != null, auto: c.auto }))}
            />
          </AdminCard>

          <div className="grid gap-4 md:grid-cols-2">
            <AdminCard title="담당자 · 연락">
              <ContactReveal id={id} maskedName={maskName(g.organizer_name)} maskedContact={maskedContact} methodLabel={contactMethodLabel(g.contact_method)} />
              {!cancelled && <OrganizerNameEditor id={id} />}
              {!cancelled && <ContactEditor id={id} method={g.contact_method} />}
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
