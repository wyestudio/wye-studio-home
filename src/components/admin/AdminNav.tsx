import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { ADMIN_MENU } from "@/components/admin/adminMenu";

/**
 * 어드민 공통 네비게이션.
 *
 * 기존 어드민은 대시보드 상단에 버튼 4개가 나열된 형태라 분류가 없었다.
 * 화면이 늘어날수록 찾기 어려워지므로 영역별로 묶는다.
 * 설계 근거: docs/08-architecture-screens-and-admin.md §3-2
 *
 * ⚠️ admin 서브도메인(admin.wouldyouescape.com)에서는 proxy.ts 가
 *    "/xxx" → "/admin/xxx" 로 rewrite 하므로, 링크는 /admin 접두사 없이 쓴다.
 */
export function AdminNav({ current }: { current?: string }) {
  return (
    /*
      스크롤해도 맨 위에 남는다. 어드민은 긴 목록을 훑다가 다른 메뉴로 건너뛰는
      일이 잦아서, 매번 위로 올라가야 하면 성가시다.

      ⚠️ 사이트 헤더(sticky top-0)가 위에 있으므로 그 높이만큼 내려서 붙인다.
         헤더가 노출하는 --header-height 를 쓴다 — 숫자를 박으면 헤더가 바뀔 때
         어긋난다. before 로 위쪽을 배경으로 채워 그 틈으로 본문이 비치지 않게 한다.
      ⚠️ -mx-6/-mt-6 는 페이지 바깥 컨테이너의 p-6 을 되돌려, 고정된 동안 배경이
         좌우 여백까지 덮게 하려는 것이다.
      ⚠️ before 는 어긋난 몇 px 만 메운다. 크게 잡으면 스크롤 전에도 위쪽 사이트
         헤더를 덮어버린다(실제로 그랬다).
    */
    // 휴대폰에서는 이 줄을 숨긴다 — 사이트 머리의 햄버거가 같은 어드민 메뉴를 연다(2026-10-30).
    // 바깥 여백(-mx)은 페이지 여백(휴대폰 p-4 · 컴퓨터 p-6)과 같아야 한다 — 크면 가로로 삐져나온다.
    <nav
      className="relative z-30 -mx-4 -mt-4 mb-8 hidden flex-wrap items-center gap-x-6 gap-y-3 border-b border-border
                 bg-background px-4 pb-4 pt-4 md:sticky md:top-[var(--header-height,0px)] md:flex md:-mx-6 md:-mt-6 md:px-6 md:pt-6
                 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full
                 before:h-2 before:bg-background"
    >
      {ADMIN_MENU.map((group) => (
        <div key={group.label} className="flex min-w-0 items-center gap-2">
          <span className="text-micro uppercase tracking-wide text-muted">{group.label}</span>
          <div className="flex min-w-0 flex-wrap gap-1">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1 text-body-sm whitespace-nowrap transition-colors ${
                  current === item.href
                    ? "bg-glow text-glow-foreground"
                    : "text-foreground hover:bg-muted/20"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="ml-auto">
        <LogoutButton />
      </div>
    </nav>
  );
}
