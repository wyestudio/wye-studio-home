"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { applyAction, type ApplyState } from "@/app/sessions/[id]/apply/actions";
import type { Profile } from "@/types/domain";

const initialState: ApplyState = {};

export function ApplyForm({
  sessionId,
  priceKrw,
  profile,
}: {
  sessionId: string;
  priceKrw: number;
  profile: Profile;
}) {
  const [state, formAction, pending] = useActionState(applyAction, initialState);

  if (state.application) {
    return <ApplyComplete application={state.application} priceKrw={priceKrw} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <p className="mb-2 text-xs font-bold text-muted">신청자 정보</p>
        <p>
          {profile.name} · {profile.gender === "M" ? "남" : "여"} · {profile.phone}
        </p>
      </div>

      <Field label="입금 시 사용할 이름 (입금자명)" htmlFor="depositorName">
        <Input id="depositorName" name="depositorName" type="text" required placeholder={profile.name} />
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agreedTerms" required className="mt-1" />
        <span>이용약관, 개인정보처리방침, 환불정책에 모두 동의합니다.</span>
      </label>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "제출 중..." : "신청 제출"}
      </Button>
    </form>
  );
}
