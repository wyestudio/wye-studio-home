import { ConceptCards } from "@/components/about/ConceptCards";

const PRINCIPLES = [
  { title: "술 없이 진행해요", desc: "누구나 부담 없이 즐길 수 있도록 음주를 제공하지 않아요." },
  { title: "개인정보는 암호화해 보관해요", desc: "이름·전화번호는 암호화되어 저장되고, 운영진도 필요할 때만 열람해요." },
  { title: "소개팅 회차는 성비를 관리해요", desc: "남/여 정원을 따로 두고, 정원이 안 찼을 때 자동으로 채우지 않아요." },
];

export default function AboutPage() {
  return (
    <div className="pt-10">
      <div className="mx-auto max-w-3xl px-5">
        <h1 className="mb-3 text-center text-2xl font-extrabold">About</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-muted">브랜드 스토리</h2>
          <p className="rounded-xl border border-dashed border-border bg-surface p-5 text-center text-sm text-muted">
            회사 소개 준비 중
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              🧢
            </span>
            <div>
              <p className="font-bold">케이프를 소개합니다</p>
              <p className="text-sm text-muted">
                헤더에서 로고를 망치질하고 있는 우주이스케이프의 마스코트예요. 아직 베타라 할 일이 많아서 늘 바빠요.
              </p>
            </div>
          </div>
        </section>
      </div>

      <ConceptCards />

      <div className="mx-auto max-w-3xl px-5">
        <section className="mb-8">
          <h2 className="mb-3 text-center text-xl font-extrabold">운영 원칙</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-surface p-5 text-center">
                <p className="mb-2 font-bold">{p.title}</p>
                <p className="text-sm text-muted">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10 rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="mb-1 font-semibold">사업자 정보</p>
          <p className="text-muted">준비 중 (회사 설립 완료 후 기재 예정)</p>
        </section>
      </div>
    </div>
  );
}
