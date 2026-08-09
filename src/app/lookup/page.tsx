import { LookupForm } from "@/components/lookup/LookupForm";

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">참여내역 조회</h1>
      <p className="mb-6 text-sm text-muted">
        신청 시 안내받은 접수번호와 대표 신청자 전화번호를 입력하면 신청 내역을 확인할 수 있어요.
      </p>
      <LookupForm />
    </div>
  );
}
