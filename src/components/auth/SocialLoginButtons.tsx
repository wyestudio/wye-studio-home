"use client";

import { useState } from "react";

export function SocialLoginButtons() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setNotice("카카오 로그인은 준비 중입니다. 이메일로 가입해주세요.")}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-5 py-3 text-sm font-semibold text-[#3C1E1E]"
      >
        카카오로 시작하기
      </button>
      <button
        type="button"
        onClick={() => setNotice("네이버 로그인은 준비 중입니다. 이메일로 가입해주세요.")}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-5 py-3 text-sm font-semibold text-white"
      >
        네이버로 시작하기
      </button>
      {notice ? <p className="text-center text-xs text-muted">{notice}</p> : null}
    </div>
  );
}
