"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { signupAction, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <SocialLoginButtons />

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        또는 이메일로 가입
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <Field label="이메일" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="비밀번호 (8자 이상)" htmlFor="password">
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
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

        <p className="text-xs text-muted">
          wye studio는 만 19세 이상만 가입할 수 있습니다.
        </p>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "가입 처리 중..." : "회원가입"}
        </Button>
      </form>
    </div>
  );
}
