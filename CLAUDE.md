# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(우주이스케이프)의 **비회원 구매(예약) 사이트**. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). **술을 제공하지 않기로 결정**해 미성년자 확인 필요성이 없어졌고, 회원가입 없이 **신청(구매) 시점에 인적정보(이름/전화번호/출생년도)를 직접 받는 방식**으로 운영한다. 대신 소개팅 상품 특성상 "비슷한 또래끼리 즐기는 게 분위기가 좋다"는 이유로 **출생년도 1990~1999년생 제한**(법적 제한 아님)이 모든 회차 공통으로 있고, 한 사람이 대표로 신청하며 동행자까지 함께 등록하는 **그룹 신청**을 지원한다. 로그인 없이 **전화번호+접수번호로 참여내역 조회**도 가능하다. (로그인/카카오/네이버 시스템은 한때 회원제로 운영하며 만들었던 것으로, 삭제하지 않고 **휴면 처리**만 해둠 — 배경은 이 문서 하단 "설계 변경 이력" 참고.)

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, **public**). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제). ⚠️ private였다가 Vercel Hobby(무료) 플랜으로 배포하기 위해 public으로 전환함(private 조직 저장소는 Vercel Pro 플랜이 필요) — 커밋 히스토리에 비밀키 없음을 확인 후 전환. `.env*`는 `.gitignore`로 계속 제외됨.
- Vercel: **연동 완료**. `wyestudio/wye-studio-home` Import, Vercel Team "WYE"(Hobby), 환경변수 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 완료. 배포 URL: `https://wye-studio-home-1ih0pshfp-wye1.vercel.app` (main 브랜치 push마다 자동 재배포됨). **커스텀 도메인 연결 완료**(`wouldyouescape.com`, 아래 "도메인 관련 진행 상황" 참고).
- 도메인: **`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료**(2026-08-06). 네임서버도 Cloudflare 사용 중.

# 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
- **motion**(옛 Framer Motion, 2026-08-12 설치) — 헤더 메뉴 글자 스왑 호버 애니메이션(`RandomLetterSwap`)에 사용. import는 `"motion/react"`(패키지명이 `motion`으로 바뀌면서 서브패스도 같이 바뀜, `"framer-motion"` 아님).
- **Supabase (Postgres)** — Firebase(NoSQL) 대신 선택. 신청 관련 관계형 데이터를 다뤄야 하고, 향후 결제 연동 시 서버 사이드 검증이 필요하기 때문. 리전은 **Seoul (Northeast Asia)**.
- Supabase 프로젝트 생성 시 보안 옵션: **Data API ON / Automatically expose new tables OFF / Automatic RLS ON**
- **인증**: 비회원 구매 플로우로 전환하며 **휴면 처리됨**(2026-08-09). 이메일/비번 + 카카오/네이버 직접 OAuth 로그인까지 전부 완성해서 실제로 동작했었지만, 신청 플로우에서 더 이상 로그인을 요구하지 않게 되면서 코드는 남기고(`src/app/{login,signup,auth,account}/**`, `src/lib/{kakao,naver,profile,oauthLink,accountLookup,age}.ts`) 진입점만 제거함(`proxy.ts`, `Header.tsx`, 신청 페이지). 자세한 배경은 "설계 변경 이력" 3차 수정 참고.
- **이메일 발송(Confirm email)**: Supabase Auth의 "Confirm email"이 켜져 있어 가입 시 이메일 인증이 실제로 필요함. 기본 내장 메일 발송은 시간당 2건 수준으로 매우 제한적이라 **Resend를 커스텀 SMTP로 연결**해둠. `wouldyouescape.com`을 Resend에 등록하고 Cloudflare DNS에 DKIM(TXT `resend._domainkey`)/SPF(MX+TXT `send`)/DMARC(TXT `_dmarc`) 레코드를 추가해 **도메인 인증 완료(Verified, 2026-08-07)**. Supabase Auth SMTP 발신 주소도 `onboarding@resend.dev` → **`no-reply@wouldyouescape.com`**으로 변경 완료 — 이제 임의의 이메일 주소로 가입 확인 메일 수신 가능. Resend 리전은 Tokyo(ap-northeast-1) — Resend가 서울 리전을 아예 제공하지 않아(제공 리전: 버지니아/아일랜드/상파울루/도쿄) 한국에서 가장 가까운 도쿄가 기본 선택된 것. 스팸 판정은 서버 지역이 아니라 SPF/DKIM/DMARC 인증과 발신 IP 평판(Resend는 내부적으로 AWS SES 사용)으로 결정되므로 리전 자체는 무관.

# 지금까지 완료한 것

- [x] Next.js 16 프로젝트 + Supabase 클라이언트(`src/lib/supabase/{client,server,middleware}.ts`), `src/proxy.ts`
  - 주의: Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌고 export 함수명도 `proxy`로 변경됨. Next.js 관련 코드 작성 전엔 `node_modules/next/dist/docs/`에서 최신 컨벤션 확인할 것(AGENTS.md 참고). `params`/`searchParams`는 Promise이며 `PageProps<'/route'>` 헬퍼 타입을 쓴다.
- [x] `supabase-schema.sql` v4 — Supabase에 실행 완료(테이블/RLS/함수/시드 데이터 전부 반영됨)
- [x] 공통 레이아웃(`Header`/`Footer`), 디자인 토큰(`globals.css`, 브랜드 컬러 `--brand: #5b4bff`)
- [x] ~~회원가입(`/signup`) — 이메일/비번 + 만 19세 미만 가입 차단~~ / ~~로그인(`/login`)~~ — 실제로 완성해서 동작까지 확인했던 기능(카카오/네이버 직접 OAuth, 계정 연결 등 포함)이지만, 2026-08-09 비회원 구매 플로우 전환으로 **휴면 처리**됨. 코드는 `src/app/{login,signup,auth,account}/**` 등에 그대로 남아있음 — "설계 변경 이력" 3차 수정 참고.
- [x] 홈(`/`) — 회차 카드(오후/저녁) + 실시간 모집 위젯, 상품 소개 상세(`/sessions/[id]`), 참가 신청 폼(`/sessions/[id]/apply`, **로그인 불필요**, 그룹 신청 지원)
- [x] **비회원 구매 플로우 전환** (2026-08-09) — 신청 시점에 대표 신청자+동행자 전원의 이름/전화번호/출생년도를 직접 입력받는 그룹 신청으로 재설계. 출생년도 1990~1999년생 제한(모든 회차 공통, 법적 제한 아님) 추가. 같은 테마(`sessions.theme_label`) 재참여는 전화번호 기준으로 차단, 닉네임(선택)은 같은 회차 내에서만 유일. 로그인 없이 **전화번호+접수번호로 참여내역 조회**(`/lookup`) 신규 추가. DB는 `supabase-schema.sql` v7 — `applications`에서 `user_id` 제거, `application_attendees` 신설, `apply_and_recompute()` → `submit_application()`으로 대체(정원 계산이 신청 건수가 아니라 참여 인원 합계 기준으로 변경), `get_session_stats()`도 인원 합계 기준 재작성, `lookup_application()` 신설. 로그인 시스템은 삭제하지 않고 진입점만 제거(휴면 처리).
- [x] **보안 강화 + PII 암호화** (2026-08-09) — `application_attendees.name/phone`, `applications.depositor_name`을 Supabase Vault 키 기반으로 암호화(`encrypt_pii`/`decrypt_pii`), 전화번호 매칭은 복호화 불가능한 HMAC 해시(`hash_phone`)로 전환(`supabase-schema.sql` v8). `next.config.ts`에 HSTS 헤더 추가, Supabase DB의 "Enforce SSL on incoming connections" 활성화. 자세한 내용은 아래 "보안 강화" 섹션 참고.
- [x] **신청 실패 시 입력값 유지 + 충돌 참여자 표시** (2026-08-09) — `ApplyForm`을 controlled component로 전환해 유효성 실패(같은 테마 재참여 등) 시 폼이 리셋되지 않고 입력값이 그대로 남도록 수정. `submit_application()`이 충돌한 전화번호를 SQL `DETAIL`로 실어 보내고, 클라이언트가 해당 참여자 입력칸을 빨간 테두리로 표시.
- [x] `npm run lint` / `npm run build` 통과 확인
- [x] GitHub 저장소 push 완료 (`wyestudio/wye-studio-home`)
- [x] Resend 커스텀 SMTP 연결(Supabase Auth) — 도메인 인증은 아직(TBD, 앞으로 할 일 참고)
- [x] RLS 실측 점검 — anon은 `profiles`/`session_venues` 접근 자체가 차단됨을 API 호출로 확인
- [x] `sessions.venue_name`(상호명) 노출 문제 수정 — `session_venues` 비공개 테이블로 분리, 관련 select 정책/grant 없음
- [x] Vercel 배포 — `https://wye-studio-home-1ih0pshfp-wye1.vercel.app`, 홈 화면 회차 카드/모집 위젯까지 실제 Supabase 연결 확인됨
- [x] 카카오 로그인 활성화 — 카카오 개발자센터 앱(`우주이스케이프`, ID 1535854, 비즈 앱) 등록, REST API 키/Client Secret 발급, Redirect URI를 Supabase 콜백(`https://jilghhbbtjyybzbgwdhq.supabase.co/auth/v1/callback`)으로 등록, Supabase Auth Provider에 Kakao 연결, `SocialLoginButtons.tsx`에서 `signInWithOAuth({provider:"kakao"})` 호출. 실제 로그인 화면까지 도달 확인.
- [x] 도메인 구매 — `wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료(2026-08-06).
- [x] Resend 도메인 인증 완료 — Cloudflare DNS에 DKIM/SPF(MX+TXT)/DMARC 레코드 4개 추가 후 "Verified" 확인(2026-08-07), Supabase Auth SMTP 발신 주소를 `no-reply@wouldyouescape.com`으로 변경. 이제 임의 이메일로 가입 확인 메일 수신 가능.
- [x] Vercel 커스텀 도메인 연결 — Vercel 프로젝트에 `wouldyouescape.com`(apex, → `www`로 308 리다이렉트) + `www.wouldyouescape.com`(Production) 추가, Cloudflare DNS에 CNAME(둘 다 `8610a2a84068dc1b.vercel-dns-017.com`, 프록시 끔/"DNS 전용") 등록(2026-08-07). 둘 다 "Valid Configuration" 확인, SSL 인증서 자동 발급.
- [x] **Supabase Auth URL Configuration 수정** — 도메인 연결 도중 발견: Site URL이 여태 `http://localhost:3000`이었고 Redirect URLs 허용 목록이 완전히 비어 있었음(즉 이메일 인증 링크·카카오 로그인 완료 후 리다이렉트가 실제로는 localhost로 튈 수 있는 상태였음). Site URL을 `https://wouldyouescape.com`으로, Redirect URLs에 `https://wouldyouescape.com/**` / `https://www.wouldyouescape.com/**` / `https://wye-studio-home-*.vercel.app/**` / `http://localhost:3000/**` 4개를 추가함(2026-08-07).
- [x] **브랜드명 "우주이스케이프"로 통일 + 헤더 BETA 마스코트** (2026-08-09) — 사용자 노출 텍스트 전반(페이지 제목/설명, 홈 문구, 신청 완료 화면 예금주 등)에 남아있던 옛 명칭 "wye studio"를 "우주이스케이프"로 교체(GitHub 저장소명/Vercel 프로젝트명/`package.json` name 등 내부 식별자는 의도적으로 그대로 둠). 휴면 처리된 signup 플로우에 남아있던 "만 19세 미만 거부" 문구/로직도 함께 제거(출생년도 1990~1999 제한으로 대체됐으므로 불필요). 헤더 로고 옆에 마스코트("케이프") 정적 이미지 + 🔨 이모지를 CSS `@keyframes`로 조합해 로고를 망치질하는 애니메이션과 초록색 `BETA` 배지 추가.
- [x] **SEO 기초 작업 완료** (2026-08-10) — `src/app/robots.ts`/`sitemap.ts` 추가(세션 상세 페이지는 Supabase에서 동적으로 끌어옴), `layout.tsx`의 `metadata`에 OpenGraph/Twitter 카드/keywords 보강, `opengraph-image.tsx`로 동적 OG 이미지 생성(마스코트 이미지 + 한글 폰트 서브셋 임베드). Google Search Console에 도메인 속성 등록(Cloudflare DNS TXT 인증, OAuth 자동 연동은 보안상 거부하고 수동 등록) + 사이트맵 제출 완료. 네이버 서치어드바이저도 사이트 등록(HTML meta 태그 인증, `layout.tsx`의 `verification.other`에 반영) + 사이트맵 제출 완료. 색인 반영까지는 며칠~2주 소요 예상, 색인 여부는 `site:wouldyouescape.com` 검색이나 각 콘솔의 URL 검사/색인 상태 확인 도구로 확인 가능.
- [x] **참가 신청 시 Slack 알림 + 문자(SMS) 신청확인 발송** (2026-08-10) — `submit_application()` 성공 직후 Next.js `after()`(`next/server`)로 응답을 먼저 돌려주고 백그라운드에서 처리: `src/lib/slack.ts`(`sendApplicationSlackAlert`, Incoming Webhook으로 세션/상태/참여자/접수번호 전송)와 `src/lib/sms.ts`(`sendApplicationConfirmationSms`, Solapi SDK로 대표 신청자에게 접수번호·계좌·환불기한 안내). 둘 다 관련 환경변수(`SLACK_WEBHOOK_URL` / `SOLAPI_API_KEY`·`SOLAPI_API_SECRET`·`SOLAPI_SENDER_NUMBER`)가 없으면 `console.warn`만 남기고 조용히 스킵 — 신청 자체는 절대 실패하지 않음. 필요한 키는 `.env.example`에 문서화.
  - **Slack**: `api.slack.com`에 "Wouldyouescape Notify" 앱을 Blank app으로 생성 → Incoming Webhooks 활성화 → `#apply-notification` 채널로 Webhook 발급 → `.env.local`에 등록. 실제 신청 제출 후 채널에 메시지 도착까지 확인 완료.
  - **SMS(Solapi) — 실제 발송까지 확인 완료** (2026-08-10) — 계정 생성, 제로콜(070-5236-4797, 개인 명의) 발신번호 서류 인증 승인, 잔액 충전까지 마치고 실제 신청 폼 제출로 라이브 테스트 진행. Solapi API(`getMessages`)로 발송 결과를 직접 조회해 `status: "COMPLETE"`, `reason: "수신 완료"`로 실제 수신까지 확인됨. 카카오 알림톡(번호 노출 없음)도 검토했으나 사업자등록번호 없이는 카카오 "비즈니스 채널" 인증이 안 돼 알림톡 발송이 막힘을 확인 — 사업자등록 이후 재검토.
  - **무통장입금 계좌 확정** — 카카오뱅크 3333052843942, 예금주는 개인 명의라 보안상 "김*온"으로 마스킹 표시(`src/lib/bankAccount.ts`). 신청 완료 화면(`ApplyComplete.tsx`)의 "준비 중" 플레이스홀더를 실제 값으로 교체.
  - **신청 완료 화면(`ApplyComplete.tsx`) 보강** — 참여자 명단에 전화번호 추가, 그룹/단독에 따라 "대표 신청자"/"신청자" 문구로 문자 발송 보조 안내 추가, 환불 기한(행사 전날, `formatRefundDeadline()`)을 명확한 문구로 표시. SMS가 아직 연동 전이라 계좌 정보는 화면에서 제거하지 않고 그대로 유지(화면이 유일한 신뢰 가능 정보원).
  - 문자 알림 3단계(신청확인→입금확인→참가확정) 중 **1단계만 구현** — 2·3단계는 각각 Database Webhook/Cron이 필요한 별도 작업으로 남음("향후 추가 예정" 참고).
- [x] **네비게이션 4개 메뉴 재편 + 소개팅 성비 분리 신청 로직** (2026-08-10) — 헤더 네비를 About/Contents/Check(=`/lookup`, 라벨만 영문화)/Notice 4개로 재편(`/about`·`/contents`·`/notice` 신규 페이지 추가, `sitemap.ts`에 3개 반영). 처음엔 홈에서 `ConceptCards`/`ProcessSteps`/`FaqPreview`를 각 신규 페이지로 옮기며 중복을 없앴으나, 사용자가 "홈 형태는 원래대로 유지"를 요청해 **홈에도 그대로 남겨두고 About/Contents/Notice에도 같은 컴포넌트를 재사용하는 의도된 중복 구조**로 최종 조정함(`ConceptCards`→`src/components/about/`, `ProcessSteps`→`src/components/contents/`, FAQ 콘텐츠→`src/components/notice/FaqSection.tsx`로 파일 위치만 옮기고 홈/About/Contents/Notice 각각에서 import해서 씀). "홈" 메뉴 항목은 로고 클릭이 이미 홈으로 가서 넣지 않음. 소개팅 회차는 성비를 맞춰야 해서 그룹 신청을 막고 1인+성별 필수 신청으로 전환, 남/여 각각 정원 10명씩 독립 판정하도록 `submit_application()`/`get_session_stats()`를 `supabase-schema.sql` v9로 재작성(`sessions.capacity_confirm_line_male/female`, `application_attendees.gender` 컬럼 추가). 정원이 다 안 찼을 때 성비를 깨서 채우는 결정은 자동화하지 않고 운영자 수동 처리로 남겨둠(위 "데이터 모델" 참고). 비소개팅 회차는 기존 그룹 신청 로직 100% 유지.
- [x] **Solapi 신청확인 SMS 실제 발송 검증** (2026-08-10) — 발신번호(제로콜 070-5236-4797) 서류 인증 승인 + 잔액 충전 완료 후, 실제 신청 폼으로 라이브 테스트 진행(비소개팅 회차, 접수번호 810751). Solapi SDK의 `getMessages()`로 발송 이력을 직접 조회해 `status: "COMPLETE"` / `reason: "수신 완료"`를 확인 — 콘솔 로그에 의존하지 않고 Solapi API 응답 자체로 실수신을 검증하는 방법을 새로 확립함(추후 SMS 관련 이슈 디버깅 시 재사용 가능). 테스트로 만든 신청 데이터는 확인 후 `delete from applications where confirmation_code = '810751'`로 정리 완료.
- [x] **전화번호 세그먼트 입력 + 형식 유효성 검사** (2026-08-11, 팀 테스트 중 발견) — 지금까지 전화번호는 형식 검증이 전혀 없었음(`type="tel"` + `required`뿐). `src/lib/phone.ts` 신설(`isValidPhoneDigits`: 010~019로 시작하는 10~11자리, `formatPhoneDigits`: 화면 표시용 하이픈 포맷). `ApplyForm.tsx`의 전화번호 입력을 하나의 `<Input>`에서 `010 / 0000 / 0000` 세 칸으로 분리(`phone1/phone2/phone3`)해 숫자 외 입력·칸별 자릿수 초과를 애초에 막고, 칸이 다 차면 다음 칸으로 자동 포커스 이동 + 빈 칸에서 백스페이스 시 이전 칸으로 이동까지 구현. 유효성 오류는 폼 하단 텍스트가 아니라 **제출을 한 번 시도한 뒤부터** 문제 있는 칸 자체가 빨간 배경/테두리로 바뀌는 방식으로 변경(기존 전화번호 중복 충돌 표시와 같은 자리에 함께 적용), 통과하면 서버에 보내지도 않고 클라이언트에서 즉시 막음(`actions.ts`의 서버 측 `isValidPhoneDigits` 검사는 방어용으로 그대로 유지). 부수 효과: 이제 항상 하이픈 없는 순수 숫자만 서버로 전송돼 `hash_phone()` 매칭이 이전보다 일관돼짐(이전엔 사용자가 하이픈을 넣었는지 여부에 따라 같은 번호가 다르게 해시될 수 있었던 잠재 버그가 자연히 해소됨) — `ApplyComplete.tsx`/`LookupForm.tsx`의 전화번호 표시도 `formatPhoneDigits()`로 통일해 하이픈 있는 옛 데이터/순수 숫자 신규 데이터 둘 다 안전하게 포맷.
- [x] **페이지별 콘텐츠 보강** (2026-08-11) — "안에 뭐가 없다"는 피드백으로 프립/문토 실제 사이트를 참고해 화면설계 아티팩트를 먼저 만들고(개요/우선순위/필요한 준비물 포함), 승인 후 사진·브랜드 스토리처럼 실제 자료가 필요한 항목만 "준비 중" 자리로 남겨두고 나머지를 전부 구현함.
  - **세션 상세**(`/sessions/[id]`, 최우선) — 포함사항 칩, 진행 순서(회차 시각 기반 4단계, 번호 매김), 시각적 FAQ(테마별 분기 — 소개팅은 "대기 중인데 정원이 안 차면?", 비소개팅은 "혼자 신청해도 되나요?"), About 연결 카드, "아직 등록된 후기가 없어요" 정직한 빈 상태 추가. 대표 이미지는 실사진이 없어 기존 플레이스홀더 유지.
  - **홈**(`/`) — 히어로에 암호화 안내 마이크로카피, "이런 분들께 추천해요" 타겟 페르소나 칩(`PersonaChips.tsx` 신규), "이런 공간에서 진행돼요" 공간 사진 플레이스홀더(`SpacePreview.tsx` 신규, 사진 없어 준비 중), 진행 방식 각 단계에 소요/시점 설명 추가(`ProcessSteps.tsx`, Contents와 공유), About 연결 카드, FAQ 2건 추가(혼자 신청/환불 규정), 마감 전 CTA 배너.
  - **About**(`/about`) — 마스코트("케이프") 소개, 운영 원칙 카드 3개(무알코올·PII 암호화·성비 관리 — 전부 이미 구현된 사실만 노출), Footer에 묻혀 있던 사업자 정보를 별도 카드로 분리. 브랜드 스토리는 실제 창업 계기 문구가 없어 "준비 중" 유지(지어내지 않음).
  - **Contents**(`/contents`) — 인트로 문장, 다음 시즌 예고 카드. `SessionCard.tsx`(홈 히어로와 공유)에 포함사항 태그 2개 추가.
  - **Notice**(`/notice`) — 실제 공지 2건 등록("베타 오픈 안내", "8/22 신청 접수 중") — `NOTICES` 빈 배열 상태 해소.
  - **신청 폼 / Check** — 각각 암호화 안내 마이크로카피, 접수번호 안내 문구 한 줄만 추가(기능은 이미 충분).
  - **소개팅 세션 대표 이미지** (2026-08-11 추가) — 사용자가 방탈출 테마 "바-오" 홍보용 zip(14장)을 전달했으나, 확인해보니 실제 우리 콘텐츠가 아니라 소개팅 모집 카드뉴스 **디자인 템플릿**이었음(호스트명 "윤월"/지역 "미리시" 등 placeholder, 모집인원·보증금·타임테이블도 우리 실제 정책과 다름, 마지막 장은 "페이지 내 인물 사진은 샘플이미지입니다"라고 명시된 스톡 사진). 정보성 슬라이드(모집조건/타임테이블/FAQ/샘플 커플사진)는 실제 사이트에 올리면 잘못된 정보를 노출하는 셈이라 전부 제외하고, 텍스트 오버레이 없는 순수 타이틀 아트웍(1번, `public/bar-o-title.png`)만 소개팅(`theme_label==='소개팅'`) 세션 상세의 대표 이미지 자리에 사용 — "테마 아트웍 이미지 · 실제 진행 공간은 회차마다 달라질 수 있어요" 캡션을 붙여 실제 장소 사진이 아님을 명시. 비소개팅 세션은 기존 "대표 이미지 준비 중" 플레이스홀더 그대로.
- **홈페이지 히어로 + 스크롤텔링 전면 재작업** (2026-08-11, 여러 라운드에 걸쳐 진행, 이 커밋에서 일괄 반영) — 기존 "히어로 확대 후 아래로 릴리즈" 방식을 걷어내고, 스크롤에 따라 씬이 전환되는 연출로 교체:
  - **`ScrollStage`/`ScrollStageContext` 씬 구조**(`src/components/home/scroll-stage/`) — 각 씬(`HeroScene`/`SessionScene`/`ConceptScene`/`ProcessScene`/`ClosingScene`)이 `useScene(index, total, range)`로 자기 구간의 로컬 진행률(0~1)을 받고, `SceneShell`이 그걸 실제 화면 효과로 변환. 씬마다 **`weight` prop**(기본 1)으로 스크롤 구간 길이를 다르게 줄 수 있음 — 예: `<SessionScene weight={2.5}>`처럼 특정 씬만 스크롤을 훨씬 더 길게 차지하게 함. 씬 경계 겹침(크로스페이드) 폭은 `unitSpan`(weight=1 기준 폭) 기준으로 고정 계산해서, 큰 weight를 받은 씬이 있어도 다른 씬들의 전환 타이밍이 밀리지 않도록 함(안 그러면 weight 큰 씬의 여유 구간까지 겹침으로 잡혀서 다음 씬이 너무 일찍 겹쳐 보이는 버그가 있었음 — 실제로 겪고 고침).
  - **`SceneShell`의 `variant`** — 기본 `"fade"`(opacity+clip-path+blur+scale, 기존 방식 그대로, 히어로/컨셉/진행방식/마무리 씬이 사용)와 새 `"rise"`(회차 카드 씬 전용) 두 가지. `rise`는 진입(아래→제자리, 슬라이드)·줌인(제자리 고정+확대)·순수 hold(그대로 고정)·줌아웃(제자리 고정+축소)·이탈(제자리→위, 슬라이드) 5단계로 구성되고, 진입/이탈 폭과 속도를 대칭으로 맞춤. opacity 페이드를 안 쓰고 실제 위치 이동(translateY, 퍼센트 단위로 자기 높이 기준)만으로 리빌하기 때문에 카드가 화면 아래에서 물리적으로 솟아오르는 것처럼 보임(overflow-hidden인 sticky 뷰포트가 자연스럽게 클리핑해줌).
  - **마스코트 궤도**(`src/components/space/MascotOrbit.tsx`) — 히어로 중앙 텍스트 주위를 3개 마스코트(우쥬/이스/케이프)가 `requestAnimationFrame` 루프로 원형 궤도 회전. 커서가 셋 중 아무거나에 가까워지면 궤도 전체가 공유 속도로 같이 느려짐(개별 반응 아님). 마스코트를 클릭하면 `MascotSelectionContext`(전역, `useSyncExternalStore`+`localStorage`)에 저장되고, 사이트 전역 커스텀 커서(`MascotCursor.tsx`)가 그 마스코트로 즉시 바뀌며 새로고침/페이지 이동해도 유지됨. 히어로 스크롤 exit 시 마스코트 페이드아웃은 로고/텍스트와 **정확히 같은 타이밍**(`SceneShell`의 exit 구간 0.7~1)을 쓰도록 맞춤 — 예전엔 마스코트가 로고보다 훨씬 먼저 사라지는 버그가 있었음.
  - **마스코트 정체성 버그**: `mascot-woodju.png`/`mascot-kape-hero.png` 파일명이 처음부터 서로 뒤바뀌어 있었음(woodju.png가 실제로는 케이프의 검은 블롭, kape-hero.png가 실제로는 우쥬의 파란 구름). `src/lib/mascots.ts`에서 매핑만 바로잡고 파일 자체는 리네임 안 함(다른 곳에서 참조 중이라). 커서 전용으로 사용자가 새로 준 cutout 이미지들(`mascot-{woodju,is,kape}-cursor.png`)을 별도로 추가함. **2026-08-11 저녁**: 이스(is) 캐릭터 디자인 자체가 교체됨(파란 혜성 → 빨간 혜성, 정사각 1:1 비율로 변경) — `mascot-is.png`/`mascot-is-cursor.png` 덮어쓰고 `mascots.ts`의 `orbitHeight`/`cursorWidth`/`cursorHeight`도 새 비율에 맞게 수정. **주의**: 같은 파일명으로 이미지만 덮어쓰면 Next.js 15/16 dev 서버(Turbopack)가 이전 버전을 계속 캐싱해서 안 바뀐 것처럼 보일 수 있음 — `.next` 전체를 지우고 dev 서버를 재시작해야 확실히 반영됨(단순 `.next/cache/images` 삭제로는 부족했음, 실제로 겪음).
  - **헤더 완전 투명화** — 마스코트 궤도가 히어로 상단(헤더 영역)까지 올라오는데 헤더가 불투명해서 마스코트 머리가 잘리는 문제가 있었음. `Header.tsx`에서 배경색(`bg-background/80`)·보더·블러(`backdrop-blur-md`, 이후 시도한 `-sm`도 결국)를 전부 제거해서 완전 투명하게 만듦 — 로고/메뉴 글자만 떠 있고 바(bar) 자체가 안 보임. **트레이드오프**: 다른 페이지(About/Contents 등)에서 스크롤되는 본문 텍스트가 이제 메뉴 글자 위로 블러 없이 겹쳐 보일 수 있음 — 아직 리포트된 문제는 없지만, 나중에 가독성 이슈로 지적되면 홈만 투명 헤더를 쓰고 다른 페이지는 블러 있는 헤더로 분리하는 걸 고려할 것.
  - **헤더 높이만큼의 "빈 스크롤" 구간 제거** — 헤더가 `sticky top-0`이지만 문서 흐름에서 실제 높이(~61px)를 차지해서, 히어로의 sticky 뷰포트가 그만큼 먼저 스크롤을 통과해야 고정되기 시작했음(그동안 히어로 전체가 일반 콘텐츠처럼 슬쩍 밀려 올라가 보임). `Header.tsx`를 client 컴포넌트로 바꿔 `ResizeObserver`로 실제 높이를 재서 `--header-height` CSS 변수로 노출하고, `ScrollStage.tsx`의 래퍼에 `margin-top: calc(-1 * var(--header-height))`를 줘서 첫 스크롤 픽셀부터 바로 고정+연출이 시작되도록 함.
  - **React Compiler 린트 규칙 관련**: 이번 작업 중 `react-hooks/refs`(렌더 중 ref 재할당 금지)와 `react-hooks/immutability`(렌더 중 클로저 변수 재할당 금지) 두 개를 새로 만났음 — 렌더 바디에서 `let cumulative` 같은 변수를 `.map()` 콜백 안에서 재할당하면 걸림. 사전에 별도 배열로 값을 다 계산해두고 map 콜백은 읽기만 하도록 고쳐서 해결. `useRef`를 최신값으로 동기화할 때도 렌더 중이 아니라 `useEffect` 안에서 할당해야 함.
  - 회차 카드 씬(`SessionScene.tsx`)은 이번 라운드에서 좌측 텍스트/페르소나 칩 컬럼을 없애고 카드 2개만 화면 중앙에 크게 배치하도록 단순화됨(2열 고정, `SessionCard.tsx`도 세로로 긴 카드가 되도록 `min-h`/`justify-between` 추가).
  - 관련 파일: `src/components/home/scroll-stage/{ScrollStage,ScrollStageContext,SceneShell}.tsx`, `src/components/home/scenes/{Hero,Session,Concept,Process,Closing}Scene.tsx`, `src/components/space/{MascotOrbit,MascotCursor,MascotSelectionContext,useScrollStageProgress}.tsx`, `src/lib/mascots.ts`, `src/components/layout/Header.tsx`, `src/app/page.tsx`.
  - **다음에 이어서 할 만한 것**: 지금까지는 전부 "일단 이 정도면 괜찮다"는 반응까지만 확인된 상태 — 회차 카드 씬의 좌측 텍스트를 없앤 뒤라 카피(설명 문구) 없이 카드만 있는 게 정보량이 부족하진 않은지, 컨셉/진행방식/마무리 씬은 여전히 옛날 fade 방식이라 히어로→회차 구간과 톤이 안 맞는 느낌이 있는지 정도는 다음에 실제로 다시 보면서 판단하면 좋을 듯. 헤더 투명화의 다른 페이지 가독성 트레이드오프도 다음 세션에 체크해볼 것.
- [x] **GTM/GA4 애널리틱스 연동** (2026-08-11~12) — 페이지뷰 + "신청 시작"/"신청 완료"(대표 신청자 출생년도/성별 포함) 이벤트를 GA4로 전송, GA4 맞춤 정의(테마명/접수번호/출생년도/성별) 등록까지 완료. 컨테이너/속성 ID, 태그·트리거·변수 구성, 새 이벤트 추가 시 체크리스트는 `ANALYTICS.md` 참고.
- [x] **테마 리브랜딩 + 8/29 일정·가격 변경 + 회차 카드 전면 재디자인** (2026-08-12) — `supabase-schema.sql` v10.
  - **리브랜딩/일정/가격**: `theme_label`을 '소개팅'/'비소개팅' → **"바-ㅇ탈출(ver.소개팅)"/"바-ㅇ탈출(ver.모임)"**으로 변경(오타 아님, 의도된 표기 — 사용자 확정). 이 값이 `submit_application()`(그룹신청 제한/성별필수/성비분리 정원 분기) 등 여러 곳에서 리터럴 비교되고 있어서, TS 쪽은 `src/lib/theme.ts`의 `isDatingTheme()` 헬퍼로 비교를 한 곳에 모으고(값이 또 바뀌어도 한 군데만 고치면 되게), SQL 쪽은 `submit_application()`을 새 값으로 `create or replace`. 날짜 8/22→**8/29**로 변경, 가격은 정가(모임 65,000원/소개팅 75,000원) 대비 **8/29 베타 한정 할인**(모임 45,000원/소개팅 55,000원, `SessionCard.tsx`에서 `price_krw + 20,000`로 정가를 계산해 취소선 표시 — 정가 자체는 DB에 안 둠). `venue_area`도 "서울 신림권" → "서울 신림역 인근"으로 수정. **DB 값 변경(UPDATE 2건)은 Supabase SQL Editor에서 직접 실행 완료** — `sessions` 테이블엔 `service_role`도 update grant가 없어서(의도된 보안 설정, 위 "중요한 교훈" 참고) 스크립트로 못 돌리고 브라우저로 Supabase 대시보드 SQL Editor에 직접 접속해서 실행함.
  - **회차 카드 디자인**: `SessionCard.tsx`를 신청현황/진행바/모집중 뱃지 없이 테마명(색은 `hud-panel-group`=초록/`hud-panel-dating`=핑크 네온, `isDatingTheme()`로 분기) + 날짜/시작시간/플레이타임/장소(라벨-값 쌍 반복, `SessionCardField`) + 가격(정가 취소선+할인가)만 남기는 걸로 재구성. 각진 유리질감 SF 패널(`globals.css`의 `.hud-panel`/`.hud-clip`, 우측 상하단 모서리만 대각선으로 깎음, `--hud-accent` 커스텀 프로퍼티로 테마별 색 주입) + 호버 시 확장하는 배경 글로우. `SessionScene.tsx`(홈)도 `grid-cols-1 sm:grid-cols-2`로 모바일 반응형 추가(예전엔 `grid-cols-2` 고정이라 모바일에서 카드가 다 찌그러졌었음).
  - **모바일 버그 3종**: ① `ScrollStage.tsx`의 씬 컨테이너가 `h-screen`(100vh)이라 모바일 브라우저 주소창이 떠 있을 때 실제 보이는 영역보다 콘텐츠가 밀려 보이던 문제 → **`h-dvh`(동적 뷰포트 높이)로 교체**. ② `Header.tsx`의 로고 옆 브랜드 텍스트("우주이스케이프")가 좁은 화면에서 단어 중간에 줄바꿈되던 버그 → `whitespace-nowrap` + 로고 클러스터 `shrink-0`, 망치질 마스코트는 공간 확보를 위해 모바일에서만 숨김(`hidden sm:block`). ③ 마스코트 커스텀 커서(`MascotCursor.tsx`)가 링크/버튼 위에서 브라우저 기본 손 커서와 같이 보이던 문제 — `<a href>`는 브라우저 기본 스타일시트가 그 요소에 직접 `cursor:pointer`를 지정해서 body의 `cursor:none` 상속보다 우선순위가 높았음(단순히 Tailwind `cursor-pointer` 클래스를 지우는 것만으론 해결 안 됐던 부분). `MascotCursor` 활성화 시 `<html>`에 `custom-cursor-active` 클래스를 붙이고 `globals.css`에서 그 클래스가 있을 때 `a`/`button`/`input` 등을 직접 겨냥해 `cursor:none`을 걸도록 수정 — `getComputedStyle`로 실제 계산된 커서 값이 `"none"`인 것까지 확인함. 추가로 클릭 가능한 요소 위에서는 마스코트 커서 자체도 30% 투명도로 옅어지도록 함(호버 애니메이션이 커서에 가려 안 보이던 문제 해결).
  - **헤더 메뉴 글자 스왑 호버 효과**: `motion`(옛 Framer Motion) 패키지 신규 설치, `RandomLetterSwap` 컴포넌트(`src/components/ui/RandomLetterSwap.tsx`) 신규 제작 — 헤더 4개 메뉴 글자가 호버 시 무작위 순서로 스태거되며 롤업 애니메이션. 21st.dev 커뮤니티 컴포넌트(`m-random-letter-swap-1`)를 참고했으나 핵심 로직 소스는 안 보여줘서 실제 사이트에서 호버 동작을 관찰하고 직접 구현.
  - **히어로 CTA 버튼("YES")**: `src/components/home/HeroCtaButton.tsx` 신규 — "would you escape?" 바로 아래, 클릭 시 `/contents`로 이동. 기본 상태는 테두리 없이 우상단(ㄱ)/좌하단(ㄴ) 브래킷 없이 텍스트만(여러 라운드 끝에 브래킷도 뺌) 떠 있다가, 호버 시 커서가 들어온 지점에서 흰 원이 퍼지며(`--origin-x/y` CSS 커스텀 프로퍼티, `globals.css`의 `.hero-cta-fill`) 그 사각형 클리핑 영역이 자연스럽게 완전한 네모로 채워지고 텍스트도 "YES" → "참여하기"로 크로스페이드(21st.dev "Origin Button" 참고). ">" 표시는 폰트에 기대지 않도록 정사각형 45도 회전(`.hero-cta-arrow`)으로 그림. 기본 라벨은 왼쪽 패딩 30px/오른쪽 42px(합 72px 고정)로 왼쪽에 붙어있고, 호버 라벨("참여하기")은 `absolute inset-0 flex justify-center`로 기본 라벨과 독립적으로 버튼 정중앙에 옴.
  - **관련 파일**: `src/lib/theme.ts`(신규), `src/components/home/{SessionCard,HeroCtaButton}.tsx`, `src/components/home/scenes/{SessionScene,HeroScene}.tsx`, `src/components/home/scroll-stage/ScrollStage.tsx`, `src/components/layout/Header.tsx`, `src/components/space/{MascotCursor,MascotOrbit}.tsx`, `src/components/ui/RandomLetterSwap.tsx`(신규), `src/lib/format.ts`(`formatSessionTime`/`formatDuration` 추가), `src/app/globals.css`, `supabase-schema.sql`(v10).
  - **다음에 이어서 할 만한 것**: 회차 카드의 호버 애니메이션(테두리가 도는 효과)은 여러 번 시도했지만 사용자가 원하는 정확한 느낌을 못 맞춰서 보류 상태 — 사용자가 직접 레퍼런스를 더 찾아본 뒤 재논의 예정. `RandomLetterSwap`도 21st.dev 원본 소스를 못 보고 관찰만으로 재현한 거라, 실제 라이브러리 소스가 확보되면 비교해볼 것.
- [x] **유리 네온 카드 디자인 통일 + About 환경변수 제어** (2026-08-12) — `supabase-schema.sql` v10 이후 About/Contents/Notice/Check/상세 페이지까지 스크롤할수록 톤이 떨어지는 문제가 있었음(히어로/네비/배경은 네온 파장감 → 나머지 콘텐츠는 평범한 glass-panel). 네온 그라디언트→단색 미니멀→종이 문서 컨셉 등 여러 시행착오를 거쳐, 회차 카드가 이미 쓰던 유리+네온 `hud-panel` 언어로 최종 수렴. `HudCard`/`SectionHeading`/`HudPlaceholder`/`FaqAccordion`/`Reveal` 공용 컴포넌트 신설, 호버 시 대각선 하이라이트가 카드를 훑고 지나가는 스윕 애니메이션 추가. About 페이지는 배포 환경에서는 `NEXT_PUBLIC_ABOUT_ENABLED` 환경변수 없을 시 404로 폐쇄, 헤더 링크도 조건부로 숨김 — 로컬에서는 계속 개발 가능.
- [x] **신청 폼 UX 개선 + v12 신청 확정/대기 로직 전면 재설계** (2026-08-13) — 다섯 가지 큰 변경:
  - **신청 폼**: 성별/경험 select 드롭다운을 토글 버튼 그룹으로 전환(`ButttonGroup.tsx`), 페이지 헤더를 `[ThemeTag] 바-ㅇ탈출 8/29(토)·12:30` 순서로 재배치(`ThemeTag` 신규), 브라우저 기본 검증 팝업 제거(`<form noValidate>`), 약관 미동의 시 체크박스 바로 아래 오류 표시, 모바일 헤더만 불투명화, `supabase-schema.sql` alter 문을 `if not exists`로 멱등화. 경험 횟수를 선택사항으로 변경(필수 검사 제거).
  - **v12 DB 스키마**: 정원/확정 로직 완전 재설계 — 모임은 24명까지 즉시확정/50명까지 대기/50명 초과 거부, 소개팅은 성별 각 12명 확정/각 30명까지 대기/초과 거부. 자동 승격 로직 완전 삭제(대기자는 영구 대기, 운영자 수동 처리만). 테마 상호배타를 테마 불문 1인 1활성신청으로 강화. `waiting_number` 신설(대기자 대기 순번), `applications`에 SMS 중복발송 방지 마커 컬럼 추가(`confirmation_sms_sent_at` 등).
  - **SMS 3단계 함수**: `sendApplicationConfirmationSms`(신청확인, **현재 비활성**)·`sendPaymentConfirmedSms`(입금확인)·`sendEventReminderSms`(참가확정 상기) 구현. 1단계는 8/11에 비활성화한 상태 그대로 유지, 2·3단계는 아래 어드민/크론 페이지에서 실제 호출함.
  - **어드민 페이지** (`/admin-x7f9k2m3/**`, `proxy.ts`에서 `ADMIN_PATH`로 보호): 비밀번호 입력(`/admin-x7f9k2m3/login`, `ADMIN_PASSWORD` 환경변수) 후 쿠키(`admin_auth`, 24시간) 발급. 대시보드(`/admin-x7f9k2m3`)에서 세션 목록 조회, `/admin-x7f9k2m3/sessions/[id]`에서 신청자 목록 + 입금확인 버튼(클릭 시 `payment_status` 업데이트 + `sendPaymentConfirmedSms` 발송).
  - **크론 API** (`/api/cron/reminder`, `CRON_SECRET` 토큰 인증): 24시간 이내 시작하는 확정 신청 조회 후, `reminder_sms_sent_at` null인 대표 신청자에게 `sendEventReminderSms` 발송. 외부 크론 서비스(cron-job.org 등)에서 매 5~15분 호출 설정 필요.
  - **프론트엔드 waiting_number/정원마감 반영**: 정원 숫자 자체 노출 제거(`CapacityPolicyTable` 삭제), 대기자에게 "대기번호 N번" 표시, 자동 승격 안내 문구 제거, `"정원마감:"` 에러 감지해 `state.closed`로 구분. `state.closed`/`session.status==='closed'`일 때 폼을 숨기고 마감 안내만 표시, 소개팅 성별 마감(`male_closed`/`female_closed`) 시 해당 성별 선택지 비활성화("(마감)" 텍스트 추가). v9 시절의 "성비 맞추기 위해 10명씩 즉시확정" 안내 문구 삭제(v12 수치 12명과 안 맞아서).
  - **모바일 히어로 마스코트 자유 이동** (`MascotFreeRoam`): 데스크톱은 기존 궤도 회전(`MascotOrbit`) 유지, 모바일에서만 세 마스코트가 화면을 자유롭게 걸어 다니며 드래그/던지기 가능한 물리 시뮬레이션으로 분기(`HeroScene.tsx`, `useIsMobileViewport()` 판정). 콘텐츠 박스 회피 샘플링, 충돌 감지, `requestAnimationFrame` 루프로 구현. 초기 구현 중 `sampleAvoidingContent` 함수를 `measure()`보다 늦게 선언해서 모바일 전용 TDZ 런타임 에러 발생 → 함수 선언 순서 재조정으로 수정(메모리 `mascot_tdz_fix.md` 참고).

# 화면 / 라우팅 구조

헤더 네비게이션은 **About / Contents / Check / Notice** 4개 메뉴로 구성(2026-08-10 재편, 로고 클릭이 이미 홈으로 가서 "홈" 메뉴는 따로 안 둠):

```
/                          홈 — Hero(회차 카드) + ConceptCards + ProcessSteps + FaqSection, 기존 형태 그대로 유지(사용자 요청)
/about                     About — 브랜드/회사 소개(ConceptCards, 회사 소개 문구는 아직 "준비 중") — 홈에도 동일 컴포넌트가 중복 노출됨(의도됨), NEXT_PUBLIC_ABOUT_ENABLED 환경변수로 배포 시 폐쇄
/contents                  Contents — 진행 방식(ProcessSteps) + 회차 카드 그리드(회차 상품 목록 허브) — 홈에도 동일 컴포넌트가 중복 노출됨(의도됨)
/sessions/[id]             상품 소개 상세 (누구나 조회 가능, URL은 그대로 — SEO 색인 유지 목적으로 안 바꿈)
/sessions/[id]/apply       참가 신청 폼 (로그인 불필요. 비소개팅은 인원 선택+그룹 신청, 소개팅은 1인+성별 선택만)
/lookup                    Check(참여내역 조회) — 전화번호 + 접수번호로 신청 내역 확인. 네비 라벨만 영문화, URL은 유지
/notice                    Notice — 공지사항(NoticeSection, 아직 빈 배열) + FAQ(FaqSection) 한 페이지에 통합 — 홈에도 FaqSection이 동일하게 중복 노출됨(의도됨)
/admin-x7f9k2m3/login      어드민 로그인 — 비밀번호 입력 (ADMIN_PASSWORD 환경변수), 성공 시 admin_auth 쿠키 발급(24시간, httpOnly)
/admin-x7f9k2m3            어드민 대시보드 — 세션 목록 (상태/정원/확정·대기 인원 표시), proxy.ts에서 ADMIN_PATH로 보호
/admin-x7f9k2m3/sessions/[id]  세션별 신청자 목록 (대표 신청자 표시, 상태 필터) + 입금확인 버튼 (payment_status 업데이트 + SMS 발송)
/api/cron/reminder         크론 전용 API — CRON_SECRET 토큰 인증, 24시간 이내 시작하는 확정 신청에 대해 대표 신청자에게 참가확정 알림 SMS 발송 (reminder_sms_sent_at 기록)

--- 아래는 휴면 처리됨(2026-08-09) — 코드는 남아있지만 어디서도 링크하지 않음 ---
/signup, /signup/check-email, /signup/profile
/login, /login/confirm-link
/account
/auth/**                   (callback, kakao/*, naver/*, oauth/*)
```

# 데이터 모델 (`supabase-schema.sql` 참고, v12)

- **sessions** — 회차(방탈출 테마 목록이 아님). `theme_label`(v10부터 '바-ㅇ탈출(ver.모임)'/'바-ㅇ탈출(ver.소개팅)', 예전 값은 '비소개팅'/'소개팅')이 같은 테마 재참여 방지 기준으로도 쓰임 — 프론트에서 이 값과의 비교는 전부 `src/lib/theme.ts`의 `isDatingTheme()`를 거침(리터럴 문자열을 여러 곳에 흩어두지 않기 위해). v12부터 정원 로직 전면 재설계:
  - **비소개팅**: `capacity_confirm_line`=24(즉시확정), `capacity_max`=50(정원). 참여 인원 합계가 24명 이하면 confirmed, 25~49명은 waiting, 50명 도달 시 신청 거부.
  - **소개팅**: `capacity_confirm_line_male/female`=12(각 성별 즉시확정), `capacity_max_male/female`=30(각 성별 정원), 공통 `capacity_max`=60(전체 총원 상한). 신청한 성별의 인원이 12명 이하면 confirmed, 13~29명은 waiting, 30명 도달 시 그 성별 신청 거부. 60명 도달 시 전체 마감. `male_closed`/`female_closed` 플래그로 성별별 마감 상태 추적.
  - 조회는 전체 공개, 등록/수정 정책 없음 → 시드 SQL/어드민 페이지에서 운영자가 처리.
- **session_venues** — 상호명(`venue_name`) 전용 비공개 테이블. select/insert/update 정책·grant 전혀 없어 `anon`/`authenticated` 둘 다 API로 존재 자체를 알 수 없음. 운영자는 SQL Editor/Table Editor(테이블 소유자 권한이라 RLS 우회)에서만 조회.
- **applications** — 신청 "건"(그룹 단위, 로그인 계정과 무관. 소개팅은 그룹이 항상 1명). `depositor_name_enc`(v8, 암호화됨)/`agreed_terms`/`confirmation_code`/`status`/`payment_status`/`waiting_number`(v12, 대기자 순번, 확정자는 null). 직접 select/insert 정책·grant가 전혀 없음 — 생성은 `submit_application()`, 조회는 `lookup_application()`을 통해서만. v12부터 SMS 중복발송 방지 마커 컬럼 추가: `confirmation_sms_sent_at`(신청확인 SMS)/`payment_confirmed_sms_sent_at`(입금확인 SMS)/`reminder_sms_sent_at`(참가확정 상기 SMS).
- **application_attendees** (v7 신규, v12 강화) — 그룹 신청의 참여자 개개인(대표 신청자 포함 전원 한 행씩). `name_enc`/`phone_enc`(v8, 암호화됨)/`phone_hash`(v8, 매칭 전용 HMAC)/`birth_year`(1990~1999 체크 제약)/`nickname`(선택, 평문)/`is_representative`/`gender`(v9, `'M'|'F'`, 소개팅만 값 있고 비소개팅은 NULL). `unique(session_id, nickname)`으로 같은 회차 내 닉네임 중복만 방지. select/insert 정책 없음 — 완전히 잠김.
- **테마 상호배타 강화** (v12) — 기존 v9/v10은 "같은 테마 재참여만 차단"이었으나, v12부터는 **테마 불문 1인 1활성신청**으로 변경 — 같은 사람이 어떤 테마든 동시에 활성 신청(confirmed 또는 waiting)을 최대 1건만 가질 수 있음. 취소/실패한 신청은 카운트에서 제외됨(`status`가 'cancelled'/'failed'인 행은 무시).
- **waiting_number 신설** (v12) — 대기자(`status='waiting'`)에게만 계산되는 같은 세션/같은 성별 내 대기 순번. 확정자는 null.
- **어드민 뷰 갱신** (v12) — SQL Editor에서만 조회 가능하던 `admin_attendee_view`/`admin_application_view`를 이제 `/admin-x7f9k2m3` 어드민 페이지 UI(로그인 후)에서 세션별 신청자 목록으로 조회 가능. 입금확인 버튼으로 `payment_status` 수정 + `sendPaymentConfirmedSms` 발송도 UI에서 가능. 마감 재오픈은 여전히 SQL 수동 처리(`male_closed`/`female_closed` 리셋, `sessions.status` 리셋).
- **PII 암호화** (v8, 2026-08-09) — 전화번호로 중복/조회를 체크하는 구조라 보안에 더 신경써야 한다는 판단으로, `application_attendees.name/phone`과 `applications.depositor_name`을 평문으로 저장하지 않음. Supabase 디스크 암호화는 관리형으로 이미 자동 적용되지만 그건 "테이블을 직접 읽을 수 있는 사람"(SQL Editor, `service_role` 키 보유자)에게는 방어가 안 됐던 마지막 구멍이었음.
  - 키는 **Supabase Vault**(`vault.create_secret`, pgsodium 기반 — 이 프로젝트에 이미 활성화돼 있었음)에 `app_pii_key`라는 이름으로 저장. `get_pii_key()`(SECURITY DEFINER, `anon`/`authenticated`엔 grant 없음)로만 꺼낼 수 있음.
  - `encrypt_pii(text) returns bytea` / `decrypt_pii(bytea) returns text` — `pgp_sym_encrypt`/`pgp_sym_decrypt` 래퍼. `name_enc`/`phone_enc`/`depositor_name_enc`에 사용.
  - `hash_phone(text) returns text` — HMAC-SHA256 해시(복호화 불가능). 전화번호는 "같은 번호인지" 매칭(동일 테마 재참여 체크, `/lookup` 조회)만 하면 되고 원문을 되돌릴 필요가 없어서, 매칭용 `phone_hash`는 애초에 복호화가 안 되는 해시로 — 복호화 가능한 암호화보다 이쪽이 더 안전함.
  - `admin_attendee_view` / `admin_application_view` — 운영자가 SQL Editor에서 실제 참여자 이름/연락처/입금자명을 확인해야 할 때 쓰는 복호화된 뷰(둘 다 grant 없음, 테이블 소유자 권한으로만 조회 가능. 행사 운영 중 참여자한테 연락해야 하면 `select name, phone from admin_attendee_view where session_id = '...';`처럼 조회).
  - **소개팅 정원 초과 시 수동 확정** — 위 "소개팅 성비 분리 신청 로직" 항목 참고. 행사가 임박했는데 남/여 중 한쪽이 10명을 못 채워 총원 20명에 못 미치면, 성비가 좀 깨지더라도 반대 성별 대기자를 확정시켜 채울지는 운영자가 판단할 일 — `admin_attendee_view`로 대기자를 확인한 뒤 `update applications set status = 'confirmed' where id = '...';`처럼 SQL Editor에서 직접 처리한다(자동 로직 없음, 의도적).
  - **실제 겪은 버그**: `submit_application()`의 반환 타입을 `returns table (id uuid, session_id uuid, status text, ...)`로 바꿨더니, PL/pgSQL이 TABLE의 컬럼명을 함수 본문 안에 자동으로 변수처럼 주입해버려서 본문에서 쓰던 `where id = ...`/`where status = ...`같은 원래 테이블 컬럼 참조가 전부 "column reference is ambiguous" 런타임 에러로 깨짐(생성 시점엔 에러 없이 통과됨 — 호출해야 발견됨). `returns table(...)` 대신 별도 `create type application_result as (...)` composite 타입을 만들어 `returns public.application_result`로 바꿔서 해결 — composite 타입은 이 자동 변수 주입이 없음.
- **submit_application()** (v7 `apply_and_recompute()` 대체, v8에서 암호화, v9에서 소개팅 분기, v12에서 대기 로직 재설계) — SECURITY DEFINER, `anon`+`authenticated` 실행 가능. 참여자 배열(jsonb)을 받아 ①약관 동의 ②(소개팅만) 그룹 크기 1 강제 + 성별 필수 ③출생년도 범위 ④테마 상호배타(전화번호 해시 기준, 모든 참여자 검사) ⑤정원 초과 여부를 순서대로 검증 후 `applications`+`application_attendees`를 한 트랜잭션에 삽입. **그룹 전체가 들어갈 자리가 없으면 신청 자체를 거부**(부분 확정 없음, `"정원마감:"` 접두사 에러로 구분). v12부터 자동 승격 로직 완전 삭제 — 대기자는 영구 대기, 운영자만 수동 처리. `waiting_number` 계산(같은 세션/성별 내 순번).
- **확정 로직 (v12 재설계)**: 비소개팅은 참여 인원이 24명 이하면 confirmed, 25~49명은 waiting, 50명 도달 시 신청 거부. 소개팅은 성별별로 독립 판정 — 신청한 성별 인원이 12명 이하면 confirmed, 13~29명은 waiting, 30명 도달 시 그 성별 거부, 전체 60명 도달 시 마감. **자동 승격 없음** — 모든 성별의 대기자는 영구 대기, 운영자가 수동으로 판정할 때까지. `sessions` row를 `for update`로 잠그고 원자적으로 처리.
- **get_session_stats(session_id)** (v7 재작성, v9에서 성별 카운트, v12에서 대기 구조 유지) — "신청 건수"가 아니라 "참여 인원 합계" 기준으로 confirmed/waiting 카운트 + 성별별 카운트. 비로그인 방문자도 볼 수 있는 공개 집계.
- **lookup_application(phone_digits, confirmation_code)** (v7 신규, v8에서 해시 매칭+복호화 반영, v9-4에서 화면 보강용 필드 추가) — 로그인 없이 참여내역을 조회하려면 전화번호만으로는 프라이버시 문제가 있어(번호를 아는 아무나 조회 가능) 접수번호까지 같이 요구. 어느 값이 틀렸는지는 응답에서 구분 안 함(열거 공격 방지). 접수번호는 처음엔 `WYE-0822-A-001`처럼 날짜/타임슬롯을 담은 형식이었으나, 사용자가 직접 입력하기 번거롭다는 피드백으로 **6자리 숫자**(100000~999999, 중복 시 재생성)로 변경함. v9-4에서는 `/lookup` 조회 결과 화면을 신청 완료 화면(`ApplyComplete.tsx`)과 비슷하게 보여달라는 요청으로 `price_krw`(무통장입금 안내용)와 참여자별 `phone`/`gender`(둘 다 `decrypt_pii`/그대로 반환)를 추가로 내려주도록 재작성. `LookupForm.tsx`도 조회 성공 시 입력 폼(전화번호/접수번호 필드)을 숨기고 결과만 보여주도록 변경, "다른 접수번호로 다시 조회하기" 링크(`<a href="/lookup">` 전체 새로고침으로 폼 상태 초기화)만 남김. "대표 신청자" 라벨은 그룹(참여자 2명 이상)일 때만 표시하도록 `ApplyComplete.tsx`/`LookupForm.tsx`/`ApplyForm.tsx` 전부 수정 — 소개팅은 항상 1인 신청이라 "대표 신청자"라는 말 자체가 안 맞았음(이전엔 인덱스 0번이면 무조건 붙어서 소개팅 1인 신청에도 잘못 표시됐던 버그).
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- **~~profiles / kakao_links / naver_links / find_account_by_email / find_account_by_phone~~** — 휴면 처리된 로그인 시스템이 쓰던 테이블/함수. 삭제하지 않고 스키마에 그대로 남아있음(신청 플로우는 더 이상 참조 안 함).
- **중요한 교훈**: Supabase는 새 테이블을 만들어도 RLS 정책과 별개로 `anon`/`authenticated` 롤에 테이블 자체 권한(GRANT)을 자동으로 주지 않는다. 반대로 `session_venues`/`applications`/`application_attendees`처럼 **의도적으로 막고 싶은 테이블은 grant를 아예 안 주면 된다** — 이게 기본값이라 오히려 안전한 쪽, 모든 접근을 SECURITY DEFINER 함수로만 강제할 수 있다. **이 규칙은 `service_role`에도 그대로 적용된다** — RLS는 우회하지만 테이블 GRANT는 별개라, `naver_links`/`kakao_links`에 명시적으로 grant를 안 줬다가 "permission denied for table" 에러를 겪었고(2026-08-07), 이번 v7 작업 중에도 `applications`/`profiles`/`sessions`에 `service_role` grant가 아예 없어 스크립트로 행 개수조차 못 읽는 걸 재확인함(2026-08-09) — 사이드 이펙트 없는 조사성 쿼리라도 grant가 없으면 막힌다는 걸 잊지 말 것.

# 보안 강화 (2026-08-09)

전화번호로 중복/조회를 체크하는 구조라 개인정보 보호에 더 신경써야 한다는 판단으로 진행:

- **PII 컬럼 암호화** — 위 "데이터 모델" 섹션 참고. `name`/`phone`/`depositor_name` 평문 저장 안 함.
- **`next.config.ts`에 HSTS 헤더 추가** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. 브라우저가 이 도메인엔 앞으로 항상 HTTPS로만 접속하도록 강제(다운그레이드 공격 방지).
- **Supabase Database 설정 > Enforce SSL on incoming connections 활성화** — 직접 Postgres 프로토콜 접속(psql 등)에도 SSL을 강제. 앱은 이미 PostgREST(HTTPS)로만 통신해서 앱 동작엔 영향 없음. **주의**: 이 설정을 바꾸면 Supabase가 DB를 재시작해서 몇 분간 다운타임이 생김 — 실제로 겪음, 향후 이 설정을 다시 건드릴 일이 있으면 미리 공지할 것.
- 이미 기본으로 잘 되어 있던 것(점검만 함): `.env*` gitignore 처리, `service_role` 키가 `src/lib/supabase/admin.ts` 한 곳(`"server-only"`)에서만 쓰임, 쿠키 `httpOnly`/`secure`(프로덕션)/`sameSite: lax`, Vercel/Supabase 전 구간 HTTPS, Supabase 디스크 암호화(관리형 자동), `applications`/`application_attendees` RLS 정책 0개로 API 접근 자체 차단.

# 향후 추가 예정 (설계는 돼 있으나 미구현 또는 부분 구현)

- **문자 알림 3단계** (2026-08-13 상태 업데이트):
  - **1단계(신청확인)**: 코드 완성(`src/lib/sms.ts`, Solapi SDK) + 실수신 검증 완료(2026-08-10), 하지만 **2026-08-11부터 임시 비활성화** — 팀원 테스트 시 반복 신청으로 요금이 계속 나가서 `src/app/sessions/[id]/apply/actions.ts`의 `after()` 블록에서 호출 제거. 재활성화하려면 import 복구 + `Promise.all`에 추가 필요. 코드는 유지 중.
  - **2단계(입금확인)**: 코드 완성(`sendPaymentConfirmedSms` 함수) + 어드민 페이지에서 실제 연동 완료(2026-08-13) — `/admin-x7f9k2m3/sessions/[id]` 입금확인 버튼 클릭 시 `payment_status` 업데이트 + SMS 발송.
  - **3단계(참가확정 상기)**: 코드 완성(`sendEventReminderSms` 함수) + 크론 라우트(`/api/cron/reminder`) 신설(2026-08-13) — 24시간 이내 시작하는 확정 신청자에게 참가확정 + 장소 안내 SMS 발송. 외부 크론 서비스(cron-job.org 등)에서 5~15분 주기로 호출해야 함(아직 실제 등록 미확인).
- **본인인증 검토** (2026-08-11, 팀 테스트 중 발견) — 형식 유효성 검사는 완료(위 "지금까지 완료한 것" 참고). 실제 "본인인증"(번호 소유자 확인)은 두 갈래: (a) PASS/통신사 본인인증(NICE·KCB 등 본인확인기관 계약) — 진짜 본인인증이지만 사업자등록번호 없으면 계약 자체가 불가(카카오싱크/알림톡과 동일한 벽, 사업자등록 이후 재검토), (b) 자체 SMS OTP(Solapi) — 기술적으로는 가능하지만 신청 1건당 1통이 아니라 번호 입력마다 훨씬 자주 나가는 구조라, 이번에 겪은 SMS 요금 사고를 감안하면 재전송 횟수 제한·쿨다운 같은 남용 방지 없이는 더 위험함 — 당장은 보류.
- **이용약관/개인정보처리방침/환불정책 동의 문구 확정** — 아직 실제 약관 내용이 정해지지 않아서 미착수. `ApplyForm`의 체크박스는 지금 "이용약관, 개인정보처리방침, 환불정책에 모두 동의합니다"라는 뭉뚱그린 문구뿐이고 실제 약관 페이지/전문은 없음. 아래 정책 페이지(10~12) 작업과 함께 처리해야 함.
- 04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내(현재는 신청 완료 화면에 간이 버전만 있음), 09 문의하기, 10~12 정책 페이지(이용약관/개인정보처리방침/환불정책) — 07 FAQ/08 공지사항은 `/notice`로 이미 반영됨(2026-08-10).
- Phase 2: PG 결제 연동(필요 시 로그인 시스템 재활성화 검토 — 휴면 처리된 상태, "설계 변경 이력" 참고), 리뷰, 다회차/다지역 카탈로그, 애프터 매칭, 관리자 대시보드, 추천인 코드.

# 앞으로 할 일 (순서대로)

1. **신청확인 SMS 재활성화** — 위 "향후 추가 예정" 참고. 팀원 테스트로 인한 요금 문제가 정리되면(예: 테스트용 발신 차단/별도 환경 분리 등을 먼저 정하고) `actions.ts`에 `sendApplicationConfirmationSms` 호출을 다시 붙일 것. ⚠️ **재활성화 시 실제 문자가 나가는지는 아직 확인 전** — Vercel Production 환경에 SOLAPI 키(`SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER_NUMBER`)가 설정돼 있는지 반드시 검증 후 진행할 것.
2. **어드민 비밀번호/크론 시크릿 환경변수 설정** — 어드민 페이지(`/admin-x7f9k2m3/login`)가 작동하려면 `.env.local`의 `ADMIN_PASSWORD`를 설정해야 하고(현재 비어있어 로그인이 항상 실패), 크론 API(`/api/cron/reminder`)가 작동하려면 `CRON_SECRET`을 설정해야 함(현재 없어 모든 크론 요청이 401). Vercel Production 환경변수에도 모두 등록 필요.
3. **외부 크론 서비스 실제 등록** — `/api/cron/reminder` 라우트는 완성되었지만, cron-job.org 같은 외부 서비스에 실제 등록하지 않아서 참가확정 SMS 3단계가 자동 실행되지 않음. 위 `CRON_SECRET` 설정 후 `https://wouldyouescape.com/api/cron/reminder?token=[CRON_SECRET]`을 5~15분 주기로 호출하도록 등록할 것.
4. **동시성 검증** — Node.js 스크립트(임시, 스크래치패드 작성)로 모임/소개팅 각각 정원 근처까지 동시 신청을 `Promise.all`로 보냄 — 모임은 확정 24건 + 대기 1~26번을 정확히 받는지, 소개팅은 성별 각 12명 확정 + 대기 1~18번을 받는지, 51명 이상/성별 31명 이상은 모두 "정원마감:" 에러로 거부되는지 확인. `waiting_number` 순번이 race condition 없이 정확한지 검증. 테스트 후 생성된 신청 데이터는 `delete from applications where confirmation_code in (...)`로 정리.
5. **카카오 공유 시 메시지 포맷** — Open Graph 메타태그(`og:title`/`og:description`/`og:image`)는 SEO 작업으로 이미 세팅 완료(카카오톡 공유 시 기본 미리보기는 뜸). 카카오 SDK 공유 버튼("카톡으로 공유하기")은 아직 미착수, 필요하면 검토.
6. 네이버 로그인 — 예전엔 "Supabase 기본 미지원(Custom OIDC 필요)"으로 적어뒀지만, 이후 실제로 네이버가 `https://nid.naver.com/.well-known/openid-configuration`에서 표준 OIDC(서명된 id_token, JWKS)를 지원하기 시작한 걸 확인한 적이 있어 예상보다 단순해질 수 있음. 다만 로그인 시스템 자체가 지금 휴면 처리 상태라 우선순위는 낮음, 착수 전 재확인 필요.
7. 04~06, 09~12 나머지 베타 화면 순차 추가(이용약관/환불정책 문구 확정 포함), (나중) PG 결제 연동
8. **(사업자등록 완료 후)** 카카오 간편가입(카카오싱크) 전환 검토, 카카오 알림톡(번호 노출 없는 문자 대안)도 사업자등록 후 재검토 — 아래 "카카오 로그인 관련 결정" 참고
9. **(보류)** 이메일 발송 문구 커스텀화 — 로그인 시스템이 휴면 처리되며 이메일 발송 자체가 당장 불필요해짐. 로그인/PG 결제 연동 등으로 재활성화될 때 재검토.

## 도메인 연결 작업 기록 (2026-08-07, 전부 완료)

`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료(네임서버도 Cloudflare). 아래 3가지 모두 완료됨:

- [x] **Resend 도메인 인증 완료** — Cloudflare DNS에 TXT `resend._domainkey`(DKIM), MX `send`(우선순위 10) + TXT `send`(SPF), TXT `_dmarc`(DMARC) 4개 레코드 추가 → Resend Dashboard(`resend.com/domains`)에서 상태 "Verified" 확인(2026-08-07). Supabase Auth SMTP 발신 주소를 `no-reply@wouldyouescape.com`으로 변경 완료.
- [x] **Vercel 커스텀 도메인 연결 완료** — Vercel Domains에 `wouldyouescape.com`(apex)과 `www.wouldyouescape.com` 추가. apex는 www로 308 리다이렉트, www가 Production에 연결됨. Cloudflare DNS에 CNAME `@`/`www` → `8610a2a84068dc1b.vercel-dns-017.com`(프록시 끔, Vercel 권장사항) 등록 → 둘 다 "Valid Configuration". **이제 `https://wouldyouescape.com`으로 실제 접속 가능.**
- [x] **교차 계정 RLS 재검증 완료** — Supabase Auth Users에서 관리자 권한으로 테스트 계정 2개(`rls-test-a`/`rls-test-b@wouldyouescape.com`, 이메일 인증 없이 auto-confirm) 생성 → 각각 실제 프로덕션 사이트(`wouldyouescape.com`)에서 로그인해 프로필 입력 + 참가 신청까지 완료 → User B 세션의 access token으로 Supabase REST API를 직접 호출(`GET /rest/v1/profiles`, `/applications`, User A의 UUID를 알고 직접 지정해서 조회하는 경우까지 포함)해서 결과가 전부 빈 배열 또는 본인 행만 반환되는 것을 확인(2026-08-07). RLS(`auth.uid() = id` / `auth.uid() = user_id`)가 UI뿐 아니라 API 레벨에서도 타인 데이터 접근을 완전히 차단함을 검증. 테스트 후 두 계정과 연쇄 삭제된 프로필/신청 데이터는 정리 완료(운영 모집 현황 수치에 영향 없음 확인).

# 설계 변경 이력 (요약)

- 최초 계획: 방탈출 테마 목록(`rooms`) + 로그인 신청(`applications`) + 리뷰(`reviews`), auth.uid() 기반 RLS.
- 1차 수정: 화면설계서 기준으로 회원가입 없는 1회성 신청 폼으로 단순화(무회원제) — `sessions`(회차) 개념 도입, `applications`는 이름+연락처로 식별.
- 2차 수정: 참가자 성별·연령을 확실히 확인해야 해서(미성년자 술 제공 방지) **다시 회원제로 전환**. 이메일/비밀번호 로그인을 우선 구현한 뒤, 이후 별도 세션들에서 카카오/네이버 직접 OAuth와 계정 연결(중복 이메일/전화번호 병합) 로직까지 실제로 완성해서 동작시켰음.
- **3차 수정(2026-08-09, 현재)**: **술을 제공하지 않기로 사업 결정이 바뀌면서** 2차 수정의 원래 이유(미성년자 확인)가 사라짐. 동시에 카카오/네이버/이메일 로그인을 통합하는 과정에서 계정 연결·중복 계정·orphan 계정 등 복잡도가 계속 늘어났고, 다른 방탈출 사이트들처럼 "구매 시점에 인적정보를 직접 받는" 방식이 실제 상품(1회성 예약) 대비 훨씬 덜 피곤하다고 판단해 **다시 비회원 구매 플로우로 전환**. 로그인/카카오/네이버 관련 코드(`src/app/{login,signup,auth,account}/**`, `src/lib/{kakao,naver,profile,oauthLink,accountLookup,age}.ts`, DB의 `profiles`/`kakao_links`/`naver_links`/`find_account_by_*`)는 **삭제하지 않고 휴면 처리**만 함 — 결제 연동 등으로 계정이 다시 필요해지면 참고. 이 전환과 함께 그룹 신청(대표자+동행자), 출생년도 1990~1999 제한(상품 특성상 제한이지 법적 제한 아님), 전화번호+접수번호 기반 참여내역 조회(`/lookup`)도 함께 추가함. 신청 폼/DB 재설계는 위 "데이터 모델" 섹션 참고.
- 확정 로직도 초기 "16→20→24 4의 배수 단계식"에서 "1~20명 즉시확정 / 21~23명 대기 / 24명 도달 시 대기자 전원 확정+마감"으로 베타용 단순화한 뒤, 3차 수정에서 그룹 신청을 반영해 "신청 건수" 기준이 아니라 "참여 인원 합계" 기준으로 다시 다듬어짐(위 "데이터 모델" 참고).

# 실제 배포 후 발견해서 고친 버그 (스키마 실행 직후 라이브 테스트에서 발견)

- **테이블 grant 누락**: `profiles`/`sessions`/`applications`에 RLS 정책만 있고 `anon`/`authenticated` 롤에 대한 `grant select/insert/update`가 빠져 있어서 홈 화면부터 "permission denied"로 500 에러가 났음. `supabase-schema.sql`에 grant 문 추가로 해결(위 "중요한 교훈" 참고).
- **이메일 인증 리다이렉트 누락**: `signup/actions.ts`의 `supabase.auth.signUp()`에 `emailRedirectTo`를 안 넘겨서, Confirm email이 켜진 상태에서 인증 링크를 눌러도 `/auth/callback`을 안 거치고 Supabase 기본 Site URL로 튕겨나갔음(로그인도 프로필 생성도 안 됨). `emailRedirectTo: "{origin}/auth/callback?redirect=/"` 추가로 해결.
- **가입 시 입력한 추가정보가 이메일 인증 후 사라지는 문제**: 위 버그를 고치고 나니, Confirm email 경로에서는 가입 폼에 입력한 이름/휴대폰/생년월일/성별이 그냥 버려지고 `/signup/profile`에서 재입력을 요구하는 게 확인됨(사용자 피드백으로 발견). `signUp()`의 `options.data`(=`user_metadata`)에 이 값들을 실어 보내고, `/auth/callback`에서 `createProfileFromSignupMetadata()`(`src/lib/profile.ts`)로 자동으로 `profiles`를 생성하도록 수정 — 이제 재입력 없이 바로 홈으로 이동함. `user_metadata`가 없거나(OAuth 등) 검증 실패 시에만 `/signup/profile`로 폴백.
- **`sessions.venue_name` REST API 노출**: 위 "session_venues" 항목 참고.

# 카카오 로그인 관련 결정 (2026-08-06)

- **Redirect URI 등록 위치**: 카카오 개발자센터에서 헷갈리기 쉬운 부분 — "카카오 로그인 > 일반" 메뉴가 아니라 **[앱] > [플랫폼 키] > REST API 키(Default Rest API Key) 클릭 > "카카오 로그인 리다이렉트 URI"** 항목에 있음.
- **KOE205 (잘못된 요청)**: Supabase의 카카오 연동이 항상 `account_email profile_image profile_nickname` 세 scope를 요청하는데, 카카오 콘솔의 "동의항목"에서 이 세 개가 전부 "사용 안 함"이면 발생. 동의항목을 필수/선택/이용 중 동의 중 하나로 설정해야 해결됨.
- **"이용 중 동의"의 실제 동작**: 카카오 문서상 "로그인 시 동의를 받지 않고 나중에 받는다"고 돼 있지만, 실제로는 로그인 동의 화면에 "선택 동의"와 동일하게 노출됨(문서와 실제 동작이 다름 — 직접 테스트로 확인). 즉 Supabase 기본 연동을 쓰는 한 닉네임/프로필사진 동의 화면을 완전히 숨기는 방법은 없음(사용자가 체크 해제하고 넘어가는 건 가능).
- **KOE006 (앱 관리자 설정 오류)**: Redirect URI 등록값과 실제 요청값이 정확히 일치하지 않으면 발생. 이번 케이스는 등록 시 오타(`calback`, l 하나 누락)가 원인이었음 — 등록할 때 값을 반드시 다시 확인할 것.
- **직접 구현(옵션 B) 검토 후 보류**: 닉네임/프로필사진 동의 자체를 없애려면 Supabase의 기본 카카오 연동을 버리고 직접 OAuth(코드 교환 + `service_role` 키로 세션 생성)를 구현해야 함. 반나절~하루 공수 + 새로운 비밀키 관리 부담 대비 얻는 이득이 적어 보류. 지금은 이메일 필수 동의 + 닉네임/사진 선택 동의(사용자가 거부 가능)로 운영.
- **향후 대안 — 카카오 간편가입(카카오싱크)**: 사업자 정보 등록 + 비즈니스 정보 심사 통과 시, 카카오 로그인만으로 회원가입 완료 + 이름/생년월일/성별까지 카카오에서 받아올 수 있는 기능. `/signup/profile` 재입력 문제를 근본적으로 해결할 잠재력 있음. 우주이스케이프는 아직 사업자등록번호가 없어 **보류 중** — 사업자등록 완료되면 재검토.

@AGENTS.md
@CLAUDE.local.md
@ANALYTICS.md
