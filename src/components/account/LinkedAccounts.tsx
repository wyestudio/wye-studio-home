import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

type Props = {
  hasEmail: boolean;
  hasKakao: boolean;
  hasNaver: boolean;
};

// 카카오/네이버 둘 다 커스텀 OAuth 흐름이라(Supabase의 linkIdentity를 안 씀)
// "연결하기"는 단순 링크다 — 클라이언트 인터랙션이 필요 없다.
export function LinkedAccounts({ hasEmail, hasKakao, hasNaver }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <Row label="이메일" connected={hasEmail} />
      <Row
        label="카카오"
        connected={hasKakao}
        action={<LinkButton href="/auth/kakao/link?redirect=/account" />}
      />
      <Row
        label="네이버"
        connected={hasNaver}
        action={<LinkButton href="/auth/naver/link?redirect=/account" />}
      />
    </div>
  );
}

function LinkButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
    >
      연결하기
    </a>
  );
}

function Row({
  label,
  connected,
  action,
}: {
  label: string;
  connected: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      {connected ? <Badge tone="confirm">연결됨</Badge> : action}
    </div>
  );
}
