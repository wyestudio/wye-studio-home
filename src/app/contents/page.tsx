import { ContentsCenteredCards } from "@/components/contents/ContentsCenteredCards";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function ContentsPage() {
  const sessions = await getUpcomingSessions();

  return <ContentsCenteredCards sessions={sessions} />;
}
