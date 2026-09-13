# GTM / GA4 애널리틱스 설정

마지막 업데이트: **2026-09-13**. 추적 이벤트를 추가/수정할 때는 이 문서만 보고 어디를 고쳐야 하는지 파악할 수 있도록 관리한다.

> ⚠️ **2026-09-13에 고친 큰 구멍 두 개** — 같은 실수를 반복하지 않으려면 먼저 읽을 것.
>
> **(1) 테마 구조로 넘어오며 신청 퍼널 추적이 끊겨 있었다.**
> `apply_start`/`apply_complete` 를 쏘는 코드가 **옛 신청폼**(`src/components/apply/ApplyForm.tsx`)에만
> 있었고, 신규 폼(`src/app/(site)/themes/[slug]/apply/ApplyForm.tsx`)에는 없었다.
> GA4 기준 최근 7일 `/themes/baotalchul/apply` 조회 64회에 `apply_start` 는 **1건**이었다.
> Slack 알림이 레거시 폼에만 붙어 있어 누락됐던 것과 **같은 종류의 구멍**이다 —
> 화면을 새로 만들 때는 그 화면이 쏘던 이벤트·알림을 반드시 같이 옮겨야 한다.
>
> **(2) 어드민 사용이 방문자로 집계되고 있었다.**
> GTM 스니펫이 호스트를 가리지 않고 실려서, 운영자가 어드민을 쓰는 것도 전부 세션으로
> 잡혔다(최근 7일 `/applications` 65회, `/themes` 45회, `/sessions` 22회 — 전부 어드민 화면).
> 방문 수가 부풀면 "방문 대비 신청 전환율" 이 통째로 틀어진다.
> 이제 `src/app/(site)/layout.tsx` 가 `isProductionHost()` 로 판정해 **운영 도메인에서만** GTM 을 싣는다
> (admin·test·localhost 는 제외). 판정 기준은 `src/lib/hosts.ts` 화이트리스트다.

## 식별자

- GTM 컨테이너: **`GTM-K5MMSPTV`** (Google 태그 관리자 계정 "우주이스케이프", `accounts/6370793481/containers/260905555`)
- GA4 속성: 측정 ID **`G-EG7FHGECVK`** (계정 "우주이스케이프", `a404254703p549432652`)
- 사이트에는 `NEXT_PUBLIC_GTM_ID` 환경변수가 있을 때만 `src/app/layout.tsx`가 GTM 스니펫(`<Script>` + `<noscript>`)을 렌더링한다. Vercel Production/Preview/Development 전체와 로컬 `.env.local`에 등록 완료.
- 커스텀 이벤트는 `src/lib/analytics.ts`의 `pushDataLayerEvent(event, params)` 헬퍼로 `window.dataLayer`에 push한다.

## 현재 잡혀있는 추적 3가지

| dataLayer 이벤트(한글) | GA4 이벤트 이름 | 찍히는 조건 | 같이 보내는 값 |
|---|---|---|---|
| (없음, 자동) | `page_view` | 사이트 아무 페이지나 열람할 때(전 페이지 공통, GTM 태그 "Google 태그" · 트리거 `Initialization - All Pages`) | 없음(GA4 기본 페이지뷰) |
| `신청 시작` | `apply_start` | 신청 폼이 **마운트될 때** — 즉 신청 페이지가 **로드되는 시점**. "신청하기" 버튼을 누르는 동작 자체가 아니라 그 결과로 도달한 페이지가 열릴 때 찍힘. 새로고침/재진입할 때마다 매번 다시 발생 | `session_id`, `theme_label` |
| `신청 완료` | `apply_complete` | 신청 서버 호출이 **성공**했을 때만 발생. 전화번호 중복·출생연도 범위 밖·정원 마감 등으로 서버가 거부하면 "신청 제출" 버튼을 눌러도 **찍히지 않음** | `session_id`, `theme_label`, `confirmation_code`, `birth_year`, `gender`(아래 참고) |

**두 이벤트를 쏘는 곳은 두 군데다** — 신규 폼이 실사용이고, 옛 폼은 옛 회차용으로 남아 있다.

| 폼 | 파일 | 쓰이는 주소 |
|---|---|---|
| **신규 (실사용)** | `src/app/(site)/themes/[slug]/apply/ApplyForm.tsx` | `/themes/[slug]/apply` |
| 옛 (휴면) | `src/components/apply/ApplyForm.tsx` | `/sessions/[slug]/apply` — 지금은 테마 페이지로 308 리다이렉트 |

⚠️ 신규 폼은 **dataLayer 이벤트명·키를 옛 폼과 똑같이** 쓴다(`신청 시작`/`신청 완료`, `sessionId`/`themeLabel`/…).
GTM 트리거(`CE - 신청 시작`)와 변수(`DLV - sessionId` 등)가 그 이름에 묶여 있어서, 이름을 바꾸면
**GTM 도 같이 고쳐야** 한다. 신규 폼에서 `themeLabel` 에 넣는 값은 테마명(예: `바-ㅇ탈출`)이다.

`apply_complete`의 `birth_year`/`gender`는 **대표 신청자(그룹의 0번 인덱스, `attendees[0]`)** 값만 보낸다. 비소개팅 그룹 신청은 동행자마다 출생년도가 다를 수 있어 대표자 값을 근사치로 쓰기로 결정함(2026-08-12, 사용자 확인 후 진행). 소개팅은 항상 1인 신청이라 정확히 일치. 비소개팅은 `gender` 자체를 안 받는 상품이라 이 경우 `gender`는 `null`.

코드상 호출부: `pushDataLayerEvent("신청 시작", { sessionId, themeLabel })` / `pushDataLayerEvent("신청 완료", { sessionId, themeLabel, confirmationCode, birthYear, gender })` — 신규 폼과 옛 폼 양쪽에 있다(위 표 참고).

## GTM 구성 요소

**변수** (전부 "데이터 영역 변수" 유형, `DLV - ` 접두사로 dataLayer 키와 매핑):
`DLV - sessionId` / `DLV - themeLabel` / `DLV - confirmationCode` / `DLV - birthYear` / `DLV - gender`

**트리거** (전부 "맞춤 이벤트" 유형, `CE - ` 접두사, 이벤트 이름은 한글 그대로):
`CE - 신청 시작`(이벤트 이름 `신청 시작`) / `CE - 신청 완료`(이벤트 이름 `신청 완료`)

**태그**:
- `Google 태그` — 트리거 `Initialization - All Pages`, 측정 ID `G-EG7FHGECVK`
- `GA4 이벤트 - 신청 시작` — 트리거 `CE - 신청 시작`, GA4 이벤트 이름 `apply_start`, 매개변수 `session_id`/`theme_label`
- `GA4 이벤트 - 신청 완료` — 트리거 `CE - 신청 완료`, GA4 이벤트 이름 `apply_complete`, 매개변수 `session_id`/`theme_label`/`confirmation_code`/`birth_year`/`gender`

현재 버전: **4** (2026-08-12 게시).

## GA4 맞춤 정의 (관리 > 데이터 표시 > 맞춤 정의)

등록 완료 (이벤트 범위 맞춤 측정기준, 2026-08-12):

| 측정기준 이름 | 이벤트 매개변수 |
|---|---|
| 테마명 | `theme_label` |
| 접수번호 | `confirmation_code` |
| 출생년도 | `birth_year` |
| 성별 | `gender` |

**`session_id`는 등록 불가** — GA4가 세션 추적용으로 내부적으로 이미 쓰는 예약어라 맞춤 측정기준 생성 UI에서 즉시 거부됨("이 범위에는 매개변수 이름이 허용되지 않습니다"). 다른 이름들(`confirmation_code`, `birth_year` 등)은 문제없이 등록됨 — `session_id`라는 이름 자체만의 문제. 세션ID를 리포트에서 쓰고 싶어지면 GTM 변수/태그 매개변수 이름을 `session_id` → 예: `app_session_id`로 바꿔서 다시 등록해야 함(코드 변경 불필요, GTM 태그의 매개변수 키만 바꾸면 됨). 지금은 우선순위 낮아 보류.

등록해도 실제 리포트/탐색 분석에 뜨기까진 **24~48시간** 소요(등록 직후엔 실시간 이벤트 상세에서만 값 확인 가능).

## 새 이벤트/매개변수를 추가할 때 체크리스트

1. **코드**: `pushDataLayerEvent(eventName, { ... })` 호출 추가/수정 (신규 이벤트면 `src/lib/analytics.ts` import 후 원하는 컴포넌트에서 호출)
2. **GTM** (`tagmanager.google.com` → 계정 "우주이스케이프" → 컨테이너 `GTM-K5MMSPTV`):
   - 새 dataLayer 키를 쓰면 "변수"에 데이터 영역 변수 추가 (`DLV - xxx` 네이밍 유지)
   - 새 이벤트명이면 "트리거"에 맞춤 이벤트 추가 (`CE - xxx` 네이밍, 이벤트 이름은 코드에서 push하는 문자열과 정확히 일치해야 함)
   - "태그"에 GA4 이벤트 태그 추가/수정 — 측정 ID `G-EG7FHGECVK`, GA4 이벤트 이름은 영문 snake_case 권장(GA4 이벤트 명명 규칙), 이벤트 매개변수도 snake_case로 등록
   - 우측 상단 **"제출"** 로 게시해야 실제 반영됨 — 워크스페이스에 저장만 하고 제출을 안 하면 라이브에는 하나도 안 나감(실제로 겪은 실수, 몇 시간 동안 "신청 완료" 태그가 초안 상태로만 있었음)
3. **GA4** (`analytics.google.com` → 관리 → 데이터 표시 → 맞춤 정의):
   - 새 매개변수를 "맞춤 측정기준"(텍스트/카테고리 값) 또는 "맞춤 측정항목"(합산 의미가 있는 숫자 값)으로 등록해야 리포트/탐색 분석에서 쓸 수 있음
   - 매개변수 이름이 GA4 예약어(`session_id` 등)면 등록이 거부되니, 새 매개변수 이름을 정할 때 미리 한 번 시도해보고 이름을 정할 것

## 알려진 이슈 / 결정 사항

- GTM UI가 예전 "Google 애널리틱스: GA4 구성" 태그 유형을 없애고 **"Google 태그"**로 통합함. 오래된 안내/기억에 의존하지 말고 실제 태그 유형 목록에서 확인할 것.
- 예전에 실수로 GTM 계정을 두 번 만든 잔재(컨테이너 `GTM-PDDVSVS4`, 빈 컨테이너였음)를 발견해 삭제함(2026-08-12, 휴지통에서 30일간 복구 가능 — 애초에 사이트에 연결된 적 없어 영향 없음).
- **Vercel Redeploy는 이미 git에 커밋된 코드만 다시 빌드한다** — 로컬에서 코드만 고치고 커밋/푸시를 안 하면 Redeploy를 눌러도 반영 안 됨(GTM 스크립트를 처음 넣었을 때 실제로 겪은 실수).
- GA4 관리자(Admin) 화면은 해시 기반 라우팅이라 URL을 직접 쳐서 들어가면 (예: `.../admin/custom-definitions`) 홈으로 튕기는 경우가 있음 — 좌측 하단 톱니바퀴(관리) 아이콘을 눌러서 들어가는 게 안전함.


## 어드민 분석 화면 (`/admin/analytics`)

2026-09-13에 전면 개편했다. 예약형 사업 대시보드가 공통으로 쓰는 구성을 따랐다 —
핵심 숫자는 **"방문 대비 신청 전환율"** 하나이고(업계 평균 2~5%), GA4 방문 데이터만으로는
장사가 되는지 알 수 없으니 **우리 DB 의 신청·입금·매출을 같이 놓는다.**

| 영역 | 데이터 출처 |
|---|---|
| 방문(세션)·유입 채널·랜딩 페이지·퍼널 앞 3단계 | GA4 (`src/lib/ga4.ts`) |
| 신청·입금·매출·취소 | 우리 DB (`src/lib/adminStats.ts`) |

기간은 **오늘 / 최근 7일 / 최근 28일**. 날짜는 전부 KST 기준으로 자른다(GA4 속성 시간대도 서울).

### 설계상 중요한 두 가지

**퍼널 앞 단계를 이벤트가 아니라 페이지 경로로 센다.**
이벤트는 GTM 설정·태그 게시에 의존해서 조용히 끊기기 쉽다(실제로 그랬다 — 위 경고 참고).
경로는 페이지가 열리기만 하면 잡히므로 더 튼튼하다. `getPathFunnel()` 참고.

**경로별 세션 수를 더하면 안 된다.**
한 세션이 테마 두 개를 보면 두 번 세어져서 "테마 상세 조회 = 방문의 100%" 같은 숫자가 나온다
(처음 만들었을 때 실제로 그랬다). GA4 에 `dimensionFilter` 를 걸어 **"그 경로를 본 세션 수"**
를 직접 물어야 중복이 제거된다.

**입금·취소는 신청일이 아니라 그 일이 실제로 일어난 날에 센다.**
9/10 신청이 9/12 입금이면 신청은 10일, 입금은 12일에 잡힌다. 그래야 "그날 무슨 일이
있었나" 를 읽을 수 있다. 단 `cancelled_at` 은 2026-09-13(p22)부터 쌓여서 그 이전 취소는
취소 추이에서 빠진다.

### 2026-09-13에 지운 것

`getApplyFunnel()`(이벤트 기반 퍼널)과 `getTopPages()` 를 `src/lib/ga4.ts` 에서 제거했다.
전자는 이벤트가 끊겨 0만 반환하고 있었고, 후자는 '유입 페이지' 와 겹쳐 화면에서 뺐다.
되살릴 일이 생기면 git 히스토리에 원본이 있다.
