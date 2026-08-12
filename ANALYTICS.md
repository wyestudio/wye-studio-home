# GTM / GA4 애널리틱스 설정

마지막 업데이트: 2026-08-12. 추적 이벤트를 추가/수정할 때는 이 문서만 보고 어디를 고쳐야 하는지 파악할 수 있도록 관리한다.

## 식별자

- GTM 컨테이너: **`GTM-K5MMSPTV`** (Google 태그 관리자 계정 "우주이스케이프", `accounts/6370793481/containers/260905555`)
- GA4 속성: 측정 ID **`G-EG7FHGECVK`** (계정 "우주이스케이프", `a404254703p549432652`)
- 사이트에는 `NEXT_PUBLIC_GTM_ID` 환경변수가 있을 때만 `src/app/layout.tsx`가 GTM 스니펫(`<Script>` + `<noscript>`)을 렌더링한다. Vercel Production/Preview/Development 전체와 로컬 `.env.local`에 등록 완료.
- 커스텀 이벤트는 `src/lib/analytics.ts`의 `pushDataLayerEvent(event, params)` 헬퍼로 `window.dataLayer`에 push한다.

## 현재 잡혀있는 추적 3가지

| dataLayer 이벤트(한글) | GA4 이벤트 이름 | 찍히는 조건 | 같이 보내는 값 |
|---|---|---|---|
| (없음, 자동) | `page_view` | 사이트 아무 페이지나 열람할 때(전 페이지 공통, GTM 태그 "Google 태그" · 트리거 `Initialization - All Pages`) | 없음(GA4 기본 페이지뷰) |
| `신청 시작` | `apply_start` | `src/components/apply/ApplyForm.tsx`가 **마운트될 때** — 즉 `/sessions/[id]/apply` 페이지가 **로드되는 시점**. "신청하기" 버튼을 누르는 동작 자체가 아니라 그 결과로 도달한 페이지가 열릴 때 찍힘. 새로고침/재진입할 때마다 매번 다시 발생 | `session_id`, `theme_label` |
| `신청 완료` | `apply_complete` | `submit_application()` 서버 호출이 **성공**해서 `state.application`이 채워질 때만 발생. 전화번호 중복·출생년도 범위 밖·정원 마감 등으로 서버가 거부하면 "신청 제출" 버튼을 눌러도 **찍히지 않음** | `session_id`, `theme_label`, `confirmation_code`, `birth_year`, `gender`(아래 참고) |

`apply_complete`의 `birth_year`/`gender`는 **대표 신청자(그룹의 0번 인덱스, `attendees[0]`)** 값만 보낸다. 비소개팅 그룹 신청은 동행자마다 출생년도가 다를 수 있어 대표자 값을 근사치로 쓰기로 결정함(2026-08-12, 사용자 확인 후 진행). 소개팅은 항상 1인 신청이라 정확히 일치. 비소개팅은 `gender` 자체를 안 받는 상품이라 이 경우 `gender`는 `null`.

코드상 호출부: `pushDataLayerEvent("신청 시작", { sessionId, themeLabel })` / `pushDataLayerEvent("신청 완료", { sessionId, themeLabel, confirmationCode, birthYear, gender })` — 둘 다 `src/components/apply/ApplyForm.tsx`.

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
