import type { Metadata } from "next";
import { NoticeTabs } from "@/components/notice/NoticeTabs";
import { getPublishedNotices, getVisibleFaqs } from "@/lib/content";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "Notice",
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
