# 11. 스택과 보안 결정

> 이 문서는 2026-09-17에 `CLAUDE.md` 에서 옮겨온 것입니다. 매 세션 읽히는 파일을 짧게 유지하려고
> 규칙은 `CLAUDE.md`·스킬에 두고, 찾아볼 자료는 여기로 나눴습니다.

## 스택 및 결정 이유

- **Next.js 16 (App Router, TypeScript, Tailwind v4)** — 프론트엔드+백엔드(서버 액션)를 한 프로젝트에서 처리. 개발자가 순수 JS 경험만 있어서 React/Next.js는 Claude Code와 함께 배워가며 진행 중.
- **motion**(옛 Framer Motion, 2026-08-12 설치) — 헤더 메뉴 글자 스왑 호버 애니메이션(`RandomLetterSwap`)에 사용. import는 `"motion/react"`(패키지명이 `motion`으로 바뀌면서 서브패스도 같이 바뀜, `"framer-motion"` 아님).
- **Supabase (Postgres)** — Firebase(NoSQL) 대신 선택. 신청 관련 관계형 데이터를 다뤄야 하고, 향후 결제 연동 시 서버 사이드 검증이 필요하기 때문. 리전은 **Seoul (Northeast Asia)**.
- Supabase 프로젝트 생성 시 보안 옵션: **Data API ON / Automatically expose new tables OFF / Automatic RLS ON**
- **인증**: 비회원 구매 플로우로 전환하며 **휴면 처리됨**(2026-08-09). 이메일/비번 + 카카오/네이버 직접 OAuth 로그인까지 전부 완성해서 실제로 동작했었지만, 신청 플로우에서 더 이상 로그인을 요구하지 않게 되면서 코드는 남기고(`src/app/{login,signup,auth,account}/**`, `src/lib/{kakao,naver,profile,oauthLink,accountLookup,age}.ts`) 진입점만 제거함(`proxy.ts`, `Header.tsx`, 신청 페이지). 자세한 배경은 "설계 변경 이력" 3차 수정 참고.
- **이메일 발송(Confirm email)**: Supabase Auth의 "Confirm email"이 켜져 있어 가입 시 이메일 인증이 실제로 필요함. 기본 내장 메일 발송은 시간당 2건 수준으로 매우 제한적이라 **Resend를 커스텀 SMTP로 연결**해둠. `wouldyouescape.com`을 Resend에 등록하고 Cloudflare DNS에 DKIM(TXT `resend._domainkey`)/SPF(MX+TXT `send`)/DMARC(TXT `_dmarc`) 레코드를 추가해 **도메인 인증 완료(Verified, 2026-08-07)**. Supabase Auth SMTP 발신 주소도 `onboarding@resend.dev` → **`no-reply@wouldyouescape.com`**으로 변경 완료. Resend 리전은 Tokyo(ap-northeast-1) — 스팸 판정은 서버 지역이 아니라 SPF/DKIM/DMARC 인증으로 결정되므로 리전 자체는 무관.

---

## 🔄 최근 완료 항목 (타임라인)

**📝 새 항목은 1~2줄 요약만 추가; 상세한 서사·시행착오·관련 파일 목록은 `HISTORY.md` 참고.**

- 2026-08-09: 비회원 구매 플로우 전환 + PII 암호화 + 신청 실패 시 입력값 유지
- 2026-08-09: 브랜드명 "우주이스케이프"로 통일 + 헤더 BETA 마스코트 추가
- 2026-08-10: SEO 기초 작업 완료 (robots.ts / sitemap.ts / 메타태그 / OG 이미지)
- 2026-08-10: Slack 알림 + Solapi SMS 신청확인 발송 (1단계 구현, 2~3단계는 향후)
- 2026-08-10: 네비게이션 4개 메뉴 재편 + 소개팅 성비 분리 신청 로직
- 2026-08-10: Solapi SMS 실제 발송 검증 완료 (라이브 테스트)
- 2026-08-11: 전화번호 세그먼트 입력 + 형식 유효성 검사
- 2026-08-11: 페이지별 콘텐츠 보강 (상세/홈/About/Contents/Notice/신청폼)
- 2026-08-11: 홈페이지 히어로 + 스크롤텔링 전면 재작업 (ScrollStage 씬 구조)
- 2026-08-11~12: GTM/GA4 애널리틱스 연동 완료
- 2026-08-12: 테마 리브랜딩 + 8/29 일정·가격 변경 + 회차 카드 전면 재디자인
- 2026-08-12: 유리 네온 카드 디자인 통일 + About 환경변수 제어
- 2026-08-13: 8/29 회차 시각 변경 (모임 13:00 / 소개팅 18:00)
- 2026-08-13: 신청 폼 UX 개선 + v12 신청 확정/대기 로직 전면 재설계 (어드민 페이지/크론 API 포함)
- 2026-08-13: 회차 URL을 UUID에서 짧은 슬러그로 변경 (예: `/sessions/0829-meeting`, 기존 UUID 링크도 자동 리다이렉트)
- 2026-08-13: 세션별 SEO 메타데이터 추가 — generateMetadata + 동적 OG 이미지 (`/sessions/[slug]/opengraph-image.tsx`)
- 2026-08-14: 출생년도 제한 안내 문구 추가 + 모임 연령대 확장 (소개팅 1990~1999 유지 / 모임 1987~2006 확장)
- 2026-08-14: `/contents` 회차 카드 컴팩트 스타일 적용 + "/ 인당" 문구 제거, 홈은 기존 스타일 유지
- 2026-08-15: WYE-73(참가~종료 프로세스 문서화) 대조 후 문서-코드 정합화 — 음주 정책 반전(소개팅만 2부부터 제공), `content_group` 신설로 크로스테마 배타 스코프 수정, 서버 출생년도 검증 테마별 분기 복원(v23), `sessions.status`에 `cancelled` 추가, 문자4/6/7 SMS 신규 구현 + 어드민 액션 3종(신청취소/대기승격/회차비활성화) 추가, `/lookup` 셀프취소·`/terms` 페이지가 이미 구현돼 있었다는 사실을 문서에 반영
- 2026-08-20: 소개팅 출생년도 상한 1999→2001로 확장 (`src/lib/eligibility.ts` 상수 + DB `submit_application()` v30, test/prod 둘 다 적용)
- 2026-08-20: wouldyouescape_test 대상 동시성/스트레스 테스트 진행 — 정원 로직(오버부킹) 문제 없음 확인, 대기 순번 중복·성별 정원 오참조 버그 2건 발견해 `submit_application()` v31로 test/prod 모두 수정
- 2026-08-20: test/운영 DB 함수·이벤트 트리거 전체 대조(md5 해시 비교) — `get_session_stats()` 운영 버전이 컬럼명부터 다르게 드리프트돼 있던 것(다행히 미사용) + `rls_auto_enable` 이벤트 트리거(신규 테이블 자동 RLS)가 운영에만 없던 것 발견, v32로 운영에 동일 반영. Vercel 환경변수 키 목록도 대조 — SOLAPI 키 운영 설정 확인됨, 불필요한 `TEST_SUPABASE_*` 키가 운영 프로젝트에 남아있던 것 삭제
- 2026-08-26: 그룹(모임) 출생년도 상한 2006→2007로 확장 (`src/lib/eligibility.ts` 상수 + DB `submit_application()`/CHECK 제약 v40, test에서 경계값 RPC 검증 후 운영 라이브 트래픽 중 무중단 반영)
- 2026-09-13: 테마 상세 가격표를 어드민 블록으로 분리(순서 이동·숨김 가능) + 참가비 포함 블록에 라벨·제목 추가, 판 안 큰 문구를 `headline` 으로 분리. `themes.content` 에 구조 버전 `v` 신설(현재 3) — 읽을 때 옛 버전을 자동 변환하고 저장하면 최신 버전으로 굳는다
- 2026-09-15: 본문 글꼴(SUIT)에 없는 글자 때문에 일부 기기에서 화살표가 `E`/`e`로 보이던 문제 수정 — UI 화살표는 SVG(`components/ui/Chevron.tsx`)로 대체, 한글 대체 글꼴 스택 추가, SUIT에 없는 기호만 담은 6KB 보조 글꼴 신설(`fonts/WyeSymbols-*`)
- 2026-09-15: 구글 이미지에 옛 소개팅 큐피드 아트웍이 계속 뜨던 문제 — `public/bar-o-title.png` 를 같은 이름으로 교체(08-11→08-13)해 구글이 옛 그림을 그 URL 에 캐시하고 있었음. 파일과 죽은 코드(SessionShowcase·SessionScene·ContentsSessionShowcase) 삭제해 404 처리
- 2026-09-15: 신청 건에 유입경로(utm) 저장 — 잼핏 등 외부 플랫폼 입점이 **방문이 아니라 실제 신청**으로 이어지는지 보려고 추가. `applications` 에 `utm_*`·`referrer`·`landing_path` 7개 컬럼(p29), 어드민 분석에 경로별 신청·입금·매출 표. 자세한 규칙은 아래 「유입경로(utm)를 건드릴 때」
- 2026-09-15: **운영 장애** — 테마 상세 배포 때 다른 세션이 만든 마이그레이션 2개(p30 genres, p31 theme_categories)를 빠뜨려 `/themes/[slug]` 가 500. 칸을 추가해 복구. 재발 방지는 아래 「운영에 배포할 때」 참고
- 2026-09-15: 잼핏(ZAMFIT) 제휴 — 인당 할인 쿠폰(`per_head`) 500장 발급, 유입경로 `?utm_source=zamfit`, 어드민에 「잼핏 정산」 화면과 쿠폰 CSV 내려받기 추가. 정산 규칙은 아래 「잼핏 정산을 건드릴 때」 참고
- 2026-09-16: 쿠폰 중복 적용 — 잼핏+인스타 이벤트는 겹쳐 쓰고 프리오픈은 불가(캠페인별 `stackable`). `application_coupons` 표 신설, `submit_application_v3`·`preview_coupons` 추가, 정산을 새 표 기준으로 이전. 인스타 쿠폰 300장(접두사 E, ~10/4) 발급. 자세한 규칙은 아래 「쿠폰을 건드릴 때」
- 2026-09-15: 테마 상세 상단을 방탈출 사이트식으로 재배치 — 포스터 옆에 난이도·소요시간(큰 숫자)·장르 해시태그·시놉시스, 날짜 선택은 아래 `#booking` 섹션으로 내림. `themes.genres text[]` 신설(p30), 시놉시스는 비어 있던 `description` 칸을 그대로 씀. 어드민에 장르 태그 입력 추가

---

## 보안 강화 (2026-08-09)

- **PII 컬럼 암호화** — Supabase Vault 키 기반. `encrypt_pii()`/`decrypt_pii()`, 전화번호 매칭은 `hash_phone()` HMAC 해시.
- **`next.config.ts`에 HSTS 헤더 추가** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Supabase Database > Enforce SSL on incoming connections 활성화** — 직접 Postgres 접속(psql 등)에도 SSL 강제. **주의**: 이 설정을 바꾸면 DB 재시작으로 다운타임 발생.
- 이미 기본으로 잘 되어 있는 것(점검만 함): `.env*` gitignore, `service_role` 키 격리, 쿠키 `httpOnly`/`secure`/`sameSite: lax`, 전 구간 HTTPS, Supabase 디스크 암호화(관리형 자동), `applications`/`application_attendees` RLS 정책 0개.
