# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(wye studio)의 **비회원 구매(예약) 사이트**. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). **술을 제공하지 않기로 결정**해 미성년자 확인 필요성이 없어졌고, 회원가입 없이 **신청(구매) 시점에 인적정보(이름/전화번호/출생년도)를 직접 받는 방식**으로 운영한다. 대신 소개팅 상품 특성상 "비슷한 또래끼리 즐기는 게 분위기가 좋다"는 이유로 **출생년도 1990~1999년생 제한**(법적 제한 아님)이 모든 회차 공통으로 있고, 한 사람이 대표로 신청하며 동행자까지 함께 등록하는 **그룹 신청**을 지원한다. 로그인 없이 **전화번호+접수번호로 참여내역 조회**도 가능하다. (로그인/카카오/네이버 시스템은 한때 회원제로 운영하며 만들었던 것으로, 삭제하지 않고 **휴면 처리**만 해둠 — 배경은 이 문서 하단 "설계 변경 이력" 참고.)

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, **public**). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제). ⚠️ private였다가 Vercel Hobby(무료) 플랜으로 배포하기 위해 public으로 전환함(private 조직 저장소는 Vercel Pro 플랜이 필요) — 커밋 히스토리에 비밀키 없음을 확인 후 전환. `.env*`는 `.gitignore`로 계속 제외됨.
- Vercel: **연동 완료**. `wyestudio/wye-studio-home` Import, Vercel Team "WYE"(Hobby), 환경변수 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 완료. 배포 URL: `https://wye-studio-home-1ih0pshfp-wye1.vercel.app` (main 브랜치 push마다 자동 재배포됨). **커스텀 도메인 연결 완료**(`wouldyouescape.com`, 아래 "도메인 관련 진행 상황" 참고).
- 도메인: **`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료**(2026-08-06). 네임서버도 Cloudflare 사용 중.

# 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
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

# 화면 / 라우팅 구조

```
/                          홈 — 오후/저녁 회차 카드, get_session_stats 위젯
/sessions/[id]             상품 소개 상세 (누구나 조회 가능)
/sessions/[id]/apply       참가 신청 폼 (로그인 불필요. 인원 선택 → 대표자+동행자 각각 이름/전화/출생년도/닉네임 입력)
/lookup                    참여내역 조회 — 전화번호 + 접수번호로 신청 내역 확인 (신규, 로그인 불필요)

--- 아래는 휴면 처리됨(2026-08-09) — 코드는 남아있지만 어디서도 링크하지 않음 ---
/signup, /signup/check-email, /signup/profile
/login, /login/confirm-link
/account
/auth/**                   (callback, kakao/*, naver/*, oauth/*)
```

# 데이터 모델 (`supabase-schema.sql` 참고, v8)

- **sessions** — 회차(방탈출 테마 목록이 아님). `theme_label`(예: '비소개팅'/'소개팅')이 같은 테마 재참여 방지 기준으로도 쓰임. `capacity_min`(16, 참고용) / `capacity_confirm_line`(20) / `capacity_max`(24, 이제 "참여 인원 합계" 기준). 조회는 전체 공개, 등록/수정 정책 없음 → 시드 SQL/대시보드로 운영자가 직접 입력.
- **session_venues** — 상호명(`venue_name`) 전용 비공개 테이블. select/insert/update 정책·grant 전혀 없어 `anon`/`authenticated` 둘 다 API로 존재 자체를 알 수 없음. 운영자는 SQL Editor/Table Editor(테이블 소유자 권한이라 RLS 우회)에서만 조회.
- **applications** — 신청 "건"(그룹 단위, 로그인 계정과 무관). `depositor_name_enc`(v8, 암호화됨)/`agreed_terms`/`confirmation_code`/`status`/`payment_status`. 직접 select/insert 정책·grant가 전혀 없음(session_venues와 동일 패턴) — 생성은 `submit_application()`, 조회는 `lookup_application()`을 통해서만.
- **application_attendees** (v7 신규) — 그룹 신청의 참여자 개개인(대표 신청자 포함 전원 한 행씩). `name_enc`/`phone_enc`(v8, 암호화됨)/`phone_hash`(v8, 매칭 전용 HMAC)/`birth_year`(1990~1999 체크 제약)/`nickname`(선택, 평문 — 다른 참여자에게 보여주는 용도라 암호화 대상 아님)/`is_representative`. `unique(session_id, nickname)`로 같은 회차 내 닉네임 중복만 방지(다른 회차는 재사용 가능, Postgres unique는 NULL을 서로 다른 값으로 취급해서 닉네임 미입력자는 제약에 안 걸림). select/insert 정책 없음 — 완전히 잠김.
- **PII 암호화** (v8, 2026-08-09) — 전화번호로 중복/조회를 체크하는 구조라 보안에 더 신경써야 한다는 판단으로, `application_attendees.name/phone`과 `applications.depositor_name`을 평문으로 저장하지 않음. Supabase 디스크 암호화는 관리형으로 이미 자동 적용되지만 그건 "테이블을 직접 읽을 수 있는 사람"(SQL Editor, `service_role` 키 보유자)에게는 방어가 안 됐던 마지막 구멍이었음.
  - 키는 **Supabase Vault**(`vault.create_secret`, pgsodium 기반 — 이 프로젝트에 이미 활성화돼 있었음)에 `app_pii_key`라는 이름으로 저장. `get_pii_key()`(SECURITY DEFINER, `anon`/`authenticated`엔 grant 없음)로만 꺼낼 수 있음.
  - `encrypt_pii(text) returns bytea` / `decrypt_pii(bytea) returns text` — `pgp_sym_encrypt`/`pgp_sym_decrypt` 래퍼. `name_enc`/`phone_enc`/`depositor_name_enc`에 사용.
  - `hash_phone(text) returns text` — HMAC-SHA256 해시(복호화 불가능). 전화번호는 "같은 번호인지" 매칭(동일 테마 재참여 체크, `/lookup` 조회)만 하면 되고 원문을 되돌릴 필요가 없어서, 매칭용 `phone_hash`는 애초에 복호화가 안 되는 해시로 — 복호화 가능한 암호화보다 이쪽이 더 안전함.
  - `admin_attendee_view` / `admin_application_view` — 운영자가 SQL Editor에서 실제 참여자 이름/연락처/입금자명을 확인해야 할 때 쓰는 복호화된 뷰(둘 다 grant 없음, 테이블 소유자 권한으로만 조회 가능. 행사 운영 중 참여자한테 연락해야 하면 `select name, phone from admin_attendee_view where session_id = '...';`처럼 조회).
  - **실제 겪은 버그**: `submit_application()`의 반환 타입을 `returns table (id uuid, session_id uuid, status text, ...)`로 바꿨더니, PL/pgSQL이 TABLE의 컬럼명을 함수 본문 안에 자동으로 변수처럼 주입해버려서 본문에서 쓰던 `where id = ...`/`where status = ...`같은 원래 테이블 컬럼 참조가 전부 "column reference is ambiguous" 런타임 에러로 깨짐(생성 시점엔 에러 없이 통과됨 — 호출해야 발견됨). `returns table(...)` 대신 별도 `create type application_result as (...)` composite 타입을 만들어 `returns public.application_result`로 바꿔서 해결 — composite 타입은 이 자동 변수 주입이 없음.
- **submit_application()** (v7 `apply_and_recompute()` 대체, v8에서 암호화 반영) — SECURITY DEFINER, `anon`+`authenticated` 실행 가능. 참여자 배열(jsonb)을 받아 ①약관 동의 ②출생년도 범위 ③동일 테마 재참여(전화번호 해시 기준, 대표자/동행자 모두 검사) ④정원 초과 여부를 순서대로 검증 후 `applications`+`application_attendees`를 한 트랜잭션에 암호화해서 삽입. **그룹 전체가 들어갈 자리가 없으면 신청 자체를 거부**(부분 확정 없음) — 이 덕분에 총 인원이 `capacity_max`를 절대 못 넘어서 "정원 도달 시 대기자 전원 확정" 로직이 그대로 성립. 반환값의 `depositor_name`은 DB에서 다시 복호화하는 게 아니라 방금 입력받은 평문 파라미터를 그대로 돌려줌(어차피 본인이 방금 친 값).
- **확정 로직(베타 단순화, 그룹 인원 합계 기준)**: 세션 누적 인원이 20명 이하면 그 신청 건은 즉시 confirmed, 넘으면 waiting. 24명(정원) 도달 시 그 회차의 waiting 전원 confirmed 전환 + `sessions.status`를 closed로 변경. `sessions` row를 `for update`로 잠그고 원자적으로 처리.
- **get_session_stats(session_id)** (v7 재작성) — "신청 건수"가 아니라 "참여 인원 합계" 기준으로 confirmed/waiting 카운트. 비로그인 방문자도 볼 수 있는 공개 집계.
- **lookup_application(phone_digits, confirmation_code)** (v7 신규, v8에서 해시 매칭+복호화 반영) — 로그인 없이 참여내역을 조회하려면 전화번호만으로는 프라이버시 문제가 있어(번호를 아는 아무나 조회 가능) 접수번호까지 같이 요구. 어느 값이 틀렸는지는 응답에서 구분 안 함(열거 공격 방지). 접수번호는 처음엔 `WYE-0822-A-001`처럼 날짜/타임슬롯을 담은 형식이었으나, 사용자가 직접 입력하기 번거롭다는 피드백으로 **6자리 숫자**(100000~999999, 중복 시 재생성)로 변경함.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- **~~profiles / kakao_links / naver_links / find_account_by_email / find_account_by_phone~~** — 휴면 처리된 로그인 시스템이 쓰던 테이블/함수. 삭제하지 않고 스키마에 그대로 남아있음(신청 플로우는 더 이상 참조 안 함).
- **중요한 교훈**: Supabase는 새 테이블을 만들어도 RLS 정책과 별개로 `anon`/`authenticated` 롤에 테이블 자체 권한(GRANT)을 자동으로 주지 않는다. 반대로 `session_venues`/`applications`/`application_attendees`처럼 **의도적으로 막고 싶은 테이블은 grant를 아예 안 주면 된다** — 이게 기본값이라 오히려 안전한 쪽, 모든 접근을 SECURITY DEFINER 함수로만 강제할 수 있다. **이 규칙은 `service_role`에도 그대로 적용된다** — RLS는 우회하지만 테이블 GRANT는 별개라, `naver_links`/`kakao_links`에 명시적으로 grant를 안 줬다가 "permission denied for table" 에러를 겪었고(2026-08-07), 이번 v7 작업 중에도 `applications`/`profiles`/`sessions`에 `service_role` grant가 아예 없어 스크립트로 행 개수조차 못 읽는 걸 재확인함(2026-08-09) — 사이드 이펙트 없는 조사성 쿼리라도 grant가 없으면 막힌다는 걸 잊지 말 것.

# 보안 강화 (2026-08-09)

전화번호로 중복/조회를 체크하는 구조라 개인정보 보호에 더 신경써야 한다는 판단으로 진행:

- **PII 컬럼 암호화** — 위 "데이터 모델" 섹션 참고. `name`/`phone`/`depositor_name` 평문 저장 안 함.
- **`next.config.ts`에 HSTS 헤더 추가** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. 브라우저가 이 도메인엔 앞으로 항상 HTTPS로만 접속하도록 강제(다운그레이드 공격 방지).
- **Supabase Database 설정 > Enforce SSL on incoming connections 활성화** — 직접 Postgres 프로토콜 접속(psql 등)에도 SSL을 강제. 앱은 이미 PostgREST(HTTPS)로만 통신해서 앱 동작엔 영향 없음. **주의**: 이 설정을 바꾸면 Supabase가 DB를 재시작해서 몇 분간 다운타임이 생김 — 실제로 겪음, 향후 이 설정을 다시 건드릴 일이 있으면 미리 공지할 것.
- 이미 기본으로 잘 되어 있던 것(점검만 함): `.env*` gitignore 처리, `service_role` 키가 `src/lib/supabase/admin.ts` 한 곳(`"server-only"`)에서만 쓰임, 쿠키 `httpOnly`/`secure`(프로덕션)/`sameSite: lax`, Vercel/Supabase 전 구간 HTTPS, Supabase 디스크 암호화(관리형 자동), `applications`/`application_attendees` RLS 정책 0개로 API 접근 자체 차단.

# 향후 추가 예정 (설계는 돼 있으나 미구현)

- **문자 알림 3단계**: 신청확인(즉시, 계좌·입금액 포함) → 입금확인(운영자가 `payment_status`를 confirmed로 바꿀 때, Database Webhook 필요 — 환불불가 시작일=행사 전날 안내 포함) → 참가확정(행사 전날, 시간 기반 Cron 필요, 정확한 장소 최초 공개). SMS 발급사 미선정 상태.
- **소개팅형(저녁) 세션 성비 관리**: 성별 필드가 v7의 `application_attendees`엔 아직 없음(이름/전화/출생년도/닉네임만) — 필요해지면 컬럼 추가 검토.
- 04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내(현재는 신청 완료 화면에 간이 버전만 있음), 07 FAQ, 08 공지사항, 09 문의하기, 10~12 정책 페이지(이용약관/개인정보처리방침/환불정책).
- Phase 2: PG 결제 연동(필요 시 로그인 시스템 재활성화 검토 — 휴면 처리된 상태, "설계 변경 이력" 참고), 리뷰, 다회차/다지역 카탈로그, 애프터 매칭, 관리자 대시보드, 추천인 코드.

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
- **향후 대안 — 카카오 간편가입(카카오싱크)**: 사업자 정보 등록 + 비즈니스 정보 심사 통과 시, 카카오 로그인만으로 회원가입 완료 + 이름/생년월일/성별까지 카카오에서 받아올 수 있는 기능. `/signup/profile` 재입력 문제를 근본적으로 해결할 잠재력 있음. wye studio는 아직 사업자등록번호가 없어 **보류 중** — 사업자등록 완료되면 재검토.

@AGENTS.md
@CLAUDE.local.md
