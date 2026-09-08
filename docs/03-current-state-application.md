# 03. 애플리케이션 현 상태 (2026-09-08, 커밋 `1b0453b`)

스택: **Next.js 16 App Router / React 19 / TypeScript / Tailwind v4 / motion 13 / recharts 3 / @supabase/ssr / solapi**
서버 로직은 별도 백엔드 없이 **Server Actions + Route Handlers + Postgres RPC** 조합으로만 구성된다.

---

## 1. 요청 처리 파이프라인 (`src/proxy.ts`)

미들웨어 한 파일이 **4중 게이트 + 호스트 기반 rewrite**를 전부 담당한다. 재설계 시 가장 먼저 이해해야 할 파일이다.

```
요청
 ├─ /robots.txt          → 게이트 전부 우회 (크롤러가 disallow를 읽을 수 있도록)
 ├─ 0단계  admin 호스트가 아닌데 /admin 접근  → 404
 ├─ 1단계  SITE_ACCESS_PASSWORD 설정 시 사이트 전체 비밀번호 게이트
 ├─ 1.5단계 /openyourdream/*  → 자체 게이트(실물 명함 번호)
 ├─ 2단계  admin 호스트(admin.wouldyouescape.com)면 "/xxx" → "/admin/xxx" rewrite
 ├─ 3단계  PROTECTED_PATTERN(/account, /auth/*/link) → Supabase 세션 확인
 │         /admin/* (login 제외) → admin_auth 쿠키 HMAC 검증
 └─ 4단계  updateSession() + 비프로덕션 호스트에 X-Robots-Tag: noindex 강제
```

- **어드민은 별도 서브도메인**으로 분리돼 있다 (`admin.wouldyouescape.com` → 내부적으로 `/admin/*`로 rewrite). 이 구조는 재설계 후에도 유지 가치가 크다.
- 어드민 인증은 `ADMIN_PASSWORD` **단일 공유 비밀번호** → HMAC 서명 쿠키(24시간). **계정 개념이 없어 "누가 무엇을 했는지" 기록이 불가능하다.**

---

## 2. 라우팅 인벤토리

### 공개 화면 (`src/app/(site)/`)

| 경로 | 설명 |
|---|---|
| `/` | 홈 — ScrollStage 기반 씬 스크롤텔링 (Hero / Session / Concept / Process / Notice) |
| `/about` | 브랜드 소개 — `NEXT_PUBLIC_ABOUT_ENABLED`로 on/off |
| `/contents` | 회차 카드 그리드 (상품 목록 허브) |
| `/sessions/[slug]` | **회차 상세** (634줄) — 타임테이블·대상·주의사항 등 |
| `/sessions/[slug]/apply` | 신청 폼 |
| `/sessions/[slug]/opengraph-image` | 회차별 동적 OG 이미지 |
| `/lookup`, `/lookup/result` | 참여내역 조회 + 셀프 취소 |
| `/notice` | 공지 + FAQ |
| `/terms`, `/privacy` | 약관 / 개인정보처리방침 |

### 공개 화면 (`src/app/` 루트 — `(site)` 레이아웃 밖)

| 경로 | 설명 |
|---|---|
| `/review-guide` (`/review.go`) | 후기 페이백 안내 + 신청 폼 |
| `/sponsorship-guide` | 크리에이터 협찬 안내 (그룹) |
| `/dating-sponsorship-guide` | 크리에이터 협찬 안내 (소개팅·여성 전용) |
| `/openyourdream`, `/openyourdream/gate` | **타로 미니게임 이스터에그** — 실물 명함 QR 전용, 사이트 어디서도 링크 없음 |

### 어드민 (`/admin/*`, admin 서브도메인)

| 경로 | 줄수 | 설명 |
|---|---:|---|
| `/admin/login` | — | 단일 비밀번호 로그인 |
| `/admin` | 126 | **대시보드 = 세션 목록 한 개** |
| `/admin/sessions/[id]` | 411 | 세션별 신청자 목록 + 행별 액션 |
| `/admin/analytics` | 414 | GA4 대시보드 (recharts) |
| `/admin/sponsorships` | 233 | 협찬 신청 조회 |
| `/admin/review-paybacks` | 104 | 후기 페이백 신청 조회 |
| `/admin/sms-templates` | 56 | **문자 템플릿 편집 (DB 저장)** |

### API 라우트

| 경로 | 인증 | 설명 |
|---|---|---|
| `/api/cron/reminder` | `CRON_SECRET` | 전날안내 문자3 — **외부 크론 미등록, 자동 실행 안 됨** |
| `/api/cron/keepalive` | `CRON_SECRET` | Supabase 슬립 방지 — GitHub Actions가 매일 호출 |
| `/api/admin/analytics` | 어드민 쿠키 | GA4 Data API 프록시 |
| `/api/sponsorship/group`, `/api/sponsorship/dating` | 없음 | 협찬 신청 접수 |
| `/api/review-payback` | 없음 | 후기 페이백 접수 |

### 휴면 (코드 존재, 어디서도 링크 안 됨)

`/login`, `/login/confirm-link`, `/signup`, `/signup/check-email`, `/signup/profile`, `/account`, `/logout`, `/auth/callback`, `/auth/kakao/{login,callback,link}`, `/auth/naver/{login,callback,link}`, `/auth/oauth/{confirm-link,cancel-link}`

> **로그인 부활 시 자산이 그대로 남아 있다.** 이메일+비번, 카카오/네이버 OAuth, 계정 연결(link/confirm-link) 플로우까지 실제로 완성돼 동작했던 코드다.

---

## 3. 서버 액션 인벤토리

### 고객 플로우

| 액션 | 파일 | 호출 RPC |
|---|---|---|
| `applyAction` | `sessions/[slug]/apply/actions.ts` | `submit_application` |
| `checkNicknameAvailability` | 〃 | `check_nickname_available` |
| `checkActiveApplicationConflicts` | 〃 | `check_active_applications` |
| `lookupAction` | `lookup/actions.ts` | `lookup_application` |
| `cancelApplicationAction` | 〃 | `cancel_application` |

### 어드민 플로우 (`admin/sessions/[id]/actions.ts`, 675줄)

| 액션 | 하는 일 | 문자 |
|---|---|---|
| `confirmPayment` | 입금 확인 | 문자2 |
| `cancelApplicationAdmin` | 신청 취소 | 문자4 |
| `silentCancelApplicationAdmin` | 신청 취소 (문자 없이) | — |
| `promoteWaitlistApplicant` | 대기 → 확정 승격 | 문자6 |
| `markRefundCompleted` | 환불 완료 표시 | — |
| `deactivateSession` + `getDeactivatePreview` | 회차 비활성화 (전원 일괄 취소) | 문자7 |
| `sendSessionReminderAdmin` + `getReminderPreview` | **전날안내 수동 발송** | 문자3 |
| `adminManualApply` | 문자 없이 수동 신청 등록 | — |
| `adminUpdateApplication` | 신청/참여자 정보 수정 | — |

### 문자 7종 현황

템플릿 본문은 **`sms_templates` 테이블에 저장**되고 `/admin/sms-templates`에서 편집 가능하다 (CLAUDE.md에 전혀 기록되지 않은 기능).

| key | 라벨 | 발송 트리거 |
|---|---|---|
| `application_confirmation` | 문자1 신청확인 | 신청 완료 시 자동 |
| `payment_confirmed` | 문자2 입금확인 | 어드민 버튼 |
| `event_reminder_group` / `event_reminder_dating` | 문자3 전날안내 | 크론(미등록) 또는 어드민 버튼 |
| `application_cancelled` | 문자4 미입금취소 | 어드민 버튼 |
| `waitlist_promoted` | 문자6 공석입금안내 | 어드민 버튼 |
| `minimum_not_met_cancellation` | 문자7 최소인원미달취소 | 어드민 버튼 |

문자5(대기접수완료)는 발송하지 않기로 확정됨.

---

## 4. 어드민 화면의 실제 모습

`/admin` 대시보드 전체 구성:

```
[제목] 관리자 대시보드                [협찬 신청][후기 페이백][문자 포맷 관리][분석 보기][로그아웃]

┌──────────────────────────────────────────────────────────┐
│ 그룹 바-ㅇ탈출                              상태: 마감    │
│ 2026.08.29 13:00                          [링크 복사]    │
│ 확정선 24명 / 정원 50명                                   │
│ 확정 20명 · 대기 0명                                      │
│ 입금 확인 전 인원: 0명                                    │
└──────────────────────────────────────────────────────────┘
(회차 수만큼 반복)
```

**즉 어드민은 "세션 목록 화면 하나 + 상단 버튼 4개"가 전부다.**

### 없는 것 (사용자가 지적한 "분류·카테고리화가 전혀 안 됨"의 실체)

| 없는 기능 | 현재 대체 수단 |
|---|---|
| **회차/테마 등록·수정·삭제 UI** | **Supabase SQL Editor에서 직접 INSERT** |
| 장소(`session_venues`) 관리 UI | SQL Editor |
| 고객 단위 조회 (한 사람의 전체 참여 이력) | 없음 |
| 매출/정산/환불 집계 | 없음 |
| 검색·필터·정렬·페이지네이션 | 없음 (전건 로드) |
| 사이드바/그룹 네비게이션 (IA) | 없음 (버튼 나열) |
| 운영자 계정·권한·감사로그 | 없음 (공유 비밀번호 1개) |
| 공지/FAQ 관리 | **컴포넌트에 하드코딩** |
| 대시보드 지표 (오늘 신청, 입금 대기, 이번 주 매출 등) | 없음 |
| 마감 재오픈 (`male_closed`/`status` 리셋) | SQL 수동 |

---

## 5. 콘텐츠가 코드에 박혀 있는 지점

정기 운영/테마 추가의 **직접적인 걸림돌**이다.

| 위치 | 하드코딩된 내용 |
|---|---|
| `src/app/(site)/sessions/[slug]/page.tsx` | `DATING_FOR_YOU_CARDS` / `GROUP_FOR_YOU_CARDS`(대상 4종), `contentSteps`(진행 3단계), **`schedule`(타임테이블 — 13:00/19:00 시각까지 고정)**, `precautions`(주의사항), 테마 강조색(`#ff5ec4` / `#3dffb0`), `"8/29 pre-open 한정 할인가"` |
| `src/components/home/SessionCard.tsx` | `"8/29 pre-open 한정 할인가"` |
| `src/components/notice/NoticeSection.tsx` | 공지 2건 배열 |
| `src/components/notice/FaqSection.tsx` | FAQ 배열 (소개팅/그룹 비교, "정식 오픈은 9월 중" 등) |
| `src/lib/bankAccount.ts` | **무통장입금 계좌 (카카오뱅크, 개인 명의)** |
| `src/lib/sms.ts` | 장소 주소 `"서울특별시 관악구 봉천로 333 … 뮤트스페이스 더클래식 봉천점"` 2곳 |
| `next.config.ts` | UTM 짧은 링크 13개 중 6개가 `0829-dating`/`0829-meeting` 고정 |
| `src/app/review-guide/page.tsx`, `admin/review-paybacks/page.tsx` | 회차 선택지 `0829-*` 고정 |
| `src/lib/openYourDreamGateAuth.ts` | 게이트 정답 코드 `"43129573"` |

## 6. 소개팅/그룹 분기의 규모

- `'소개팅'` 리터럴을 참조하는 파일: **19개**
- `isDatingTheme()` 호출 지점: **37곳**
- DB 측: `sessions.session_type` CHECK, 성별 정원 컬럼 6개, `submit_application()` 내 8개 분기, `get_session_stats()` 성별 카운트 6개, `sms_templates` 소개팅 전용 1건, `sponsorship_dating_applications` 테이블 + 전용 RPC + 전용 뷰 + `/dating-sponsorship-guide` 페이지

소개팅 제거는 "한 줄 삭제"가 아니라 **프론트 19파일 + DB 스키마/함수/데이터**에 걸친 작업이다.

---

## 7. 잘 되어 있어서 재설계 때 지켜야 할 것

재설계 논의에서 실수로 버리기 쉬운, 이미 검증된 자산들:

1. **RPC 전용 접근 모델** — 테이블 GRANT를 아예 주지 않고 `SECURITY DEFINER` 함수로만 통과시키는 구조. RLS 정책 실수의 여지가 원천적으로 적다.
2. **PII 암호화 + `phone_hash` HMAC 매칭** — 평문 저장 없이 중복 판정과 조회가 가능하다.
3. **동시성 안전성** — `select … for update` 직렬화로 오버부킹이 없음이 60~200건 동시 요청 스트레스 테스트로 검증됨 (2026-08-20, CLAUDE.md 기록).
4. **입금 확인 기준 정원 판정** (`paid_confirmed_count`) — 미입금 확정 건이 자리를 점유하지 않게 하는 실전에서 나온 개선.
5. **admin 서브도메인 분리 + 호스트 화이트리스트 색인 차단** — `src/lib/hosts.ts` 기반 화이트리스트라 새 서브도메인이 자동으로 안전측으로 떨어진다.
6. **운영/테스트 환경 완전 분리** — Vercel 2 프로젝트 + Supabase 2 프로젝트, 코드 분기 없이 환경변수로만 구분. `NEXT_PUBLIC_IS_TEST_ENV`로 SMS 발송 차단.
7. **DB 기반 문자 템플릿 + 어드민 편집기** — 이미 "코드 배포 없이 운영자가 바꾸는" 패턴의 성공 사례. **테마/공지/FAQ에 그대로 확장할 모델이다.**
