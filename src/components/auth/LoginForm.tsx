"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const router = useRouter();
  const handledRef = useRef<LoginState | null>(null);

  useEffect(() => {
    if (state === handledRef.current) return;
    handledRef.current = state;

    if (state.kind === "no_account" && state.email) {
      const go = window.confirm(
        `${state.email}(으)로 가입된 계정을 찾을 수 없어요.\n회원가입 페이지로 이동할까요?`
      );
      if (go) {
        router.push(
          `/signup?redirect=${encodeURIComponent(redirectTo)}&email=${encodeURIComponent(state.email)}`
        );
      }
    } else if (state.kind === "social_only" && state.provider && state.email) {
      const label = state.provider === "kakao" ? "카카오" : "네이버";
      const go = window.confirm(`이 이메일은 ${label} 계정으로 가입되어 있어요.\n${label}로 로그인할까요?`);
      if (go) {
        window.location.href = `/auth/${state.provider}/login?redirect=${encodeURIComponent(redirectTo)}`;
      }
    }
  }, [state, redirectTo, router]);

  return (
    <div className="flex flex-col gap-6">
      <SocialLoginButtons redirectTo={redirectTo} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        또는 이메일로 로그인
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Field label="이메일" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="비밀번호" htmlFor="password">
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </Field>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </div>
  );
}
