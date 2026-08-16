import type { Metadata } from "next";
import { ContentsCenteredCards } from "@/components/contents/ContentsCenteredCards";
import { getUpcomingSessions } from "@/lib/sessions";

export const metadata: Metadata = {
  title: "지금 열린 회차",
  openGraph: { title: "우주이스케이프 | 지금 열린 회차" },
  twitter: { title: "우주이스케이프 | 지금 열린 회차" },
};

export default async function ContentsPage() {
  const sessions = await getUpcomingSessions();

  return <ContentsCenteredCards sessions={sessions} />;
}
