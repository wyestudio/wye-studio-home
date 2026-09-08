# 01. 인프라 현 상태 (2026-09-08 실측)

## 1. 소스 관리

| 항목 | 값 |
|---|---|
| 리포지토리 | `github.com/wyestudio/wye-studio-home` (**public**) |
| 기본 브랜치 | `main` (운영 배포 트리거) |
| 보조 브랜치 | `develop` (테스트 배포 트리거) |
| 분석 시점 HEAD | `1b0453b` — `feat : 후기 페이백 안내 페이지 짧은 링크(/review.go) 추가` |
| 워킹트리 | 커밋되지 않은 이미지 작업물 디렉터리 존재 (`background-removed/`, `output/`, `tmp/`) — 소스 변경 없음 |

> 리포지토리가 **public**이라는 점은 재설계 시 계속 의식해야 한다. 코드에 하드코딩된 값은 전부 공개된 값이다 (04 문서의 `openyourdream` 게이트 코드 항목 참고).

### GitHub Actions

`.github/workflows/supabase-keepalive.yml` — 매일 03:00 UTC(12:00 KST)에 운영/테스트 양쪽 `/api/cron/keepalive`를 호출.
Supabase Free 플랜의 "7일 무활동 시 자동 일시정지"를 막는 용도. **현재 유일하게 실제로 동작 중인 스케줄러다.**

## 2. Vercel

**팀**: `WYE` (slug `wye1`, id `team_0Hgv38tO831EqvyU3hgRq7TV`) — **플랜: Hobby**

### 운영 프로젝트

| 항목 | 값 |
|---|---|
| 이름 / ID | `wye-studio-home` / `prj_QNzFlwaksNeVRRO8mvbEhiR1xCvb` |
| 프레임워크 / Node | Next.js / `24.x` |
| 생성 | 2026-08-06 07:02 UTC |
| 최신 운영 배포 | `dpl_BCniPKShzccmY77dNadAcaypgyZ4` — **2026-08-30 02:52 UTC, READY** |
| 도메인 | `wouldyouescape.com`, `www.wouldyouescape.com`, **`admin.wouldyouescape.com`**, `wye-studio-home.vercel.app`, `wye-studio-home-wye1.vercel.app`, `wye-studio-home-git-main-wye1.vercel.app` |

### 테스트 프로젝트

| 항목 | 값 |
|---|---|
| 이름 / ID | `wye-studio-home-test` / `prj_1SCzUWhb49KNRfDQfHMq1nKtEHk2` |
| 생성 | 2026-08-15 06:06 UTC |
| 최신 배포 | 2026-08-30 02:52 UTC, READY (target: preview) |
| 도메인 | `test.wouldyouescape.com`, **`test.admin.wouldyouescape.com`**, `wye-studio-home-test*.vercel.app` |

**두 프로젝트가 같은 GitHub 리포지토리를 바라본다.** 운영은 `main`, 테스트는 `develop`. 코드 분기는 없고 **환경변수만으로 운영/테스트를 구분**한다(`.env.example` 주석에 명시된 설계).

### 배포 보호 (운영 프로젝트)

```
passwordProtection : disabled
ssoProtection      : enabled, deploymentType = "all_except_custom_domains"
trustedIps         : disabled
```

즉 `*.vercel.app` 프리뷰/배포 URL은 Vercel 로그인이 필요하고, 커스텀 도메인(`wouldyouescape.com`, `admin.wouldyouescape.com`)은 공개. 어드민 보호는 Vercel이 아니라 **애플리케이션 레벨**(`proxy.ts` + `admin_auth` 쿠키)에서만 이뤄진다.

### ⚠️ Hobby 플랜

Vercel Hobby는 약관상 비상업적 사용 대상이다. 이 사이트는 실제로 매출이 발생하는 사업장 사이트이므로, 정기 운영 전환 시 Pro 전환 필요 여부를 확인해야 한다. (CLAUDE.md 기록상 리포지토리를 public으로 바꾼 이유 자체가 "Hobby로 배포하기 위해서"였다 — 즉 Pro 전환 시 리포지토리를 다시 private으로 되돌릴 수 있다.)

## 3. Supabase

**조직**: `uhljhlketkwjpqwtcwtc`

| | 운영 | 테스트 |
|---|---|---|
| 이름 | `wouldyouescape` | `wouldyouescape_test` |
| ref | `jilghhbbtjyybzbgwdhq` | `ksjyfcafhlmqirfeksrp` |
| 리전 | **`ap-northeast-2` (서울)** | **`ap-northeast-1` (도쿄)** |
| Postgres | 17.6.1.155 | 17.6.1.155 |
| 상태 | ACTIVE_HEALTHY | ACTIVE_HEALTHY |
| 생성 | 2026-08-04 | 2026-08-14 |
| **플랜** | **Free** | Free |
| 컴퓨트 | **Nano** (pool 15 / max clients 200) | — |

> 운영과 테스트의 **리전이 다르다**. 기능 검증에는 문제없지만 지연시간 기반 동시성 테스트 결과를 그대로 옮겨 해석하면 안 된다.

### 운영 프로젝트 설정 (2026-09-08 대시보드 실측)

| 항목 | 상태 |
|---|---|
| **Scheduled backups** | ❌ **"Free Plan does not include project backups."** — 백업 없음 |
| Point-in-time recovery | ❌ Free 미제공 |
| Enforce SSL on incoming connections | ✅ ON |
| Network restrictions | ⚠️ **"Your database can be accessed by all IP addresses"** — 제한 없음 |
| Data API | ON |
| Exposed schemas | 2 / 2 |
| **Automatically expose new tables** | ✅ **OFF** (의도된 설정) |
| Extra search path | `public`, `extensions` |
| Max rows | 1000 |
| 설치된 Integration | Data API, **Vault** (PII 키 저장소) |

> ⚠️ Data API 설정 화면은 "**0 of 16 functions exposed**"라고 표시하지만, 실제로는 anon 키로 `/rest/v1/rpc/encrypt_pii` 호출이 **HTTP 200**으로 성공한다. 즉 이 카운터는 명시적으로 grant된 함수만 세고, **Postgres 기본 ACL(`PUBLIC=X`)로 열려 있는 함수는 화면에 드러나지 않는다.** 대시보드만 보고 안전하다고 판단하면 안 된다 — 상세는 [04-drift-and-risks.md](./04-drift-and-risks.md) §C-A.

### Auth 상세 (대시보드 실측)

- **Providers**: Email `Enabled`, Kakao `Enabled`, 나머지 22종 전부 `Disabled`. **Custom Provider 없음** (네이버는 Supabase가 아니라 자체 OAuth 라우트).
- **Custom SMTP**: ✅ 활성화됨
  - Sender: `no-reply@wouldyouescape.com` / 표시명 `wye studio`
  - Host `smtp.resend.com` : `465`, Username `resend`
  - Minimum interval per user: `60`초
  - → CLAUDE.md의 Resend 연결 기록이 **현재도 유효함을 확인**했다.

### Auth 설정 (운영, `GET /auth/v1/settings` 실측)

```json
{
  "external": { "email": true, "kakao": true, "...나머지 전부": false },
  "disable_signup": false,
  "mailer_autoconfirm": false,
  "phone_autoconfirm": false,
  "saml_enabled": false,
  "passkeys_enabled": false
}
```

- **이메일 + 카카오 provider가 켜져 있고, 회원가입도 막혀 있지 않다** — 로그인 시스템이 "휴면"이라고 문서화돼 있지만 백엔드는 살아 있는 상태. (`auth.users` 현재 0건)
- 네이버는 Supabase provider가 아니라 `src/app/(site)/auth/naver/*` 자체 OAuth 라우트로 구현돼 있다.
- `mailer_autoconfirm: false` → 이메일 인증 필요. 발송은 Resend 커스텀 SMTP로 연결돼 있으며 **이번에 대시보드에서 재확인 완료**(아래 "Auth 상세" 참고).

## 4. 도메인 / DNS

- `wouldyouescape.com` — Cloudflare Registrar 구매, 네임서버도 Cloudflare (CLAUDE.md 기록, 이번에 재확인하지 않음)
- 서브도메인 4종이 실제 서비스 중: `www`(운영), `admin`(운영 어드민), `test`(테스트), `test.admin`(테스트 어드민)
- 코드상 색인 허용 호스트는 화이트리스트 2개뿐 (`src/lib/hosts.ts`): `wouldyouescape.com`, `www.wouldyouescape.com`. 나머지 호스트는 `proxy.ts`가 `X-Robots-Tag: noindex, nofollow`를 강제하고 `robots.ts`가 전체 disallow를 반환한다.

## 5. 외부 서비스

| 서비스 | 용도 | 코드 위치 |
|---|---|---|
| **Solapi** | SMS 발송 (문자 1~7종) | `src/lib/sms.ts` |
| **Slack** | 신청/환불/협찬 알림 (webhook 3개 분리) | `src/lib/slack.ts` |
| **GA4 + GTM** | 애널리틱스, 어드민 분석 대시보드 | `src/lib/ga4.ts`, `src/lib/analytics.ts`, `src/app/api/admin/analytics/route.ts` |
| **Google Analytics Data API** | 어드민 `/analytics` 화면 데이터 | 서비스 계정 키 사용 |
| **Resend** | Supabase Auth 커스텀 SMTP | (Supabase 설정, 코드 없음) |
| **Kakao / Naver OAuth** | 휴면 로그인 | `src/lib/kakao.ts`, `src/lib/naver.ts` |

## 6. 환경변수 (2026-09-08 Vercel 대시보드 실측)

값은 비공개이므로 **키 이름 · 적용 환경 · 등록일**만 기록한다.

### 운영 프로젝트 `wye-studio-home` — 20개

| 변수 | 적용 환경 | 등록/수정 | 사용처 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production and Preview | Aug 6 | Supabase 전반 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production and Preview | Aug 6 | Supabase 전반 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production and Preview | Aug 7 | 어드민/크론 |
| `ADMIN_PASSWORD` | Production and Preview | Aug 16 | 어드민 로그인 |
| `CRON_SECRET` | Production and Preview | Aug 17 | 크론 2종 |
| `NEXT_PUBLIC_SITE_URL` | Production and Preview | Aug 24 | OG/JSON-LD, 링크복사 |
| **`SOLAPI_API_KEY`** | Production and Preview | Aug 10 | SMS |
| **`SOLAPI_API_SECRET`** | Production and Preview | Aug 10 | SMS |
| **`SOLAPI_SENDER_NUMBER`** | Production and Preview | Aug 10 | SMS |
| `SLACK_WEBHOOK_URL` | Production and Preview | Aug 10 | 신청 알림 |
| `SLACK_REFUND_WEBHOOK_URL` | Production and Preview | Aug 15 | 환불 알림 |
| `SLACK_SPONSORSHIP_WEBHOOK_URL` | **Production only** | Aug 26 | 협찬 알림 |
| `NEXT_PUBLIC_GTM_ID` | **All Environments** | Aug 11 | GTM |
| `GA4_PROPERTY_ID` | Production and Preview | Aug 18 | 어드민 분석 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Production and Preview | Aug 18 | 어드민 분석 |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Production and Preview | Aug 14 | 어드민 분석 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | Production and Preview | Aug 7 | 휴면 로그인 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | Production and Preview | Aug 7 | 휴면 로그인 |

**운영에 설정돼 있지 않은 키** (전부 의도된 상태):
`NEXT_PUBLIC_IS_TEST_ENV`(미설정 → 운영에서 테스트 모드 아님 ✅) · `SITE_ACCESS_PASSWORD`(미설정 → 전체 게이트 off ✅) · `NEXT_PUBLIC_ABOUT_ENABLED`(미설정 → **`/about` 비공개 + sitemap 제외**) · `ADMIN_PATH` / `SITE_GATE_PATH`(코드 기본값 사용) · `TEST_SUPABASE_*`(CLAUDE.md 기록대로 삭제 완료 ✅)

> ✅ **`SOLAPI_*` 3종이 운영에 실제로 설정돼 있음을 확인했다.** CLAUDE.md "앞으로 할 일" 1번에 미확인으로 남아 있던 항목이 해소됐다.

### 테스트 프로젝트 `wye-studio-home-test` — 19개

운영과 대부분 동일하되 차이는 다음과 같다.

| 테스트에만 있음 | 테스트에 없음 |
|---|---|
| `NEXT_PUBLIC_IS_TEST_ENV` (Aug 15) — SMS 스킵·배너·Slack prefix | `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` |
| `SITE_ACCESS_PASSWORD` (Aug 16) — 사이트 전체 비밀번호 게이트 | `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` |
| `NEXT_PUBLIC_ABOUT_ENABLED` (Aug 15) — `/about` 공개 | |

> 로그인을 부활시키면 **테스트 환경에 카카오/네이버 키를 추가해야 한다** (지금은 없어서 테스트 불가).

### ⚠️ Preview 스코프 문제

운영 프로젝트의 키가 거의 전부 **"Production and Preview"** 로 설정돼 있다. 테스트 환경은 *별도 Vercel 프로젝트*이므로, 여기서 말하는 Preview는 **운영 프로젝트의 브랜치 프리뷰 배포**를 뜻한다.

즉 운영 프로젝트에서 브랜치 프리뷰가 뜨면 그 배포는:
- **운영 Supabase**에 직접 쓰고,
- **운영 Solapi 키로 실제 문자를 발송**하며(`NEXT_PUBLIC_IS_TEST_ENV`가 없으므로 스킵 로직이 걸리지 않는다),
- 운영 Slack 채널로 알림을 보낸다.

완화 요인: 배포 보호(SSO)가 커스텀 도메인 외 전부에 걸려 있어 외부인은 프리뷰에 접근할 수 없다. 그러나 **팀 내부에서 프리뷰로 테스트하면 실제 고객 DB에 쓰고 실제 문자 요금이 발생한다** — CLAUDE.md에 기록된 "팀원 반복 테스트로 인한 요금 문제"와 같은 사고 경로가 여전히 열려 있다.

### 로컬 `.env.local`에만 있는 키

`TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_ENV_PASSWORD` — 동시성 테스트 스크립트용 로컬 전용.

## 7. 스케줄링 현황

| 잡 | 등록 위치 | 상태 |
|---|---|---|
| `/api/cron/keepalive` | GitHub Actions (매일 03:00 UTC) | **동작 중** |
| `/api/cron/reminder` (문자3 전날안내) | 없음 — 외부 크론 미등록 | **자동 실행 안 됨** |

`/api/cron/reminder` 라우트는 완성돼 있지만 어디에도 등록돼 있지 않다. 대신 어드민 세션 상세에 **`SendReminderButton`(수동 발송)** 이 추가돼 있어, 실제 운영은 수동으로 이뤄진 것으로 보인다. `vercel.json`은 존재하지 않아 Vercel Cron도 아니다.

→ **주말 정기 운영으로 전환하면 이 수동 의존이 매주 반복 부담이 된다.** 05 문서 참고.
