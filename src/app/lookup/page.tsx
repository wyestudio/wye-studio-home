import { LookupForm } from "@/components/lookup/LookupForm";

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-[560px] px-5 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">신청내역 조회</h1>
      <LookupForm />
    </div>
  );
}
