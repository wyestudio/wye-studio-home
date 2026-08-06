# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(wye studio)의 회원제 예약 사이트. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). 참가자는 성별·연령(만 19세 미만 가입 불가 — 저녁 타임 술 제공) 확인이 필요해 **회원가입 필수**로 운영한다. (참고: 초기 화면설계서 초안은 무회원제였으나 이 요구사항 때문에 회원제로 재변경됨 — 자세한 배경은 이 문서 하단 "설계 변경 이력" 참고.)

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, private). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제).
- Vercel: 아직 연동 전. `wyestudio/wye-studio-home`을 Import하고 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 환경변수로 등록하면 됨.

# 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
- **Supabase (Postgres)** — Firebase(NoSQL) 대신 선택. 신청 관련 관계형 데이터를 다뤄야 하고, 향후 결제 연동 시 서버 사이드 검증이 필요하기 때문. 리전은 **Seoul (Northeast Asia)**.
- Supabase 프로젝트 생성 시 보안 옵션: **Data API ON / Automatically expose new tables OFF / Automatic RLS ON**
- **인증**: Supabase Auth 이메일/비밀번호가 현재 유일하게 동작하는 방식. 카카오/네이버 OAuth는 버튼과 콜백 라우트(`src/app/auth/callback/route.ts`)만 준비돼 있고, 개발자센터 앱 등록·키 발급 전이라 아직 비활성 상태("준비 중" 안내로 처리, `SocialLoginButtons.tsx`).

# 지금까지 완료한 것

- [x] Next.js 16 프로젝트 + Supabase 클라이언트(`src/lib/supabase/{client,server,middleware}.ts`), `src/proxy.ts`
  - 주의: Next.js 16부터 `middleware.ts`가 `proxy.ts`로 이름이 바뀌고 export 함수명도 `proxy`로 변경됨. Next.js 관련 코드 작성 전엔 `node_modules/next/dist/docs/`에서 최신 컨벤션 확인할 것(AGENTS.md 참고). `params`/`searchParams`는 Promise이며 `PageProps<'/route'>` 헬퍼 타입을 쓴다.
- [x] `supabase-schema.sql` v3 전면 재작성 — **아직 Supabase에 실행 안 함, 다음으로 제일 먼저 할 일**
- [x] 공통 레이아웃(`Header`/`Footer`), 디자인 토큰(`globals.css`, 브랜드 컬러 `--brand: #5b4bff`)
- [x] 회원가입(`/signup`) — 이메일/비번 + 만 19세 미만 가입 차단(`src/lib/age.ts`). Supabase의 "Confirm email" 설정이 꺼져 있으면 가입 즉시 추가정보(이름/휴대폰/생년월일/성별)까지 한 번에 저장, 켜져 있으면 `/signup/check-email` → 이메일 인증 → 로그인 → `/signup/profile`에서 이어서 입력 — 두 경로 모두 코드로 처리해둠.
- [x] 로그인(`/login`) — 로그인 성공 시 `profiles` 존재 여부 확인 후 없으면 `/signup/profile`로 유도. `proxy.ts`가 `/sessions/*/apply` 접근을 세션 유무로 가드(비로그인 시 `/login?redirect=...`).
- [x] 홈(`/`) — 회차 카드(오후/저녁) + 실시간 모집 위젯, 상품 소개 상세(`/sessions/[id]`), 참가 신청 폼(`/sessions/[id]/apply`, 로그인·프로필 완료 필수)
- [x] `npm run lint` / `npm run build` 통과 확인
- [x] GitHub 저장소 push 완료 (`wyestudio/wye-studio-home`)
- [ ] Vercel 배포 — 진행 예정

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

# 데이터 모델 (`supabase-schema.sql` 참고, v3)

- **profiles** — `auth.users` 확장 1:1 테이블(이름/휴대폰/생년월일/성별). 본인만 select/insert/update 가능.
- **sessions** — 회차(방탈출 테마 목록이 아님). `capacity_min`(16, 참고용) / `capacity_confirm_line`(20) / `capacity_max`(24). 조회는 전체 공개, 등록/수정 정책 없음 → 지금은 시드 SQL(8/22 오후·저녁 2건 포함)/대시보드로 운영자가 직접 입력.
- **applications** — 참가 신청. `user_id` 기반(로그인 필수), `unique(session_id, user_id)`로 중복신청 방지. **직접 insert 정책이 없다** — 반드시 `apply_and_recompute()` RPC로만 생성됨(클라이언트가 status/confirmation_code를 임의 조작 못 하게 하기 위함). select는 본인 것만.
- **확정 로직(베타 단순화)**: 1~20명은 신청 즉시 무조건 confirmed, 21~23명은 waiting, 24명(정원) 도달 시 waiting 전원 confirmed 전환 + `sessions.status`를 closed로 변경. `apply_and_recompute()`가 `sessions` row를 `for update`로 잠그고 원자적으로 처리(동시 신청 레이스 컨디션 방지), 중복신청은 unique_violation을 잡아 친절한 메시지로 변환.
- **get_session_stats(session_id)** — SECURITY DEFINER 함수. 비로그인 방문자도 볼 수 있는 "신청 N / 목표 20명" 집계만 노출(PII 없음), `applications` 원본은 계속 잠김.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- 알려진 한계: `sessions.venue_name`(파티룸 상호명, 예: 뮤트스페이스 신림점)은 `select using (true)`라 Supabase REST API로 직접 조회하면 노출됨. 지금 화면 코드는 `venue_area`(대략 지역)만 렌더링해서 UI상으로는 안 보이지만, 상호명까지 완전히 비공개하고 싶다면 별도 테이블/권한 분리가 필요함(TBD).

# 향후 추가 예정 (설계는 돼 있으나 미구현)

- **문자 알림 3단계**: 신청확인(즉시, 계좌·입금액 포함) → 입금확인(운영자가 `payment_status`를 confirmed로 바꿀 때, Database Webhook 필요 — 환불불가 시작일=행사 전날 안내 포함) → 참가확정(행사 전날, 시간 기반 Cron 필요, 정확한 장소 최초 공개). SMS 발급사 미선정 상태.
- **소개팅형(저녁) 세션 성비 관리**: `applications ⋈ profiles`로 회차별 성별 집계 가능(스키마 변경 불필요). 아직 화면 없음 — 필요 시 Supabase SQL Editor에서 직접 조회하거나 `get_session_gender_stats()` 함수로 승격.
- 04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내(현재는 신청 완료 화면에 간이 버전만 있음), 07 FAQ, 08 공지사항, 09 문의하기, 10~12 정책 페이지(이용약관/개인정보처리방침/환불정책).
- Phase 2: 카카오/네이버 소셜로그인 실제 활성화, PG 결제 연동, 리뷰, 다회차/다지역 카탈로그, 애프터 매칭, 관리자 대시보드, 추천인 코드.

# 앞으로 할 일 (순서대로)

1. `supabase-schema.sql`을 Supabase SQL Editor에서 실행(8/22 오후·저녁 시드 데이터 포함됨)
2. Supabase Auth "Confirm email" 설정 확인 — 켜져 있으면 회원가입 플로우가 `/signup/check-email` 경로를 실제로 타는지 테스트
3. RLS 최종 점검(타인 profiles/applications 접근 불가, 브라우저 네트워크 탭에서 PII 미노출 확인)
4. Vercel에서 `wyestudio/wye-studio-home` Import + 환경변수 등록 후 배포
5. 카카오/네이버 개발자센터 앱 등록·키 발급(사용자 직접) → Supabase Auth Provider 연결 → 소셜 로그인 실제 활성화
6. 04~12 나머지 베타 화면 순차 추가, 문자 알림 파이프라인, 성비 관리, (나중) PG 결제 연동

# 설계 변경 이력 (요약)

- 최초 계획: 방탈출 테마 목록(`rooms`) + 로그인 신청(`applications`) + 리뷰(`reviews`), auth.uid() 기반 RLS.
- 1차 수정: 화면설계서 기준으로 회원가입 없는 1회성 신청 폼으로 단순화(무회원제) — `sessions`(회차) 개념 도입, `applications`는 이름+연락처로 식별.
- 2차 수정(현재): 참가자 성별·연령을 확실히 확인해야 해서(미성년자 술 제공 방지) **다시 회원제로 전환**. 카카오/네이버 OAuth로 개인정보를 연동받고 싶어했으나, 앱 등록/심사 리드타임 때문에 이메일/비밀번호를 우선 구현하고 소셜 로그인은 버튼만 준비.
- 확정 로직도 초기 "16→20→24 4의 배수 단계식"에서 "1~20명 즉시확정 / 21~23명 대기 / 24명 도달 시 대기자 전원 확정+마감"으로 베타용 단순화.

@AGENTS.md
@CLAUDE.local.md
