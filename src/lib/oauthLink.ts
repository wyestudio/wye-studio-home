// 카카오/네이버 이메일이 이미 다른 방식(이메일 비번 또는 다른 소셜)으로 가입된
// 계정과 일치할 때, 조용히 그 계정으로 로그인/연결하지 않고 사용자 확인을
// 받기 위해 잠깐 담아두는 상태. httpOnly 쿠키라 클라이언트 JS는 못 읽는다.
export const PENDING_LINK_COOKIE = "oauth_pending_link";

export type PendingLink = {
  provider: "kakao" | "naver";
  providerId: string;
  email: string;
  metadata: Record<string, string>;
  redirect: string;
  // 이메일 충돌로 매칭된 경우 생략(기본값), 전화번호 충돌로 매칭된 경우 "phone".
  matchedBy?: "email" | "phone";
};

export function pendingLinkCookieOptions() {
  return {
    httpOnly: true,
    // localhost(비HTTPS)에서는 Secure 쿠키가 아예 안 실려 이 쿠키가 항상
    // 사라졌었다 — kakao.ts/naver.ts의 state 쿠키와 동일하게 맞춘다.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 300,
    path: "/",
  };
}
