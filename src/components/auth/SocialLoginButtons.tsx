// redirectTo는 로그인 완료 후 원래 있던 화면으로 돌아가기 위한 값 — proxy.ts가
// 보호 라우트에서 /login?redirect=...로 보낼 때 실려온다.
// 카카오/네이버 둘 다 Supabase가 관리하지 않는 커스텀 OAuth 흐름이라
// (see /auth/kakao/*, /auth/naver/*) 버튼은 단순 링크다.
export function SocialLoginButtons({ redirectTo = "/" }: { redirectTo?: string }) {
  const query = new URLSearchParams({ redirect: redirectTo }).toString();

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`/auth/kakao/login?${query}`}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-5 py-3 text-sm font-semibold text-[#3C1E1E]"
      >
        카카오로 시작하기
      </a>
      <a
        href={`/auth/naver/login?${query}`}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-5 py-3 text-sm font-semibold text-white"
      >
        네이버로 시작하기
      </a>
    </div>
  );
}
