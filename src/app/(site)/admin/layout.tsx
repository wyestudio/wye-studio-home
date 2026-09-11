export const dynamic = "force-dynamic";

/**
 * 어드민 껍데기.
 *
 * admin-shell 클래스는 globals.css 가 사이트 헤더를 불투명하게 만드는 데 쓴다 —
 * admin 호스트에서는 대시보드 주소가 '/' 라 헤더가 홈으로 착각해 투명 배경으로
 * 렌더되고, 고정된 어드민 메뉴 위로 본문이 비쳐 보인다.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}
