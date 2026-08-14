import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 우주이스케이프",
  description: "wouldyouescape(우주이스케이프) 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-3xl font-extrabold">개인정보처리방침</h1>
        <p className="text-sm text-muted">
          wouldyouescape (우주이스케이프)<br />
          시행일자: 2026년 8월 14일
        </p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-foreground">
        <p className="text-muted">
          wouldyouescape(우주이스케이프, 이하 "회사")는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 회사가 제공하는 체험예약 및 관련 서비스 이용 과정에서 수집하는 개인정보의 처리 목적, 항목, 보유기간 및 보호조치를 안내합니다.
        </p>

        {/* 제1조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-1" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제1조 (개인정보 처리 목적)
          </h2>
          <div className="space-y-2 text-muted">
            <p>회사는 다음의 목적을 위해 개인정보를 처리합니다. 처리한 개인정보는 아래 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
            <ol className="ml-4 list-decimal space-y-1">
              <li className="space-y-1">
                <p className="font-semibold">체험 예약 및 서비스 제공</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>체험 예약 접수 및 관리</li>
                  <li>예약 확인 및 이용 안내</li>
                  <li>예약 변경 및 취소 관련 안내</li>
                  <li>현장 이용자 확인</li>
                </ul>
              </li>
              <li className="space-y-1">
                <p className="font-semibold">고객 관리 및 서비스 개선</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>체험 만족도 분석</li>
                  <li>재방문 고객 관리</li>
                  <li>콘텐츠 및 운영 개선</li>
                  <li>예약 상담 및 고객 문의 대응</li>
                </ul>
              </li>
              <li className="space-y-1">
                <p className="font-semibold">서비스 분석 및 마케팅 활용</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>홈페이지 이용 분석</li>
                  <li>방문 경로 분석</li>
                  <li>광고 효과 분석</li>
                </ul>
                <p className="text-xs">마케팅 정보 제공을 위한 개인정보 이용은 별도의 동의를 받은 경우에 한하며, 구체적인 이용 항목 및 수신거부 방법은 제10조에서 안내합니다.</p>
              </li>
              <li className="space-y-1">
                <p className="font-semibold">부정 예약 방지</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>사전 통보 없는 불참(노쇼) 이력 관리</li>
                  <li>반복적인 노쇼에 따른 재예약 제한</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>

        {/* 제2조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-2" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제2조 (수집하는 개인정보 항목)
          </h2>
          <div className="space-y-4 text-muted">
            <p>회사는 체험 예약 및 서비스 운영을 위해 다음과 같이 개인정보를 수집합니다.</p>

            <div>
              <p className="mb-2 font-semibold">1. 예약자 및 참여자 정보 (필수 항목)</p>
              <div className="overflow-x-auto">
                <table className="w-full border border-border text-xs">
                  <thead>
                    <tr className="bg-surface">
                      <th className="border border-border px-3 py-2 text-left font-semibold">수집 항목</th>
                      <th className="border border-border px-3 py-2 text-left font-semibold">수집 목적</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border px-3 py-2">이름</td>
                      <td className="border border-border px-3 py-2">예약 관리 및 현장 이용자 확인</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">연락처</td>
                      <td className="border border-border px-3 py-2">예약 확인 및 이용 안내</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">예약 정보(예약 일시, 예약 인원, 이용 콘텐츠)</td>
                      <td className="border border-border px-3 py-2">원활한 체험 운영</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">성별</td>
                      <td className="border border-border px-3 py-2">팀 구성 운영 참고</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">출생년도</td>
                      <td className="border border-border px-3 py-2">팀 구성 및 난이도 운영 참고</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">방탈출 이용 경험 횟수</td>
                      <td className="border border-border px-3 py-2">서비스 개선 및 이용 분석</td>
                    </tr>
                    <tr>
                      <td className="border border-border px-3 py-2">입금자명, 환불 계좌번호</td>
                      <td className="border border-border px-3 py-2">결제 확인 및 환불 처리</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="font-semibold">2. 선택 항목</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>사전 설문 응답</li>
                <li>팀 편성 참고 정보(같은 팀 희망 여부 및 요청사항)</li>
                <li>닉네임(현장 호칭 및 팀 편성 참고용)</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold">3. 고객 문의(카카오톡 채널)</p>
              <p className="mb-2">카카오톡 채널 "우주이스케이프"를 통해 문의하는 경우 다음 정보가 수집·처리될 수 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 text-muted">
                <li>카카오톡 프로필 정보(닉네임 등)</li>
                <li>문의 내용</li>
                <li>상담 기록</li>
              </ul>
              <p className="mt-2 text-xs">위 정보는 예약 상담 및 고객 문의 대응, 서비스 개선 목적으로만 이용됩니다. 카카오톡 채널 자체의 이용에는 카카오가 제공하는 별도의 개인정보처리방침이 적용될 수 있습니다.</p>
            </div>
          </div>
        </div>

        {/* 제3조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-3" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제3조 (동행자 개인정보 제공 관련)
          </h2>
          <p className="space-y-2 text-muted">
            <div>
              예약자가 동행자의 개인정보를 입력하는 경우, 예약자는 해당 정보주체(동행자)에게 개인정보 수집·이용 내용을 사전에 안내하고 동의를 받은 후 회사에 정보를 제공해야 합니다.
            </div>
            <div>
              회사는 예약자가 이러한 절차를 거쳤음을 전제로 동행자 정보를 처리합니다.
            </div>
          </p>
        </div>

        {/* 제4조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-4" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제4조 (개인정보의 보유 및 이용 기간)
          </h2>
          <p className="mb-3 text-muted">
            회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만 다음의 정보에 대해서는 명시한 사유로 아래 기간 동안 보유합니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-border text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="border border-border px-3 py-2 text-left font-semibold">보유 항목</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">보유 기간</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">보유 근거</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr>
                  <td className="border border-border px-3 py-2">예약자·참여자 정보(이름, 연락처, 성별, 출생년도, 닉네임, 이용 경험 횟수 등)</td>
                  <td className="border border-border px-3 py-2">행사 종료 후 5년</td>
                  <td className="border border-border px-3 py-2">고객관리 및 재방문 서비스 목적 (관련 계약·결제 기록 보유기간과 동일하게 적용)</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">카카오톡 채널 문의·상담 기록</td>
                  <td className="border border-border px-3 py-2">문의 처리 완료 후 1년</td>
                  <td className="border border-border px-3 py-2">고객 문의 대응 및 서비스 개선</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">입금자명, 환불 계좌번호 등 결제 확인 정보</td>
                  <td className="border border-border px-3 py-2">5년</td>
                  <td className="border border-border px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률(대금결제 기록과 동일 적용)</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">노쇼·블랙리스트 관리 기록</td>
                  <td className="border border-border px-3 py-2">행사일로부터 2년</td>
                  <td className="border border-border px-3 py-2">부정 예약 방지 목적</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">계약 또는 청약철회 등에 관한 기록</td>
                  <td className="border border-border px-3 py-2">5년</td>
                  <td className="border border-border px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">대금결제 및 재화 등의 공급에 관한 기록</td>
                  <td className="border border-border px-3 py-2">5년</td>
                  <td className="border border-border px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">소비자의 불만 또는 분쟁처리에 관한 기록</td>
                  <td className="border border-border px-3 py-2">3년</td>
                  <td className="border border-border px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">표시·광고에 관한 기록</td>
                  <td className="border border-border px-3 py-2">6개월</td>
                  <td className="border border-border px-3 py-2">전자상거래 등에서의 소비자보호에 관한 법률</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">접속 로그 기록</td>
                  <td className="border border-border px-3 py-2">3개월</td>
                  <td className="border border-border px-3 py-2">통신비밀보호법</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">마케팅 정보 제공 동의 정보</td>
                  <td className="border border-border px-3 py-2">동의 철회 시까지</td>
                  <td className="border border-border px-3 py-2">정보주체 동의</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            위 보유기간에도 불구하고 관계 법령 위반에 따른 조사·수사 등이 진행 중인 경우에는 해당 사유가 종료될 때까지 개인정보를 보유할 수 있습니다.
          </p>
        </div>

        {/* 제5조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-5" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제5조 (개인정보의 파기 절차 및 방법)
          </h2>
          <ol className="ml-4 list-decimal space-y-2 text-muted">
            <li className="space-y-1">
              <p className="font-semibold">파기절차</p>
              <p>개인정보의 처리 목적이 달성된 개인정보는 내부 방침 및 관계 법령에 따라 일정 기간 저장된 후 파기됩니다. 이 경우 별도의 데이터베이스(DB)로 옮겨진 개인정보는 법령에서 정한 경우가 아니고서는 보유되는 목적 이외의 다른 목적으로 이용되지 않습니다.</p>
            </li>
            <li className="space-y-1">
              <p className="font-semibold">파기방법</p>
              <p>전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제하며, 종이 문서에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기합니다.</p>
            </li>
          </ol>
        </div>

        {/* 제6조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-6" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제6조 (개인정보의 제3자 제공)
          </h2>
          <p className="text-muted">
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 법령에 특별한 규정이 있는 경우, 또는 이용자의 별도 동의가 있는 경우에 한하여 예외로 합니다.
          </p>
        </div>

        {/* 제7조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-7" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제7조 (개인정보 처리의 위탁)
          </h2>
          <p className="mb-3 text-muted">
            회사는 원활한 서비스 운영을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-border text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="border border-border px-3 py-2 text-left font-semibold">수탁업체</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">위탁 업무 내용</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">처리 정보</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr>
                  <td className="border border-border px-3 py-2">솔라피(Solapi)</td>
                  <td className="border border-border px-3 py-2">예약 안내 문자 발송</td>
                  <td className="border border-border px-3 py-2">예약 대표자 연락처 및 문자 발송 내용</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            회사는 별도의 결제대행사(PG사)를 이용하지 않고 계좌이체 방식으로 결제를 받고 있으며, 입금자명 등 결제 확인에 필요한 정보는 회사가 직접 확인·관리합니다.
          </p>
          <p className="mt-2 text-xs text-muted">
            회사는 위탁계약 체결 시 개인정보가 안전하게 관리될 수 있도록 위탁업무 수행 목적 외 개인정보 처리 금지, 기술적·관리적 보호조치 등을 계약서 등 문서에 명시하고 있습니다.
          </p>
        </div>

        {/* 제8조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-8" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제8조 (개인정보의 국외 이전)
          </h2>
          <p className="mb-3 text-muted">
            회사는 서비스 이용 분석 및 광고 효과 측정을 위해 아래 해외 서비스를 이용하며, 이 과정에서 다음과 같이 개인정보가 국외로 이전될 수 있습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-border text-xs">
              <thead>
                <tr className="bg-surface">
                  <th className="border border-border px-3 py-2 text-left font-semibold">이전받는 자</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">이전 국가</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">이전 항목</th>
                  <th className="border border-border px-3 py-2 text-left font-semibold">이전 목적 및 보유기간</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr>
                  <td className="border border-border px-3 py-2">Google LLC (Google Analytics 4)</td>
                  <td className="border border-border px-3 py-2">미국</td>
                  <td className="border border-border px-3 py-2">방문 페이지, 이용 기록, 접속 경로</td>
                  <td className="border border-border px-3 py-2">홈페이지 이용 분석 / 해당 서비스 정책에 따름</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">Meta Platforms, Inc. (Meta Pixel)</td>
                  <td className="border border-border px-3 py-2">미국</td>
                  <td className="border border-border px-3 py-2">방문 페이지, 광고 성과 관련 정보</td>
                  <td className="border border-border px-3 py-2">광고 효과 분석 / 해당 서비스 정책에 따름</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2">Microsoft Corporation (Microsoft Clarity)</td>
                  <td className="border border-border px-3 py-2">미국</td>
                  <td className="border border-border px-3 py-2">이용 기록, 페이지 이용 행태</td>
                  <td className="border border-border px-3 py-2">서비스 개선 / 해당 서비스 정책에 따름</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            각 서비스의 세부 개인정보 처리방침은 해당 회사가 제공하는 페이지에서 별도로 확인하실 수 있습니다. 이용하는 해외 서비스나 이전 항목이 변경되는 경우 제17조에 따라 본 방침을 개정하여 안내합니다.
          </p>
        </div>

        {/* 제9조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-9" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제9조 (개인정보의 자동 수집 장치 설치·운영 및 거부)
          </h2>
          <p className="mb-3 text-muted">
            회사는 서비스 개선 및 이용 분석을 위해 다음의 분석 도구를 사용할 수 있습니다.
          </p>
          <ul className="mb-3 ml-4 list-disc space-y-1 text-muted">
            <li>Google Analytics 4</li>
            <li>Meta Pixel</li>
            <li>Microsoft Clarity</li>
          </ul>
          <p className="text-xs text-muted">
            위 도구를 통해 수집되는 정보는 방문 페이지, 이용 기록, 접속 경로, 광고 성과 관련 정보이며, 국외 이전에 관한 사항은 제8조와 같습니다. 이용자는 웹브라우저의 설정을 변경하여 쿠키 저장을 거부하거나, 각 서비스 제공자가 안내하는 옵트아웃(Opt-out) 절차를 통해 정보 수집을 거부할 수 있습니다. 다만 이 경우 서비스 이용에 일부 제한이 발생할 수 있습니다.
          </p>
        </div>

        {/* 제10조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-10" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제10조 (마케팅 정보 제공 동의 및 수신거부)
          </h2>
          <p className="mb-3 text-muted">
            회사는 별도의 동의를 받은 이용자에 한하여 다음과 같이 마케팅 정보를 제공할 수 있습니다.
          </p>
          <ul className="mb-3 ml-4 list-disc space-y-1 text-muted">
            <li>이용 항목: 이름, 연락처</li>
            <li>이용 목적: 이벤트, 프로모션, 신규 소식 안내</li>
            <li>보유 기간: 동의 철회 시까지</li>
          </ul>
          <p className="text-xs text-muted">
            이용자는 언제든지 마케팅 정보 수신 동의를 철회할 수 있으며, 수신한 문자 내 수신거부 안내 또는 제15조의 개인정보 보호책임자 연락처를 통해 거부 의사를 표시할 수 있습니다.
          </p>
          <p className="mt-2 text-xs text-muted">
            회사는 이용자의 별도 동의 없이는 오후 9시부터 오전 8시까지 영리목적의 광고성 정보를 전송하지 않습니다.
          </p>
        </div>

        {/* 제11조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-11" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제11조 (사진 및 영상 활용)
          </h2>
          <p className="text-muted">
            회사는 체험 운영 과정에서 사진 및 영상을 촬영할 수 있으며, 촬영물은 공식 SNS, 홈페이지 및 홍보 콘텐츠 제작에 활용될 수 있습니다. 사진 및 영상 활용은 선택 동의 방식으로 운영하며, 이용자가 동의하지 않는 경우 홍보 콘텐츠 활용 대상에서 제외하거나 식별이 불가능하도록 처리합니다. 촬영물은 이용자가 활용 동의를 철회할 때까지 보관하며, 철회 의사를 밝히는 경우 지체 없이 삭제·파기합니다.
          </p>
        </div>

        {/* 제12조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-12" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제12조 (만 14세 미만 아동의 개인정보 처리)
          </h2>
          <p className="text-muted">
            회사는 원칙적으로 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만 아동의 서비스 신청이 확인되는 경우, 법정대리인의 동의가 확인되지 않는 한 예약 접수 및 서비스 제공이 제한될 수 있습니다.
          </p>
        </div>

        {/* 제13조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-13" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제13조 (정보주체의 권리·의무 및 행사방법)
          </h2>
          <p className="mb-3 text-muted">
            이용자는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
          </p>
          <ul className="mb-3 ml-4 list-disc space-y-1 text-muted">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
            <li>동의 철회</li>
          </ul>
          <p className="text-xs text-muted">
            권리 행사는 제15조의 개인정보 보호책임자에게 이메일 등 서면으로 요청하실 수 있으며, 회사는 접수일로부터 10일 이내에 필요한 조치를 취합니다. 이용자가 개인정보의 오류에 대한 정정을 요청한 경우, 정정을 완료하기 전까지 해당 개인정보를 이용 또는 제공하지 않습니다.
          </p>
        </div>

        {/* 제14조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-14" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제14조 (개인정보의 안전성 확보 조치)
          </h2>
          <p className="mb-3 text-muted">
            회사는 개인정보 보호를 위해 다음과 같은 조치를 시행하고 있습니다.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-muted">
            <li>개인정보 접근 권한 관리</li>
            <li>관리자 계정 보안 관리</li>
            <li>개인정보 처리 시스템 접근 통제</li>
            <li>개인정보 보관 기간 종료 후 안전한 파기</li>
          </ul>
        </div>

        {/* 제15조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-15" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제15조 (개인정보 보호책임자)
          </h2>
          <p className="mb-3 text-muted">
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 이용자의 개인정보 관련 문의 및 불만 처리, 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-border text-xs">
              <tbody className="text-muted">
                <tr>
                  <td className="border border-border px-3 py-2 font-semibold">성명</td>
                  <td className="border border-border px-3 py-2">김시온</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2 font-semibold">직책</td>
                  <td className="border border-border px-3 py-2">대표</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2 font-semibold">전화</td>
                  <td className="border border-border px-3 py-2">070-5236-4797</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-2 font-semibold">이메일</td>
                  <td className="border border-border px-3 py-2">wouldyouescape@gmail.com</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 제16조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-16" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제16조 (권익침해 구제방법)
          </h2>
          <p className="mb-3 text-muted">
            이용자는 아래 기관에 개인정보 침해에 대한 신고나 상담을 문의하실 수 있습니다.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted">
            <li>개인정보분쟁조정위원회: privacy.go.kr / 국번없이 1833-6972</li>
            <li>개인정보침해신고센터: privacy.go.kr / 국번없이 118</li>
            <li>대검찰청 사이버범죄수사단: www.spo.go.kr / 국번없이 1301</li>
            <li>경찰청 사이버수사국: ecrm.cyber.go.kr / 국번없이 182</li>
          </ul>
        </div>

        {/* 제17조 */}
        <div className="border-b border-border/40 pb-6">
          <h2 id="article-17" className="mb-3 border-l-2 border-glow pl-3 font-bold">
            제17조 (개인정보처리방침의 변경)
          </h2>
          <p className="text-muted">
            본 개인정보처리방침은 관련 법령 또는 서비스 변경에 따라 수정될 수 있으며, 변경 사항은 홈페이지를 통해 안내합니다.
          </p>
        </div>

        {/* 부칙 */}
        <div className="border-t border-border/40 pt-6">
          <p className="text-center text-xs text-muted">
            wouldyouescape (우주이스케이프) · 본 방침은 2026년 8월 14일부터 시행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
