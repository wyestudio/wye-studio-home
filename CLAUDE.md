# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(wye studio)의 회원제 예약 사이트. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다. 참가자는 성별·연령(만 19세 미만 가입 불가 — 저녁 타임 술 제공) 확인이 필요해 **회원가입 필수**로 운영한다(초기 화면설계서는 무회원제였으나 이 요구사항 때문에 회원제로 재변경됨).

베타 필수 페이지(1차 완료, `~/.claude/plans/workspace-wye-studio-home-magical-candy.md`의 v3 계획 기준):
1. 홈(랜딩) — `/` : 회차 카드 + 실시간 모집 위젯
2. 상품 소개 상세 — `/sessions/[id]`
3. 회원가입/로그인 — `/signup`, `/login`, 추가정보 완료 `/signup/profile`
4. 참가 신청 폼 — `/sessions/[id]/apply` (로그인 필수)

나머지 베타 화면(04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내, 07 FAQ, 08 공지사항, 09 문의하기, 10~12 정책 페이지)과 Phase 2(카카오/네이버 소셜로그인 실제 활성화, SMS 알림 자동화, 성비 관리 어드민, PG 결제, 리뷰 등)는 순차 추가 예정.

# 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
- **Supabase (Postgres)** — Firebase(NoSQL) 대신 선택. 이유: 신청 관련 관계형 데이터를 다뤄야 하고, 향후 결제 연동 시 서버 사이드 검증이 필요하기 때문. 리전은 **Seoul (Northeast Asia)** — 실제 고객이 한국 사용자라서.
- Supabase 프로젝트 생성 시 보안 옵션: **Data API ON / Automatically expose new tables OFF / Automatic RLS ON**
- **인증**: Supabase Auth 이메일/비밀번호가 현재 유일하게 동작하는 방식. 카카오/네이버 OAuth는 버튼과 콜백 라우트(`src/app/auth/callback/route.ts`)만 준비돼 있고, 개발자센터 앱 등록·키 발급 전이라 아직 비활성 상태("준비 중" 안내로 처리, `SocialLoginButtons.tsx`).
- **Vercel** — GitHub 연동 자동 배포 예정.

# 지금까지 완료한 것

- [x] Next.js 16 프로젝트 + Supabase 클라이언트(`src/lib/supabase/{client,server,middleware}.ts`), `src/proxy.ts`
  - 주의: Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌고 export 함수명도 `proxy`로 변경됨. Next.js 관련 코드 작성 전엔 `node_modules/next/dist/docs/`에서 최신 컨벤션 확인할 것(AGENTS.md 참고). `params`/`searchParams`는 Promise이며 `PageProps<'/route'>` 헬퍼 타입을 사용한다.
- [x] `supabase-schema.sql` v3 전면 재작성 — **아직 Supabase에 실행 안 함, 다음 세션에서 제일 먼저 할 일**
- [x] 공통 레이아웃(`Header`/`Footer`), 디자인 토큰(`globals.css`)
- [x] 회원가입(`/signup`) — 이메일/비번 + 만 19세 미만 가입 차단(`src/lib/age.ts`). 이메일 인증이 꺼져 있으면 가입 즉시 추가정보(이름/휴대폰/생년월일/성별)까지 한 번에 저장, 켜져 있으면 `/signup/check-email` → 로그인 후 `/signup/profile`에서 이어서 입력하도록 두 경로 모두 처리해둠.
- [x] 로그인(`/login`) — 로그인 성공 시 `profiles` 존재 여부 확인 후 없으면 `/signup/profile`로 유도. `proxy.ts`가 `/sessions/*/apply` 접근을 세션 유무로 가드(비로그인 시 `/login?redirect=...`).
- [x] 홈(`/`), 상품 소개 상세(`/sessions/[id]`), 참가 신청 폼(`/sessions/[id]/apply`) — `npm run build`/`lint` 통과 확인.
- [ ] GitHub 저장소 생성 + Vercel 배포 — 진행 예정(다음 섹션 참고)

# 데이터 모델 (`supabase-schema.sql` 참고, v3)

- **profiles** — `auth.users` 확장 1:1 테이블(이름/휴대폰/생년월일/성별). 본인만 select/insert/update 가능.
- **sessions** — 회차(방탈출 테마 목록이 아님). `capacity_min`(16, 참고용) / `capacity_confirm_line`(20) / `capacity_max`(24). 조회는 전체 공개, 등록/수정 정책 없음 → 지금은 시드 SQL/대시보드로 운영자가 직접 입력.
- **applications** — 참가 신청. `user_id` 기반(로그인 필수), `unique(session_id, user_id)`로 중복신청 방지. **직접 insert 정책이 없다** — 반드시 `apply_and_recompute()` RPC로만 생성됨(클라이언트가 status/confirmation_code를 임의 조작 못 하게 하기 위함). select는 본인 것만.
- **확정 로직(베타 단순화)**: 1~20명은 신청 즉시 무조건 confirmed, 21~23명은 waiting, 24명(정원) 도달 시 waiting 전원 confirmed 전환 + `sessions.status`를 closed로 변경. `apply_and_recompute()`가 `sessions` row를 `for update`로 잠그고 원자적으로 처리(동시 신청 레이스 컨디션 방지).
- **get_session_stats(session_id)** — SECURITY DEFINER 함수. 비로그인 방문자도 볼 수 있는 "신청 N / 목표 20명" 집계만 노출(PII 없음), `applications` 원본은 계속 잠김.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).

# 향후 추가 예정 (설계는 돼 있으나 미구현)

- **문자 알림 3단계**: 신청확인(즉시, 계좌·입금액 포함) → 입금확인(운영자가 `payment_status`를 confirmed로 바꿀 때, Database Webhook 필요 — 환불불가 시작일=행사 전날 안내 포함) → 참가확정(행사 전날, 시간 기반 Cron 필요, 정확한 장소 최초 공개). SMS 발급사 미선정 상태.
- **소개팅형(저녁) 세션 성비 관리**: `applications ⋈ profiles`로 회차별 성별 집계 가능(스키마 변경 불필요). 아직 화면 없음 — 필요 시 Supabase SQL Editor에서 직접 조회하거나 `get_session_gender_stats()` 함수로 승격.

# 앞으로 할 일 (순서대로)

1. `supabase-schema.sql`을 Supabase SQL Editor에서 실행(8/22 오후·저녁 시드 데이터 포함됨)
2. Supabase Auth 이메일 확인(Confirm email) 설정 확인 — 켜져 있으면 회원가입 플로우가 `/signup/check-email` 경로를 타는지 실제로 테스트
3. RLS 최종 점검(타인 profiles/applications 접근 불가, 브라우저 네트워크 탭에서 PII 미노출 확인)
4. GitHub 저장소 생성 + Vercel 배포, 환경변수 등록(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
5. 카카오/네이버 개발자센터 앱 등록·키 발급(사용자 직접) → Supabase Auth Provider 연결 → 소셜 로그인 실제 활성화
6. 04~12 나머지 베타 화면 순차 추가, 문자 알림 파이프라인, 성비 관리, (나중) PG 결제 연동

# 참고

- 개발자는 React/Next.js 경험이 없고 순수 JS + Java 경험만 있음. 설명할 때 개념을 풀어서 설명해주면 좋음.
- 디자인은 1차로 브랜드 톤(보라색 `--brand: #5b4bff`)만 잡아둔 상태 — 실제 화면을 보면서 방향을 더 다듬고 싶어함.
- Node.js/Homebrew 등 개발 환경은 이미 세팅 완료됨 (Mac).

@AGENTS.md
