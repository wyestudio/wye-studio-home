const CARDS = [
  { title: "방탈출", desc: "몰입감 있는 방탈출 콘텐츠가 대화의 자연스러운 매개체가 됩니다." },
  { title: "4인 1조 랜덤 편성", desc: "모르는 사람들과 랜덤으로 조가 편성되어 함께 미션을 풀어갑니다." },
  { title: "자연스러운 대화", desc: "게임을 함께 풀어가며 자연스럽게 서로를 알아가는 경험을 제공합니다." },
];

export function ConceptCards() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12">
      <h2 className="mb-6 text-center text-xl font-extrabold">wye studio가 다른 이유</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-surface p-5 text-center">
            <p className="mb-2 font-bold">{card.title}</p>
            <p className="text-sm text-muted">{card.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
