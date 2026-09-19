import type { Metadata } from "next";
import { NoticeTabs } from "@/components/notice/NoticeTabs";
import { getPublishedNotices, getVisibleFaqs } from "@/lib/content";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "Notice",
  // ⚠️ 본문(NoticeTabs)은 클라이언트에서 그려져 서버 HTML 에는 푸터밖에 없다.
  //    설명을 안 주면 구글이 긁을 게 없어 옛 사이트 설명으로 떨어진다 — 9/13 에
  //    지운 "로테이션 소개팅 … 베타 오픈" 이 그 뒤로도 검색에 계속 나갔다.
  description:
    "우주이스케이프 공지사항과 자주 묻는 질문. 참여 전 확인할 내용을 모았습니다.",
  openGraph: { title: "우주이스케이프 | Notice" },
  twitter: { title: "우주이스케이프 | Notice" },
};

// 공지·FAQ 는 운영자가 어드민에서 바꾸므로 요청마다 새로 읽는다.
export const dynamic = "force-dynamic";

export default async function NoticePage() {
  const [notices, faqs] = await Promise.all([getPublishedNotices(), getVisibleFaqs()]);

  return (
    // 폭·위아래 여백은 테마 상세의 새 비율에 맞춰 넓게(2026-09-15).
    // 세로 가운데 정렬은 하지 않는다 — 탭을 바꾸면 내용 길이가 달라져 목록이 위아래로 튄다.
    <div className="mx-auto max-w-2xl px-5 py-12 sm:max-w-3xl sm:py-20 lg:max-w-4xl lg:py-24">
      <NoticeTabs notices={notices} faqs={faqs} />
      <KakaoChannelButton />
    </div>
  );
}
