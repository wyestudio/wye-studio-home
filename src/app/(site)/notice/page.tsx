import type { Metadata } from "next";
import { NoticeTabs } from "@/components/notice/NoticeTabs";
import { getPublishedNotices, getVisibleFaqs } from "@/lib/content";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "Notice",
  // 검색 결과에 올리지 않는다. 홈과 테마 페이지만 색인하기로 했다(2026-09-13).
  // 이 페이지들이 사이트링크로 딸려 나와 목록이 길어지는데, 정작 검색으로
  // 찾아 들어올 이유는 없는 화면들이다.
  // ⚠️ follow 는 살려둔다 — 크롤러가 여기 걸린 테마 링크는 계속 타고 가야 한다.
  robots: { index: false, follow: true },
  openGraph: { title: "우주이스케이프 | Notice" },
  twitter: { title: "우주이스케이프 | Notice" },
};

// 공지·FAQ 는 운영자가 어드민에서 바꾸므로 요청마다 새로 읽는다.
export const dynamic = "force-dynamic";

export default async function NoticePage() {
  const [notices, faqs] = await Promise.all([getPublishedNotices(), getVisibleFaqs()]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <NoticeTabs notices={notices} faqs={faqs} />
      <KakaoChannelButton />
    </div>
  );
}
