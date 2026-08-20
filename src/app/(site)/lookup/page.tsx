import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup/LookupForm";

export const metadata: Metadata = {
  title: "신청내역 조회",
  openGraph: { title: "우주이스케이프 | 신청내역 조회" },
  twitter: { title: "우주이스케이프 | 신청내역 조회" },
};

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">신청내역 조회</h1>
      <LookupForm />
    </div>
  );
}
