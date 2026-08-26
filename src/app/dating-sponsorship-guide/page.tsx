import type { Metadata } from "next";

export const metadata: Metadata = {
  title: '소개팅 방탈출 여성 크리에이터 협찬 | 우주이스케이프',
  description: '우주이스케이프 프리오픈 소개팅 방탈출 여성 크리에이터 협찬 신청 안내',
  robots: { index: false, follow: false },
};

const PAGE_STYLES = String.raw`
    :root{--p:#d94688;--pd:#9d2e68;--ink:#2c1e31;--sub:#716574;--line:#f0dfeb;--soft:#fff0f7;--bg:#fff9fc;--yellow:#ffe878;--ok:#087b51;--danger:#c62b51;--shadow:0 16px 44px rgba(139,43,97,.12)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:radial-gradient(circle at 7% 7%,rgba(255,112,177,.13),transparent 23rem),radial-gradient(circle at 94% 20%,rgba(117,87,238,.1),transparent 25rem),var(--bg);font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;line-height:1.6;word-break:keep-all;-webkit-font-smoothing:antialiased}button,input,select,textarea{font:inherit}.shell{max-width:720px;margin:0 auto;padding:0 20px 84px}.top{display:flex;justify-content:space-between;align-items:center;padding:20px 2px 14px;color:#5b2847;font-size:13px;font-weight:850}.top a{color:var(--sub);text-decoration:none}.hero{position:relative;overflow:hidden;padding:44px 28px 30px;color:#fff;background:linear-gradient(145deg,#ef6aa7,var(--pd) 58%,#55204b);border-radius:28px;box-shadow:var(--shadow)}.hero:after{position:absolute;width:220px;height:220px;top:-125px;right:-65px;border-radius:50%;background:rgba(255,255,255,.1);content:""}.badge{position:relative;z-index:1;display:inline-block;padding:6px 12px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:800}.hero h1{position:relative;z-index:1;margin:15px 0 0;font-size:clamp(29px,7vw,43px);line-height:1.18;letter-spacing:-.045em}.hero h1 em{color:var(--yellow);font-style:normal}.hero-copy{position:relative;z-index:1;margin:14px 0 0;color:rgba(255,255,255,.87);font-size:15px}.facts{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:24px}.fact{padding:11px;background:rgba(50,10,37,.23);border:1px solid rgba(255,255,255,.16);border-radius:13px}.fact small{display:block;color:rgba(255,255,255,.67)}.fact b{font-size:13px}.cta{position:relative;z-index:1;display:block;margin-top:19px;padding:14px;color:#493900;background:var(--yellow);border-radius:13px;font-weight:900;text-align:center;text-decoration:none}.hero-note{position:relative;z-index:1;margin:9px 0 0;color:rgba(255,255,255,.7);font-size:11.5px;text-align:center}section{margin-top:46px}.kicker{margin-bottom:5px;color:var(--pd);font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}h2{margin:0 0 14px;font-size:22px;line-height:1.35;letter-spacing:-.025em}.desc{margin:-6px 0 16px;color:var(--sub);font-size:13.5px}.offer{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:22px;background:#fff;border:1px solid var(--line);border-radius:19px;box-shadow:0 10px 28px rgba(124,47,91,.06)}.offer h3{margin:0;font-size:15px}.offer p{margin:4px 0 0;color:var(--sub);font-size:12.5px}.price{text-align:right}.price del{display:block;color:#a095a2;font-size:12px}.price strong{color:var(--pd);font-size:25px;letter-spacing:-.04em}.notice{margin-top:11px;padding:14px 16px;color:#8c4b12;background:#fff8e8;border:1px solid #f1d79d;border-radius:13px;font-size:12px}.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.step{min-height:123px;padding:14px 11px;background:#fff;border:1px solid var(--line);border-radius:15px}.num{display:grid;width:25px;height:25px;place-items:center;margin-bottom:10px;color:#fff;background:var(--p);border-radius:8px;font-size:11px;font-weight:900}.step b{display:block;font-size:12.5px;line-height:1.4}.step small{display:block;margin-top:5px;color:var(--sub);font-size:11px;line-height:1.45}.channels{display:grid;grid-template-columns:1fr 1fr;gap:10px}.channel{padding:16px;background:#fff;border:1px solid var(--line);border-radius:15px}.channel h3{margin:0;font-size:14px}.channel p{margin:6px 0 0;color:var(--sub);font-size:12px}.channel small{display:block;margin-top:8px;color:var(--pd);font-weight:800}.rules,.refund{overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:17px}.rule,.refund-row{display:grid;grid-template-columns:120px 1fr;gap:14px;padding:14px 17px;border-bottom:1px solid var(--line);font-size:12.5px}.rule:last-child,.refund-row:last-child{border-bottom:0}.rule span{color:var(--sub)}.phrase{margin-top:12px;padding:16px;background:var(--soft);border:1px dashed #e791b9;border-radius:13px}.phrase small{color:var(--pd);font-weight:900}.phrase p{margin:4px 0 0;font-size:12.5px;font-weight:750}.refund-row{grid-template-columns:1.4fr .6fr;align-items:center}.refund-row strong{color:var(--pd);text-align:right}.form-card{padding:26px;background:#fff;border:1px solid var(--line);border-radius:23px;box-shadow:var(--shadow)}.form-head p{margin:-7px 0 22px;color:var(--sub);font-size:12.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 12px}.field.full{grid-column:1/-1}label,legend{display:block;margin-bottom:6px;font-size:12.5px;font-weight:850}.req{color:var(--danger)}input,select,textarea{width:100%;color:var(--ink);background:#fff;border:1.5px solid #e7d6e2;border-radius:10px;outline:none}input,select{height:46px;padding:0 12px}textarea{min-height:95px;padding:10px 12px;resize:vertical}input:focus,select:focus,textarea:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(217,70,136,.12)}.hint{margin:4px 1px 0;color:var(--sub);font-size:11px}fieldset{margin:19px 0 0;padding:0;border:0}.deliverables{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.choice{position:relative;margin:0}.choice input{position:absolute;width:1px;height:1px;opacity:0}.choice span{display:grid;min-height:65px;place-items:center;padding:7px 4px;color:var(--sub);border:1.5px solid #e7d6e2;border-radius:11px;font-size:11px;font-weight:850;text-align:center;cursor:pointer}.choice input:checked+span{color:var(--pd);background:var(--soft);border-color:var(--p)}.choice input:focus-visible+span{outline:3px solid rgba(217,70,136,.22)}.agree{display:grid;gap:9px;margin-top:21px;padding:15px;background:#fff9fc;border:1px solid var(--line);border-radius:13px}.check{display:flex;gap:8px;align-items:flex-start;margin:0;color:#534652;font-size:11.8px;font-weight:650;cursor:pointer}.check input{flex:0 0 auto;width:16px;height:16px;margin:2px 0 0;accent-color:var(--p)}.submit{width:100%;margin-top:17px;padding:15px;color:#fff;background:linear-gradient(135deg,var(--p),var(--pd));border:0;border-radius:12px;box-shadow:0 9px 22px rgba(157,46,104,.23);font-weight:900;cursor:pointer}.submit:active{transform:translateY(1px)}.privacy{margin:9px 0 0;color:var(--sub);font-size:10.5px;text-align:center}.submit-error{display:none;margin-top:10px;color:var(--danger);font-size:12.5px;text-align:center}.submit-error.show{display:block}.result{display:none;margin-top:21px;padding:21px;background:#ecfdf5;border:1px solid #a8e2ca;border-radius:15px;outline:none}.result.open{display:block}.result h3{margin:0;color:var(--ok);font-size:17px}.result p{margin:6px 0 0;color:#316450;font-size:12px}.summary{overflow:auto;max-height:275px;margin:14px 0 0;padding:13px;color:#302a40;background:#fff;border:1px solid #cde8dc;border-radius:10px;font-family:inherit;font-size:11.5px;line-height:1.65;white-space:pre-wrap}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.action{padding:11px;border:1px solid #8ecfb5;border-radius:10px;font-size:12px;font-weight:850;text-align:center;text-decoration:none;cursor:pointer}button.action{color:var(--ok);background:#fff}a.action{color:#fff;background:var(--ok)}.status{min-height:18px;margin-top:6px;color:var(--ok);font-size:11px;text-align:center}footer{margin-top:48px;color:var(--sub);font-size:11.5px;text-align:center}footer a{color:var(--pd);font-weight:800}
    @media(max-width:680px){.steps{grid-template-columns:1fr 1fr}.step:last-child{grid-column:1/-1;min-height:auto}.deliverables{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:520px){.shell{padding-inline:15px}.hero{padding:35px 20px 24px;border-radius:22px}.facts{grid-template-columns:1fr}.fact{display:flex;justify-content:space-between}.offer{grid-template-columns:1fr}.price{text-align:left}.channels,.grid{grid-template-columns:1fr}.field.full{grid-column:auto}.rule,.refund-row{grid-template-columns:1fr;gap:3px}.refund-row strong{text-align:left}.form-card{padding:21px 17px}.actions{grid-template-columns:1fr}}
`;

const PAGE_BODY_HTML = String.raw`
  <main class="shell">
    <nav class="top" aria-label="상단 메뉴"><span>우주이스케이프 · wouldyouescape</span><a href="/review-guide">일반 후기 페이백</a></nav>

    <header class="hero">
      <div class="badge">💗 8/29 프리오픈 · 여성 크리에이터 전용</div>
      <h1>소개팅 방탈출을<br><em>65,000원 협찬</em>으로 만나보세요</h1>
      <p class="hero-copy">방탈출과 자연스러운 대화를 통해 새로운 사람을 만나는 프리오픈 프로그램이에요.</p>
      <div class="facts"><div class="fact"><small>일시</small><b>2026. 8. 29. (토)</b></div><div class="fact"><small>시간</small><b>19:00~23:30</b></div><div class="fact"><small>협찬 가치</small><b>1인 65,000원</b></div></div>
      <a class="cta" href="#apply">여성 크리에이터 협찬 신청하기</a>
      <p class="hero-note">신청 후 계정 적합성을 확인하고, 선정자에게 개별 안내해 드려요.</p>
    </header>

    <section aria-labelledby="offer-title"><div class="kicker">Collaboration offer</div><h2 id="offer-title">협찬 제공 조건</h2>
      <div class="offer"><div><h3>65,000원 체험권 전액 지원</h3><p>예약 확정을 위해 20,000원을 먼저 결제하고, 약정 콘텐츠 게시 후 3영업일 내 전액 돌려드려요.</p></div><div class="price"><del>65,000원</del><strong>최종 0원</strong></div></div>
      <div class="notice">※ 이번 협찬은 체험권만 제공하며 별도 원고료는 지급하지 않습니다. 친구와 함께 참여하려면 각자 신청 후 선정되어야 하며, 동행인 할인은 없습니다.</div>
    </section>

    <section aria-labelledby="process-title"><div class="kicker">Process</div><h2 id="process-title">이렇게 진행돼요</h2><div class="steps">
      <div class="step"><span class="num">1</span><b>신청</b><small>채널과 희망 콘텐츠 제출</small></div><div class="step"><span class="num">2</span><b>선정 안내</b><small>선정자에게 개별 안내</small></div><div class="step"><span class="num">3</span><b>예약 확정</b><small>20,000원 선결제로 자리 확정</small></div><div class="step"><span class="num">4</span><b>행사 참여</b><small>8/29(토) 19:00~23:30</small></div><div class="step"><span class="num">5</span><b>게시·반환</b><small>9/5까지 게시, 3영업일 내 반환</small></div>
    </div></section>

    <section aria-labelledby="channel-title"><div class="kicker">Deliverables</div><h2 id="channel-title">채널을 하나 선택하세요</h2><p class="desc">릴스·쇼츠·블로그·유튜브 영상·인스타 게시물 중 1개로 지원해 주세요. 영상과 사진은 촬영 허용 시간에만 담아 주세요.</p><div class="channels">
      <article class="channel"><h3>🎬 인스타 릴스</h3><p>30초 이상, 아이스브레이킹과 2부 프로그램 중심</p><small>업로드 후 90일 유지</small></article><article class="channel"><h3>▶️ 유튜브 쇼츠</h3><p>30초 이상, 아이스브레이킹과 2부 활동 장면 중심</p><small>업로드 후 90일 유지</small></article><article class="channel"><h3>📝 네이버 블로그</h3><p>800자 및 촬영 허용 시간의 현장 사진 8장 이상</p><small>업로드 후 90일 유지</small></article><article class="channel"><h3>🎥 유튜브 영상</h3><p>전용 영상 3분 이상 또는 브이로그 내 60초 이상 코너</p><small>업로드 후 90일 유지</small></article><article class="channel"><h3>📷 인스타 게시물</h3><p>사진 또는 카드뉴스 5장 이상, 계정 태그·협찬 표기 포함</p><small>업로드 후 90일 유지</small></article>
    </div></section>

    <section aria-labelledby="rules-title"><div class="kicker">Content guide</div><h2 id="rules-title">꼭 확인해 주세요</h2><div class="rules">
      <div class="rule"><b>솔직한 후기</b><span>긍정적인 평가를 요구하지 않으며, 실제 체험을 솔직하게 작성해 주세요.</span></div><div class="rule"><b>타인 개인정보</b><span>다른 참가자의 얼굴과 개인 대화는 사전 동의 없이 콘텐츠에 포함하지 말아 주세요.</span></div><div class="rule"><b>촬영 가능 시간</b><span>문제 유출 방지를 위해 1부 방탈출 진행 시간에는 사진과 영상 촬영이 불가합니다. 아이스브레이킹 및 2부 콘텐츠 시간에만 촬영해 주세요.</span></div><div class="rule"><b>스포일러 보호</b><span>문제·힌트·정답과 연결되는 장면뿐 아니라 스토리와 관련된 굿즈가 노출될 경우 반드시 모자이크 또는 블러 처리해 주세요.</span></div><div class="rule"><b>퇴장 안내</b><span>전체 일정은 23:30까지지만, 1부 종료 후 2부 콘텐츠를 어느 정도 즐긴 뒤에는 조금 일찍 퇴장하셔도 괜찮아요.</span></div><div class="rule"><b>업로드·유지</b><span>2026년 9월 5일까지 업로드하고 게시물은 90일간 유지해 주세요.</span></div><div class="rule"><b>동행 정책</b><span>친구와 함께 참여하려면 각자 신청하고 선정되어야 합니다. 소개팅 프로그램에는 동행인 할인이 없습니다.</span></div>
    </div><div class="phrase"><small>의무 표기 예시</small><p>우주이스케이프로부터 65,000원 상당의 체험권을 제공받아 솔직하게 작성했습니다.</p></div></section>

    <section aria-labelledby="refund-title"><div class="kicker">Cancellation</div><h2 id="refund-title">취소·환불 기준</h2><p class="desc">매칭 구성과 노쇼는 프로그램 운영에 큰 영향을 미치므로 아래 기준을 적용해요.</p><div class="refund">
      <div class="refund-row"><span>8/27(목) 19:00까지 취소<br><small>시작 48시간 전까지</small></span><strong>결제액 전액 환불</strong></div><div class="refund-row"><span>8/27 19:00~8/28 19:00 취소<br><small>시작 24~48시간 전</small></span><strong>결제액의 50% 환불</strong></div><div class="refund-row"><span>8/28(금) 19:00 이후 취소 또는 노쇼<br><small>시작 24시간 이내</small></span><strong>환불 불가</strong></div><div class="refund-row"><span>주최 측 사정으로 행사 취소</span><strong>결제액 전액 환불</strong></div>
    </div></section>

    <section id="apply" aria-labelledby="apply-title"><div class="form-card"><div class="form-head"><div class="kicker">Application</div><h2 id="apply-title">여성 크리에이터 협찬 신청</h2><p>신청 시 확인 후 DM으로 연락드립니다.</p></div>
      <form id="creator-form" novalidate><div class="grid">
        <div class="field"><label for="name">이름 <span class="req">*</span></label><input id="name" name="name" type="text" autocomplete="name" placeholder="예: 김우주" required></div><div class="field"><label for="birthYear">출생연도 <span class="req">*</span></label><input id="birthYear" name="birthYear" type="number" min="1900" max="2007" inputmode="numeric" placeholder="예: 1995" required></div>
        <div class="field"><label for="gender">성별 <span class="req">*</span></label><select id="gender" name="gender" required><option value="" selected disabled>선택해 주세요</option><option value="M">남성</option><option value="F">여성</option></select></div><div class="field"><label for="handle">채널명 / 아이디 <span class="req">*</span></label><input id="handle" name="handle" type="text" placeholder="예: @wouldyouescape" required></div>
        <div class="field"><label for="phone">휴대폰 번호 <span class="req">*</span></label><input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000" required></div>
        <div class="field"><label for="platform">주력 채널 <span class="req">*</span></label><select id="platform" name="platform" required><option value="" selected disabled>선택해 주세요</option><option>인스타그램</option><option>유튜브</option><option>네이버 블로그</option></select></div><div class="field"><label for="followers">팔로워 / 구독자 수 <span class="req">*</span></label><input id="followers" name="followers" type="number" min="0" inputmode="numeric" placeholder="숫자만 입력" required></div>
        <div class="field full"><label for="profileUrl">채널 주소 <span class="req">*</span></label><input id="profileUrl" name="profileUrl" type="url" inputmode="url" placeholder="https://" required></div>
        <div class="field"><label for="reach">평균 조회 / 도달 <span class="req">*</span></label><input id="reach" name="reach" type="number" min="0" inputmode="numeric" placeholder="최근 게시물 6개 기준" required><p class="hint">블로그는 평균 일 방문자로 입력해 주세요.</p></div><div class="field"><label for="portfolioUrl">대표 후기 주소</label><input id="portfolioUrl" name="portfolioUrl" type="url" inputmode="url" placeholder="https:// (선택)"></div>
        <div class="field full"><label for="note">소개 및 콘텐츠 기획</label><textarea id="note" name="note" placeholder="소개팅 방탈출을 어떤 콘텐츠로 담고 싶은지 자유롭게 남겨 주세요."></textarea></div>
      </div>
      <fieldset><legend>희망 콘텐츠 <span class="req">*</span></legend><div class="deliverables"><label class="choice"><input type="radio" name="deliverable" value="인스타 릴스" required><span>🎬<br>릴스</span></label><label class="choice"><input type="radio" name="deliverable" value="유튜브 쇼츠"><span>▶️<br>쇼츠</span></label><label class="choice"><input type="radio" name="deliverable" value="네이버 블로그"><span>📝<br>블로그</span></label><label class="choice"><input type="radio" name="deliverable" value="유튜브 영상"><span>🎥<br>영상</span></label><label class="choice"><input type="radio" name="deliverable" value="인스타 게시물"><span>📷<br>게시물</span></label></div></fieldset>
      <div class="agree"><label class="check"><input type="checkbox" name="agreeEligibility" required><span>만 19세 이상의 여성이며, 소개팅 프로그램에 본인이 참여합니다. <span class="req">*</span></span></label><label class="check"><input type="checkbox" name="agreeOffer" required><span>65,000원 체험권, 20,000원 선결제 후 콘텐츠 게시 시 전액 반환 조건과 별도 원고료가 없음을 확인했습니다. <span class="req">*</span></span></label><label class="check"><input type="checkbox" name="agreeContent" required><span>1부 방탈출 시간은 촬영 불가이며, 아이스브레이킹 및 2부 콘텐츠 시간에만 촬영할 수 있음을 확인했습니다. 스토리 관련 굿즈가 노출되면 반드시 모자이크 또는 블러 처리하겠습니다. <span class="req">*</span></span></label><label class="check"><input type="checkbox" name="agreePrivacyGuests" required><span>다른 참가자의 얼굴과 개인 대화는 사전 동의 없이 촬영·공개하지 않겠습니다. <span class="req">*</span></span></label><label class="check"><input type="checkbox" name="agreeRefund" required><span>행사 시작 48시간 전까지 전액, 24~48시간 전 50%, 24시간 이내 및 노쇼는 환불 불가임을 확인했습니다. <span class="req">*</span></span></label><label class="check"><input type="checkbox" name="agreePrivacy" required><span>선정 및 행사 운영을 위해 신청 정보를 수집·이용하며, 모집 종료 후 30일간 보관하는 데 동의합니다. <span class="req">*</span></span></label></div>
      <button class="submit" type="submit">신청하기</button><p class="submit-error" id="submit-error" role="alert"></p></form>
      <div class="result" id="result" tabindex="-1" aria-live="polite"><h3>신청이 접수됐어요 🎉</h3><p>확인 후 인스타 DM으로 연락드릴게요.</p></div>
    </div></section>

    <footer>문의는 <a href="https://pf.kakao.com/_EGNBX/chat" target="_blank" rel="noopener">카카오톡 채널</a>로 연락해 주세요.<br>ⓒ 우주이스케이프 · wouldyouescape.com</footer>
  </main>

`;

const PAGE_SCRIPT = String.raw`
    (function(){
      var form=document.getElementById('creator-form'),phone=document.getElementById('phone'),result=document.getElementById('result'),submitButton=form.querySelector('.submit'),errorEl=document.getElementById('submit-error');
      phone.addEventListener('input',function(){var d=phone.value.replace(/\D/g,'').slice(0,11);if(d.length>7)phone.value=d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);else if(d.length>3)phone.value=d.slice(0,3)+'-'+d.slice(3);else phone.value=d});
      function val(name){var f=form.elements[name];return f?String(f.value||'').trim():''}
      function checked(name){var f=form.elements[name];return !!(f&&f.checked)}
      function showError(msg){errorEl.textContent=msg;errorEl.classList.add('show')}
      function hideError(){errorEl.textContent='';errorEl.classList.remove('show')}
      form.addEventListener('submit',function(e){
        e.preventDefault();
        hideError();
        var valid=/^01[016789]-\d{3,4}-\d{4}$/.test(val('phone'));
        phone.setCustomValidity(valid?'':'휴대폰 번호 형식으로 입력해 주세요.');
        if(!form.checkValidity()){form.reportValidity();return}
        if(val('gender')!=='F'){showError('이번 협찬은 여성 크리에이터만 신청할 수 있어요.');return}
        var payload={
          name: val('name'),
          birthYear: Number(val('birthYear')),
          gender: val('gender'),
          handle: val('handle'),
          phone: val('phone'),
          platform: val('platform'),
          profileUrl: val('profileUrl'),
          followers: Number(val('followers')),
          reach: Number(val('reach')),
          portfolioUrl: val('portfolioUrl') || null,
          note: val('note') || null,
          deliverable: val('deliverable'),
          agreements: {
            eligibility: checked('agreeEligibility'),
            offer: checked('agreeOffer'),
            content: checked('agreeContent'),
            privacyGuests: checked('agreePrivacyGuests'),
            refund: checked('agreeRefund'),
            privacy: checked('agreePrivacy')
          }
        };
        submitButton.disabled=true;
        submitButton.textContent='신청 처리 중...';
        fetch('/api/sponsorship/dating',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
          .then(function(res){return res.json().then(function(data){return {ok:res.ok,data:data}})})
          .then(function(r){
            if(!r.ok){throw new Error((r.data&&r.data.error)||'신청 처리 중 오류가 발생했어요.')}
            form.style.display='none';
            result.classList.add('open');
            result.focus();
            result.scrollIntoView({behavior:'smooth',block:'center'});
          })
          .catch(function(err){
            showError(err.message||'신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
            submitButton.disabled=false;
            submitButton.textContent='신청하기';
          });
      });
    })();
`;

export default function Page() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />
      <div dangerouslySetInnerHTML={{ __html: PAGE_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
    </>
  );
}
