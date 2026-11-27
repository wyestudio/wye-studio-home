import Image from "next/image";
import { dateLabel } from "@/lib/groupPricing";
import { loadParticipantStatus, resolveForm } from "@/lib/groupFormLinks";
import { loadLeaderPrefill } from "@/lib/groupLeader";
import type { FormDef } from "@/lib/groupForms/schema";
import { flattenTemplate, leaderParts } from "@/lib/groupForms/template";
import { loadTemplate } from "@/lib/groupFormTemplates";
import { LeaderForm } from "./LeaderForm";
import { ParticipantForm } from "./ParticipantForm";
import { ReviewForm } from "./ReviewForm";

// 링크마다 · 낼 때마다 내용이 다르다. 미리 구워 둘 수 없다.
export const dynamic = "force-dynamic";

/**
 * 단체 예약 공개 폼 — `/f/<코드>`. 코드를 아는 사람만 그 단체의 그 폼 하나를 연다.
 *
 * 서버가 한 번 읽어 그린다(wye-server-cost). 신청 현황은 처음 열 때와 「새로고침」 을 눌렀을 때만 읽는다 —
 * 주기적으로 다시 읽지 않는다.
 *
 * ⚠️ 브라우저로 내려가는 것은 모임명 · 일시 · 확정 인원 · 제출 인원 수 · (가린 이름 + 닉네임)뿐이다.
 *    모임장 신청서는 견적에서 받은 값(모임명 · 인원 · 일시 · 모임 성격 · 옵션)과 **가린** 담당자만 — 낸 답은 끝 4자리 확인 뒤에만.
 * ⚠️ 없는 코드 · 무효가 된 코드 · 한 글자 틀린 코드는 전부 같은 화면이다 — 무엇이 틀렸는지 알려주지 않는다.
 */
export default async function GroupFormPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const form = await resolveForm(code);

  if (!form) {
    return (
      <Notice title="링크가 만료되었거나 올바르지 않아요">
        모임장이나 우주이스케이프 카카오톡 채널로 새 링크를 받아주세요.
      </Notice>
    );
  }
  if (form.cancelled) {
    return <Notice title="취소된 모임이에요">이 모임은 취소되어 설문을 받지 않아요.</Notice>;
  }

  // 지금 쓰는 양식(운영자가 「단체 도구 › 설문 양식」 에서 고친 버전). 문구 · 선택지는 전부 고객에게 보이는 값이다.
  const loaded = await loadTemplate(form.formKey);
  const def: FormDef = { key: form.formKey, version: loaded.version, title: loaded.template.title, questions: flattenTemplate(loaded.template) };

  if (form.formKey === "participant") {
    const status = await loadParticipantStatus(form.inquiryId);
    const when = form.date ? `${dateLabel(form.date)}${form.time ? ` ${form.time}` : ""}${form.fixed ? "" : " (예정)"}` : "";
    return <ParticipantForm code={code} groupName={form.groupName} when={when} headcount={form.headcount} initialStatus={status} def={def} />;
  }
  if (form.formKey === "review") {
    return <ReviewForm code={code} groupName={form.groupName} def={def} />;
  }
  const leader = await loadLeaderPrefill(form.inquiryId);
  if (!leader) {
    return (
      <Notice title="링크가 만료되었거나 올바르지 않아요">
        모임장이나 우주이스케이프 카카오톡 채널로 새 링크를 받아주세요.
      </Notice>
    );
  }
  return <LeaderForm code={code} prefill={leader.prefill} parts={leaderParts(loaded.template)} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Image src="/logo-black.png" alt="" width={860} height={600} className="h-10 w-auto" priority />
        <span className="text-body font-extrabold text-foreground">우주이스케이프</span>
      </div>
      <h1 className="text-h2 font-extrabold text-foreground">{title}</h1>
      <p className="mt-3 text-body text-muted">{children}</p>
    </div>
  );
}
