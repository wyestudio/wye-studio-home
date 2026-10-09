/**
 * 보드판 사진 페이지 전용 틀.
 *
 * ⚠️ 이 파일이 없으면 화면이 안 뜬다 — "Missing <html> and <body> tags in the root
 *    layout"(2026-10-09 실측). 사이트 본체의 <html>·<body> 는 `(site)` 묶음 안에
 *    있어서 그 바깥 경로에는 안 걸린다. review-guide · sponsorship-guide ·
 *    codename 도 같은 이유로 각자 이 파일을 갖고 있다.
 *
 * ⚠️ 사이트 헤더·푸터·글꼴을 일부러 안 씌운다. 방탈출을 막 끝낸 참가자가 태블릿
 *    QR 로 넘어와 **사진만 받아 가는** 자리라, 현장 앱과 같은 결이어야 한다.
 */
export default function PhotoLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
