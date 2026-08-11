const NOTICES: { title: string; date: string; body: string }[] = [
  {
    title: "🎉 우주이스케이프 베타 오픈 안내",
    date: "2026.08.11",
    body: "방탈출과 로테이션 소개팅을 결합한 우주이스케이프가 베타로 문을 열었어요. 로그인 없이 신청 시점에 인적정보만 입력하면 바로 참가할 수 있어요.",
  },
  {
    title: "8/22(토) 첫 시즌 신청 접수 중",
    date: "2026.08.11",
    body: "오후(비소개팅)/저녁(소개팅) 2개 회차로 첫 시즌을 시작해요. 정원이 차면 마감되니 서둘러 신청해주세요.",
  },
];

export function NoticeSection() {
  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">공지사항</h2>
      {NOTICES.length === 0 ? (
        <p className="rounded-xl border border-dashed border-glass-border bg-surface/40 p-5 text-center text-sm text-muted">
          등록된 공지가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {NOTICES.map((notice) => (
            <div key={notice.title} className="rounded-xl glass-panel p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold">{notice.title}</p>
                <p className="text-xs text-muted">{notice.date}</p>
              </div>
              <p className="text-sm text-muted">{notice.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
