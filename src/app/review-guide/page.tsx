import type { Metadata } from "next";

export const metadata: Metadata = {
  title: '후기 페이백 가이드 | 우주이스케이프',
  description: '우주이스케이프 SNS 후기 페이백 안내 — 채널별 작성 기준과 신청 방법을 확인하세요.',
  robots: { index: false, follow: false },
};

const PAGE_STYLES = String.raw`
  :root{
    --purple:#7B5CFF; --purple-dark:#5B3FE0; --pink:#FF6FB5;
    --ink:#1c1830; --sub:#6b6580; --bg:#faf9ff; --card:#ffffff;
    --line:#eceafd; --soft:#f3f0ff; --warn-bg:#fff7ed; --warn-line:#fdba74;
    --ok:#16a34a;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;
    background:var(--bg); color:var(--ink); line-height:1.65;
    -webkit-font-smoothing:antialiased; word-break:keep-all;
  }
  .wrap{max-width:640px;margin:0 auto;padding:0 20px 80px}

  /* hero */
  .hero{
    background:linear-gradient(135deg,var(--purple) 0%,var(--purple-dark) 55%,#3d2ba8 100%);
    color:#fff;text-align:center;padding:52px 20px 44px;
    border-radius:0 0 28px 28px;
  }
  .hero .badge{
    display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);
    border-radius:999px;padding:5px 14px;font-size:13px;font-weight:600;letter-spacing:.02em;margin-bottom:14px;
  }
  .hero h1{font-size:26px;font-weight:800;line-height:1.35}
  .hero h1 .amt{color:#ffe14d}
  .hero p{margin-top:10px;font-size:15px;opacity:.92}
  .cta{
    display:block;margin:22px auto 0;max-width:320px;
    background:#ffe14d;color:#3a2d00;text-decoration:none;
    font-size:16px;font-weight:800;text-align:center;
    padding:15px 20px;border-radius:14px;
    box-shadow:0 6px 18px rgba(0,0,0,.18);
  }
  .cta:active{transform:translateY(1px)}
  .hero .cta-sub{font-size:12.5px;margin-top:10px;opacity:.8}

  /* sections */
  section{margin-top:44px}
  h2{font-size:19px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  h2 .num{
    flex:none;width:26px;height:26px;border-radius:8px;background:var(--purple);color:#fff;
    font-size:14px;display:flex;align-items:center;justify-content:center;
  }
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}

  /* steps */
  .steps{display:flex;flex-direction:column;gap:10px}
  .step{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
  .step .n{flex:none;width:24px;height:24px;border-radius:50%;background:var(--soft);color:var(--purple-dark);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:2px}
  .step b{font-size:15px}
  .step p{font-size:13.5px;color:var(--sub);margin-top:2px}

  /* 문구 복사 */
  .phrase{border:1px dashed var(--purple);background:var(--soft);border-radius:12px;padding:14px 14px 12px;margin-top:10px}
  .phrase .label{font-size:12px;font-weight:700;color:var(--purple-dark);margin-bottom:6px}
  .phrase .text{font-size:14.5px}
  .copy-btn{
    margin-top:10px;border:none;background:var(--purple);color:#fff;
    font-size:13px;font-weight:700;padding:8px 14px;border-radius:8px;cursor:pointer;
  }
  .copy-btn.copied{background:var(--ok)}
  .note{font-size:13px;color:var(--sub);margin-top:12px}
  .note b{color:var(--ink)}

  /* 작성 예시 박스 */
  .example{margin-top:16px;border-radius:14px;overflow:hidden;border:1px solid var(--line)}
  .example .ex-head{padding:9px 14px;font-size:12.5px;font-weight:800}
  .example.good .ex-head{background:#ecfdf5;color:#047857}
  .example.bad .ex-head{background:#fef2f2;color:#b91c1c}
  .example .ex-body{background:#fff;padding:13px 14px;font-size:13.5px;line-height:1.7}
  .example .ex-body .hl{background:#fef3c7;border-radius:4px;padding:1px 4px;font-weight:700}
  .example .ex-body .dim{color:var(--sub)}
  .example .ex-body .tags{color:#2563eb;font-size:13px}

  /* 채널 카드 */
  .channel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:12px}
  .channel h3{font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px}
  .channel h3 .ico{font-size:18px}
  .channel table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}
  .channel th{
    text-align:left;color:var(--sub);font-weight:600;white-space:nowrap;
    padding:7px 12px 7px 0;vertical-align:top;width:88px;
  }
  .channel td{padding:7px 0;border-bottom:1px solid var(--line)}
  .channel tr:last-child td{border-bottom:none}
  .tag{display:inline-block;background:var(--soft);color:var(--purple-dark);border-radius:6px;padding:2px 7px;font-size:12.5px;font-weight:600;margin:2px 3px 2px 0}

  /* 경고/유의 */
  .warn{background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:16px;padding:18px}
  .warn h3{font-size:15px;font-weight:800;margin-bottom:8px}
  .warn ul{list-style:none}
  .warn li{font-size:13.5px;padding-left:22px;position:relative;margin-top:7px}
  .warn li::before{content:"🚫";position:absolute;left:0;font-size:13px}
  .warn li.ok::before{content:"✅"}

  ul.plain{list-style:none}
  ul.plain li{font-size:13.5px;color:var(--sub);padding-left:16px;position:relative;margin-top:6px}
  ul.plain li::before{content:"·";position:absolute;left:4px;color:var(--purple);font-weight:800}

  /* footer */
  footer{margin-top:56px;text-align:center;font-size:13px;color:var(--sub)}
  footer a{color:var(--purple-dark);font-weight:700;text-decoration:none}
  .bottom-cta{margin-top:28px}
  .bottom-cta .cta{background:var(--purple);color:#fff}
  .cta{border:none;cursor:pointer;width:100%;font-family:inherit}

  /* ===== 페이백 신청 모달 ===== */
  .modal-overlay{
    position:fixed;inset:0;background:rgba(20,15,45,.55);
    display:none;align-items:flex-end;justify-content:center;z-index:100;
    padding:0;
  }
  .modal-overlay.open{display:flex}
  .modal{
    background:#fff;width:100%;max-width:560px;
    border-radius:20px 20px 0 0;max-height:92vh;overflow-y:auto;
    padding:24px 22px 30px;position:relative;
    animation:slideUp .22s ease-out;
  }
  @keyframes slideUp{from{transform:translateY(40px);opacity:.6}to{transform:translateY(0);opacity:1}}
  @media(min-width:600px){
    .modal-overlay{align-items:center;padding:24px}
    .modal{border-radius:20px}
  }
  .modal h3{font-size:19px;font-weight:800;margin-bottom:4px}
  .modal .m-sub{font-size:13px;color:var(--sub);margin-bottom:18px}
  .m-close{
    position:absolute;top:16px;right:16px;border:none;background:var(--soft);
    width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;color:var(--sub);
  }
  .field{margin-top:14px}
  .field label{display:block;font-size:13.5px;font-weight:700;margin-bottom:6px}
  .field label .req{color:#e11d48}
  .field input,.field select{
    width:100%;border:1.5px solid var(--line);border-radius:10px;
    padding:12px 12px;font-size:15px;font-family:inherit;background:#fff;color:var(--ink);
    -webkit-appearance:none;appearance:none;
  }
  .field select{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6580' stroke-width='2' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
  .field input:focus,.field select:focus{outline:none;border-color:var(--purple)}
  .field .hint{font-size:12px;color:var(--sub);margin-top:5px}
  .field.error input,.field.error select{border-color:#e11d48}
  .field .err-msg{display:none;font-size:12px;color:#e11d48;margin-top:5px}
  .field.error .err-msg{display:block}
  .row2{display:flex;gap:10px}
  .row2 .field{flex:1}
  .agree{margin-top:18px;background:var(--soft);border-radius:12px;padding:14px}
  .agree label{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--ink);cursor:pointer}
  .agree label + label{margin-top:10px}
  .agree input[type=checkbox]{flex:none;width:17px;height:17px;margin-top:2px;accent-color:var(--purple)}
  .agree a{color:var(--purple-dark);font-weight:700}
  .m-submit{
    margin-top:20px;width:100%;border:none;cursor:pointer;
    background:var(--purple);color:#fff;font-size:16px;font-weight:800;
    padding:15px;border-radius:14px;font-family:inherit;
  }
  .m-submit:disabled{background:#c9c2e8;cursor:not-allowed}
  .m-submit-error{display:none;margin-top:10px;color:#e11d48;font-size:12.5px;text-align:center}
  .m-submit-error.show{display:block}
  .m-done{display:none;text-align:center;padding:36px 10px}
  .m-done .big{font-size:44px}
  .m-done h4{font-size:18px;font-weight:800;margin-top:10px}
  .m-done p{font-size:13.5px;color:var(--sub);margin-top:8px}
`;

const PAGE_BODY_HTML = String.raw`

<div class="hero">
  <div class="badge">우주이스케이프 후기 이벤트</div>
  <h1>후기 남기고<br><span class="amt">5,000원</span> 페이백 받으세요</h1>
  <p>SNS에 후기를 올리고 7일간 유지하면<br>계좌로 5,000원을 돌려드려요.</p>
  <button class="cta" type="button" data-open-modal>페이백 신청하기</button>
  <div class="cta-sub">후기 게시 후, 이 버튼으로 게시물 링크를 제출해 주세요</div>
</div>

<div class="wrap">

  <section>
    <h2><span class="num">1</span>참여 방법</h2>
    <div class="steps">
      <div class="step"><span class="n">1</span><div><b>아래 기준에 맞춰 후기 게시</b><p>내 채널 하나를 골라, 채널별 기준(사진·분량·해시태그·표기 문구)에 맞춰 올려주세요.</p></div></div>
      <div class="step"><span class="n">2</span><div><b>페이백 신청 폼 제출</b><p>게시물 링크와 입금받을 계좌를 신청 폼에 남겨주세요.</p></div></div>
      <div class="step"><span class="n">3</span><div><b>7일 후 자동 확인 → 당일 입금</b><p>게시 7일째에 유지 여부를 확인하고, 확인 당일 5,000원을 입금해 드려요.</p></div></div>
    </div>
  </section>

  <section>
    <h2><span class="num">2</span>꼭 들어가야 하는 문구</h2>
    <div class="card">
      <p style="font-size:14px">저희 후기 페이백은 법적으로 <b>"대가를 받고 작성한 후기"임을 표기</b>해야 해요. 아래 문구 중 하나를 복사해서 후기에 넣어주세요. 말투는 자유롭게 바꾸셔도 되지만, <b>페이백(대가)을 받았다는 내용</b>은 꼭 들어가야 합니다.</p>

      <div class="phrase">
        <div class="label">기본형</div>
        <div class="text">우주이스케이프에서 후기 작성 페이백을 받고 쓰는 후기입니다</div>
        <button class="copy-btn" data-copy="우주이스케이프에서 후기 작성 페이백을 받고 쓰는 후기입니다">문구 복사</button>
      </div>
      <div class="phrase">
        <div class="label">자연스러운 톤</div>
        <div class="text">(이 후기는 우주이스케이프에서 소정의 페이백을 받고 작성했어요)</div>
        <button class="copy-btn" data-copy="(이 후기는 우주이스케이프에서 소정의 페이백을 받고 작성했어요)">문구 복사</button>
      </div>
      <div class="phrase">
        <div class="label">블로그 마무리용</div>
        <div class="text">※ 본 후기는 우주이스케이프로부터 후기 작성 대가(페이백)를 받아 작성되었습니다</div>
        <button class="copy-btn" data-copy="※ 본 후기는 우주이스케이프로부터 후기 작성 대가(페이백)를 받아 작성되었습니다">문구 복사</button>
      </div>



    </div>
  </section>

  <section>
    <h2><span class="num">3</span>채널별 작성 기준</h2>
    <p style="font-size:13.5px;color:var(--sub);margin-bottom:4px">아래 중 <b>1개 채널</b>을 골라 작성해 주세요. (1인 1채널 1회)</p>

    <div class="channel">
      <h3><span class="ico">📸</span>인스타그램 피드</h3>
      <table>
        <tr><th>사진</th><td>현장 사진 2장 이상 (또는 사진 1장 + 영상 1개)</td></tr>
        <tr><th>분량</th><td>본문 5줄 이상 (공백 제외 150자 이상)</td></tr>
        <tr><th>표기 위치</th><td>캡션(사진 아래 글) <b>맨 앞</b> </td></tr>
        <tr><th>해시태그</th><td><span class="tag">#우주이스케이프</span><span class="tag">#wouldyouescape</span><span class="tag">#방탈출</span> + 자유 2개 (<span class="tag">#단체방탈출</span><span class="tag">#이색모임</span><span class="tag">#방탈출소개팅</span> 중)</td></tr>
      </table>
      <button class="copy-btn" data-copy="#우주이스케이프 #wouldyouescape #방탈출 #단체방탈출 #이색모임">해시태그 복사</button>
    </div>

    <div class="channel">
      <h3><span class="ico">🎬</span>인스타그램 릴스</h3>
      <table>
        <tr><th>영상</th><td>현장 영상 15초 이상</td></tr>
        <tr><th>해시태그</th><td>피드와 동일</td></tr>
      </table>
    </div>

    <div class="channel">
      <h3><span class="ico">📝</span>네이버 블로그</h3>
      <table>
        <tr><th>사진</th><td>현장 사진 5장 이상</td></tr>
        <tr><th>분량</th><td>500자 이상</td></tr>
        <tr><th>태그</th><td><span class="tag">우주이스케이프</span><span class="tag">방탈출</span><span class="tag">단체방탈출</span></td></tr>
      </table>
    </div>

    <div class="channel">
      <h3><span class="ico">🧵</span>스레드</h3>
      <table>
        <tr><th>사진</th><td>현장 사진 1장 이상</td></tr>
        <tr><th>분량</th><td>3문장 이상</td></tr>
        <tr><th>해시태그</th><td><span class="tag">#우주이스케이프</span></td></tr>
      </table>
    </div>

    <div class="channel">
      <h3><span class="ico">▶️</span>유튜브 (쇼츠 포함)</h3>
      <table>
        <tr><th>영상</th><td>현장 영상 30초 이상</td></tr>
        <tr><th>제목/태그</th><td>제목 또는 태그에 "우주이스케이프" 포함</td></tr>
      </table>
    </div>

    <p class="note">※ 인스타그램 <b>스토리는 24시간 뒤 사라져서</b> 7일 유지 조건을 채울 수 없어 페이백 대상이 아니에요. (자유롭게 올려주시는 건 언제나 환영입니다!)</p>
  </section>

  <section>
    <h2><span class="num">4</span>스포일러는 가려주세요</h2>
    <div class="warn">
      <h3>다음 참가자들의 재미를 위해 🙏</h3>
      <ul>
        <li>문제지·힌트 내용이 보이는 사진</li>
        <li>비하인드 카드의 내용이 보이는 사진</li>
        <li>정답과 연결되는 소품·장치의 세부 컷</li>
        <li class="ok">위 항목은 <b>촬영에서 빼거나, 가리거나, 블러 처리</b> 후 올려주세요</li>
        <li class="ok">단체 사진, 팀 활동 컷, 굿즈의 겉면, 공간 분위기 컷은 자유롭게 OK!</li>
      </ul>
    </div>
  </section>

  <section>
    <h2><span class="num">5</span>유의사항</h2>
    <div class="card">
      <ul class="plain">
        <li>계정이 공개 상태여야 확인이 가능해요 (비공개 계정은 확인 불가).</li>
        <li>게시물은 게시일부터 7일간 유지되어야 하며, 7일째에 확인해요.</li>
        <li>표기 문구·필수 요소가 빠진 경우 수정 요청을 1회 안내드리고, 수정되지 않으면 지급이 어려워요.</li>
        <li>스포일러가 포함된 게시물도 수정 요청 1회 후, 수정되지 않으면 지급이 어려워요.</li>
        <li>페이백은 1인 1채널 1회 지급됩니다.</li>
      </ul>
    </div>
  </section>

  <div class="bottom-cta">
    <button class="cta" type="button" data-open-modal>후기 올렸다면, 페이백 신청하기</button>
  </div>

  <footer>
    궁금한 점은 <a href="https://pf.kakao.com/_EGNBX/chat" target="_blank" rel="noopener">카카오톡 채널</a>로 편하게 물어보세요<br>
    ⓒ 우주이스케이프 · wouldyouescape.com
  </footer>

</div>

<!-- ===== 페이백 신청 모달 ===== -->
<div class="modal-overlay" id="payback-modal" role="dialog" aria-modal="true" aria-labelledby="pm-title">
  <div class="modal">
    <button class="m-close" type="button" data-close-modal aria-label="닫기">✕</button>

    <form id="payback-form" novalidate>
      <h3 id="pm-title">페이백 신청</h3>
      <p class="m-sub">후기 확인 후 게시 7일째에 5,000원을 입금해 드려요.</p>

      <div class="field" data-name="name">
        <label>이름 <span class="req">*</span></label>
        <input type="text" name="name" placeholder="참가 신청 시 이름과 동일하게" autocomplete="name" required>
        <div class="err-msg">이름을 입력해 주세요.</div>
      </div>

      <div class="field" data-name="phone">
        <label>전화번호 <span class="req">*</span></label>
        <input type="tel" name="phone" placeholder="010-0000-0000" inputmode="numeric" autocomplete="tel" required>
        <div class="hint">참가 신청 때 쓰신 번호로 입력해 주세요.</div>
        <div class="err-msg">올바른 휴대폰 번호를 입력해 주세요.</div>
      </div>

      <div class="field" data-name="session">
        <label>참가 회차 <span class="req">*</span></label>
        <select name="session" required>
          <option value="" selected disabled>참가하신 회차를 선택해 주세요</option>
          <!-- TODO(TING): 새 회차 오픈 시 option 추가 -->
          <option value="0829-meeting">8/29 프리오픈 · 그룹 방탈출 (낮)</option>
          <option value="0829-dating">8/29 프리오픈 · 소개팅 방탈출 (저녁)</option>
        </select>
        <div class="err-msg">회차를 선택해 주세요.</div>
      </div>

      <div class="field" data-name="channel">
        <label>후기 채널 <span class="req">*</span></label>
        <select name="channel" required>
          <option value="" selected disabled>후기를 올린 채널을 선택해 주세요</option>
          <option value="instagram-feed">인스타그램 피드</option>
          <option value="instagram-reels">인스타그램 릴스</option>
          <option value="naver-blog">네이버 블로그</option>
          <option value="threads">스레드</option>
          <option value="youtube">유튜브 (쇼츠 포함)</option>
        </select>
        <div class="err-msg">채널을 선택해 주세요.</div>
      </div>

      <div class="field" data-name="url">
        <label>후기 게시물 링크 <span class="req">*</span></label>
        <input type="url" name="url" placeholder="https://" inputmode="url" required>
        <div class="hint">게시물에서 [공유 → 링크 복사]한 주소를 붙여넣어 주세요.</div>
        <div class="err-msg">https:// 로 시작하는 게시물 주소를 입력해 주세요.</div>
      </div>

      <div class="row2">
        <div class="field" data-name="holder">
          <label>예금주명 <span class="req">*</span></label>
          <input type="text" name="holder" placeholder="본인 명의 계좌" required>
          <div class="err-msg">예금주명을 입력해 주세요.</div>
        </div>
        <div class="field" data-name="bank">
          <label>은행 <span class="req">*</span></label>
          <select name="bank" required>
            <option value="" selected disabled>선택</option>
            <option>카카오뱅크</option><option>토스뱅크</option><option>국민은행</option>
            <option>신한은행</option><option>우리은행</option><option>하나은행</option>
            <option>농협은행</option><option>기업은행</option><option>새마을금고</option>
            <option>우체국</option><option value="etc">기타 (직접 입력)</option>
          </select>
          <div class="err-msg">은행을 선택해 주세요.</div>
        </div>
      </div>

      <div class="field" data-name="bank-etc" id="bank-etc-field" style="display:none">
        <label>은행명 직접 입력 <span class="req">*</span></label>
        <input type="text" name="bankEtc" placeholder="예: 부산은행">
        <div class="err-msg">은행명을 입력해 주세요.</div>
      </div>

      <div class="field" data-name="account">
        <label>계좌번호 <span class="req">*</span></label>
        <input type="text" name="account" placeholder="'-' 없이 숫자만 입력" inputmode="numeric" required>
        <div class="err-msg">계좌번호를 숫자만으로 입력해 주세요.</div>
      </div>

      <div class="agree">
        <label data-name="agree-terms">
          <input type="checkbox" name="agreeTerms" required>
          <span>게시물을 7일간 유지하고, 대가성 표기 문구가 포함되어 있음을 확인했어요 <span class="req">*</span></span>
        </label>
        <label data-name="agree-privacy">
          <input type="checkbox" name="agreePrivacy" required>
          <span>페이백 지급을 위한 개인정보(이름·전화번호·계좌정보) 수집·이용에 동의해요 <span class="req">*</span> <a href="https://www.wouldyouescape.com/privacy" target="_blank" rel="noopener">자세히</a></span>
        </label>
      </div>

      <button class="m-submit" type="submit">신청 완료하기</button>
      <p class="m-submit-error" id="payback-submit-error" role="alert"></p>
    </form>

    <div class="m-done" id="payback-done">
      <div class="big">🎉</div>
      <h4>신청이 접수됐어요!</h4>
      <p>게시 7일째에 후기를 확인하고<br>확인 당일 5,000원을 입금해 드릴게요.<br>입금이 완료되면 문자로 알려드립니다.</p>
    </div>
  </div>
</div>

`;

const PAGE_SCRIPT = String.raw`
  document.querySelectorAll('.copy-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      function done(){
        var original = btn.textContent;
        btn.textContent = '복사 완료!';
        btn.classList.add('copied');
        setTimeout(function(){ btn.textContent = original; btn.classList.remove('copied'); }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function(){ fallback(); });
      } else { fallback(); }
      function fallback(){
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch(e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* ===== 페이백 신청 모달 동작 ===== */
  (function(){
    var overlay = document.getElementById('payback-modal');
    var form = document.getElementById('payback-form');
    var done = document.getElementById('payback-done');
    var bankSelect = form.querySelector('select[name=bank]');
    var bankEtcField = document.getElementById('bank-etc-field');
    var submitButton = form.querySelector('.m-submit');
    var submitError = document.getElementById('payback-submit-error');

    document.querySelectorAll('[data-open-modal]').forEach(function(btn){
      btn.addEventListener('click', function(){
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    function closeModal(){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    overlay.querySelector('[data-close-modal]').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

    bankSelect.addEventListener('change', function(){
      bankEtcField.style.display = (bankSelect.value === 'etc') ? '' : 'none';
    });

    /* 전화번호 자동 하이픈 */
    var phoneInput = form.querySelector('input[name=phone]');
    phoneInput.addEventListener('input', function(){
      var d = phoneInput.value.replace(/\D/g,'').slice(0,11);
      if(d.length > 7) phoneInput.value = d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7);
      else if(d.length > 3) phoneInput.value = d.slice(0,3)+'-'+d.slice(3);
      else phoneInput.value = d;
    });
    /* 계좌번호 숫자만 */
    var accountInput = form.querySelector('input[name=account]');
    accountInput.addEventListener('input', function(){
      accountInput.value = accountInput.value.replace(/[^0-9]/g,'');
    });

    function setError(name, on){
      var f = form.querySelector('[data-name="'+name+'"]');
      if(f) f.classList.toggle('error', !!on);
    }

    function hideSubmitError(){ submitError.textContent = ''; submitError.classList.remove('show'); }
    function showSubmitError(msg){ submitError.textContent = msg; submitError.classList.add('show'); }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      hideSubmitError();
      var v = function(n){ var el = form.querySelector('[name='+n+']'); return el ? el.value.trim() : ''; };
      var ok = true;

      setError('name', !v('name')); ok = ok && !!v('name');
      var phoneOk = /^01[016789]-?\d{3,4}-?\d{4}$/.test(v('phone'));
      setError('phone', !phoneOk); ok = ok && phoneOk;
      setError('session', !v('session')); ok = ok && !!v('session');
      setError('channel', !v('channel')); ok = ok && !!v('channel');
      var urlOk = /^https?:\/\/.+\..+/.test(v('url'));
      setError('url', !urlOk); ok = ok && urlOk;
      setError('holder', !v('holder')); ok = ok && !!v('holder');
      setError('bank', !v('bank')); ok = ok && !!v('bank');
      if(v('bank') === 'etc'){ setError('bank-etc', !v('bankEtc')); ok = ok && !!v('bankEtc'); }
      var accOk = /^\d{8,16}$/.test(v('account'));
      setError('account', !accOk); ok = ok && accOk;
      ok = ok && form.querySelector('[name=agreeTerms]').checked && form.querySelector('[name=agreePrivacy]').checked;

      if(!ok){
        var firstErr = form.querySelector('.field.error');
        if(firstErr) firstErr.scrollIntoView({behavior:'smooth', block:'center'});
        return;
      }

      var payload = {
        name: v('name'), phone: v('phone'), session: v('session'),
        channel: v('channel'), url: v('url'), holder: v('holder'),
        bank: v('bank') === 'etc' ? v('bankEtc') : v('bank'),
        account: v('account'),
        agreements: {
          terms: form.querySelector('[name=agreeTerms]').checked,
          privacy: form.querySelector('[name=agreePrivacy]').checked
        }
      };

      submitButton.disabled = true;
      submitButton.textContent = '신청 처리 중...';

      fetch('/api/review-payback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
        .then(function(r){
          if(!r.ok){ throw new Error((r.data && r.data.error) || '신청 처리 중 오류가 발생했어요.'); }
          form.style.display = 'none';
          done.style.display = 'block';
        })
        .catch(function(err){
          showSubmitError(err.message || '신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
          submitButton.disabled = false;
          submitButton.textContent = '신청 완료하기';
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
