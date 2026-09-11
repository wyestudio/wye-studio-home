"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { completeProfileAction, type ProfileState } from "@/app/(site)/signup/profile/actions";

const initialState: ProfileState = {};

/**
 * 가입 후 추가 정보.
 *
 * 회원제 시절에는 생년월일과 성별을 필수로 받았지만 지금은 **출생연도만**
 * 받고 성별은 선택이다 (D-03·D-04). 신청 폼과 같은 기준으로 맞춘다.
 */
export function ProfileDetailsForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(completeProfileAction, initialState);

  // 연도를 상수로 박으면 해가 바뀔 때 사람이 고쳐야 한다.
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => thisYear - 14 - i);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Field label="이름" htmlFor="name">
        <Input id="name" name="name" type="text" required />
      </Field>
      <Field label="휴대폰 번호" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" required placeholder="01012345678" />
      </Field>
      <p className="-mt-2 text-xs text-muted">
        이 번호로 신청하신 내역이 있으면 자동으로 연결해 드려요.
      </p>
      <Field label="출생연도" htmlFor="birthYear">
        <select
          id="birthYear"
          name="birthYear"
          required
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/50"
          defaultValue=""
        >
          <option value="" disabled>선택</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-semibold text-foreground">
          성별 <span className="font-normal text-muted">(선택)</span>
        </legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="gender" value="M" /> 남
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="gender" value="F" /> 여
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="gender" value="" defaultChecked /> 선택 안 함
          </label>
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "저장 중..." : "완료"}
      </Button>
    </form>
  );
}
