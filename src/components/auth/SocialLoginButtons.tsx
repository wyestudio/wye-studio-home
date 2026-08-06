"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SocialLoginButtons() {
  const [notice, setNotice] = useState<string | null>(null);

  async function handleKakaoLogin() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/`,
        // Supabase가 kakao 기본 scope(account_email profile_image profile_nickname)를
        // 항상 함께 요청하므로, 셋 다 카카오 콘솔 동의항목에서 "선택 동의" 이상으로 켜둬야 함.
      },
    });
    if (error) {
      setNotice(`카카오 로그인에 실패했습니다: ${error.message}`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleKakaoLogin}
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
