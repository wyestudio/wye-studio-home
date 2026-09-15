/**
 * 테스트 환경 표시 띠.
 *
 * ⚠️ 화면에 고정(fixed)하지 않는다. 고정했을 때는 헤더 윗부분을 덮어서 테스트 서버에서만
 *    헤더가 '위에 붙어 찌그러진' 것처럼 보였다(2026-09-15). 헤더 위 한 줄로 두고
 *    스크롤하면 같이 올라간다 — 헤더는 원래대로 맨 위에 붙어 따라온다.
 */
export default function TestEnvBanner() {
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV !== "true") return null;

  return (
    <div className="relative z-50 bg-amber-900 px-4 py-2 text-center text-sm text-amber-50">
      ⚠️ <strong>TEST 환경</strong> (테스트 DB 연결됨)
    </div>
  );
}
