import { HudCard } from "@/components/ui/HudCard";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";

const NOTICES: { title: string; date: string; body: string }[] = [
  {
    title: "🎉 우주이스케이프를 소개합니다.",
    date: "2026.08.14",
    body: "안녕하세요, 우주이스케이프입니다. 저희는 팀대항 방탈출, 파티형 방탈출을 시작으로 다양한 형태의 이색 방탈출 컨텐츠를 기획하고 제작하는 사람들입니다. 저희 우주를 탐험해주세요. 감사합니다.\nwould you escape?",
  },
  {
    title: "[바-ㅇ탈출] 프리오픈 소식",
    date: "2026.08.29",
    body: "우주이스케이프의 첫 번째 파티형 방탈출 [바-ㅇ탈출]이 프리오픈했습니다. 이번 프리오픈은 그룹 파티형 방탈출과 소개팅 파티형 방탈출, 2개의 회차로 진행됩니다. 원하시는 회차를 선택해 지금 바로 참가 신청해주세요.",
  },
];

export function NoticeSection() {
  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">공지사항</h2>
      {NOTICES.length === 0 ? (
        <HudPlaceholder label="등록된 공지가 없습니다." />
      ) : (
        <div className="flex flex-col gap-3">
          {NOTICES.map((notice) => (
            <HudCard key={notice.title} className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold">{notice.title}</p>
                <p className="text-xs text-muted">{notice.date}</p>
              </div>
              <p className="whitespace-pre-line text-sm text-muted">{notice.body}</p>
            </HudCard>
          ))}
        </div>
      )}
    </section>
  );
}
