import { NoticeSection } from "@/components/notice/NoticeSection";
import { FaqSection } from "@/components/notice/FaqSection";

export default function NoticePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-5 py-12">
      <NoticeSection />
      <FaqSection />
    </div>
  );
}
