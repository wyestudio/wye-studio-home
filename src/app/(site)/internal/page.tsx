import type { Metadata } from "next";
import { isInternalDevice } from "@/lib/internalTraffic";
import { turnOffInternalDevice, turnOnInternalDevice } from "./actions";

export const metadata: Metadata = {
  title: "테스트 기기 설정",
  robots: { index: false, follow: false },
};

/**
 * 우리끼리 쓰는 기기를 분석에서 빼는 스위치. 사이트 어디서도 링크하지 않는다.
 *
 * ⚠️ 주소만 열어서는 켜지지 않고 버튼을 눌러야 켜진다 — 링크 미리보기나 크롤러가
 *    열었다고 표시가 생기면 안 된다. 배경은 src/lib/internalTraffic.ts.
 */
export default async function InternalDevicePage() {
  const on = await isInternalDevice();

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16 sm:py-24">
      <h1 className="mb-3 text-2xl font-extrabold sm:text-3xl">테스트 기기 설정</h1>
      <p className="mb-8 text-sm text-muted sm:text-base">
        켜 두면 이 브라우저의 방문과 신청이 분석에서 빠집니다.
        <br />
        기기·브라우저마다 따로 켜야 하고, 인스타·카카오톡 안에서 여는 창도 따로입니다.
      </p>

      <div className="mb-6 rounded-lg border border-white/20 px-4 py-4">
        <p className="text-sm text-muted">이 브라우저</p>
        <p className={`mt-1 text-lg font-bold ${on ? "text-glow" : ""}`}>
          {on ? "테스트 기기로 표시됨" : "표시 안 됨 (일반 방문자로 집계)"}
        </p>
      </div>

      <form action={on ? turnOffInternalDevice : turnOnInternalDevice}>
        <button
          type="submit"
          className="w-full rounded-lg border border-white/30 px-4 py-3 text-base font-semibold"
        >
          {on ? "표시 끄기" : "이 브라우저를 테스트 기기로 표시"}
        </button>
      </form>
    </div>
  );
}
