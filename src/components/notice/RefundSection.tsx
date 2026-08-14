import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { Button } from "@/components/ui/Button";

export function RefundSection() {
  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">환불요청</h2>
      <div className="flex flex-col items-center gap-4">
        <HudPlaceholder label="등록된 환불 요청이 없어요." />
        <Button disabled>작성하기</Button>
        <p className="text-xs text-muted">곧 이용하실 수 있어요</p>
      </div>
    </section>
  );
}
