import { ConceptCards } from "@/components/about/ConceptCards";

export default function AboutPage() {
  return (
    <div className="pt-10">
      <div className="mx-auto max-w-3xl px-5">
        <h1 className="mb-3 text-center text-2xl font-extrabold">About</h1>
        <p className="rounded-xl border border-dashed border-border bg-surface p-5 text-center text-sm text-muted">
          회사 소개 준비 중
        </p>
      </div>
      <ConceptCards />
    </div>
  );
}
