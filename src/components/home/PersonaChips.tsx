const PERSONAS = [
  "새로운 사람을 만나고 싶은 분",
  "방탈출을 좋아하는 분",
  "소개팅은 부담스럽지만 자연스러운 만남을 원하는 분",
  "또래(90~99년생)와 어울리고 싶은 분",
];

export function PersonaChips() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-4">
      <p className="mb-3 text-center text-sm font-semibold text-muted">이런 분들께 추천해요</p>
      <div className="flex flex-wrap justify-center gap-2">
        {PERSONAS.map((persona) => (
          <span
            key={persona}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
          >
            {persona}
          </span>
        ))}
      </div>
    </section>
  );
}
