import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_LINK_COOKIE, type PendingLink } from "@/lib/oauthLink";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export default async function ConfirmLinkPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_LINK_COOKIE)?.value;
  if (!raw) redirect("/login");

  let pending: PendingLink;
  try {
    pending = JSON.parse(raw);
  } catch {
    redirect("/login");
  }

  const providerLabel = pending.provider === "kakao" ? "카카오" : "네이버";
  const isPhoneMatch = pending.matchedBy === "phone";

  return (
    <div className="mx-auto max-w-sm px-5 py-16 text-center">
      <h1 className="mb-3 text-xl font-extrabold">
        {isPhoneMatch ? "이미 가입된 휴대폰 번호가 있어요" : "이미 가입된 계정이 있어요"}
      </h1>
      <p className="mb-8 text-sm text-muted">
        {isPhoneMatch ? (
          <>
            입력하신 휴대폰 번호로 가입된 계정({maskEmail(pending.email)})이 이미 있어요.
            <br />
            {providerLabel} 계정을 연결하고 로그인할까요?
          </>
        ) : (
          <>
            {maskEmail(pending.email)} 이메일로 가입된 계정이 이미 있어요.
            <br />
            {providerLabel} 계정을 연결하고 로그인할까요?
          </>
        )}
      </p>
      <div className="flex flex-col gap-2">
        <a
          href="/auth/oauth/confirm-link"
          className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          연결하고 로그인하기
        </a>
        <a
          href="/auth/oauth/cancel-link"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold hover:bg-black/5"
        >
          취소
        </a>
      </div>
    </div>
  );
}
