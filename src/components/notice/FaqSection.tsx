import { FaqAccordion } from "@/components/ui/FaqAccordion";

const FAQS = [
  { q: "혼자 또는 친구와 신청해도 되나요?", a: "현재 소개팅 파티형 방탈출은 1인 개별 신청만 가능하며, 그룹 파티형 방탈출은 혼자 또는 친구와 함께 모두 가능합니다." },
  { q: "언제 참여가 확정되나요?", a: "입금 확인 시 참여가 확정되며, 참여 확정 안내를 신청자(그룹 신청 시 대표 신청자) 번호로 문자 발송드립니다." },
  { q: "방탈출을 못 해봤는데 참여할 수 있나요?", a: "저희는 방탈출을 입문하는 사람에게도 어렵게 느껴지지 않도록 난이도를 초보자도 즐길 수 있는 수준으로 구성하려 노력하고 있습니다. 그리고 혹여나 문제를 풀지 못하더라도 그 외에 다양한 즐길 수 있는 요소들이 배치하여 최대한 많은 분들이 재미를 느끼실 수 있게 프로그램을 짜고 있습니다" },
  { q: "장소는 어디인가요?", a: "매 회차 다른 장소를 대관하며, 정확한 주소는 전날 참여 확정자에게 개별 안내드립니다." },
  { q: "환불 규정은 어떻게 되나요?", a: "테마 시작 48시간 전까지 취소 시 100% 환불, 48시간 전부터 24시간 전까지는 50% 환불, 24시간 전부터는 환불이 불가해요." },
  {
    q: "소개팅 버전과 그룹 버전은 어떤 점이 다른가요?",
    a: (
      <>
        동일한 테마, 동일한 문제로 구성되어 있고 그 외 타임 구성이 달라요.
        <br />
        <br />
        <span className="font-semibold">그룹</span>: 아이스브레이킹 + 방탈출 + 상품교환 & 다과 (총 3시간 30분)
        <br />
        <span className="font-semibold">소개팅</span>: 로테이션 미팅 + 방탈출 + 상품교환 & 다과 (총 4시간 30분)
      </>
    ),
  },
  { q: "정식 오픈은 언제인가요?", a: "9월 중으로 계획되어 있습니다." },
  {
    q: "단체 신청 문의는 어디로 하나요?",
    a: (
      <>
        단체 문의 게시판을 개설 예정이에요. 그 전에 문의하고 싶으신 분들은 카카오톡 채널 또는 인스타그램 DM으로
        문의 부탁드립니다.
        <br />
        <br />
        카카오톡 채널:{" "}
        <a
          href="http://pf.kakao.com/_EGNBX"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          pf.kakao.com/_EGNBX
        </a>
        <br />
        인스타그램:{" "}
        <a
          href="https://www.instagram.com/wouldyouescape?igsh=N2V2dXYyOHF2dDhr&igsi=N2V2dXYyOHF2dDhr"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          @wouldyouescape
        </a>
      </>
    ),
  },
];

export function FaqSection() {
  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">자주 묻는 질문</h2>
      <FaqAccordion items={FAQS} />
    </section>
  );
}
