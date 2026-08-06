const FAQS = [
  { q: "신청은 어떻게 하나요?", a: "회원가입 후 회차를 선택해 참가 신청서를 작성하고, 무통장입금으로 참가비를 입금하면 신청이 접수됩니다." },
  { q: "언제 참가가 확정되나요?", a: "20명까지는 신청 즉시 확정되고, 21~24명 구간은 대기 후 24명(정원)이 차면 대기자 전원이 한 번에 확정됩니다." },
  { q: "장소는 어디인가요?", a: "매 회차 다른 파티룸을 대관하며, 정확한 주소는 참가 확정자에게 개별 안내됩니다." },
];

export function FaqPreview() {
  return (
    <section className="border-t border-border px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-6 text-center text-xl font-extrabold">자주 묻는 질문</h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-1 font-semibold">{faq.q}</p>
              <p className="text-sm text-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
