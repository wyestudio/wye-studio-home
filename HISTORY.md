# HISTORY.md — 배경 이력서 & 트러블슈팅 기록

CLAUDE.md 에 있던 "최근 완료 항목" 타임라인(2026-09-17 부터 `docs/11-stack-and-security.md`)에서 나열된 각 항목의 **상세 서사·시행착오·관련 파일 목록·"다음에 이어서 할 만한 것"** 메모를 기록. 또한 **도메인 연결/배포 후 버그/외부 서비스 결정** 같은 구체적인 배경을 한 곳에 보관.

---

## 📋 완료 항목별 상세 기록

### 비회원 구매 플로우 전환 + PII 암호화 (2026-08-09)

신청 시점에 대표 신청자+동행자 전원의 이름/전화번호/출생년도를 직접 입력받는 그룹 신청으로 재설계. 출생년도 1990~1999년생 제한(모든 회차 공통, 법적 제한 아님) 추가. 같은 테마(`sessions.theme_label`) 재참여는 전화번호 기준으로 차단, 닉네임(선택)은 같은 회차 내에서만 유일. 로그인 없이 **전화번호+접수번호로 참여내역 조회**(`/lookup`) 신규 추가. DB는 `supabase-schema.sql` v7 — `applications`에서 `user_id` 제거, `application_attendees` 신설, `apply_and_recompute()` → `submit_application()`으로 대체(정원 계산이 신청 건수가 아니라 참여 인원 합계 기준으로 변경), `get_session_stats()`도 인원 합계 기준 재작성, `lookup_application()` 신설. 로그인 시스템은 삭제하지 않고 진입점만 제거(휴면 처리).

**PII 암호화** — 전화번호로 중복/조회를 체크하는 구조라 개인정보 보호에 더 신경써야 한다는 판단으로, `application_attendees.name/phone`, `applications.depositor_name`을 Supabase Vault 키 기반으로 암호화(`encrypt_pii`/`decrypt_pii`), 전화번호 매칭은 복호화 불가능한 HMAC 해시(`hash_phone`)로 전환(`supabase-schema.sql` v8). `next.config.ts`에 HSTS 헤더 추가, Supabase DB의 "Enforce SSL on incoming connections" 활성화.

---

### 신청 실패 시 입력값 유지 + 충돌 참여자 표시 (2026-08-09)

`ApplyForm`을 controlled component로 전환해 유효성 실패(같은 테마 재참여 등) 시 폼이 리셋되지 않고 입력값이 그대로 남도록 수정. `submit_application()`이 충돌한 전화번호를 SQL `DETAIL`로 실어 보내고, 클라이언트가 해당 참여자 입력칸을 빨간 테두리로 표시.

---

### 브랜드명 "우주이스케이프"로 통일 + 헤더 BETA 마스코트 (2026-08-09)

사용자 노출 텍스트 전반(페이지 제목/설명, 홈 문구, 신청 완료 화면 예금주 등)에 남아있던 옛 명칭 "wye studio"를 "우주이스케이프"로 교체(GitHub 저장소명/Vercel 프로젝트명/`package.json` name 등 내부 식별자는 의도적으로 그대로 둠). 휴면 처리된 signup 플로우에 남아있던 "만 19세 미만 거부" 문구/로직도 함께 제거(출생년도 1990~1999 제한으로 대체됐으므로 불필요). 헤더 로고 옆에 마스코트("케이프") 정적 이미지 + 🔨 이모지를 CSS `@keyframes`로 조합해 로고를 망치질하는 애니메이션과 초록색 `BETA` 배지 추가.

---

### SEO 기초 작업 완료 (2026-08-10)

`src/app/robots.ts`/`sitemap.ts` 추가(세션 상세 페이지는 Supabase에서 동적으로 끌어옴), `layout.tsx`의 `metadata`에 OpenGraph/Twitter 카드/keywords 보강, `opengraph-image.tsx`로 동적 OG 이미지 생성(마스코트 이미지 + 한글 폰트 서브셋 임베드). Google Search Console에 도메인 속성 등록(Cloudflare DNS TXT 인증, OAuth 자동 연동은 보안상 거부하고 수동 등록) + 사이트맵 제출 완료. 네이버 서치어드바이저도 사이트 등록(HTML meta 태그 인증, `layout.tsx`의 `verification.other`에 반영) + 사이트맵 제출 완료. 색인 반영까지는 며칠~2주 소요 예상, 색인 여부는 `site:wouldyouescape.com` 검색이나 각 콘솔의 URL 검사/색인 상태 확인 도구로 확인 가능.

---

### Slack 알림 + Solapi SMS 신청확인 발송 (2026-08-10)

`submit_application()` 성공 직후 Next.js `after()`(`next/server`)로 응답을 먼저 돌려주고 백그라운드에서 처리:

**Slack**: `api.slack.com`에 "Wouldyouescape Notify" 앱을 Blank app으로 생성 → Incoming Webhooks 활성화 → `#apply-notification` 채널로 Webhook 발급 → `.env.local`에 등록. `src/lib/slack.ts`(`sendApplicationSlackAlert`, Incoming Webhook으로 세션/상태/참여자/접수번호 전송). 실제 신청 제출 후 채널에 메시지 도착까지 확인 완료.

**SMS(Solapi)**: 계정 생성, 제로콜(070-5236-4797, 개인 명의) 발신번호 서류 인증 승인, 잔액 충전까지 마치고 실제 신청 폼 제출로 라이브 테스트 진행. `src/lib/sms.ts`(`sendApplicationConfirmationSms`, Solapi SDK로 대표 신청자에게 접수번호·계좌·환불기한 안내). 관련 환경변수(`SLACK_WEBHOOK_URL` / `SOLAPI_API_KEY`·`SOLAPI_API_SECRET`·`SOLAPI_SENDER_NUMBER`)가 없으면 `console.warn`만 남기고 조용히 스킵 — 신청 자체는 절대 실패하지 않음. 필요한 키는 `.env.example`에 문서화.

**카카오 알림톡**: 번호 노출 없음의 장점이 있지만 사업자등록번호 없이는 카카오 "비즈니스 채널" 인증이 안 돼 알림톡 발송이 막힘을 확인 — 사업자등록 이후 재검토.

**무통장입금 계좌 확정** — 카카오뱅크 3333052843942, 예금주는 개인 명의라 보안상 "김*온"으로 마스킹 표시(`src/lib/bankAccount.ts`). 신청 완료 화면(`ApplyComplete.tsx`)의 "준비 중" 플레이스홀더를 실제 값으로 교체.

**신청 완료 화면(`ApplyComplete.tsx`) 보강** — 참여자 명단에 전화번호 추가, 그룹/단독에 따라 "대표 신청자"/"신청자" 문구로 문자 발송 보조 안내 추가, 환불 기한(행사 전날, `formatRefundDeadline()`)을 명확한 문구로 표시. SMS가 아직 연동 전이라 계좌 정보는 화면에서 제거하지 않고 그대로 유지(화면이 유일한 신뢰 가능 정보원).

**문자 알림 3단계 중 1단계만 구현** — 신청확인(1단계) 코드는 완성됐지만 팀원 테스트 시 반복 신청으로 요금이 계속 나가서 `src/app/sessions/[id]/apply/actions.ts`의 `after()` 블록에서 호출을 2026-08-11에 제거함. 2·3단계(입금확인/참가확정 상기)는 각각 어드민 페이지/Cron으로 별도 구현 필요.

---

### Solapi 신청확인 SMS 실제 발송 검증 (2026-08-10)

발신번호(제로콜 070-5236-4797) 서류 인증 승인 + 잔액 충전 완료 후, 실제 신청 폼으로 라이브 테스트 진행(비소개팅 회차, 접수번호 810751). Solapi SDK의 `getMessages()`로 발송 이력을 직접 조회해 `status: "COMPLETE"` / `reason: "수신 완료"`를 확인 — 콘솔 로그에 의존하지 않고 Solapi API 응답 자체로 실수신을 검증하는 방법을 새로 확립함(추후 SMS 관련 이슈 디버깅 시 재사용 가능). 테스트로 만든 신청 데이터는 확인 후 `delete from applications where confirmation_code = '810751'`로 정리 완료.

---

### 네비게이션 4개 메뉴 재편 + 소개팅 성비 분리 신청 로직 (2026-08-10)

헤더 네비를 About/Contents/Check(=`/lookup`, 라벨만 영문화)/Notice 4개로 재편(`/about`·`/contents`·`/notice` 신규 페이지 추가, `sitemap.ts`에 3개 반영). 처음엔 홈에서 `ConceptCards`/`ProcessSteps`/`FaqPreview`를 각 신규 페이지로 옮기며 중복을 없앴으나, 사용자가 "홈 형태는 원래대로 유지"를 요청해 **홈에도 그대로 남겨두고 About/Contents/Notice에도 같은 컴포넌트를 재사용하는 의도된 중복 구조**로 최종 조정함(`ConceptCards`→`src/components/about/`, `ProcessSteps`→`src/components/contents/`, FAQ 콘텐츠→`src/components/notice/FaqSection.tsx`로 파일 위치만 옮기고 홈/About/Contents/Notice 각각에서 import해서 씀).

소개팅 회차는 성비를 맞춰야 해서 그룹 신청을 막고 1인+성별 필수 신청으로 전환, 남/여 각각 정원 10명씩 독립 판정하도록 `submit_application()`/`get_session_stats()`를 `supabase-schema.sql` v9로 재작성(`sessions.capacity_confirm_line_male/female`, `application_attendees.gender` 컬럼 추가). 정원이 다 안 찼을 때 성비를 깨서 채우는 결정은 자동화하지 않고 운영자 수동 처리로 남겨둠. 비소개팅 회차는 기존 그룹 신청 로직 100% 유지.

---

### 전화번호 세그먼트 입력 + 형식 유효성 검사 (2026-08-11, 팀 테스트 중 발견)

지금까지 전화번호는 형식 검증이 전혀 없었음(`type="tel"` + `required`뿐). `src/lib/phone.ts` 신설(`isValidPhoneDigits`: 010~019로 시작하는 10~11자리, `formatPhoneDigits`: 화면 표시용 하이픈 포맷). 

`ApplyForm.tsx`의 전화번호 입력을 하나의 `<Input>`에서 `010 / 0000 / 0000` 세 칸으로 분리(`phone1/phone2/phone3`)해 숫자 외 입력·칸별 자릿수 초과를 애초에 막고, 칸이 다 차면 다음 칸으로 자동 포커스 이동 + 빈 칸에서 백스페이스 시 이전 칸으로 이동까지 구현. 유효성 오류는 폼 하단 텍스트가 아니라 **제출을 한 번 시도한 뒤부터** 문제 있는 칸 자체가 빨간 배경/테두리로 바뀌는 방식으로 변경(기존 전화번호 중복 충돌 표시와 같은 자리에 함께 적용), 통과하면 서버에 보내지도 않고 클라이언트에서 즉시 막음(`actions.ts`의 서버 측 `isValidPhoneDigits` 검사는 방어용으로 그대로 유지). 

**부수 효과**: 이제 항상 하이픈 없는 순수 숫자만 서버로 전송돼 `hash_phone()` 매칭이 이전보다 일관돼짐(이전엔 사용자가 하이픈을 넣었는지 여부에 따라 같은 번호가 다르게 해시될 수 있었던 잠재 버그가 자연히 해소됨) — `ApplyComplete.tsx`/`LookupForm.tsx`의 전화번호 표시도 `formatPhoneDigits()`로 통일해 하이픈 있는 옛 데이터/순수 숫자 신규 데이터 둘 다 안전하게 포맷.

---

### 페이지별 콘텐츠 보강 (2026-08-11)

"안에 뭐가 없다"는 피드백으로 프립/문토 실제 사이트를 참고해 화면설계 아티팩트를 먼저 만들고(개요/우선순위/필요한 준비물 포함), 승인 후 사진·브랜드 스토리처럼 실제 자료가 필요한 항목만 "준비 중" 자리로 남겨두고 나머지를 전부 구현함.

**세션 상세**(`/sessions/[id]`, 최우선) — 포함사항 칩, 진행 순서(회차 시각 기반 4단계, 번호 매김), 시각적 FAQ(테마별 분기 — 소개팅은 "대기 중인데 정원이 안 차면?", 비소개팅은 "혼자 신청해도 되나요?"), About 연결 카드, "아직 등록된 후기가 없어요" 정직한 빈 상태 추가. 대표 이미지는 실사진이 없어 기존 플레이스홀더 유지.

**홈**(`/`) — 히어로에 암호화 안내 마이크로카피, "이런 분들께 추천해요" 타겟 페르소나 칩(`PersonaChips.tsx` 신규), "이런 공간에서 진행돼요" 공간 사진 플레이스홀더(`SpacePreview.tsx` 신규, 사진 없어 준비 중), 진행 방식 각 단계에 소요/시점 설명 추가(`ProcessSteps.tsx`, Contents와 공유), About 연결 카드, FAQ 2건 추가(혼자 신청/환불 규정), 마감 전 CTA 배너.

**About**(`/about`) — 마스코트("케이프") 소개, 운영 원칙 카드 3개(무알코올·PII 암호화·성비 관리 — 전부 이미 구현된 사실만 노출), Footer에 묻혀 있던 사업자 정보를 별도 카드로 분리. 브랜드 스토리는 실제 창업 계기 문구가 없어 "준비 중" 유지(지어내지 않음).

**Contents**(`/contents`) — 인트로 문장, 다음 시즌 예고 카드. `SessionCard.tsx`(홈 히어로와 공유)에 포함사항 태그 2개 추가.

**Notice**(`/notice`) — 실제 공지 2건 등록("베타 오픈 안내", "8/22 신청 접수 중") — `NOTICES` 빈 배열 상태 해소.

**신청 폼 / Check** — 각각 암호화 안내 마이크로카피, 접수번호 안내 문구 한 줄만 추가(기능은 이미 충분).

**소개팅 세션 대표 이미지** (2026-08-11 추가) — 사용자가 방탈출 테마 "바-오" 홍보용 zip(14장)을 전달했으나, 확인해보니 실제 우리 콘텐츠가 아니라 소개팅 모집 카드뉴스 **디자인 템플릿**이었음(호스트명 "윤월"/지역 "미리시" 등 placeholder, 모집인원·보증금·타임테이블도 우리 실제 정책과 다름, 마지막 장은 "페이지 내 인물 사진은 샘플이미지입니다"라고 명시된 스톡 사진). 정보성 슬라이드(모집조건/타임테이블/FAQ/샘플 커플사진)는 실제 사이트에 올리면 잘못된 정보를 노출하는 셈이라 전부 제외하고, 텍스트 오버레이 없는 순수 타이틀 아트웍(1번, `public/bar-o-title.png`)만 소개팅 세션 상세의 대표 이미지 자리에 사용 — "테마 아트웍 이미지 · 실제 진행 공간은 회차마다 달라질 수 있어요" 캡션을 붙여 실제 장소 사진이 아님을 명시.

---

### 홈페이지 히어로 + 스크롤텔링 전면 재작업 (2026-08-11, 여러 라운드에 걸쳐)

기존 "히어로 확대 후 아래로 릴리즈" 방식을 걷어내고, 스크롤에 따라 씬이 전환되는 연출로 교체.

**`ScrollStage`/`ScrollStageContext` 씬 구조**(`src/components/home/scroll-stage/`) — 각 씬(`HeroScene`/`SessionScene`/`ConceptScene`/`ProcessScene`/`ClosingScene`)이 `useScene(index, total, range)`로 자기 구간의 로컬 진행률(0~1)을 받고, `SceneShell`이 그걸 실제 화면 효과로 변환. 씬마다 **`weight` prop**(기본 1)으로 스크롤 구간 길이를 다르게 줄 수 있음 — 예: `<SessionScene weight={2.5}>`처럼 특정 씬만 스크롤을 훨씬 더 길게 차지하게 함. 씬 경계 겹침(크로스페이드) 폭은 `unitSpan`(weight=1 기준 폭) 기준으로 고정 계산해서, 큰 weight를 받은 씬이 있어도 다른 씬들의 전환 타이밍이 밀리지 않도록 함(안 그러면 weight 큰 씬의 여유 구간까지 겹침으로 잡혀서 다음 씬이 너무 일찍 겹쳐 보이는 버그가 있었음 — 실제로 겪고 고침).

**`SceneShell`의 `variant`** — 기본 `"fade"`(opacity+clip-path+blur+scale, 기존 방식 그대로, 히어로/컨셉/진행방식/마무리 씬이 사용)와 새 `"rise"`(회차 카드 씬 전용) 두 가지. `rise`는 진입(아래→제자리, 슬라이드)·줌인(제자리 고정+확대)·순수 hold(그대로 고정)·줌아웃(제자리 고정+축소)·이탈(제자리→위, 슬라이드) 5단계로 구성되고, 진입/이탈 폭과 속도를 대칭으로 맞춤.

**마스코트 궤도**(`src/components/space/MascotOrbit.tsx`) — 히어로 중앙 텍스트 주위를 3개 마스코트(우쥬/이스/케이프)가 `requestAnimationFrame` 루프로 원형 궤도 회전. 커서가 셋 중 아무거나에 가까워지면 궤도 전체가 공유 속도로 같이 느려짐. 마스코트를 클릭하면 `MascotSelectionContext`(전역, `useSyncExternalStore`+`localStorage`)에 저장되고, 사이트 전역 커스텀 커서(`MascotCursor.tsx`)가 그 마스코트로 즉시 바뀌며 새로고침/페이지 이동해도 유지됨. 히어로 스크롤 exit 시 마스코트 페이드아웃은 로고/텍스트와 **정확히 같은 타이밍** 유지.

**마스코트 정체성 버그**: `mascot-woodju.png`/`mascot-kape-hero.png` 파일명이 처음부터 서로 뒤바뀌어 있었음. `src/lib/mascots.ts`에서 매핑만 바로잡고 파일 자체는 리네임 안 함(다른 곳에서 참조 중이라). 커서 전용으로 사용자가 새로 준 cutout 이미지들(`mascot-{woodju,is,kape}-cursor.png`)을 별도로 추가. **2026-08-11 저녁**: 이스(is) 캐릭터 디자인 자체가 교체됨(파란 혜성 → 빨간 혜성, 정사각 1:1 비율로 변경) — `mascot-is.png`/`mascot-is-cursor.png` 덮어쓰고 `mascots.ts`의 `orbitHeight`/`cursorWidth`/`cursorHeight`도 새 비율에 맞게 수정. **주의**: 같은 파일명으로 이미지만 덮어쓰면 Next.js 15/16 dev 서버(Turbopack)가 이전 버전을 계속 캐싱해서 안 바뀐 것처럼 보일 수 있음 — `.next` 전체를 지우고 dev 서버를 재시작해야 확실히 반영됨.

**헤더 완전 투명화** — 마스코트 궤도가 히어로 상단(헤더 영역)까지 올라오는데 헤더가 불투명해서 마스코트 머리가 잘리는 문제가 있었음. `Header.tsx`에서 배경색·보더·블러를 전부 제거해서 완전 투명하게 만듦 — 로고/메뉴 글자만 떠 있고 바 자체가 안 보임. **트레이드오프**: 다른 페이지(About/Contents 등)에서 스크롤되는 본문 텍스트가 이제 메뉴 글자 위로 블러 없이 겹쳐 보일 수 있음 — 나중에 가독성 이슈로 지적되면 홈만 투명 헤더를 쓰고 다른 페이지는 블러 있는 헤더로 분리하는 걸 고려할 것.

**헤더 높이만큼의 "빈 스크롤" 구간 제거** — 헤더가 `sticky top-0`이지만 문서 흐름에서 실제 높이를 차지해서, 히어로의 sticky 뷰포트가 그만큼 먼저 스크롤을 통과해야 고정되기 시작했음. `Header.tsx`를 client 컴포넌트로 바꿔 `ResizeObserver`로 실제 높이를 재서 `--header-height` CSS 변수로 노출하고, `ScrollStage.tsx`의 래퍼에 `margin-top: calc(-1 * var(--header-height))`를 줘서 첫 스크롤 픽셀부터 바로 고정+연출이 시작되도록 함.

**React Compiler 린트 규칙 관련**: 이번 작업 중 `react-hooks/refs`(렌더 중 ref 재할당 금지)와 `react-hooks/immutability`(렌더 중 클로저 변수 재할당 금지) 두 개를 새로 만났음 — 렌더 바디에서 `let cumulative` 같은 변수를 `.map()` 콜백 안에서 재할당하면 걸림. 사전에 별도 배열로 값을 다 계산해두고 map 콜백은 읽기만 하도록 고쳐서 해결. `useRef`를 최신값으로 동기화할 때도 렌더 중이 아니라 `useEffect` 안에서 할당해야 함.

**다음에 이어서 할 만한 것**: 회차 카드 씬의 좌측 텍스트를 없앤 뒤라 카피(설명 문구) 없이 카드만 있는 게 정보량이 부족하진 않은지, 컨셉/진행방식/마무리 씬은 여전히 옛날 fade 방식이라 히어로→회차 구간과 톤이 안 맞는 느낌이 있는지 정도는 다음에 실제로 다시 보면서 판단하면 좋을 듯. 헤더 투명화의 다른 페이지 가독성 트레이드오프도 다음 세션에 체크해볼 것.

---

### GTM/GA4 애널리틱스 연동 (2026-08-11~12)

페이지뷰 + "신청 시작"/"신청 완료"(대표 신청자 출생년도/성별 포함) 이벤트를 GA4로 전송, GA4 맞춤 정의(테마명/접수번호/출생년도/성별) 등록까지 완료. 컨테이너/속성 ID, 태그·트리거·변수 구성, 새 이벤트 추가 시 체크리스트는 `ANALYTICS.md` 참고.

---

### 테마 리브랜딩 + 8/29 일정·가격 변경 + 회차 카드 전면 재디자인 (2026-08-12)

`supabase-schema.sql` v10.

**리브랜딩/일정/가격**: `theme_label`을 '소개팅'/'비소개팅' → **"바-ㅇ탈출(ver.소개팅)"/"바-ㅇ탈출(ver.모임)"**으로 변경(오타 아님, 의도된 표기 — 사용자 확정). 이 값이 `submit_application()`(그룹신청 제한/성별필수/성비분리 정원 분기) 등 여러 곳에서 리터럴 비교되고 있어서, TS 쪽은 `src/lib/theme.ts`의 `isDatingTheme()` 헬퍼로 비교를 한 곳에 모으고(값이 또 바뀌어도 한 군데만 고치면 되게), SQL 쪽은 `submit_application()`을 새 값으로 `create or replace`. 날짜 8/22→**8/29**로 변경, 가격은 정가(모임 65,000원/소개팅 75,000원) 대비 **8/29 베타 한정 할인**(모임 45,000원/소개팅 55,000원, `SessionCard.tsx`에서 `price_krw + 20,000`으로 정가를 계산해 취소선 표시 — 정가 자체는 DB에 안 둠). `venue_area`도 "서울 신림권" → "서울 신림역 인근"으로 수정. **DB 값 변경(UPDATE 2건)은 Supabase SQL Editor에서 직접 실행 완료** — `sessions` 테이블엔 `service_role`도 update grant가 없어서(의도된 보안 설정) 스크립트로 못 돌리고 브라우저로 Supabase 대시보드 SQL Editor에 직접 접속해서 실행함.

**회차 카드 디자인**: `SessionCard.tsx`를 신청현황/진행바/모집중 뱃지 없이 테마명(색은 `hud-panel-group`=초록/`hud-panel-dating`=핑크 네온, `isDatingTheme()`로 분기) + 날짜/시작시간/플레이타임/장소(라벨-값 쌍 반복, `SessionCardField`) + 가격(정가 취소선+할인가)만 남기는 걸로 재구성. 각진 유리질감 SF 패널(`globals.css`의 `.hud-panel`/`.hud-clip`, 우측 상하단 모서리만 대각선으로 깎음, `--hud-accent` 커스텀 프로퍼티로 테마별 색 주입) + 호버 시 확장하는 배경 글로우. `SessionScene.tsx`(홈)도 `grid-cols-1 sm:grid-cols-2`로 모바일 반응형 추가(예전엔 `grid-cols-2` 고정이라 모바일에서 카드가 다 찌그러졌었음).

**모바일 버그 3종**:
- ① `ScrollStage.tsx`의 씬 컨테이너가 `h-screen`(100vh)이라 모바일 브라우저 주소창이 떠 있을 때 실제 보이는 영역보다 콘텐츠가 밀려 보이던 문제 → **`h-dvh`(동적 뷰포트 높이)로 교체**.
- ② `Header.tsx`의 로고 옆 브랜드 텍스트("우주이스케이프")가 좁은 화면에서 단어 중간에 줄바꿈되던 버그 → `whitespace-nowrap` + 로고 클러스터 `shrink-0`, 망치질 마스코트는 공간 확보를 위해 모바일에서만 숨김(`hidden sm:block`).
- ③ 마스코트 커스텀 커서(`MascotCursor.tsx`)가 링크/버튼 위에서 브라우저 기본 손 커서와 같이 보이던 문제 — `<a href>`는 브라우저 기본 스타일시트가 그 요소에 직접 `cursor:pointer`를 지정해서 body의 `cursor:none` 상속보다 우선순위가 높았음. `MascotCursor` 활성화 시 `<html>`에 `custom-cursor-active` 클래스를 붙이고 `globals.css`에서 그 클래스가 있을 때 `a`/`button`/`input` 등을 직접 겨냥해 `cursor:none`을 걸도록 수정 — `getComputedStyle`로 실제 계산된 커서 값이 `"none"`인 것까지 확인함. 추가로 클릭 가능한 요소 위에서는 마스코트 커서 자체도 30% 투명도로 옅어지도록 함.

**헤더 메뉴 글자 스왑 호버 효과**: `motion`(옛 Framer Motion) 패키지 신규 설치, `RandomLetterSwap` 컴포넌트(`src/components/ui/RandomLetterSwap.tsx`) 신규 제작 — 헤더 4개 메뉴 글자가 호버 시 무작위 순서로 스태거되며 롤업 애니메이션. 21st.dev 커뮤니티 컴포넌트(`m-random-letter-swap-1`)를 참고했으나 핵심 로직 소스는 안 보여줘서 실제 사이트에서 호버 동작을 관찰하고 직접 구현. **다음에 이어서 할 만한 것**: `RandomLetterSwap`도 21st.dev 원본 소스를 못 보고 관찰만으로 재현한 거라, 실제 라이브러리 소스가 확보되면 비교해볼 것.

**히어로 CTA 버튼("YES")**: `src/components/home/HeroCtaButton.tsx` 신규 — "would you escape?" 바로 아래, 클릭 시 `/contents`로 이동. 기본 상태는 테두리 없이 우상단(ㄱ)/좌하단(ㄴ) 브래킷 없이 텍스트만(여러 라운드 끝에 브래킷도 뺌) 떠 있다가, 호버 시 커서가 들어온 지점에서 흰 원이 퍼지며(`--origin-x/y` CSS 커스텀 프로퍼티, `globals.css`의 `.hero-cta-fill`) 그 사각형 클리핑 영역이 자연스럽게 완전한 네모로 채워지고 텍스트도 "YES" → "참여하기"로 크로스페이드(21st.dev "Origin Button" 참고). 기본 라벨은 왼쪽 패딩 30px/오른쪽 42px(합 72px 고정)로 왼쪽에 붙어있고, 호버 라벨("참여하기")은 `absolute inset-0 flex justify-center`로 기본 라벨과 독립적으로 버튼 정중앙에 옴.

**다음에 이어서 할 만한 것**: 회차 카드의 호버 애니메이션(테두리가 도는 효과)은 여러 번 시도했지만 사용자가 원하는 정확한 느낌을 못 맞춰서 보류 상태 — 사용자가 직접 레퍼런스를 더 찾아본 뒤 재논의 예정.

---

### 유리 네온 카드 디자인 통일 + About 환경변수 제어 (2026-08-12)

`supabase-schema.sql` v10 이후 About/Contents/Notice/Check/상세 페이지까지 스크롤할수록 톤이 떨어지는 문제가 있었음(히어로/네비/배경은 네온 파장감 → 나머지 콘텐츠는 평범한 glass-panel). 네온 그라디언트→단색 미니멀→종이 문서 컨셉 등 여러 시행착오를 거쳐, 회차 카드가 이미 쓰던 유리+네온 `hud-panel` 언어로 최종 수렴. `HudCard`/`SectionHeading`/`HudPlaceholder`/`FaqAccordion`/`Reveal` 공용 컴포넌트 신설, 호버 시 대각선 하이라이트가 카드를 훑고 지나가는 스윕 애니메이션 추가. 

About 페이지는 배포 환경에서는 `NEXT_PUBLIC_ABOUT_ENABLED` 환경변수 없을 시 404로 폐쇄, 헤더 링크도 조건부로 숨김 — 로컬에서는 계속 개발 가능.

---

### 8/29 회차 시각 변경 — 모임 13:00 / 소개팅 18:00 (2026-08-13)

모임(`바-ㅇ탈출 ver.모임`) 12:30→13:00, 소개팅(`바-ㅇ탈출 ver.소개팅`) 18:30→18:00으로 시작 시각 변경, 진행시간(플레이타임)은 각각 3.5h/4.5h로 유지(모임 13:00~16:30, 소개팅 18:00~22:30). `supabase-schema.sql` v12-9 추가 — 화면에 보이는 모든 시각 표시(회차 카드/상세/신청 폼 헤더/어드민/Slack 알림/`/lookup`)는 `src/lib/format.ts`가 `sessions.start_at`/`end_at`을 그때그때 계산하는 구조라 DB 값만 바꾸면 자동 반영됨(코드 수정 불필요). `sessions` 테이블은 `service_role`도 update grant가 없어(의도된 보안 설정) UPDATE 2건은 Supabase SQL Editor에서 직접 실행 완료. 이번 시각 변경과 무관하게 조사 중 발견된 낡은 텍스트도 함께 정리: `NoticeSection.tsx` 공지 문구("8/22"→"8/29", "비소개팅"→"모임"), `layout.tsx`의 `SITE_DESCRIPTION`("8/22"→"8/29").

---

### 신청 폼 UX 개선 + v12 신청 확정/대기 로직 전면 재설계 (2026-08-13)

다섯 가지 큰 변경:

**신청 폼**: 성별/경험 select 드롭다운을 토글 버튼 그룹으로 전환(`ButttonGroup.tsx`), 페이지 헤더를 `[ThemeTag] 바-ㅇ탈출 8/29(토)·12:30` 순서로 재배치(`ThemeTag` 신규), 브라우저 기본 검증 팝업 제거(`<form noValidate>`), 약관 미동의 시 체크박스 바로 아래 오류 표시, 모바일 헤더만 불투명화, `supabase-schema.sql` alter 문을 `if not exists`로 멱등화. 경험 횟수를 선택사항으로 변경(필수 검사 제거).

**v12 DB 스키마**: 정원/확정 로직 완전 재설계 — 모임은 24명까지 즉시확정/50명까지 대기/50명 초과 거부, 소개팅은 성별 각 12명 확정/각 30명까지 대기/초과 거부. 자동 승격 로직 완전 삭제(대기자는 영구 대기, 운영자 수동 처리만). 테마 상호배타를 테마 불문 1인 1활성신청으로 강화. `waiting_number` 신설(대기자 대기 순번), `applications`에 SMS 중복발송 방지 마커 컬럼 추가(`confirmation_sms_sent_at` 등).

**SMS 3단계 함수**: `sendApplicationConfirmationSms`(신청확인, **현재 비활성**)·`sendPaymentConfirmedSms`(입금확인)·`sendEventReminderSms`(참가확정 상기) 구현. 1단계는 8/11에 비활성화한 상태 그대로 유지, 2·3단계는 아래 어드민/크론 페이지에서 실제 호출함.

**어드민 페이지** (`/admin/**`, `proxy.ts`에서 `ADMIN_PATH`로 보호): 비밀번호 입력(`/admin/login`, `ADMIN_PASSWORD` 환경변수) 후 쿠키(`admin_auth`, 24시간) 발급. 대시보드(`/admin`)에서 세션 목록 조회, `/admin/sessions/[id]`에서 신청자 목록 + 입금확인 버튼(클릭 시 `payment_status` 업데이트 + `sendPaymentConfirmedSms` 발송).

**크론 API** (`/api/cron/reminder`, `CRON_SECRET` 토큰 인증): 24시간 이내 시작하는 확정 신청 조회 후, `reminder_sms_sent_at` null인 대표 신청자에게 `sendEventReminderSms` 발송. 외부 크론 서비스(cron-job.org 등)에서 매 5~15분 호출 설정 필요.

**프론트엔드 waiting_number/정원마감 반영**: 정원 숫자 자체 노출 제거(`CapacityPolicyTable` 삭제), 대기자에게 "대기번호 N번" 표시, 자동 승격 안내 문구 제거, `"정원마감:"` 에러 감지해 `state.closed`로 구분. `state.closed`/`session.status==='closed'`일 때 폼을 숨기고 마감 안내만 표시, 소개팅 성별 마감(`male_closed`/`female_closed`) 시 해당 성별 선택지 비활성화("(마감)" 텍스트 추가).

**모바일 히어로 마스코트 자유 이동** (`MascotFreeRoam`): 데스크톱은 기존 궤도 회전(`MascotOrbit`) 유지, 모바일에서만 세 마스코트가 화면을 자유롭게 걸어 다니며 드래그/던지기 가능한 물리 시뮬레이션으로 분기(`HeroScene.tsx`, `useIsMobileViewport()` 판정). 콘텐츠 박스 회피 샘플링, 충돌 감지, `requestAnimationFrame` 루프로 구현. 초기 구현 중 `sampleAvoidingContent` 함수를 `measure()`보다 늦게 선언해서 모바일 전용 TDZ 런타임 에러 발생 → 함수 선언 순서 재조정으로 수정.

---

### 검색 사이트링크 정리 — 컨텐츠 빼고 Notice·신청내역 조회 넣기 (2026-09-19)

브랜드명으로 검색하면 홈 결과 아래에 사이트링크로 `바-ㅇ탈출 · 컨텐츠 · Notice ·
About · 참여내역 조회` 다섯 개가 딸려 나왔다. **사이트링크는 끌 수 없다** — 구글
문서상 자동 생성이고 Search Console 의 강등 도구는 폐지됐다. 빼는 방법은 그 페이지를
`noindex` 하거나 지우는 것뿐이라, 무엇이 나갈지는 색인 대상으로만 고를 수 있다.

그래서 9/13 의 "홈·컨텐츠·테마만 색인" 을 **홈·Notice·신청내역 조회·테마** 로 바꿨다.

- `/contents` → `noindex, follow`. 실테마가 하나뿐이라 서버 HTML 에 긁을 본문이 없어,
  잠긴 카드의 "아직 탐사되지 않은 행성입니다" 와 푸터 사업자등록번호가 사이트링크
  설명으로 나갔다. 테마가 늘면 다시 켠다
- `/notice`·`/lookup` → `noindex` 해제 + **자체 `description` 신설**. 둘 다 본문이
  클라이언트에서 그려져 서버 HTML 에는 푸터뿐이라, 설명을 안 주면 구글이 옛 사이트
  설명으로 떨어진다. 실제로 9/13 에 지운 `"방탈출과 로테이션 소개팅을 결합한 …
  베타 오픈. 8/22"` 가 그 뒤로도 조회 페이지 설명으로 계속 나갔다
- `sitemap.ts` 도 같이(컨텐츠 빼고 Notice·조회 넣기) — 안 맞추면 Search Console 에
  "제출됐지만 noindex" 경고가 쌓인다
- 테마 상세는 **검색용 설명과 공유 카드용 설명을 갈랐다**. 어드민의 '한 줄 소개'는
  실제로는 시놉시스라 `"미남아, 소개팅 받아볼래? / > [YES]  [NO]"` 처럼 극중 대사와
  선택지 아트웍으로 돼 있다. 그대로 검색에 나가면 (1) 우리가 팔지 않는 소개팅을
  파는 것처럼 읽히고 (2) 줄바꿈이 뭉개져 `> [YES] [NO]` 가 잡음으로 붙는다.
  `description` 은 아트웍 줄을 빼고 `시놉시스 · ` 를 붙여 내보내고, `og:description`
  은 카카오톡 카드에 아트웍이 살아야 하므로 적은 그대로 둔다. **화면 문구는 그대로다**

같이 확인한 것: 같은 검색에 뜨던 옛 큐피드 이미지와 "비소개팅" 문구는 **사이트에 이미
없다**. `/_next/image?url=%2Fbar-o-title.png` 는 400 을 주고(4xx 는 429 만 빼고 전부
색인 제거 대상), `robots.txt` 도 `/_next/` 를 막지 않아 크롤만 되면 빠진다. 남은 건
재크롤 대기뿐이라 Search Console 임시 삭제를 걸어 뒀다.

→ 규칙: `.claude/skills/wye-customer-facing/SKILL.md` — 공개 여부를 바꾸면 sitemap 도 같이

---


## 🛠 인프라 작업 기록

### 도메인 연결 작업 (2026-08-07, 전부 완료)

`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료(네임서버도 Cloudflare). 아래 3가지 모두 완료됨:

- [x] **Resend 도메인 인증 완료** — Cloudflare DNS에 TXT `resend._domainkey`(DKIM), MX `send`(우선순위 10) + TXT `send`(SPF), TXT `_dmarc`(DMARC) 4개 레코드 추가 → Resend Dashboard(`resend.com/domains`)에서 상태 "Verified" 확인(2026-08-07). Supabase Auth SMTP 발신 주소를 `no-reply@wouldyouescape.com`으로 변경 완료.
- [x] **Vercel 커스텀 도메인 연결 완료** — Vercel Domains에 `wouldyouescape.com`(apex)과 `www.wouldyouescape.com` 추가. apex는 www로 308 리다이렉트, www가 Production에 연결됨. Cloudflare DNS에 CNAME `@`/`www` → `8610a2a84068dc1b.vercel-dns-017.com`(프록시 끔, Vercel 권장사항) 등록 → 둘 다 "Valid Configuration". **이제 `https://wouldyouescape.com`으로 실제 접속 가능.**
- [x] **교차 계정 RLS 재검증 완료** — Supabase Auth Users에서 관리자 권한으로 테스트 계정 2개(`rls-test-a`/`rls-test-b@wouldyouescape.com`, 이메일 인증 없이 auto-confirm) 생성 → 각각 실제 프로덕션 사이트(`wouldyouescape.com`)에서 로그인해 프로필 입력 + 참가 신청까지 완료 → User B 세션의 access token으로 Supabase REST API를 직접 호출(`GET /rest/v1/profiles`, `/applications`, User A의 UUID를 알고 직접 지정해서 조회하는 경우까지 포함)해서 결과가 전부 빈 배열 또는 본인 행만 반환되는 것을 확인(2026-08-07). RLS(`auth.uid() = id` / `auth.uid() = user_id`)가 UI뿐 아니라 API 레벨에서도 타인 데이터 접근을 완전히 차단함을 검증. 테스트 후 두 계정과 연쇄 삭제된 프로필/신청 데이터는 정리 완료(운영 모집 현황 수치에 영향 없음 확인).

---

## 🐛 실제 배포 후 발견해서 고친 버그

(스키마 실행 직후 라이브 테스트에서 발견)

- **테이블 grant 누락**: `profiles`/`sessions`/`applications`에 RLS 정책만 있고 `anon`/`authenticated` 롤에 대한 `grant select/insert/update`가 빠져 있어서 홈 화면부터 "permission denied"로 500 에러가 났음. `supabase-schema.sql`에 grant 문 추가로 해결(위 "중요한 교훈" 참고).

- **이메일 인증 리다이렉트 누락**: `signup/actions.ts`의 `supabase.auth.signUp()`에 `emailRedirectTo`를 안 넘겨서, Confirm email이 켜진 상태에서 인증 링크를 눌러도 `/auth/callback`을 안 거치고 Supabase 기본 Site URL로 튕겨나갔음(로그인도 프로필 생성도 안 됨). `emailRedirectTo: "{origin}/auth/callback?redirect=/"` 추가로 해결.

- **가입 시 입력한 추가정보가 이메일 인증 후 사라지는 문제**: 위 버그를 고치고 나니, Confirm email 경로에서는 가입 폼에 입력한 이름/휴대폰/생년월일/성별이 그냥 버려지고 `/signup/profile`에서 재입력을 요구하는 게 확인됨(사용자 피드백으로 발견). `signUp()`의 `options.data`(=`user_metadata`)에 이 값들을 실어 보내고, `/auth/callback`에서 `createProfileFromSignupMetadata()`(`src/lib/profile.ts`)로 자동으로 `profiles`를 생성하도록 수정 — 이제 재입력 없이 바로 홈으로 이동함. `user_metadata`가 없거나(OAuth 등) 검증 실패 시에만 `/signup/profile`로 폴백.

- **`sessions.venue_name` REST API 노출**: 위 "session_venues" 항목 참고(`docs/12-data-model-and-screens.md` 의 데이터 모델 참고).

---

## 🌐 카카오 로그인 관련 결정 (2026-08-06)

- **Redirect URI 등록 위치**: 카카오 개발자센터에서 헷갈리기 쉬운 부분 — "카카오 로그인 > 일반" 메뉴가 아니라 **[앱] > [플랫폼 키] > REST API 키(Default Rest API Key) 클릭 > "카카오 로그인 리다이렉트 URI"** 항목에 있음.

- **KOE205 (잘못된 요청)**: Supabase의 카카오 연동이 항상 `account_email profile_image profile_nickname` 세 scope를 요청하는데, 카카오 콘솔의 "동의항목"에서 이 세 개가 전부 "사용 안 함"이면 발생. 동의항목을 필수/선택/이용 중 동의 중 하나로 설정해야 해결됨.

- **"이용 중 동의"의 실제 동작**: 카카오 문서상 "로그인 시 동의를 받지 않고 나중에 받는다"고 돼 있지만, 실제로는 로그인 동의 화면에 "선택 동의"와 동일하게 노출됨(문서와 실제 동작이 다름 — 직접 테스트로 확인). 즉 Supabase 기본 연동을 쓰는 한 닉네임/프로필사진 동의 화면을 완전히 숨기는 방법은 없음(사용자가 체크 해제하고 넘어가는 건 가능).

- **KOE006 (앱 관리자 설정 오류)**: Redirect URI 등록값과 실제 요청값이 정확히 일치하지 않으면 발생. 이번 케이스는 등록 시 오타(`calback`, l 하나 누락)가 원인이었음 — 등록할 때 값을 반드시 다시 확인할 것.

- **직접 구현(옵션 B) 검토 후 보류**: 닉네임/프로필사진 동의 자체를 없애려면 Supabase의 기본 카카오 연동을 버리고 직접 OAuth(코드 교환 + `service_role` 키로 세션 생성)를 구현해야 함. 반나절~하루 공수 + 새로운 비밀키 관리 부담 대비 얻는 이득이 적어 보류. 지금은 이메일 필수 동의 + 닉네임/사진 선택 동의(사용자가 거부 가능)로 운영.

- **향후 대안 — 카카오 간편가입(카카오싱크)**: 사업자 정보 등록 + 비즈니스 정보 심사 통과 시, 카카오 로그인만으로 회원가입 완료 + 이름/생년월일/성별까지 카카오에서 받아올 수 있는 기능. `/signup/profile` 재입력 문제를 근본적으로 해결할 잠재력 있음. 우주이스케이프는 아직 사업자등록번호가 없어 **보류 중** — 사업자등록 완료되면 재검토.

---

## 🐛 여러 세션이 같은 저장소를 쓰면서 겪은 것 (2026-09-17)

### 다른 세션의 `git add -A` 에 내 미완성 변경이 실려 운영까지 배포됨

분석 화면(GA4 캠페인 축) 작업을 빌드까지 끝내고 사용자 확인을 기다리던 중, 다른 세션이
`git add -A` 로 커밋하면서 `src/lib/ga4.ts`·`analytics/route.ts`·`analytics/page.tsx` 세 파일이
`docs : 운영기간 마이그레이션 운영 적용 기록` 커밋에 섞여 들어갔다. `main` 은 운영 자동
배포라 **확인 절차 없이 그대로 운영에 나갔다**(커밋 `c4b1fa7`).

변경 자체는 읽기 전용이라 사고로 이어지지 않았지만, 커밋 메시지와 내용이 맞지 않고
"테스트 → 확인 → 운영" 순서가 통째로 건너뛰어졌다.

→ 규칙: `CLAUDE.md` 「커밋·푸시할 때」 — `git add -A` 금지, 편집한 파일만 경로로 지정

### 남의 커밋이 섞인 걸 발견해 운영 장애를 막음

같은 날 저녁, 전환율 표를 `main` 에 올리려고 `git log origin/main..origin/develop` 을
확인하니 다른 세션의 `5343e4a`(테스트 기기 표시 `/internal`)가 끼어 있었다. 그 커밋은
`applications.is_internal` 칸을 읽는데 **운영 DB 에는 그 칸이 없었고**, 마이그레이션 헤더도
`운영 (미적용)` 이었다. 그대로 올렸으면 `adminStats.ts` 의 조회 세 곳이 전부 실패해
어드민 분석 화면이 통째로 깨졌을 것이다.

푸시를 멈추고 사용자에게 알려, 그 세션이 마이그레이션을 먼저 적용한 뒤 함께 올렸다.

→ 규칙: `CLAUDE.md` 「커밋·푸시할 때」 — 올릴 커밋 목록 확인, 남의 커밋이 있으면 묻기

### 표 한 줄에서 `-` 가 두 뜻으로 읽힘

캠페인별 전환율 표에서 **방문 칸의 `-` 는 "GA4 상위 40개 밖이라 모른다"**, **신청 칸의 `-` 는
"0건"** 이었다. 같은 줄에서 같은 기호가 다른 뜻이라 읽는 사람이 반드시 틀리게 해석한다.
진짜 0 은 `0` 으로 찍고 `-` 는 "모른다" 한 뜻으로만 쓰도록 고쳤다.

→ 규칙: `.claude/skills/wye-customer-facing/SKILL.md`

### 어드민 링크 목록이 404 나는 주소를 보여줌

유입경로 링크 화면에서 코드에 박힌 짧은 주소 13개(`/open-event`, `*.go`)에 `/go/` 접두사가
잘못 붙어, 복사 버튼으로 나온 주소가 전부 404 였다. 밖에 뿌렸으면 유입이 통째로 끊겼다.
`managed_by='code'` 인 행은 접두사를 붙이지 않도록 고쳤고, 고친 뒤 **목록에 뜨는 13개 주소를
하나씩 실제로 호출해** 전부 307 인 것을 확인했다.

화면에 뜨는 값과 실제 동작이 다를 수 있다는 걸 그대로 보여준 사례다.

### 팀원의 운영 테스트로 실제 문자 요금이 나감 (2026-08-11)

비개발 팀원을 포함한 팀이 신규 기능을 확인하려고 **운영 사이트에서 신청을 반복 제출**했다.
당시 Solapi 연동이 살아 있어 제출할 때마다 실제 확인 문자가 나갔고 요금이 계속 발생했다.
`src/app/sessions/[id]/apply/actions.ts` 의 발송 호출을 급히 꺼서 막았다.

이후 `NEXT_PUBLIC_IS_TEST_ENV` 로 테스트 환경 발송을 차단하고, 2026-09-17 에는
`applications.is_internal` 로 우리 기기에서 넣은 신청을 분석에서 빼도록 했다.

> 2026-08-11 당시에는 테스트 환경이 없었으나, 이후 `test.wouldyouescape.com` 과 별도
> Supabase 프로젝트가 생겼다. **"staging 이 없다" 는 서술은 더 이상 사실이 아니다.**

→ 규칙: `.claude/skills/wye-money/SKILL.md` — 실제 비용이 나가는 기능은 가드레일부터

## 🔔 슬랙 미입금 알림이 신청 알림을 밀어냄 (2026-09-21)

입금기한 초과 미입금 알림이 새신청 알림과 **같은 채널(#apply-notification)** 로 갔다.
크론이 15분마다 도는데 **처리될 때까지 같은 건을 계속 다시 알려서**, 한 건이 8~12번씩
쌓이며 새신청 메시지를 화면 밖으로 밀어냈다. 대표님이 신청이 들어온 걸 못 보는 상태였다.

`SLACK_UNPAID_WEBHOOK_URL` 을 추가해 `#unpaid-notification` 으로 분리했다(미설정 시 기존
채널로 폴백 — 환경변수를 넣기 전에 알림이 통째로 멈추면 안 된다). **반복 발송 자체는
그대로 뒀다** — 건당 1회로 줄이려면 `applications` 에 발송 시각 칸이 필요한데, 채널 분리만으로
"새신청이 안 보인다" 는 문제는 해결돼서 DB 변경을 미뤘다.

이미 쌓인 미입금 알림 40건(접수번호 9개의 중복)은 지웠다. 그 과정에서 확인한 것:

- **웹훅으로 보낸 메시지는 봇 토큰으로 못 지운다.** 소유자가 봇이 아니라 웹훅이다.
  Owner/Admin 계정의 user token(`xoxp-`) 만 지운다
- **웹훅이 붙은 앱을 재설치하면 기존 웹훅이 무효화될 수 있다.** `Wouldyouescape Notify`
  앱에 스코프를 추가하려다 멈췄다 — 운영 알림 웹훅 4개가 거기 붙어 있어서, 틀렸을 때
  신청·환불 알림이 조용히 끊긴다. 청소 전용 앱 `WYE Cleanup` 을 따로 만들어 피했다
- **Slack 에는 메시지를 다른 채널로 옮기는 기능이 없다.** 다시 써넣고 원본을 지우는
  복제뿐이라 시각과 작성자가 바뀐다

→ 규칙: `.claude/skills/wye-cleanup/SKILL.md` — 지우기 전에 dry-run → 1건 시험 → 전체
