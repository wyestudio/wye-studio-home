import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";

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
const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "운영",
    items: [
      { href: "/", label: "대시보드" },
      { href: "/applications", label: "신청" },
      { href: "/sessions", label: "회차" },
    ],
  },
  {
    label: "상품",
    items: [
      { href: "/themes", label: "테마" },
      { href: "/venues", label: "장소" },
    ],
  },
  {
    label: "마케팅",
    items: [
      { href: "/sponsorships", label: "협찬 신청" },
      { href: "/review-paybacks", label: "후기 페이백" },
      { href: "/analytics", label: "분석" },
    ],
  },
  {
    label: "설정",
    items: [{ href: "/sms-templates", label: "문자 템플릿" }],
  },
];

export function AdminNav({ current }: { current?: string }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-4">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">{group.label}</span>
          <div className="flex gap-1">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2.5 py-1 text-sm transition-colors ${
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
