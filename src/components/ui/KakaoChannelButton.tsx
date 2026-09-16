import {
  InstagramEventBubble,
  eventBubbleDismissScript,
} from "@/components/ui/InstagramEventBubble";
import { getEventBubbleText } from "@/lib/siteSettings";

const KAKAO_CHANNEL_URL = "http://pf.kakao.com/_EGNBX";
const INSTAGRAM_URL = "https://www.instagram.com/wouldyouescape/";

/**
 * 화면 우하단에 붙어 다니는 바로가기 — 카카오톡 채널(문의) + 인스타그램.
 *
 * 인스타는 2026-09-16 에 추가했다. 문의 창구만 있고 '어떤 곳인지 보러 갈' 창구가
 * 없었다. 카톡을 아래에 두는 이유는 그대로다 — 문의가 더 급한 행동이라 엄지에 가깝게.
 *
 * ⚠️ 색은 각 서비스의 브랜드 색을 쓴다. 우리 강조색으로 칠하면 무슨 버튼인지
 *    아이콘만으로 알아보기 어렵다.
 */
export async function KakaoChannelButton({ raised = false }: { raised?: boolean }) {
  // 말풍선 문구·노출은 어드민 > 쿠폰 캠페인에서 정한다. 켜진 캠페인이 없으면 빈 문자열이다.
  const bubbleText = await getEventBubbleText();
  const bubble = { enabled: bubbleText.trim().length > 0, text: bubbleText };

  return (
    <>
      {bubble.enabled && (
        // 이미 닫은 방문자에게 깜빡 보였다 사라지지 않게, 그려지기 전에 표시를 단다.
        <script dangerouslySetInnerHTML={{ __html: eventBubbleDismissScript }} />
      )}
    <div
      // kakao-float: 모바일 하단 고정 CTA 가 있으면 CSS 가 이 묶음을 위로 올린다(globals.css).
      className={`kakao-float fixed right-4 z-40 flex flex-col items-center gap-2.5 lg:right-20 ${
        raised ? "bottom-36" : "bottom-5"
      }`}
    >
      {/* 이벤트 말풍선 — 인스타 버튼 위에 붙는다(위치 기준이 이 묶음이라 relative). */}
      {bubble.enabled && (
        <div className="relative w-full">
          <InstagramEventBubble href={INSTAGRAM_URL} text={bubble.text} />
        </div>
      )}

      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="인스타그램 계정 보기"
        className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg shadow-black/40 transition-transform hover:scale-105 sm:h-14 sm:w-14"
        style={{
          // 인스타 로고의 그라데이션. 단색으로 칠하면 다른 서비스처럼 보인다.
          backgroundImage:
            "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current sm:h-7 sm:w-7" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z" />
        </svg>
      </a>

      <a
        href={KAKAO_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="카카오톡 채널로 문의하기"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE500] text-[#391B1B] shadow-lg shadow-black/40 transition-transform hover:scale-105 sm:h-14 sm:w-14"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current sm:h-7 sm:w-7" aria-hidden>
          <path d="M12 1C6.48 1 2 5.04 2 10.016c0 2.31.84 4.44 2.25 6.12-.15 2.34-.9 4.44-.9 4.44s2.16-.63 4.5-1.5c1.17.3 2.4.42 3.75.42 5.52 0 10-4.04 10-9.016S17.52 1 12 1z" />
        </svg>
      </a>
    </div>
    </>
  );
}
