# UI 디자인 점검 후속 작업 목록

> **다른 세션에서 이어받을 때**: "ui 스킬 추가 관련 수정 목록", "다음으로 작업할 게 뭐야?" 같은 질문은 이 문서를 보고 답한다.
> 위에서부터 `[ ]` 인 첫 항목이 다음 작업이다. 하나 끝날 때마다 `[x]` 와 커밋 해시를 적는다.
> 모든 항목이 끝나면 이 문서는 지우지 않고 작업 기록으로 남긴다.

- **브랜치**: `fix/ui-design-review` (develop 에서 갈라짐). 이 목록의 작업은 전부 여기에 커밋하고, 다 끝나면 develop 에 머지한다
- **진행 방식**: 한 항목씩 고친다 → 어느 파일 몇째 줄을 고쳤는지 대표님께 알린다 → 대표님이 로컬에서 확인한다 → 확인받은 뒤 이 브랜치에 커밋한다
- **범위**: 이 저장소(wye-studio-home) 공개 화면만. 어드민은 대상이 아니다. BAR-O 앱(wye-studio-webapp)은 그 저장소 담당 세션이 따로 맡는다

## 배경

2026-11-13 전역 디자인 스킬을 설치했다(`~/.claude/skills/`).

| 스킬 | 하는 일 |
|---|---|
| `frontend-design` | 만들기 전에 주제에 맞는 분위기부터 정한다 |
| `ui-ux-pro-max` | 색·폰트 조합 견본집 |
| `hallmark` | AI 티 나는 구성을 걸러낸다 (`/hallmark audit <경로>`) |
| `emil-design-eng` | 애니메이션 곡선·속도 |
| `web-design-guidelines` | 접근성·UX 규칙 점검 |

이 스킬들로 운영 사이트(wouldyouescape.com)를 점검했다. 아래는 그 결과다.
**이 저장소의 디자인 규칙은 `wye-design-system` 스킬이 우선한다.** hallmark 제안이 그 규칙과 부딪치면 고치기 전에 대표님께 묻는다.

## 바로 고칠 것 (작은 수정)

- [x] **떠 있는 인스타·카카오 버튼이 하단 링크·견적 막대를 가린다**
  - 푸터가 보이면 버튼 묶음이 그 위로 올라간다. 하단 CTA 막대(테마 상세 · 단체 견적)도 같은 방식으로 비켜 간다
  - `src/components/ui/ScrollAwayFloat.tsx`, `src/components/layout/Footer.tsx`(`site-footer` 표시)
  - 확인: 폭 390·820·1100·1400 × `/lookup`·`/notice`·`/group`·테마 상세 × 맨 위·맨 아래·살짝 올림 = 48가지에서 겹침 0건
  - 커밋: `db43475`
- [x] **메뉴 버튼과 신청 폼 입력칸의 키보드 포커스 표시**
  - 메뉴 버튼(≡): 키보드로 왔을 때만 `brand` 2px 테두리(`focus-visible:ring-2`). 손가락으로 누를 때는 안 보인다 — `src/components/layout/Header.tsx`
  - 신청 폼 입력칸·선택칸, 환불 정보 입력창: 흰 테두리만 밝아지던 것을 공용 `Input` 과 같은 파란 테두리 + 3px 빛으로 — `ApplyForm.tsx`, `AttendeeFields.tsx`, `Select.tsx`(`glass` 모양, 신청 폼 전용), `src/components/lookup/RefundInfoDialog.tsx`
  - 확인: 메뉴 버튼은 실제 Tab 키로 테두리가 생기고 클릭에는 안 생김. 신청 폼은 7칸 × 390·1280px 모두 적용. 환불 정보 입력창은 같은 클래스라 화면 확인은 안 함(조회 결과까지 들어가야 열린다)
  - 남은 것: 휴면 중인 회원 정보 폼(`src/components/auth/ProfileDetailsForm.tsx`)도 같은 약한 표시지만 쓰이지 않아 두었다
  - 커밋: `6296bf6`
- [x] **어두운 화면 선언과 휴대폰 상단 막대 색**
  - `color-scheme: dark` — `src/app/globals.css` 의 `html` + `(site)/layout.tsx` 의 `generateViewport`. 체크박스·스크롤바·자동완성 칸이 어두운 화면용으로 그려진다
  - `theme-color` — 사이트 배경색(`#04070d`), 핼러윈 스킨이면 `#190d2b`. `generateViewport` 가 시즌을 읽어 고른다
  - ⚠️ iOS 26 사파리는 `theme-color` 를 안 쓰고 페이지 배경색으로 막대 색을 정한다(개발자 보고 · 애플 공식 문서 없음). 이 값은 안드로이드 크롬 · iOS 18 이하 · 홈 화면 웹앱용
  - 확인: 3105 HTML 에 두 meta 확인(테스트 DB 가 핼러윈이라 `#190d2b`). 팝업 체크박스가 흰 상자 → 어두운 상자로 바뀐 것 비교 캡처. 인쇄용 흰 문서는 인쇄 때 글자색을 `#111` 로 강제해 영향 없음
  - 확인 못 함: 시즌 꺼진 기본색이 실제로 찍히는 것, 안드로이드 실기기 주소창
  - 커밋: `f863dcd`
- [x] **Threads 아이콘이 실제 로고가 아니다**
  - 과녁 모양 → 실제 「@」 로고(Simple Icons 13.21.0, CC0) — `src/components/home/scenes/NoticeScene.tsx`. 크기·색·누르는 영역은 그대로
  - 카카오는 바꾸지 않았다 — Simple Icons 것은 카카오**톡**(TALK) 로고인데 링크는 카카오 **채널**이라 지금 말풍선이 더 맞다
  - 확인: 390·1280px 에서 공지 장면까지 스크롤해 세 아이콘 캡처
  - 커밋: `5b8f16b`
- [x] **공지 목록 제목 잘림과 📌 이모지**
  - 모바일은 날짜를 제목 아래로 내렸다(PC 는 오른쪽 그대로). 제목은 **한 줄 + "…" 유지** — 두 줄을 허용하면 줄마다 높이가 달라진다(대표님)
  - 📌 → 압정 그림 `src/components/notice/PinIcon.tsx`(Microsoft Fluent Emoji Pushpin Flat, MIT). 이모지는 기기마다 그림이 달라서. 글자 배지("고정")보다 그림이 낫다(대표님)
  - 고친 곳: 공개 목록 · 팝업(`NoticeSection.tsx`), 어드민 콘텐츠 관리(`admin/content/ContentManager.tsx`)
  - 확인: 운영 공지 9개 기준 390px 에서 잘리는 제목 7개(64~89% 보임) → 4개(86~95% 보임), 줄 높이 모두 같음. 1280px 은 잘림 0. 팝업 제목 압정 확인
  - 확인 못 함: 어드민 화면(admin.localhost:3000 + 로그인 필요)
  - 커밋: `1472300`
- [x] **후기 넘김 점이 후기 수만큼 늘어나 화살표를 밀어낸다** (테마 상세 한 줄 후기)
  - 운영 25개 기준 모바일에서 점 줄이 356px, 좌우 화살표가 32 → 18px 로 찌그러져 있었다
  - 숫자("3 / 25")가 아니라 **점 유지** — 점이 많아 보이는 게 좋다(대표님). 대신 인스타식으로 **5개만 보이고 지금 위치를 따라 흐른다**, 양 끝 두 점은 작게(9개는 많아 보여 5개로)
  - 화살표 44px + `shrink-0`. 점은 키보드 순서에서 뺐고(화살표로 넘긴다) 보조기기에는 "N페이지 중 M번째" 로 읽힌다
  - `src/components/contents/QuoteList.tsx`
  - 확인: 테스트 DB(모바일 19 · PC 10페이지)에서 390 · 1280px 모두 점 5개 · 화살표 44px · 가로 넘침 없음, 처음 · 가운데 · 처음에서 이전 눌러 마지막까지 점 모양 확인
  - 커밋: `33606c6`

## 대표님이 정하셔야 할 것 (화면 인상이 바뀜 — 고치기 전에 묻는다)

- [x] **섹션마다 붙은 영문 꼬리표**(BOOKING · HOW TO PLAY · REVIEWS · PRICE …) — **유지로 결정(대표님). 다시 올리지 않는다**
  - 이유: `wye-design-system` 이 `text-micro` 의 쓰임으로 "영문 섹션 라벨" 을 정해 둔 의도된 요소이고, 우주 · HUD 콘셉트와 어울린다. 섹션 id · 모드 전환 착지가 이 라벨에 묶여 있어 걷어낼 위험이 더 크다
  - (점검 때 적은 것) AI 랜딩 페이지의 대표적인 버릇이다. 다만 `wye-design-system` 이 영문 섹션 라벨을 허용한다 → 규칙과 충돌
  - 섹션 id 가 이 라벨에서 만들어진다(`ThemeBlocks.tsx:152`, `DetailTabs.tsx:27`). 라벨만 숨기고 id 는 남겨야 상단 탭이 안 깨진다
  - `src/components/ui/SectionHeading.tsx:51`, `src/app/(site)/themes/[slug]/page.tsx:659`, `src/components/contents/ThemeBlocks.tsx:139`
- [x] **첫 화면에 한국어 소개 한 줄** — **넣지 않기로 결정(대표님). 다시 올리지 않는다**
  - 이유: "would you escape?" 질문에 "YES" 로 답하고 누르면 참여로 가는 연출이다. 둘 사이에 글자가 끼면 그 흐름이 깨지고, 다른 자리도 어울리지 않았다
  - 본 시안(문구는 `SITE_DESCRIPTION` 앞부분 "여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출"): 제목과 YES 사이(흐름이 끊김) · 로고 위(로고와 제목 묶음이 흐려짐) · SCROLL 위(PC 마스코트 궤도 아래끝과 겹침 — 궤도가 SCROLL 바로 위까지 내려온다) · YES 아래(겹침은 없지만 별로)
  - (점검 때 적은 것) 지금 글자는 "would you escape? / > YES / SCROLL" 뿐이라 무엇을 하는 곳인지 모른다. 유일한 h1 도 이 영문이다
  - `src/components/home/scenes/HeroScene.tsx:138-180`
- [x] **테마 상세의 상자 안의 상자** — SELECT MODE 패널 > 모드 카드 > MODE SKILLS 상자, 테두리가 세 겹. `src/app/(site)/themes/[slug]/ModeBox.tsx` — **유지로 결정(대표님). 다시 올리지 않는다**
  - 이유: 게임의 모드 선택 창을 본뜬 의도된 모양이다(시안 2026-10-08, 코드 머리말). 세 겹이 창 · 고를 버튼 · 스킬 칸으로 역할이 다르고, `wye-design-system` 도 이 자리의 도트 모양을 예외로 정해 뒀다. 이미 여러 번 다듬은 화면이다
- [x] **Orbitron 글꼴 빼기** — 홈 "Planets to Escape" 제목 한 곳에만 쓰이는 네 번째 글꼴. `src/components/home/scenes/ThemeScene.tsx`, `orbitron.ts` — **유지로 결정(대표님). 다시 올리지 않는다**
  - 이유: Geist Mono · Space Grotesk 와 나란히 비교해 대표님이 고른 글꼴이다(`orbitron.ts` 머리말). 홈에서만 영문 한 굵기(약 6.5KB)를 받아 속도 부담이 거의 없고, 행성 장면의 SF 표지 분위기를 맡는 장식용 제목이다
- [x] **인스타 카드 다시 만들기** — 어두운 사이트에서 유일한 흰 면(공식 embed iframe). `src/components/home/scenes/InstagramScene.tsx:264` — **유지로 결정(대표님). 다시 올리지 않는다**
  - 이유: 인스타 느낌을 내려고 일부러 고른 모양이다. 무게도 첫 화면이 아니라 장면까지 내린 뒤에만 받는다
  - 실측(운영 홈, 첫 방문): 첫 화면 약 1.9~2.0MB 에서 인스타 0 바이트. 장면까지 내리면 휴대폰 약 1.0MB · PC 약 1.2MB 를 더 받고, 그중 약 850KB 는 창이 하나만 떠도 받는 인스타 스크립트다
  - 나중에 가볍게 하고 싶어지면: 인스타 모양을 우리가 그린 카드(사진만 받음, 약 100~300KB) + 토큰이 끊기면 지금 창으로 되돌아가기. "보이는 카드만 창 띄우기" 는 스크립트가 그대로라 얻는 게 적다
- [ ] **주 버튼 모양 통일** — 홈 "> YES" 글자 링크 · `/lookup` 테두리 버튼 · 테마 상세 민트 · 단체 핑크

## 손대지 말 것 (점검에서 좋다고 나온 것)

- 픽셀아트 마스코트·포스터·모드 아이콘 — 템플릿 느낌이 없는 진짜 개성이다
- "4.8 / 5" 와 후기 29개 — 날짜 붙은 실제 설문 문장이다
- 입력칸 16px(아이폰 확대 방지), 햄버거 44px, 움직임 줄이기 대응, `--muted` 대비 약 8:1

## 확인하는 방법

- 로컬 확인 서버는 테스트 DB 로 띄운다(`CLAUDE.md` 「로컬에서 띄울 때」). 대표님이 보시는 서버와 다른 포트를 쓴다
- **Claude in Chrome 확인용 탭은 백그라운드(`hidden`)라 rAF·스크롤 이벤트가 안 돈다.** 스크롤에 반응하는 화면을 재면 "안 고쳐졌다" 로 잘못 나온다
  → headless Chrome(`--headless=new --remote-debugging-port`)을 띄워 CDP 의 `Emulation.setDeviceMetricsOverride` 로 폭을 바꿔가며 잰다
- 폭은 최소 390 · 820 · 1100 을 본다 ← 640~1023px 구간에서만 생기는 문제가 있었다
- 포커스 표시를 잴 때는 CDP 의 `Emulation.setFocusEmulationEnabled` 를 켠다 ← headless 창은 포커스가 없어서
  코드로 `focus()` 를 불러도 `:focus` 스타일이 안 걸리고 "안 고쳐졌다" 로 잘못 나온다
- 신청 폼은 테스트 DB 의 열린 회차 id 로 `/themes/<slug>/apply?session=<id>` 를 연다(다른 테마 회차면 맞는 주소로 보내준다)
