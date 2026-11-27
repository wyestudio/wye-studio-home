/**
 * 카카오 JavaScript SDK — 크리스마스 게임의 「카카오톡으로 공유하고 재도전」 에만 쓴다(2026-11-27 대표님).
 *
 * 왜 휴대폰 공유창(navigator.share)이 아니라 카카오 SDK 인가
 *   공유창은 "실제로 보냈는지" 를 알려 주지 않는다 — 안드로이드는 앱을 고르기만 해도 성공으로 끝나고, 아이폰은 보내도
 *   답이 없을 때가 있다. 카카오톡 공유는 메시지가 대화방에 정말 전달됐을 때만 카카오가 우리 웹훅을 부른다.
 *
 * - 공유할 때 처음 한 번만 받아 온다(게임 화면을 열 때 받지 않는다). 버전과 무결성 값을 주소에 박는다 —
 *   카카오 문서가 그렇게 쓰라고 한다. 무결성 값은 카카오 CDN 의 파일에서 직접 계산했다(2.8.4, 2026-10-19 배포).
 *   버전을 올리면 무결성 값도 같이 바꾼다: `openssl dgst -sha384 -binary kakao.min.js | openssl base64 -A`
 * - 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 없으면 카카오톡 공유를 감춘다(카카오 디벨로퍼스 > 앱 키 > JavaScript 키).
 *   이 키는 원래 브라우저에 드러나는 값이다 — 대신 카카오 콘솔에 등록한 도메인에서만 동작한다.
 */

const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js";
const SDK_INTEGRITY = "sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w";

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    sendScrap(settings: {
      requestUrl: string;
      serverCallbackArgs?: Record<string, string>;
      installTalk?: boolean;
    }): void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

/** 카카오톡 공유를 쓸 수 있는 곳인가(키가 있다). */
export const kakaoShareAvailable = () => Boolean(JS_KEY);

let loading: Promise<KakaoSdk | null> | null = null;

/** SDK 를 받아 초기화한다. 못 받으면 null. */
export function loadKakao(): Promise<KakaoSdk | null> {
  if (!JS_KEY) return Promise.resolve(null);
  loading ??= new Promise<KakaoSdk | null>((resolve) => {
    const ready = () => {
      const k = window.Kakao;
      if (!k) return resolve(null);
      try {
        if (!k.isInitialized()) k.init(JS_KEY);
        resolve(k);
      } catch {
        resolve(null);
      }
    };
    if (window.Kakao) return ready();
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      loading = null; // 다음에 누르면 다시 받아 본다
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}
