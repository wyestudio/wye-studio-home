"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { signupAction, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = {};

export function SignupForm({
  redirectTo,
  prefillEmail = "",
}: {
  redirectTo: string;
  prefillEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="flex flex-col gap-6">
      <SocialLoginButtons redirectTo={redirectTo} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        또는 이메일로 가입
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Field label="이메일" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={prefillEmail}
          />
        </Field>
        <Field label="비밀번호 (8자 이상)" htmlFor="password">
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>

        <p className="text-xs text-muted">
          이메일 인증 후 이름·연락처 등 추가 정보를 입력하게 돼요.
        </p>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "가입 처리 중..." : "회원가입"}
        </Button>
      </form>
    </div>
  );
}
