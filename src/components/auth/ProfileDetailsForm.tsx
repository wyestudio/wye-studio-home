"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { completeProfileAction, type ProfileState } from "@/app/signup/profile/actions";

const initialState: ProfileState = {};

export function ProfileDetailsForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(completeProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Field label="이름" htmlFor="name">
        <Input id="name" name="name" type="text" required />
      </Field>
      <Field label="휴대폰 번호" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" required placeholder="01012345678" />
      </Field>
      <Field label="생년월일" htmlFor="birthDate">
        <Input id="birthDate" name="birthDate" type="date" required />
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-semibold text-foreground">성별</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="gender" value="M" required /> 남
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="gender" value="F" required /> 여
          </label>
        </div>
      </fieldset>

      <p className="text-xs text-muted">wye studio는 만 19세 이상만 이용할 수 있습니다.</p>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "저장 중..." : "완료"}
      </Button>
    </form>
  );
}
