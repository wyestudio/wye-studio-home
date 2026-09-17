# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(우주이스케이프)의 **비회원 구매(예약) 사이트**. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). 회원가입 없이 **신청(구매) 시점에 인적정보(이름/전화번호/출생년도)를 직접 받는 방식**으로 운영한다. 출생년도는 테마별로 다르게 제한: **소개팅은 또래감을 위해 1990~2001년생**(법적 제한 아님, 2026-08-20 1999→2001로 상한 확장), **모임은 20대·30대 폭으로 1987~2007년생**(2026-08-26 2006→2007로 상한 확장). 한 사람이 대표로 신청하며 동행자까지 함께 등록하는 **그룹 신청**을 지원한다. 로그인 없이 **전화번호+접수번호로 참여내역 조회**(및 셀프 취소/환불 요청)도 가능하다. (로그인/카카오/네이버 시스템은 한때 회원제로 운영하며 만들었던 것으로, 삭제하지 않고 **휴면 처리**만 해둠 — 배경은 `docs/13-backlog.md` 의 "설계 변경 이력" 참고.)
- **음주 제공 (2026-08-15 정정)**: ~~"술을 제공하지 않기로 결정"~~ 은 과거 결정이었으나 WYE-73(참가~종료 프로세스 문서화)에서 **그룹 버전은 음주 없이 진행, 소개팅 버전은 2부부터 음주 제공**(BYOB 허용)으로 뒤집힘. 출생년도 제한이 이미 19세 이상을 훨씬 웃돌아(소개팅 1990~2001년생, 모임 1987~2007년생) 별도의 미성년자 확인 로직 추가는 필요 없지만, 현장 신분증 확인 시 음주 관련 안내가 더해짐(전날안내 SMS 3에 반영됨). 관련 카피는 `src/app/about/page.tsx`(PRINCIPLES), `src/components/apply/ApplyNotices.tsx`(소개팅 전용 불릿), `src/lib/sms.ts`(전날안내 템플릿)에 반영 완료.

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, **public**). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제). ⚠️ private였다가 Vercel Hobby(무료) 플랜으로 배포하기 위해 public으로 전환함(private 조직 저장소는 Vercel Pro 플랜이 필요) — 커밋 히스토리에 비밀키 없음을 확인 후 전환. `.env*`는 `.gitignore`로 계속 제외됨.
- Vercel: **연동 완료**. `wyestudio/wye-studio-home` Import, Vercel Team "WYE"(Hobby), 환경변수 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 완료. 배포 URL: `https://wye-studio-home-1ih0pshfp-wye1.vercel.app` (main 브랜치 push마다 자동 재배포됨). **커스텀 도메인 연결 완료**(`wouldyouescape.com`).
- 도메인: **`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료**(2026-08-06). 네임서버도 Cloudflare 사용 중.

# ⚠️ 커밋·푸시할 때

- **`develop` 에 먼저 올리고, 대표님이 확인한 뒤에 `main` 에 올린다** ← `main` push 는 곧
  운영 배포다. 확인 없이 운영에 나가면 되돌리는 비용이 훨씬 크다
- **배포 횟수가 빠듯할 때만 한 번에 묶는다.** 그때도 먼저 물어본다 (Vercel Hobby 100회/일)
- **커밋 메시지는 한 줄 한국어. 본문을 붙이지 않는다** ← 배경은 코드 주석이나 `docs/` 에
- **AI 협업 표기를 넣지 않는다** (`Co-Authored-By: Claude`, `Claude-Session:`, `🤖 Generated with…`)
  ← 대표님 본인 커밋으로 남아야 한다. 설정으로 꺼 뒀지만 초기화되면 다시 붙으므로 커밋 직전에 눈으로 확인한다
- **`git add -A` / `git add .` 를 쓰지 않는다. 이번 대화에서 편집한 파일만 경로로 지정해 add 한다**
  ← 여러 세션이 같은 저장소에서 동시에 작업한다. 전체 스테이징은 남의 편집물을 내 커밋에 싣는다
- 스테이징 후 `git status` 로 목록을 눈으로 확인하고 커밋한다
- **올리기 전에 `git log origin/main..HEAD` 로 올라갈 커밋을 확인한다. 다른 세션이 만든
  커밋이 섞여 있으면 올리지 말고 사용자에게 묻는다** ← 남의 작업을 대신 운영에 반영하는
  판단이 되고, 그 커밋이 아직 운영에 적용 안 된 마이그레이션을 쓰면 화면이 깨진다
  (경위는 `HISTORY.md`)

# ⚠️ 로컬에서 띄울 때

- **`.env.local` 기본값은 운영 DB 와 실제 솔라피 키다. 그대로 띄운 로컬에서 문자 발송·입금확인 같은 버튼을 누르면 실제 고객에게 나간다**
  ← 로컬이라고 안전하지 않다
- 화면을 눌러 확인할 때는 `TEST_SUPABASE_*` 값으로 덮어쓰고 `NEXT_PUBLIC_IS_TEST_ENV=true`, `SOLAPI_*` 를 비워서 띄운다
  (셸 환경변수가 `.env.local` 보다 우선한다). 어드민은 `admin.localhost:3000` 이라 포트는 3000 이어야 한다

# ⚠️ 작업 전 먼저 읽을 것

아래 파일을 건드리면 해당 스킬을 **먼저** 읽는다. 한 작업이 여러 개에 걸리면 전부 읽는다.

| 건드리는 것 | 읽을 스킬 |
|---|---|
| `src/lib/settlement.ts`, `src/lib/coupon*.ts`, 어드민 쿠폰·정산 화면, `preview_coupons()`·`submit_application*()` | `wye-money` |
| `supabase/migrations/`, 운영 DB 에 SQL 실행, `main` 브랜치 push(=운영 배포) | `wye-db-release` |
| `src/lib/attribution*.ts`, `utmLinks.ts`, `shortLinks.ts`, `ga4.ts`, 어드민 유입경로 화면, `next.config.ts` 의 `redirects()` | `wye-marketing` |
| `public/` 이미지, `theme-assets` 버킷, 화면 문구에 새 기호 | `wye-customer-facing` |

# 더 볼 곳

규칙이 아니라 **찾아볼 자료**는 `docs/` 에 있다. 필요할 때 열어본다.

| 무엇 | 어디 |
|---|---|
| 스택 선택 이유, 보안 설계 | `docs/11-stack-and-security.md` |
| 데이터 모델, 화면·라우팅 구조 | `docs/12-data-model-and-screens.md` |
| 미구현 항목, 앞으로 할 일, 설계 변경 이력 | `docs/13-backlog.md` |
| 운영 DB 실측 현황 | `docs/02-current-state-database.md` |
| 재설계 결정 기록 | `docs/06-decisions.md` |
| 전체 문서 목록 | `docs/00-INDEX.md` |
