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
- [ ] **어두운 화면 선언과 휴대폰 상단 막대 색**
  - `color-scheme: dark` 가 없어 달력·선택창·스크롤바가 밝게 뜰 수 있다(`src/app/globals.css`)
  - `<meta name="theme-color">` 가 없어 아이폰 사파리 상단 막대 색이 페이지와 따로 논다(`(site)/layout.tsx` 의 viewport)
- [ ] **Threads 아이콘이 실제 로고가 아니다**
  - 동그라미 두 겹(과녁 모양)이다 — `src/components/home/scenes/NoticeScene.tsx:36-44`
- [ ] **공지 목록 제목 잘림과 📌 이모지**
  - 모바일에서 제목 핵심이 잘린다 → 두 줄까지(`line-clamp-2`), 날짜는 아랫줄로
  - 고정 표시 📌 → "고정" 글자 배지 — `src/components/notice/NoticeSection.tsx:52, 89`
  - 공개 화면 문구라 `wye-customer-facing` 스킬도 읽는다
- [ ] **후기 넘김 점 29개 → "3 / 29" 숫자 + 좌우 버튼**
  - 점이 8×8px 이라 누를 수 없고, 모바일에서 띠처럼 보인다(테마 상세 참여자 후기)

## 대표님이 정하셔야 할 것 (화면 인상이 바뀜 — 고치기 전에 묻는다)

- [ ] **섹션마다 붙은 영문 꼬리표**(BOOKING · HOW TO PLAY · REVIEWS · PRICE …)
  - AI 랜딩 페이지의 대표적인 버릇이다. 다만 `wye-design-system` 이 영문 섹션 라벨을 허용한다 → 규칙과 충돌
  - 섹션 id 가 이 라벨에서 만들어진다(`ThemeBlocks.tsx:152`, `DetailTabs.tsx:27`). 라벨만 숨기고 id 는 남겨야 상단 탭이 안 깨진다
  - `src/components/ui/SectionHeading.tsx:51`, `src/app/(site)/themes/[slug]/page.tsx:659`, `src/components/contents/ThemeBlocks.tsx:139`
- [ ] **첫 화면에 한국어 소개 한 줄**
  - 지금 글자는 "would you escape? / > YES / SCROLL" 뿐이라 무엇을 하는 곳인지 모른다. 유일한 h1 도 이 영문이다
  - `src/components/home/scenes/HeroScene.tsx:138-180`
- [ ] **테마 상세의 상자 안의 상자** — SELECT MODE 패널 > 모드 카드 > MODE SKILLS 상자, 테두리가 세 겹. `src/app/(site)/themes/[slug]/ModeBox.tsx`
- [ ] **Orbitron 글꼴 빼기** — 홈 "Planets to Escape" 제목 한 곳에만 쓰이는 네 번째 글꼴. `src/components/home/scenes/ThemeScene.tsx`, `orbitron.ts`
- [ ] **인스타 카드 다시 만들기** — 어두운 사이트에서 유일한 흰 면(공식 embed iframe). 자체 썸네일 + 캡션 카드로. `src/components/home/scenes/InstagramScene.tsx:264`
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
