const KAKAO_CHANNEL_URL = "http://pf.kakao.com/_EGNBX";

export function KakaoChannelButton({ raised = false }: { raised?: boolean }) {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="카카오톡 채널로 문의하기"
      className={`fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE500] text-[#391B1B] shadow-lg shadow-black/40 transition-transform hover:scale-105 sm:h-14 sm:w-14 lg:right-20 ${
        raised ? "bottom-36" : "bottom-5"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current sm:h-7 sm:w-7" aria-hidden>
        <path d="M12 1C6.48 1 2 5.04 2 10.016c0 2.31.84 4.44 2.25 6.12-.15 2.34-.9 4.44-.9 4.44s2.16-.63 4.5-1.5c1.17.3 2.4.42 3.75.42 5.52 0 10-4.04 10-9.016S17.52 1 12 1z" />
      </svg>
    </a>
  );
}
