import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | 우주이스케이프",
  description: "wouldyouescape(우주이스케이프) 이용약관",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-3xl font-extrabold">이용약관</h1>
        <p className="text-sm text-muted">
          wouldyouescape (우주이스케이프)<br />
          시행일자: 2026년 8월 14일
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-foreground">
        {/* 제1장 총칙 */}
        <div className="border-b border-border/40 pb-6">
          <h2 className="mb-4 font-bold text-muted">제1장 총칙</h2>

          <div className="mb-6 space-y-3">
            <div>
              <h3 id="article-1" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제1조 (목적)
              </h3>
              <p>
                이 약관은 wouldyouescape(우주이스케이프, 이하 "회사")가 운영하는 웹사이트 및 오프라인 행사(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </div>

            <div>
              <h3 id="article-2" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제2조 (용어의 정의)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>"서비스"란 회사가 제공하는 온라인 웹방탈출 콘텐츠 및 오프라인 단체 몰입형 방탈출 행사를 말합니다.</li>
                <li>"이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
                <li>"예약자"란 오프라인 행사 참가를 신청하고 결제를 완료한 이용자를 말합니다.</li>
                <li>"참가자"란 예약자 본인 및 예약자가 등록한 동반 참가 인원을 말합니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-3" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제3조 (약관의 게시 및 개정)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>회사는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면 또는 연결 화면에 게시합니다.</li>
                <li>회사는 관련 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정 이유를 명시하여 현행 약관과 함께 적용일자 7일 전부터 공지합니다. 이용자에게 불리한 변경의 경우 30일 전 공지합니다.</li>
                <li>이용자가 개정 약관 공지 후에도 서비스를 계속 이용하는 경우 개정 약관에 동의한 것으로 봅니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-4" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제4조 (약관 외 준칙)
              </h3>
              <p>
                이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 전자상거래 등에서의 소비자보호에 관한 법률, 약관의 규제에 관한 법률 등 관계 법령 및 상관례에 따릅니다.
              </p>
            </div>
          </div>
        </div>

        {/* 제2장 서비스 이용계약 */}
        <div className="border-b border-border/40 pb-6">
          <h2 className="mb-4 font-bold text-muted">제2장 서비스 이용계약</h2>

          <div className="space-y-3">
            <div>
              <h3 id="article-5" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제5조 (이용계약의 성립)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>이용계약은 예약자가 신청폼 작성 후 결제를 완료하고, 회사가 이를 승인함으로써 성립합니다.</li>
                <li className="space-y-1">
                  <p>회사는 다음의 경우 이용 신청을 거부하거나 사후에 이용계약을 해지할 수 있습니다.</p>
                  <ul className="ml-4 list-disc space-y-1 text-muted">
                    <li>신청 내용에 허위, 누락, 오기가 있는 경우</li>
                    <li>최소 진행 인원에 미달하여 행사 진행이 불가능한 경우</li>
                    <li>만 19세 미만의 오프라인 행사 참가 신청 등 참가 자격에 부합하지 않는 경우</li>
                    <li>팀 대항 콘텐츠의 특성상, 동일한 테마에 이미 참가한 이력이 있는 이용자가 같은 테마에 재신청하는 경우. 재참여를 원하는 경우 다른 테마를 선택하여 신청하실 수 있습니다.</li>
                    <li>기타 회사가 합리적인 판단에 따라 서비스 제공이 부적절하다고 인정하는 경우</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div>
              <h3 id="article-6" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제6조 (상품 구성 및 운영 시간)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li className="space-y-1">
                  <p>오프라인 행사는 다음과 같이 구성되며, 상품별 구체 내용과 가격은 홈페이지 또는 신청 페이지에 별도 고지합니다.</p>
                  <ul className="ml-4 list-disc space-y-1 text-muted">
                    <li>1부: 팀 대항 방탈출 콘텐츠 진행</li>
                    <li>2부: 코인마켓 및 네트워킹(교류) 프로그램 (상품 구성에 따라 미포함될 수 있음)</li>
                  </ul>
                </li>
                <li>회사는 사전 고지를 통해 행사 구성, 시간, 장소를 변경할 수 있습니다.</li>
                <li>회사는 성별 비율 및 팀별 인원을 최대한 균등하게 편성하기 위해 노력하며, 방탈출 이용 경험 횟수 등을 참고하여 조를 구성합니다. 다만 신청 인원 및 성비에 따라 완전히 동일한 인원·성비로 편성되지 않을 수 있습니다.</li>
                <li>회사는 현장에서 신분증을 통해 예약자 및 동행자의 본인 확인 절차를 진행할 수 있으며, 예약 시 기재한 정보(성별, 나이, 이름 등)와 실제 확인된 정보가 다른 경우 해당 참가자에 한하여 서비스 이용이 제한될 수 있습니다. 이 경우 이용 제한은 해당 참가자의 귀책 사유로 처리되며, 제8조의 환불 규정이 적용되지 않습니다. 다만 함께 참가한 다른 참가자의 서비스 이용에는 영향을 미치지 않습니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-7" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제7조 (예약 및 결제)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>예약은 회사가 지정한 계좌로의 계좌이체를 통해 대금 결제가 완료된 시점에 확정됩니다. 예약 신청 시점으로부터 30분 이내에 입금이 확인되지 않는 경우, 해당 예약은 자동으로 취소될 수 있습니다.</li>
                <li>회사는 별도의 결제대행사(PG사)를 이용하지 않으며, 결제 확인 및 환불 처리를 위해 입금자명, 계좌번호 등 필요한 정보를 보유할 수 있습니다. 추후 웹방탈출 서비스 출시 시 카드 결제 등 추가 결제수단이 도입될 수 있으며, 이 경우 세부 사항을 별도로 공지합니다.</li>
                <li>성별 구분 정원이 있는 상품의 경우, 특정 성별의 정원이 마감되면 해당 상품 예약이 조기 종료될 수 있습니다.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 제3장 취소 및 환불 */}
        <div className="border-b border-border/40 pb-6">
          <h3 id="article-8" className="mb-4 border-l-2 border-glow pl-3 font-bold">
            제8조 (취소 및 환불)
          </h3>
          <ol className="ml-4 list-decimal space-y-2 text-muted">
            <li className="space-y-1">
              <p>예약자의 사정으로 인한 취소 시 환불 기준은 다음과 같습니다.</p>
              <ul className="ml-4 list-disc space-y-1 text-muted">
                <li>행사일 기준 3일 전까지 취소: 결제 금액의 100% 환불</li>
                <li>행사일 기준 2일 전까지 취소: 결제 금액의 50% 환불</li>
                <li>행사일 기준 1일 전부터 행사 당일까지 취소: 환불 불가</li>
              </ul>
            </li>
            <li>회사의 사정(최소 인원 미달, 대관 장소 사정, 천재지변 등)으로 행사가 취소되는 경우, 예약자에게 결제 금액 전액을 환불합니다.</li>
            <li>환불은 결제 수단과 동일한 방법으로 영업일 기준 3~5일 이내 처리됩니다.</li>
            <li>사전 취소 통보 없이 행사에 불참(노쇼)한 예약자는 블랙리스트로 분류되며, 이후 회사 서비스에 대한 예약 신청이 제한될 수 있습니다.</li>
            <li>예약 양도(참가자 변경)는 허용되지 않습니다.</li>
            <li>단체로 예약한 경우, 참가자 중 일부에 대해서만 취소를 요청할 수 있으며 이 경우 환불 기준 (제1항)은 취소하는 인원 수에 비례하여 적용됩니다. 다만 소개팅형 상품은 개인 단위로만 신청이 가능하므로 본 항이 적용되지 않습니다.</li>
          </ol>
        </div>

        {/* 제9조 미성년자 */}
        <div className="border-b border-border/40 pb-6">
          <h3 id="article-9" className="mb-2 border-l-2 border-glow pl-3 font-bold">
            제9조 (미성년자의 이용)
          </h3>
          <ol className="ml-4 list-decimal space-y-2 text-muted">
            <li>오프라인 행사는 만 19세 미만인 자의 참가를 제한합니다. 온라인 웹방탈출 서비스는 연령 제한 없이 이용할 수 있습니다. 오프라인 행사의 미성년자 참가 허용 여부는 추후 서비스 정책 변경에 따라 확대될 수 있으며, 변경 시 사전에 공지합니다.</li>
            <li>만 14세 미만 이용자가 온라인 서비스를 이용하며 개인정보를 제공하는 경우 법정대리인의 동의가 필요하며, 회사는 이를 확인할 수 있는 절차를 둡니다.</li>
          </ol>
        </div>

        {/* 제3장 이용자 및 회사의 권리와 의무 */}
        <div className="border-b border-border/40 pb-6">
          <h2 className="mb-4 font-bold text-muted">제3장 이용자 및 회사의 권리와 의무</h2>

          <div className="space-y-3">
            <div>
              <h3 id="article-10" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제10조 (이용자의 의무)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li className="space-y-1">
                  <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
                  <ul className="ml-4 list-disc space-y-1 text-muted">
                    <li>신청 시 타인의 정보를 도용하는 행위</li>
                    <li>회사가 게시한 콘텐츠(문제, 시나리오, 정답 등)를 사전에 외부에 유출·공유·재배포하는 행위</li>
                    <li>행사장 시설 및 소품, 장비를 고의 또는 과실로 파손하는 행위</li>
                    <li>다른 참가자 또는 스태프에게 폭언, 폭행, 성희롱 등 부적절한 행위를 하는 행위</li>
                    <li>과도한 음주 등으로 행사 진행에 지장을 주는 행위</li>
                  </ul>
                </li>
                <li>이용자의 고의 또는 과실로 시설·장비가 파손된 경우, 이용자는 회사가 산정한 실제 손해를 배상하여야 합니다.</li>
                <li>이용자가 제1항 각 호를 위반하는 경우, 회사는 사전 통지 없이 행사 참여를 제한하거나 퇴장을 요청할 수 있으며 이 경우 환불 의무를 지지 않습니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-11" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제11조 (콘텐츠 저작권 및 비밀유지)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>회사가 제작한 방탈출 시나리오, 문제, 캐릭터, 브랜드 자산에 대한 저작권 및 지식재산권은 회사에 귀속됩니다.</li>
                <li>이용자는 참가 과정에서 알게 된 콘텐츠 내용을 기간 제한 없이 SNS, 커뮤니티 등 외부에 공개하지 않을 것에 동의합니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-12" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제12조 (촬영물의 이용)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>행사 중 마케팅 목적의 사진·영상 촬영이 이루어질 수 있으며, 촬영 및 활용에 대해서는 참가 신청 시 별도의 동의를 받습니다.</li>
                <li>행사 특성상 촬영 시 특정 참가자를 대상에서 개별적으로 제외하는 것은 현실적으로 어려울 수 있습니다. 이 경우 이용자의 요청에 따라 이미 촬영된 결과물에서 해당 참가자를 삭제하거나 식별이 불가능하도록 처리하는 방식으로 대응할 수 있습니다. 촬영물의 활용 범위 및 보유기간 등 세부 사항은 개인정보처리방침에 따릅니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-13" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제13조 (회사의 의무 및 면책)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>회사는 관련 법령과 이 약관이 정하는 바에 따라 지속적이고 안정적으로 서비스를 제공하기 위해 노력합니다.</li>
                <li>회사는 행사 당일 단위로 행사배상책임보험에 가입하여 행사 중 발생하는 안전사고에 대비합니다. 단, 이용자의 고의·과실, 지병, 음주로 인한 사고 등 회사의 통상적인 관리 범위를 벗어난 사고에 대해서는 책임을 지지 않습니다.</li>
                <li>천재지변, 대관 장소 관련 문제, 정부 방침 등 회사의 통제 범위를 벗어난 사유로 서비스 제공이 어려운 경우, 회사는 그 책임을 면합니다.</li>
                <li>회사의 손해배상 책임은 관련 법령에서 정한 범위 내에서 통상손해를 원칙으로 하며, 회사의 고의 또는 중대한 과실이 없는 한 특별손해에 대해서는 책임을 지지 않습니다.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 제4장 기타 */}
        <div className="border-b border-border/40 pb-6">
          <h2 className="mb-4 font-bold text-muted">제4장 기타</h2>

          <div className="space-y-3">
            <div>
              <h3 id="article-14" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제14조 (분쟁해결)
              </h3>
              <ol className="ml-4 list-decimal space-y-2 text-muted">
                <li>회사와 이용자 간 발생한 분쟁에 대해서는 상호 협의하여 해결하도록 노력합니다.</li>
                <li>협의가 이루어지지 않는 경우, 관련 법령이 정하는 관할 법원에 소를 제기할 수 있습니다.</li>
              </ol>
            </div>

            <div>
              <h3 id="article-15" className="mb-2 border-l-2 border-glow pl-3 font-bold">
                제15조 (개인정보보호)
              </h3>
              <p>
                회사는 이용자의 개인정보를 보호하기 위해 관련 법령이 정하는 바를 준수하며, 자세한 사항은 별도의 개인정보처리방침에 따릅니다.
              </p>
            </div>
          </div>
        </div>

        {/* 부칙 */}
        <div className="border-t border-border/40 pt-6">
          <h2 className="mb-4 font-bold text-muted">부칙</h2>
          <p className="text-muted">이 약관은 2026년 8월 14일부터 시행합니다.</p>
          <p className="mt-4 text-center text-xs text-muted">
            wouldyouescape (우주이스케이프) · 본 약관은 2026년 8월 14일부터 시행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
