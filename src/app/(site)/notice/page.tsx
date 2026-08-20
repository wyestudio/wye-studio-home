import type { Metadata } from "next";
import { NoticeTabs } from "@/components/notice/NoticeTabs";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "Notice",
  openGraph: { title: "우주이스케이프 | Notice" },
  twitter: { title: "우주이스케이프 | Notice" },
};

export default function NoticePage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <NoticeTabs />
      <KakaoChannelButton />
    </div>
  );
}
