# GTM / GA4 애널리틱스 설정

마지막 업데이트: **2026-09-30**. 추적 이벤트를 추가/수정할 때는 이 문서만 보고 어디를 고쳐야 하는지 파악할 수 있도록 관리한다.

> ⚠️ **2026-09-13에 고친 큰 구멍 두 개** — 같은 실수를 반복하지 않으려면 먼저 읽을 것.
>
> **(1) 테마 구조로 넘어오며 신청 퍼널 추적이 끊겨 있었다.**
> `apply_start`/`apply_complete` 를 쏘는 코드가 **옛 신청폼**(`src/components/apply/ApplyForm.tsx`,
> 2026-09-30 삭제됨)에만 있었고, 신규 폼(`src/app/(site)/themes/[slug]/apply/ApplyForm.tsx`)에는 없었다.
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

## 현재 잡혀있는 추적 5가지

| dataLayer 이벤트(한글) | GA4 이벤트 이름 | 찍히는 조건 | 같이 보내는 값 |
|---|---|---|---|
| (없음, 자동) | `page_view` | 사이트 아무 페이지나 열람할 때(전 페이지 공통, GTM 태그 "Google 태그" · 트리거 `Initialization - All Pages`) | 없음(GA4 기본 페이지뷰) |
| `신청 시작` | `apply_start` | 신청 폼이 **마운트될 때** — 즉 신청 페이지가 **로드되는 시점**. "신청하기" 버튼을 누르는 동작 자체가 아니라 그 결과로 도달한 페이지가 열릴 때 찍힘. 새로고침/재진입할 때마다 매번 다시 발생 | `session_id`, `theme_label` |
| `신청 약관동의` | `apply_step_consent` | 신청 폼 **2단계(약관동의)에 처음 닿을 때**. 지나온 단계로 돌아갔다 다시 와도 다시 찍히지 않음(폼을 새로 열면 다시 찍힘) | `session_id`, `theme_label` |
| `신청 제출단계` | `apply_step_submit` | 신청 폼 **3단계(제출·입금정보)에 처음 닿을 때**. 위와 같은 규칙 | `session_id`, `theme_label` |
| `신청 완료` | `apply_complete` | 신청 서버 호출이 **성공**했을 때만 발생. 전화번호 중복·출생연도 범위 밖·정원 마감 등으로 서버가 거부하면 "신청 제출" 버튼을 눌러도 **찍히지 않음** | `session_id`, `theme_label`, `confirmation_code`, `birth_year`, `gender`(아래 참고) |

**신청 이벤트를 쏘는 곳은 `src/app/(site)/themes/[slug]/apply/ApplyForm.tsx` 한 곳이다.**
(옛 폼 `src/components/apply/ApplyForm.tsx` 와 `/sessions/[slug]/apply` 라우트는 2026-09-30 에 삭제됐다.)

⚠️ dataLayer 이벤트명·키를 바꾸면 **GTM 도 같이 고쳐야** 한다 — 트리거(`CE - 신청 시작` 등)와
변수(`DLV - sessionId` 등)가 그 이름에 묶여 있다. `themeLabel` 에 넣는 값은 테마명(예: `바-ㅇ탈출`)이다.

`apply_complete`의 `birth_year`/`gender`는 **대표 신청자(그룹의 0번 인덱스, `attendees[0]`)** 값만 보낸다. 비소개팅 그룹 신청은 동행자마다 출생년도가 다를 수 있어 대표자 값을 근사치로 쓰기로 결정함(2026-08-12, 사용자 확인 후 진행). 소개팅은 항상 1인 신청이라 정확히 일치. 비소개팅은 `gender` 자체를 안 받는 상품이라 이 경우 `gender`는 `null`.

코드상 호출부: `pushDataLayerEvent("신청 시작", { sessionId, themeLabel })` / `pushDataLayerEvent("신청 완료", { sessionId, themeLabel, confirmationCode, birthYear, gender })`. 단계 이벤트 이름은 `src/lib/analytics.ts` 의 `APPLY_STEP_EVENT` 에 있다.

## 범용 GA4 태그 (2026-09-30 추가) — 새 이벤트는 여기에 얹는다

위 4개는 **이벤트 하나에 트리거 1개 + 태그 1개**를 손으로 만드는 방식이다. 그 수작업이
이 문서 맨 위 사고 두 건의 원인이었다. 그래서 이후 이벤트는 **태그 하나로 모은다.**

- 코드는 `src/lib/analytics.ts` 의 `pushGa4Event(name, params)` 를 쓴다.
- dataLayer 이벤트 이름은 **항상 `wye_ga4`** 로 고정되고, 실제 GA4 이벤트 이름은
  `ga4Event` 값으로 넘어간다.
- **새 이벤트를 추가할 때 GTM 은 건드리지 않는다.** 아래 슬롯 안에서 해결되는 한.

| GTM 항목 | 값 |
|---|---|
| 트리거 `CE - WYE GA4` | 맞춤 이벤트, 이벤트 이름 `wye_ga4`, 모든 맞춤 이벤트 |
| 태그 `GA4 이벤트 - 범용` | 유형 `Google 애널리틱스: GA4 이벤트`, 측정 ID `G-EG7FHGECVK`(Google 태그에서 자동 발견), **이벤트 이름 `{{DLV - ga4Event}}`** |

태그의 이벤트 매개변수(슬롯) — 코드의 dataLayer 키와 GA4 매개변수 이름이 다르다.
`DLV - themeLabel` 은 **이미 있는 변수를 그대로 쓴다**(2026-09-30 실측). 나머지 5개는 새로 만든다:

| GTM 변수 | dataLayer 키 | GA4 매개변수 | 상태 |
|---|---|---|---|
| `DLV - ga4Event` | `ga4Event` | (이벤트 이름으로 씀) | 새로 만들 것 |
| `DLV - sectionKey` | `sectionKey` | `section_key` | 새로 만들 것 |
| `DLV - sectionLabel` | `sectionLabel` | `section_label` | 새로 만들 것 |
| `DLV - sectionIndex` | `sectionIndex` | `section_index` | 새로 만들 것 |
| `DLV - appSessionId` | `appSessionId` | `app_session_id` | 새로 만들 것 |
| `DLV - themeLabel` | `themeLabel` | `theme_label` | **이미 있음 — 재사용** |

⚠️ **`session_id` 가 아니라 `app_session_id` 다.** `session_id` 는 GA4 예약어라 맞춤
측정기준 등록이 거부된다(위 「GA4 맞춤 정의」 참고).

⚠️ **기존 4개 태그와 중복되지 않는다.** 그쪽은 `ga4Event` 키를 보내지 않으므로 이 태그의
트리거(`wye_ga4`)에 걸리지 않는다. `CE - 신청 시작`·`CE - 신청 완료` 에는 Meta Pixel 도
걸려 있으니 **그 넷은 건드리지 않는다.**

⚠️ **슬롯은 매번 전부 채워 보낸다**(안 쓰는 칸은 `undefined`). dataLayer 는 push 한 값이
누적돼서, 앞 이벤트의 `sectionLabel` 을 지우지 않으면 뒤 이벤트에 그대로 따라붙는다.
`pushGa4Event` 가 그 일을 한다 — **직접 `pushDataLayerEvent` 로 `wye_ga4` 를 쏘지 말 것.**

### 이 태그로 나가는 이벤트 — 테마 상세 안 (2026-09-30)

퍼널의 "테마 상세 조회 → 신청 폼 열람" 한 칸이 가장 크게 빠지는데 그 안이 통째로
깜깜했다. 전부 한 주소(`/themes/[slug]`) 안이라 경로로는 못 가른다.

| GA4 이벤트 | 언제 | 매개변수 |
|---|---|---|
| `detail_section_view` | 상세의 블록이 화면에 **처음 들어올 때**. 블록마다 페이지 방문당 한 번 | `theme_label`, `section_key`, `section_label`, `section_index` |
| `detail_session_pick` | 회차(시각)를 고를 때 | `theme_label`, `app_session_id` |
| `detail_sold_out_click` | **마감된 회차를 눌러 볼 때** | `theme_label`, `app_session_id` |
| `detail_apply_click` | 신청하기를 눌러 신청 폼으로 넘어갈 때 | `theme_label`, `app_session_id` |
| `detail_booking_scroll` | 회차를 안 고른 채 신청하기를 눌러 회차 선택으로 되돌아갈 때 | `theme_label` |

쏘는 곳: `SectionViewTracker.tsx`(섹션) · `SessionPicker.tsx`(회차·신청) ·
`ScrollToBookingButton.tsx`(되돌아가기). 이름은 `src/lib/analytics.ts` 의 `DETAIL_EVENT`
한 곳에 모여 있고, 읽는 쪽은 `src/lib/ga4.ts` 의 `getDetailFunnel()`·`getSectionReach()` 다.

**`section_key` 는 집계용, `section_label` 은 표시용이다.** 라벨은 운영자가 어드민에서
바꿀 수 있어서 집계 기준으로 쓰면 이름을 고친 날 통계가 두 갈래로 갈린다. 키는
`intro` · `booking` · `block-<블록종류>` 이고, 화면의 `data-section-key` 속성에서 읽는다.

⚠️ **한 테마에 같은 종류 블록이 둘 이상 올 수 있다**(목록 블록 두 개 등). 그래서 키가
겹치고, 구분은 `section_index`(화면 순서)가 한다. 어드민 화면도 키가 아니라 순서로 줄을
가른다. 코드에서 "이미 센 블록" 을 기억하는 기준도 키가 아니라 **순서**다 — 키로 기억하면
둘째 블록부터 영영 안 세어진다(2026-09-30 에 실제로 그랬다).

⚠️ **마감 회차 버튼은 `disabled` 가 아니라 `aria-disabled` 다.** `disabled` 버튼은 브라우저가
클릭 자체를 삼켜서 "마감을 눌러 봤다" 를 잴 방법이 없다. 고를 수 없게 막는 일은
`onClick` 의 early return 이 한다 — **`disabled` 로 되돌리면 `detail_sold_out_click` 이
조용히 0 이 된다.**

## GTM 구성 요소

**변수** (전부 "데이터 영역 변수" 유형, `DLV - ` 접두사로 dataLayer 키와 매핑):
`DLV - sessionId` / `DLV - themeLabel` / `DLV - confirmationCode` / `DLV - birthYear` / `DLV - gender`

**트리거** (전부 "맞춤 이벤트" 유형, `CE - ` 접두사, 이벤트 이름은 한글 그대로,
실행 조건은 전부 "모든 맞춤 이벤트"):
`CE - 신청 시작`(`신청 시작`) / `CE - 신청 약관동의`(`신청 약관동의`) /
`CE - 신청 제출단계`(`신청 제출단계`) / `CE - 신청 완료`(`신청 완료`)

⚠️ 트리거의 이벤트 이름은 코드가 push 하는 문자열과 **한 글자도 달라선 안 된다**(띄어쓰기 포함).
다르면 에러 없이 그냥 안 잡힌다. 2026-09-30 에 네 개 다 코드포인트 단위로 대조해 일치를 확인했다.

**태그**:
- `Google 태그` — 트리거 `Initialization - All Pages`, 측정 ID `G-EG7FHGECVK`
- `GA4 이벤트 - 신청 시작` — 트리거 `CE - 신청 시작`, GA4 이벤트 이름 `apply_start`, 매개변수 `session_id`/`theme_label`
- `GA4 이벤트 - 신청 약관동의` — 트리거 `CE - 신청 약관동의`, GA4 이벤트 이름 `apply_step_consent`, 매개변수 `session_id`/`theme_label`
- `GA4 이벤트 - 신청 제출단계` — 트리거 `CE - 신청 제출단계`, GA4 이벤트 이름 `apply_step_submit`, 매개변수 `session_id`/`theme_label`
- `GA4 이벤트 - 신청 완료` — 트리거 `CE - 신청 완료`, GA4 이벤트 이름 `apply_complete`, 매개변수 `session_id`/`theme_label`/`confirmation_code`/`birth_year`/`gender`

**Meta Pixel 태그도 같은 트리거에 물려 있다** (2026-09-30 기록 — 그동안 이 문서에 빠져 있었다):

| 태그 | 트리거 |
|---|---|
| `Meta Pixel - Base` | `All Pages` |
| `Meta Pixel - Lead(신청시작)` | `CE - 신청 시작` |
| `Meta Pixel - CompleteRegistration(신청완료)` | `CE - 신청 완료` |

⚠️ **`CE - 신청 시작`·`CE - 신청 완료` 를 고치면 GA4 와 Meta 가 같이 바뀐다.** 한 트리거에 두
플랫폼의 태그가 걸려 있어서, GA4 만 생각하고 트리거를 손대면 광고 전환 추적이 조용히 깨진다.
신청 단계 이벤트(2·3단계)는 GA4 에만 보낸다 — 중간 단계는 광고 최적화에 쓰지 않기로 했다.

현재 버전: **8** "범용 GA4 태그 + 상세 페이지 이벤트" (2026-10-01 게시). 태그 9 · 트리거 5 · 변수 11.

2026-10-01 운영에서 end-to-end 확인 완료 — 상세 페이지 스크롤 시 `wye_ga4` 가
dataLayer 에 쌓이고, 범용 태그가 `en=detail_section_view` 로 매개변수 4개
(`theme_label`·`section_key`·`section_label`·`section_index`)를 실어 GA4 로 보내며,
GA4 실시간 보고서에 이벤트가 잡히는 것까지 봤다.

⚠️ **확인할 때 내 방문은 `tt=internal` 로 나간다**(쿠키 `wye_internal`). 운영 통계에
섞이지 않지만, **실시간 보고서에는 보인다** — "실시간에 떴으니 고객 데이터도 쌓인다"
로 읽지 말 것.

## GA4 맞춤 정의 (관리 > 데이터 표시 > 맞춤 정의)

등록 완료 (이벤트 범위 맞춤 측정기준, 2026-08-12):

| 측정기준 이름 | 이벤트 매개변수 |
|---|---|
| 테마명 | `theme_label` |
| 접수번호 | `confirmation_code` |
| 출생년도 | `birth_year` |
| 성별 | `gender` |

**등록이 필요한 것** (2026-09-30 GA4 화면에서 실측 — 아래 넷은 **아직 없다**):

| 측정기준 이름 | 이벤트 매개변수 | 없으면 |
|---|---|---|
| 상세 블록 키 | `section_key` | 퍼널의 '회차 선택까지 내려옴' 칸이 0 이 된다 |
| 상세 블록 이름 | `section_label` | '상세에서 어디까지 읽나' 가 키만 보인다 |
| 상세 블록 순서 | `section_index` | 블록 순서가 뒤섞여 보인다 |
| 회차 ID | `app_session_id` | 회차별로 쪼개 볼 수 없다(퍼널 숫자에는 영향 없음) |

⚠️ 이 넷을 등록하지 않으면 **어드민 분석 화면의 새 칸들이 조용히 0** 이 된다. GA4 Data API
가 맞춤 측정기준을 이름으로 찾는데, 등록 전에는 그 이름이 없기 때문이다.

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
| 방문(세션)·유입 채널·랜딩 페이지·퍼널 앞 3단계 | GA4 페이지 경로 (`getPathFunnel()`) |
| 퍼널의 신청 폼 **2·3단계** | GA4 이벤트 (`getStepFunnel()`) |
| 퍼널의 **테마 상세 안 3칸** + '상세에서 어디까지 읽나' | GA4 이벤트 (`getDetailFunnel()`·`getSectionReach()`) |
| 신청·입금·매출·취소 | 우리 DB (`src/lib/adminStats.ts`) |

기간은 **오늘 / 최근 7일 / 최근 28일**. 날짜는 전부 KST 기준으로 자른다(GA4 속성 시간대도 서울).

### 설계상 중요한 두 가지

**퍼널 앞 단계를 이벤트가 아니라 페이지 경로로 센다.**
이벤트는 GTM 설정·태그 게시에 의존해서 조용히 끊기기 쉽다(실제로 그랬다 — 위 경고 참고).
경로는 페이지가 열리기만 하면 잡히므로 더 튼튼하다. `getPathFunnel()` 참고.

**테마 상세 안의 3칸도 이벤트로 센다 (2026-09-30).**
"테마 상세 조회 → 신청 폼 열람" 이 퍼널에서 가장 크게 빠지는 칸인데 그 안이 통째로
깜깜했다. 상세 → 회차 선택 → 회차 고름 → 신청하기 클릭 이 전부 한 주소 안에서 일어나
경로로는 못 가른다. 0 일 때 칸을 그리지 않고 "추적이 안 붙었다" 고 알리는 규칙은
아래 신청 폼 단계와 같다. **마감 회차 클릭**은 퍼널 칸이 아니라 곁다리 지표로 따로
보여준다 — 그 사람들은 화면이 아니라 회차 편성 때문에 빠진 쪽이라 섞으면 안 된다.

**신청 폼 안의 단계만 예외로 이벤트로 센다 (2026-09-22).**
세 단계가 전부 같은 주소(`/themes/[slug]/apply`)라 경로로는 못 가른다. 그래서 여기만
이벤트(`apply_step_consent`/`apply_step_submit`)로 잰다 — 위 원칙을 어기는 자리라,
**GTM 태그가 없거나 어긋나면 이 두 칸은 조용히 0 이 된다.** 화면은 0 일 때 칸을 그리지 않고
"GTM 설정이 필요하다" 고 알린다(0 을 그려 두면 "아무도 약관까지 안 갔다" 로 잘못 읽힌다).
단계 도달은 **이벤트 수가 아니라 세션 수**로 센다 — 앞뒤 칸과 단위를 맞추기 위해서다.
GTM 쪽은 2026-09-30 에 게시를 마쳤다(버전 7). 남은 것은 코드를 `main` 에 올리는 일뿐이다 —
**운영에 코드가 나가야 이벤트가 발생한다.**

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
