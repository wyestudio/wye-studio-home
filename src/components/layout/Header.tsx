import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/logout/actions";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-base font-extrabold tracking-tight text-brand">
          wye studio
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/#sessions" className="hover:text-foreground">
            상품 소개
          </Link>
          {user ? (
            <form action={logoutAction}>
              <button type="submit" className="hover:text-foreground">
                로그아웃
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="hover:text-foreground">
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground hover:opacity-90"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
