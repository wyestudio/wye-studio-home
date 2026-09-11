import { HudCard } from "@/components/ui/HudCard";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { RichText } from "@/components/ui/RichText";
import type { Notice } from "@/lib/content";

const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\.$/, "");

/** 표시 전용. 데이터는 서버에서 받아 내려준다 (NoticeTabs 가 클라이언트라 직접 조회 못 함). */
export function NoticeSection({ notices }: { notices: Notice[] }) {
  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">공지사항</h2>
      {notices.length === 0 ? (
        <HudPlaceholder label="등록된 공지가 없습니다." />
      ) : (
        <div className="flex flex-col gap-3">
          {notices.map((notice) => (
            <HudCard key={notice.id} className="p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {notice.is_pinned && <span className="mr-1.5 text-glow">📌</span>}
                  {notice.title}
                </p>
                {notice.published_at && (
                  <p className="shrink-0 text-xs text-muted">{kstDate(notice.published_at)}</p>
                )}
              </div>
              <RichText text={notice.body} className="block text-sm text-muted" />
            </HudCard>
          ))}
        </div>
      )}
    </section>
  );
}
