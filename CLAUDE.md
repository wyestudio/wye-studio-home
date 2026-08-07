# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(wye studio)의 회원제 예약 사이트. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). 참가자는 성별·연령(만 19세 미만 가입 불가 — 저녁 타임 술 제공) 확인이 필요해 **회원가입 필수**로 운영한다. (참고: 초기 화면설계서 초안은 무회원제였으나 이 요구사항 때문에 회원제로 재변경됨 — 자세한 배경은 이 문서 하단 "설계 변경 이력" 참고.)

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, **public**). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제). ⚠️ private였다가 Vercel Hobby(무료) 플랜으로 배포하기 위해 public으로 전환함(private 조직 저장소는 Vercel Pro 플랜이 필요) — 커밋 히스토리에 비밀키 없음을 확인 후 전환. `.env*`는 `.gitignore`로 계속 제외됨.
- Vercel: **연동 완료**. `wyestudio/wye-studio-home` Import, Vercel Team "WYE"(Hobby), 환경변수 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 완료. 배포 URL: `https://wye-studio-home-1ih0pshfp-wye1.vercel.app` (main 브랜치 push마다 자동 재배포됨). **커스텀 도메인 연결 완료**(`wouldyouescape.com`, 아래 "도메인 관련 진행 상황" 참고).
- 도메인: **`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료**(2026-08-06). 네임서버도 Cloudflare 사용 중.

# 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
- **Supabase (Postgres)** — Firebase(NoSQL) 대신 선택. 신청 관련 관계형 데이터를 다뤄야 하고, 향후 결제 연동 시 서버 사이드 검증이 필요하기 때문. 리전은 **Seoul (Northeast Asia)**.
- Supabase 프로젝트 생성 시 보안 옵션: **Data API ON / Automatically expose new tables OFF / Automatic RLS ON**
- **인증**: Supabase Auth 이메일/비밀번호가 현재 유일하게 동작하는 방식. 카카오/네이버 OAuth는 버튼과 콜백 라우트(`src/app/auth/callback/route.ts`)만 준비돼 있고, 개발자센터 앱 등록·키 발급 전이라 아직 비활성 상태("준비 중" 안내로 처리, `SocialLoginButtons.tsx`).
- **이메일 발송(Confirm email)**: Supabase Auth의 "Confirm email"이 켜져 있어 가입 시 이메일 인증이 실제로 필요함. 기본 내장 메일 발송은 시간당 2건 수준으로 매우 제한적이라 **Resend를 커스텀 SMTP로 연결**해둠. `wouldyouescape.com`을 Resend에 등록하고 Cloudflare DNS에 DKIM(TXT `resend._domainkey`)/SPF(MX+TXT `send`)/DMARC(TXT `_dmarc`) 레코드를 추가해 **도메인 인증 완료(Verified, 2026-08-07)**. Supabase Auth SMTP 발신 주소도 `onboarding@resend.dev` → **`no-reply@wouldyouescape.com`**으로 변경 완료 — 이제 임의의 이메일 주소로 가입 확인 메일 수신 가능. Resend 리전은 Tokyo(ap-northeast-1) — Resend가 서울 리전을 아예 제공하지 않아(제공 리전: 버지니아/아일랜드/상파울루/도쿄) 한국에서 가장 가까운 도쿄가 기본 선택된 것. 스팸 판정은 서버 지역이 아니라 SPF/DKIM/DMARC 인증과 발신 IP 평판(Resend는 내부적으로 AWS SES 사용)으로 결정되므로 리전 자체는 무관.

# 지금까지 완료한 것

- [x] Next.js 16 프로젝트 + Supabase 클라이언트(`src/lib/supabase/{client,server,middleware}.ts`), `src/proxy.ts`
  - 주의: Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌고 export 함수명도 `proxy`로 변경됨. Next.js 관련 코드 작성 전엔 `node_modules/next/dist/docs/`에서 최신 컨벤션 확인할 것(AGENTS.md 참고). `params`/`searchParams`는 Promise이며 `PageProps<'/route'>` 헬퍼 타입을 쓴다.
- [x] `supabase-schema.sql` v4 — Supabase에 실행 완료(테이블/RLS/함수/시드 데이터 전부 반영됨)
- [x] 공통 레이아웃(`Header`/`Footer`), 디자인 토큰(`globals.css`, 브랜드 컬러 `--brand: #5b4bff`)
- [x] 회원가입(`/signup`) — 이메일/비번 + 만 19세 미만 가입 차단(`src/lib/age.ts`). Supabase "Confirm email"이 켜져 있음을 확인 → `/signup/check-email` → 이메일 인증 → `/auth/callback`에서 세션 확립 후 `user_metadata`에 저장해둔 이름/휴대폰/생년월일/성별로 `profiles`를 자동 생성(재입력 불필요) → 홈으로 이동. `user_metadata`가 없거나 검증 실패 시에만 `/signup/profile`로 폴백.
- [x] 로그인(`/login`) — 로그인 성공 시 `profiles` 존재 여부 확인 후 없으면 `/signup/profile`로 유도. `proxy.ts`가 `/sessions/*/apply` 접근을 세션 유무로 가드(비로그인 시 `/login?redirect=...`).
- [x] 홈(`/`) — 회차 카드(오후/저녁) + 실시간 모집 위젯, 상품 소개 상세(`/sessions/[id]`), 참가 신청 폼(`/sessions/[id]/apply`, 로그인·프로필 완료 필수)
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

# 화면 / 라우팅 구조

```
/                          홈 — 오후/저녁 회차 카드, get_session_stats 위젯
/signup                    회원가입 (이메일/비번, 만 19세 차단)
/signup/check-email        이메일 인증 대기 안내
/signup/profile            추가정보 입력(이름/휴대폰/생년월일/성별) — 가입 직후 or 첫 로그인 시 profiles 없으면 이 경로로 유도
/login                     로그인
/auth/callback             OAuth 콜백 (카카오/네이버 키 발급 전까지는 미사용, 라우트만 존재)
/sessions/[id]             상품 소개 상세 (비로그인도 조회 가능)
/sessions/[id]/apply       참가 신청 폼 (로그인 + profiles 완료 필수, proxy.ts가 1차 가드)
```

# 데이터 모델 (`supabase-schema.sql` 참고, v4)

- **profiles** — `auth.users` 확장 1:1 테이블(이름/휴대폰/생년월일/성별). 본인만 select/insert/update 가능.
- **sessions** — 회차(방탈출 테마 목록이 아님). `capacity_min`(16, 참고용) / `capacity_confirm_line`(20) / `capacity_max`(24). 조회는 전체 공개, 등록/수정 정책 없음 → 지금은 시드 SQL(8/22 오후·저녁 2건 포함)/대시보드로 운영자가 직접 입력.
- **session_venues** — 상호명(`venue_name`) 전용 비공개 테이블. `session_id` 1:1, select/insert/update 정책과 grant가 전혀 없어 `anon`/`authenticated` 둘 다 API로 존재 자체를 알 수 없음. 운영자는 SQL Editor/Table Editor(테이블 소유자 권한이라 RLS 우회)에서만 조회. 원래 `sessions.venue_name` 컬럼이었으나 `select using (true)` 정책 때문에 REST API로 상호명이 그대로 노출되는 문제가 있어 분리함.
- **applications** — 참가 신청. `user_id` 기반(로그인 필수), `unique(session_id, user_id)`로 중복신청 방지. **직접 insert 정책이 없다** — 반드시 `apply_and_recompute()` RPC로만 생성됨(클라이언트가 status/confirmation_code를 임의 조작 못 하게 하기 위함). select는 본인 것만.
- **확정 로직(베타 단순화)**: 1~20명은 신청 즉시 무조건 confirmed, 21~23명은 waiting, 24명(정원) 도달 시 waiting 전원 confirmed 전환 + `sessions.status`를 closed로 변경. `apply_and_recompute()`가 `sessions` row를 `for update`로 잠그고 원자적으로 처리(동시 신청 레이스 컨디션 방지), 중복신청은 unique_violation을 잡아 친절한 메시지로 변환.
- **get_session_stats(session_id)** — SECURITY DEFINER 함수. 비로그인 방문자도 볼 수 있는 "신청 N / 목표 20명" 집계만 노출(PII 없음), `applications` 원본은 계속 잠김.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- **중요한 교훈**: Supabase는 새 테이블을 만들어도 RLS 정책과 별개로 `anon`/`authenticated` 롤에 테이블 자체 권한(GRANT)을 자동으로 주지 않는다. `profiles`/`sessions`/`applications` 모두 처음 실행 시 "permission denied"가 나서 각각 `grant select ...`를 추가로 실행해야 했다(`supabase-schema.sql`에 반영됨). 반대로 `session_venues`처럼 **의도적으로 막고 싶은 테이블은 grant를 아예 안 주면 된다** — 이게 기본값이라 오히려 안전한 쪽.

# 향후 추가 예정 (설계는 돼 있으나 미구현)

- **문자 알림 3단계**: 신청확인(즉시, 계좌·입금액 포함) → 입금확인(운영자가 `payment_status`를 confirmed로 바꿀 때, Database Webhook 필요 — 환불불가 시작일=행사 전날 안내 포함) → 참가확정(행사 전날, 시간 기반 Cron 필요, 정확한 장소 최초 공개). SMS 발급사 미선정 상태.
- **소개팅형(저녁) 세션 성비 관리**: `applications ⋈ profiles`로 회차별 성별 집계 가능(스키마 변경 불필요). 아직 화면 없음 — 필요 시 Supabase SQL Editor에서 직접 조회하거나 `get_session_gender_stats()` 함수로 승격.
- 04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내(현재는 신청 완료 화면에 간이 버전만 있음), 07 FAQ, 08 공지사항, 09 문의하기, 10~12 정책 페이지(이용약관/개인정보처리방침/환불정책).
- Phase 2: 카카오/네이버 소셜로그인 실제 활성화, PG 결제 연동, 리뷰, 다회차/다지역 카탈로그, 애프터 매칭, 관리자 대시보드, 추천인 코드.

# 앞으로 할 일 (순서대로)

1. **이메일 발송 문구 커스텀화** — Supabase Auth > Emails > Templates에서 가입 확인/비밀번호 재설정 등 이메일 제목·본문을 wye studio 브랜드 톤의 한국어 문구로 교체. 현재 Supabase 기본 템플릿(영문)일 가능성이 높음 — 실제 내용 확인부터 필요.
2. **구글 검색 노출(SEO)** — "우주이스케이프"/"wouldyouescape" 검색 시 노출되도록 `robots.txt`/`sitemap.xml` 추가, `layout.tsx`의 `metadata`에 Open Graph/키워드 보강, Google Search Console에 도메인 등록 + 사이트맵 제출(필요 시 네이버 서치어드바이저도). 현재 아무 설정도 없는 상태.
3. **카카오 공유 시 메시지 포맷** — 카카오톡 공유(Kakao Link) 시 노출되는 제목/설명/썸네일 이미지 포맷 설정. Open Graph 메타태그(`og:title`/`og:description`/`og:image`) 최소 설정부터, 필요하면 카카오 SDK 공유 버튼까지 검토. 현재 관련 코드 전혀 없음.
4. **참가 신청 시 Slack 알림** — 신청 발생 시 운영자가 바로 알 수 있도록 Slack 채널로 알림 전송. `src/app/sessions/[id]/apply/actions.ts`에서 `apply_and_recompute()` 호출 성공 후 Slack Incoming Webhook을 호출하는 방식이 가장 간단(또는 Supabase Database Webhook으로 `applications` insert 이벤트 감지). 아직 미착수, Slack 워크스페이스/웹훅 URL 준비 필요.
5. 네이버 로그인 — Supabase 기본 미지원(Custom OIDC 필요), 실제 시도 시 추가 작업 필요할 수 있음. 아직 미착수.
6. 04~12 나머지 베타 화면 순차 추가, 문자 알림 파이프라인, 성비 관리, (나중) PG 결제 연동
7. **(사업자등록 완료 후)** 카카오 간편가입(카카오싱크) 전환 검토 — 아래 "카카오 로그인 관련 결정" 참고

## 도메인 연결 작업 기록 (2026-08-07, 전부 완료)

`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료(네임서버도 Cloudflare). 아래 3가지 모두 완료됨:

- [x] **Resend 도메인 인증 완료** — Cloudflare DNS에 TXT `resend._domainkey`(DKIM), MX `send`(우선순위 10) + TXT `send`(SPF), TXT `_dmarc`(DMARC) 4개 레코드 추가 → Resend Dashboard(`resend.com/domains`)에서 상태 "Verified" 확인(2026-08-07). Supabase Auth SMTP 발신 주소를 `no-reply@wouldyouescape.com`으로 변경 완료.
- [x] **Vercel 커스텀 도메인 연결 완료** — Vercel Domains에 `wouldyouescape.com`(apex)과 `www.wouldyouescape.com` 추가. apex는 www로 308 리다이렉트, www가 Production에 연결됨. Cloudflare DNS에 CNAME `@`/`www` → `8610a2a84068dc1b.vercel-dns-017.com`(프록시 끔, Vercel 권장사항) 등록 → 둘 다 "Valid Configuration". **이제 `https://wouldyouescape.com`으로 실제 접속 가능.**
- [x] **교차 계정 RLS 재검증 완료** — Supabase Auth Users에서 관리자 권한으로 테스트 계정 2개(`rls-test-a`/`rls-test-b@wouldyouescape.com`, 이메일 인증 없이 auto-confirm) 생성 → 각각 실제 프로덕션 사이트(`wouldyouescape.com`)에서 로그인해 프로필 입력 + 참가 신청까지 완료 → User B 세션의 access token으로 Supabase REST API를 직접 호출(`GET /rest/v1/profiles`, `/applications`, User A의 UUID를 알고 직접 지정해서 조회하는 경우까지 포함)해서 결과가 전부 빈 배열 또는 본인 행만 반환되는 것을 확인(2026-08-07). RLS(`auth.uid() = id` / `auth.uid() = user_id`)가 UI뿐 아니라 API 레벨에서도 타인 데이터 접근을 완전히 차단함을 검증. 테스트 후 두 계정과 연쇄 삭제된 프로필/신청 데이터는 정리 완료(운영 모집 현황 수치에 영향 없음 확인).

# 설계 변경 이력 (요약)

- 최초 계획: 방탈출 테마 목록(`rooms`) + 로그인 신청(`applications`) + 리뷰(`reviews`), auth.uid() 기반 RLS.
- 1차 수정: 화면설계서 기준으로 회원가입 없는 1회성 신청 폼으로 단순화(무회원제) — `sessions`(회차) 개념 도입, `applications`는 이름+연락처로 식별.
- 2차 수정(현재): 참가자 성별·연령을 확실히 확인해야 해서(미성년자 술 제공 방지) **다시 회원제로 전환**. 카카오/네이버 OAuth로 개인정보를 연동받고 싶어했으나, 앱 등록/심사 리드타임 때문에 이메일/비밀번호를 우선 구현하고 소셜 로그인은 버튼만 준비.
- 확정 로직도 초기 "16→20→24 4의 배수 단계식"에서 "1~20명 즉시확정 / 21~23명 대기 / 24명 도달 시 대기자 전원 확정+마감"으로 베타용 단순화.

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
- **향후 대안 — 카카오 간편가입(카카오싱크)**: 사업자 정보 등록 + 비즈니스 정보 심사 통과 시, 카카오 로그인만으로 회원가입 완료 + 이름/생년월일/성별까지 카카오에서 받아올 수 있는 기능. `/signup/profile` 재입력 문제를 근본적으로 해결할 잠재력 있음. wye studio는 아직 사업자등록번호가 없어 **보류 중** — 사업자등록 완료되면 재검토.

@AGENTS.md
@CLAUDE.local.md
