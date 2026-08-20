import type { Metadata } from "next";
import { LookupResult } from "@/components/lookup/LookupResult";

export const metadata: Metadata = {
  title: "신청내역 조회결과",
  openGraph: { title: "우주이스케이프 | 신청내역 조회결과" },
  twitter: { title: "우주이스케이프 | 신청내역 조회결과" },
};

export default function LookupResultPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-10">
      <LookupResult />
    </div>
  );
}
