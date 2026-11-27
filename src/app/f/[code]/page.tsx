import Image from "next/image";
import { dateLabel } from "@/lib/groupPricing";
import { loadParticipantStatus, resolveForm } from "@/lib/groupFormLinks";
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

  if (form.formKey === "participant") {
    const status = await loadParticipantStatus(form.inquiryId);
    const when = form.date ? `${dateLabel(form.date)}${form.time ? ` ${form.time}` : ""}${form.fixed ? "" : " (예정)"}` : "";
    return <ParticipantForm code={code} groupName={form.groupName} when={when} headcount={form.headcount} initialStatus={status} />;
  }
  if (form.formKey === "review") {
    return <ReviewForm code={code} groupName={form.groupName} />;
  }
  return (
    <Notice title="모임장 신청서를 준비하고 있어요">
      곧 이 주소에서 작성할 수 있어요. 급한 내용은 우주이스케이프 카카오톡 채널로 알려주세요.
    </Notice>
  );
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
