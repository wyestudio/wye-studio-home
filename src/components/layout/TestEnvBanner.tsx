export default function TestEnvBanner() {
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV !== "true") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900 text-amber-50 px-4 py-2 text-sm text-center">
      ⚠️ <strong>TEST 환경</strong> (테스트 DB 연결됨)
    </div>
  );
}
