# 프로젝트 개요

방탈출과 로테이션 소개팅을 결합한 상품(우주이스케이프)의 **비회원 구매(예약) 사이트**. 취미 프로젝트가 아니라 **실제 사업장**에서 쓸 사이트이며, 추후 국내 PG사(토스페이먼츠 등) 결제 연동 예정. 지금은 결제 대신 **무통장입금**만 지원.

고정 매장이 아니라 매번 파티룸을 대관해 진행하는 **회차(세션)** 단위 상품이며, 8/22(토) 오후(비소개팅)/저녁(소개팅) 2개 회차가 베타 상품이다(뮤트스페이스 신림점, 인당 6.9만원, 회차별 16~24명). 회원가입 없이 **신청(구매) 시점에 인적정보(이름/전화번호/출생년도)를 직접 받는 방식**으로 운영한다. 출생년도는 테마별로 다르게 제한: **소개팅은 또래감을 위해 1990~1999년생**(법적 제한 아님), **모임은 20대·30대 폭으로 1987~2006년생**. 한 사람이 대표로 신청하며 동행자까지 함께 등록하는 **그룹 신청**을 지원한다. 로그인 없이 **전화번호+접수번호로 참여내역 조회**(및 셀프 취소/환불 요청)도 가능하다. (로그인/카카오/네이버 시스템은 한때 회원제로 운영하며 만들었던 것으로, 삭제하지 않고 **휴면 처리**만 해둠 — 배경은 이 문서 하단 "설계 변경 이력" 참고.)
- **음주 제공 (2026-08-15 정정)**: ~~"술을 제공하지 않기로 결정"~~ 은 과거 결정이었으나 WYE-73(참가~종료 프로세스 문서화)에서 **그룹 버전은 음주 없이 진행, 소개팅 버전은 2부부터 음주 제공**(BYOB 허용)으로 뒤집힘. 출생년도 제한이 이미 19세 이상을 훨씬 웃돌아(소개팅 1990~1999년생, 모임 1987~2006년생) 별도의 미성년자 확인 로직 추가는 필요 없지만, 현장 신분증 확인 시 음주 관련 안내가 더해짐(전날안내 SMS 3에 반영됨). 관련 카피는 `src/app/about/page.tsx`(PRINCIPLES), `src/components/apply/ApplyNotices.tsx`(소개팅 전용 불릿), `src/lib/sms.ts`(전날안내 템플릿)에 반영 완료.

# 리포지토리 / 배포

- GitHub: **`wyestudio/wye-studio-home`** (조직 계정, **public**). 반드시 이 저장소를 써야 함 — 실수로 개인 계정(`wye-ting`)에 동명 저장소를 만든 적이 있으니 혼동 주의(정리 필요 시 `github.com/wye-ting/wye-studio-home/settings`에서 직접 삭제). ⚠️ private였다가 Vercel Hobby(무료) 플랜으로 배포하기 위해 public으로 전환함(private 조직 저장소는 Vercel Pro 플랜이 필요) — 커밋 히스토리에 비밀키 없음을 확인 후 전환. `.env*`는 `.gitignore`로 계속 제외됨.
- Vercel: **연동 완료**. `wyestudio/wye-studio-home` Import, Vercel Team "WYE"(Hobby), 환경변수 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 완료. 배포 URL: `https://wye-studio-home-1ih0pshfp-wye1.vercel.app` (main 브랜치 push마다 자동 재배포됨). **커스텀 도메인 연결 완료**(`wouldyouescape.com`).
- 도메인: **`wouldyouescape.com`을 Cloudflare Registrar에서 구매 완료**(2026-08-06). 네임서버도 Cloudflare 사용 중.

# 스택 및 결정 이유

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

---

# 화면 / 라우팅 구조

헤더 네비게이션은 **About / Contents / Check / Notice** 4개 메뉴로 구성(2026-08-10 재편, 로고 클릭이 이미 홈으로 가서 "홈" 메뉴는 따로 안 둠):

```
/                          홈 — Hero(회차 카드) + ConceptCards + ProcessSteps + FaqSection, 기존 형태 그대로 유지(사용자 요청)
/about                     About — 브랜드/회사 소개(ConceptCards, 회사 소개 문구는 아직 "준비 중") — 홈에도 동일 컴포넌트가 중복 노출됨(의도됨), NEXT_PUBLIC_ABOUT_ENABLED 환경변수로 배포 시 폐쇄
/contents                  Contents — 진행 방식(ProcessSteps) + 회차 카드 그리드(회차 상품 목록 허브) — 홈에도 동일 컴포넌트가 중복 노출됨(의도됨)
/sessions/[slug]           상품 소개 상세 (누구나 조회 가능, slug 기반 URL — 예: `/sessions/0829-meeting`)
/sessions/[slug]/apply     참가 신청 폼 (로그인 불필요. 비소개팅은 인원 선택+그룹 신청, 소개팅은 1인+성별 선택만)
/lookup                    Check(참여내역 조회) — 전화번호 + 접수번호로 신청 내역 확인. 네비 라벨만 영문화, URL은 유지
/notice                    Notice — 공지사항(NoticeSection) + FAQ(FaqSection) 한 페이지에 통합 — 홈에도 FaqSection이 동일하게 중복 노출됨(의도됨)
/admin/login      어드민 로그인 — 비밀번호 입력 (ADMIN_PASSWORD 환경변수), 성공 시 admin_auth 쿠키 발급(24시간, httpOnly)
/admin            어드민 대시보드 — 세션 목록 (상태(모집중/마감/비활성화)/정원/확정·대기 인원 표시), proxy.ts에서 ADMIN_PATH로 보호
/admin/sessions/[id]  세션별 신청자 목록 (대표 신청자 표시, 상태 필터) + 행별 액션(입금확인/대기→확정 전환/신청취소 버튼, 각각 문자2/6/4 발송) + 세션 단위 "회차 비활성화" 버튼(문자7, 확정·대기 전체 일괄취소, 2026-08-15 추가)
/api/cron/reminder         크론 전용 API — CRON_SECRET 토큰 인증, 24시간 이내 시작하는 세션(취소된 세션 제외) 중 입금까지 확인된 확정 신청에 대해 대표 신청자에게 전날안내(문자3) SMS 발송 (reminder_sms_sent_at 기록)

--- 아래는 휴면 처리됨(2026-08-09) — 코드는 남아있지만 어디서도 링크하지 않음 ---
/signup, /signup/check-email, /signup/profile
/login, /login/confirm-link
/account
/auth/**                   (callback, kakao/*, naver/*, oauth/*)
```

# 데이터 모델 (`supabase-schema.sql` 참고, v23)

- **sessions** — 회차(방탈출 테마 목록이 아님). v13부터 `slug text unique not null` 컬럼 신설(고객 URL용 슬러그, 예: `'0829-meeting'`, `'0829-dating'`). `theme_label`(v10부터 '바-ㅇ탈출(ver.모임)'/'바-ㅇ탈출(ver.소개팅)', 예전 값은 '비소개팅'/'소개팅')이 같은 테마 재참여 방지 기준으로도 쓰임 — 프론트에서 이 값과의 비교는 전부 `src/lib/theme.ts`의 `isDatingTheme()`를 거침(리터럴 문자열을 여러 곳에 흩어두지 않기 위해). v23부터 `content_group text not null` 컬럼 신설(아래 "테마 상호배타" 참고). v12부터 정원 로직 전면 재설계:
  - **비소개팅**: `capacity_confirm_line`=24(즉시확정), `capacity_max`=50(정원). 참여 인원 합계가 24명 이하면 confirmed, 25~49명은 waiting, 50명 도달 시 신청 거부.
  - **소개팅**: `capacity_confirm_line_male/female`=12(각 성별 즉시확정), `capacity_max_male/female`=30(각 성별 정원), 공통 `capacity_max`=60(전체 총원 상한). 신청한 성별의 인원이 12명 이하면 confirmed, 13~29명은 waiting, 30명 도달 시 그 성별 신청 거부. 60명 도달 시 전체 마감. `male_closed`/`female_closed` 플래그로 성별별 마감 상태 추적.
  - `status`는 v23부터 `'open' | 'closed' | 'cancelled'` 세 값 — `'closed'`는 정원마감(정상 진행), `'cancelled'`는 최소인원 미달 등으로 운영자가 회차 자체를 취소한 상태(어드민 "회차 비활성화" 버튼). 크론(`/api/cron/reminder`)은 `'cancelled'`만 제외하고 `'closed'`는 포함(정원마감 회차도 리마인더는 나가야 함).
  - 조회는 전체 공개, 등록/수정 정책 없음 → 시드 SQL/어드민 페이지에서 운영자가 처리.
- **session_venues** — 상호명(`venue_name`) + 주소(`venue_address`, v23 신설, 전날안내 SMS용) 전용 비공개 테이블. select/insert/update 정책·grant 전혀 없어 `anon`/`authenticated` 둘 다 API로 존재 자체를 알 수 없음. 운영자는 SQL Editor/Table Editor(테이블 소유자 권한이라 RLS 우회)에서만 조회·입력.
- **applications** — 신청 "건"(그룹 단위, 로그인 계정과 무관. 소개팅은 그룹이 항상 1명). `depositor_name_enc`(v8, 암호화됨)/`confirmation_code`/`status`/`payment_status`/`waiting_number`(v12, 대기자 순번, 확정자는 null)/`refund_bank_name`·`refund_account_number_enc`·`refund_account_holder_enc`(v17, 취소 시 환불계좌)/`consent_required`·`consent_optional`(v20, `agreed_terms` 대체). 직접 select/insert 정책·grant가 전혀 없음 — 생성은 `submit_application()`, 조회는 `lookup_application()`, 셀프 취소는 `cancel_application()`(v13-2 신규, v18에서 환불계좌 파라미터 추가)을 통해서만. SMS 중복발송 방지 마커 컬럼: `confirmation_sms_sent_at`/`payment_confirmed_sms_sent_at`/`reminder_sms_sent_at`.
- **application_attendees** (v7 신규, v12 강화, v23부터 테마별 출생년도 재분리) — 그룹 신청의 참여자 개개인(대표 신청자 포함 전원 한 행씩). `name_enc`/`phone_enc`(v8, 암호화됨)/`phone_hash`(v8, 매칭 전용 HMAC)/`birth_year`/`nickname`(선택, 평문)/`is_representative`/`gender`(v9, `'M'|'F'`, v20부터 전 테마 필수)/`experience_range`(v20 신규). `unique(session_id, nickname)`으로 같은 회차 내 닉네임 중복만 방지. select/insert 정책 없음 — 완전히 잠김.
- **테마 상호배타 → 컨텐츠 그룹 단위로 재정의** (v12 도입, v23 스코프 수정) — v12에서 "같은 사람이 어떤 테마든 1건만" 규칙을 도입했는데, 실제로는 세션/테마 필터가 전혀 없는 완전 전역 체크였다(실수가 아니라 당시엔 컨텐츠가 "바-ㅇ탈출" 하나뿐이라 결과가 같았을 뿐). WYE-73 문서화 과정에서 의도가 "같은 컨텐츠 안에서만 배타"임이 확인돼, v23에서 `sessions.content_group`을 신설하고 배타 체크를 `content_group` 일치 조건으로 스코프를 좁혔다. 지금은 소개팅/그룹 세션 모두 `content_group = 'baotalchul'`로 동일해서 기존과 동작이 같지만, 향후 새 컨텐츠(예: 대관형, 신규 방탈출 테마)가 생기면 서로 다른 `content_group`을 부여해 독립적으로 신청받을 수 있다. 취소된 신청은 여전히 카운트에서 제외됨(`status <> 'cancelled'`).
- **waiting_number** (v12) — 대기자(`status='waiting'`)에게만 계산되는 같은 세션/같은 성별 내 대기 순번. 확정자는 null. 자동 승격 로직은 없음(v12에서 완전 삭제) — 운영자가 어드민 페이지의 "대기→확정 전환" 버튼으로 수동 처리.
- **어드민 뷰/액션** (v12 뷰 신설, 2026-08-15 액션 확장) — `admin_attendee_view`/`admin_application_view`를 `/admin` 어드민 페이지 UI에서 조회. 신청 행별 액션 3종: 입금확인(문자2, 기존)/신청취소(문자4, 신규)/대기→확정 전환(문자6, 신규) — 각각 상태 가드(취소 아닌 확정만 입금확인, 취소 아닌 것만 취소, 대기인 것만 전환) 포함. 세션 단위 액션: "회차 비활성화"(문자7, 신규) — `sessions.status`를 `'cancelled'`로 바꾸고 그 세션의 confirmed/waiting 신청 전체를 일괄 cancelled 처리 + 각 대표 신청자에게 SMS. 마감 재오픈(`male_closed`/`female_closed`/`status` 리셋)은 여전히 SQL 수동 처리.
- **PII 암호화** (v8, 2026-08-09) — 전화번호로 중복/조회를 체크하는 구조라 보안에 더 신경써야 한다는 판단으로, `application_attendees.name/phone`과 `applications.depositor_name`을 평문으로 저장하지 않음. 상세는 "보안 강화" 섹션 참고. 키는 **Supabase Vault**에 `app_pii_key`라는 이름으로 저장. `encrypt_pii(text) returns bytea` / `decrypt_pii(bytea) returns text` 래퍼와 `hash_phone(text) returns text` HMAC 해시 함수로 처리.
- **submit_application()** (v7 `apply_and_recompute()` 대체, v8 암호화, v9 소개팅 분기, v12 대기 로직 재설계, v20 파라미터 정리, v23 배타 스코프+출생년도 재분리) — SECURITY DEFINER, `anon`+`authenticated` 실행 가능. 참여자 배열(jsonb)을 받아 ①약관 동의 ②(소개팅만) 그룹 크기 1 강제 + 성별 필수 ③출생년도 범위(**테마별 분기 — 소개팅 1990~1999 / 그룹 1987~2006**, v23에서 복원) ④컨텐츠 그룹 상호배타(전화번호 해시 + `content_group` 기준, v23) ⑤정원 초과 여부를 순서대로 검증 후 `applications`+`application_attendees`를 한 트랜잭션에 삽입. **그룹 전체가 들어갈 자리가 없으면 신청 자체를 거부**(부분 확정 없음, `"정원마감:"` 접두사 에러로 구분). 자동 승격 로직 없음(v12에서 완전 삭제).
  - ⚠️ v20 주석에 기록된 드리프트 이력: 한때 출생년도 검증이 ad-hoc하게 전 테마 통합 1987~2006으로 바뀌어 있었던 적이 있음(언제/누가 바꿨는지 기록 없음) — v23에서 테마별 분기로 복원했지만, 이 함수는 프로덕션 DB를 직접 고친 이력이 있었다는 뜻이니 향후 동작이 이 파일과 다르게 느껴지면 `pg_get_functiondef`로 실제 정의를 직접 대조할 것.
- **확정 로직 (v12 재설계)**: 비소개팅은 참여 인원이 24명 이하면 confirmed, 25~49명은 waiting, 50명 도달 시 신청 거부. 소개팅은 성별별로 독립 판정. **자동 승격 없음** — 모든 대기자는 영구 대기, 운영자가 수동으로 판정할 때까지.
- **get_session_stats(session_id)** (v7 재작성, v9에서 성별 카운트, v12에서 대기 구조 유지) — "신청 건수"가 아니라 "참여 인원 합계" 기준으로 confirmed/waiting 카운트 + 성별별 카운트. 비로그인 방문자도 볼 수 있는 공개 집계.
- **lookup_application(phone_digits, confirmation_code)** (v7 신규, v8에서 해시 매칭+복호화 반영) — 로그인 없이 참여내역을 조회. 접수번호는 **6자리 숫자**(100000~999999, 중복 시 재생성). 상세는 HISTORY.md 참고.
- **cancel_application(phone_digits, confirmation_code, refund_bank_name?, refund_account_number?, refund_account_holder?)** (v13-2 신규, v18에서 환불계좌 파라미터 추가) — 로그인 없이 참여자 본인이 `/lookup` 화면에서 셀프 취소. 상태를 `cancelled`로 바꾸고 환불계좌 정보를 저장(암호화). 환불 비율(48시간 전 100% / 24시간 전 50% / 이후 0%)은 `src/lib/format.ts`의 `calculateRefundAmount()`가 클라이언트에서 계산해 화면에 보여주고, 결제 확인된 취소 건은 `sendCancellationSlackAlert`로 `SLACK_REFUND_WEBHOOK_URL`에 환불 알림이 감. **지금까지 이 문서에 전혀 기록돼 있지 않던 기능**이었음(2026-08-15 WYE-73 문서 대조 중 발견) — `/lookup` 결과 화면(`LookupResult.tsx`)에 취소 버튼과 `RefundInfoDialog`가 이미 구현돼 있었음.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- **~~profiles / kakao_links / naver_links / find_account_by_email / find_account_by_phone~~** — 휴면 처리된 로그인 시스템이 쓰던 테이블/함수. 삭제하지 않고 스키마에 그대로 남아있음.

**중요한 교훈**: Supabase는 새 테이블을 만들어도 RLS 정책과 별개로 `anon`/`authenticated` 롤에 테이블 자체 권한(GRANT)을 자동으로 주지 않는다. 반대로 `session_venues`/`applications`/`application_attendees`처럼 **의도적으로 막고 싶은 테이블은 grant를 아예 안 주면 된다**. 이 규칙은 `service_role`에도 그대로 적용됨 — RLS는 우회하지만 테이블 GRANT는 별개.

# 보안 강화 (2026-08-09)

- **PII 컬럼 암호화** — Supabase Vault 키 기반. `encrypt_pii()`/`decrypt_pii()`, 전화번호 매칭은 `hash_phone()` HMAC 해시.
- **`next.config.ts`에 HSTS 헤더 추가** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **Supabase Database > Enforce SSL on incoming connections 활성화** — 직접 Postgres 접속(psql 등)에도 SSL 강제. **주의**: 이 설정을 바꾸면 DB 재시작으로 다운타임 발생.
- 이미 기본으로 잘 되어 있는 것(점검만 함): `.env*` gitignore, `service_role` 키 격리, 쿠키 `httpOnly`/`secure`/`sameSite: lax`, 전 구간 HTTPS, Supabase 디스크 암호화(관리형 자동), `applications`/`application_attendees` RLS 정책 0개.

# ⚠️ 돌이킬 수 없는 DB 작업은 증거 기반으로만 판단 (2026-08-14)

**프로덕션 데이터베이스 함수 삭제, 제약 조건 제거, 마이그레이션 롤백 등 한번 실행되면 원본을 복구할 수 없는 작업은 절대 추측이나 UI만 보고 판단하지 말 것.**

**2026-08-14 장애**: `submit_application()` 함수를 두 개(파라미터 개수 다름: 13개 vs 5개) 구분할 때 **이미지만 보고** "5개 파라미터가 현재 쓰는 버전"이라고 추측하고 13개 파라미터 함수를 삭제했으나, 실제로는 정반대였고 **프로덕션에서 쓰이는 함수를 삭제**해 **서비스 전체 마비** 장애 발생. 원본이 `supabase-schema.sql`에 기록돼 있지 않은(ad-hoc Supabase 함수) 탓에 원본을 찾을 수 없었음.

**앞으로의 절차**:
1. **프로덕션 DB 변경 전 (특히 삭제 전)**:
   - `git grep` / `git log -S` 로 리포지토리에서 실제 정의 위치 확인 (파일 경로, 라인 번호, 커밋 해시)
   - 실제 애플리케이션 코드(`actions.ts` 등)에서 어느 시그니처(파라미터 개수)를 호출하는지 grep으로 검증
   - Supabase Dashboard 스크린샷이 아닌 **코드 텍스트**로 확인
   - 삭제 전 백업본이 어디에 있는지 확인 (스키마 파일 / migration / 커밋 히스토리)

2. **사용자가 "정말 해도 되냐?"고 재확인할 때**:
   - 그것은 **경고 신호** — 작업을 멈추고 다시 검증할 것
   - **구체적인 증거**(파일 경로, 라인 번호, 커밋, grep 결과)를 모은 후 최종 판단
   - 추측이 아닌 **검증 결과**를 사용자에게 보여주기

3. **ad-hoc 함수 방지**:
   - 프로덕션 DB에 만든 새 함수는 반드시 `supabase-schema.sql`에 기록해 코드로 추적 가능하게 할 것
   - 향후 삭제 시 git 히스토리에서 원본을 복구할 수 있도록

# 향후 추가 예정 (설계는 돼 있으나 미구현 또는 부분 구현)

- **문자 알림 7종** (2026-08-15, WYE-73 문서 기준으로 전면 정리):
  - **문자1(신청확인)**: 코드 완성 + 실수신 검증 완료. **2026-08-15 오후 재활성화됨**(커밋 `6acee48`) — `src/app/sessions/[slug]/apply/actions.ts`가 `!isTest`일 때 무조건 발송 호출. ⚠️ Vercel Production에 SOLAPI 키가 실제로 설정돼 있는지는 아직 미확인 — 아래 "앞으로 할 일" 참고.
  - **문자2(입금확인)**: 어드민 "입금확인" 버튼(기존) — `payment_status` 업데이트 + SMS.
  - **문자3(전날안내)**: 크론(`/api/cron/reminder`) — 그룹/소개팅 별도 템플릿(장소·주소·주차·준비물·휴대폰보관·음주 안내)으로 2026-08-15 전면 재작성. 입금 미확인·취소된 세션(`cancelled`) 신청은 제외하도록 필터 보강.
  - **문자4(미입금취소)**: 어드민 "신청 취소" 버튼(2026-08-15 신규) — `status`/`payment_status`를 cancelled로 바꾸고 SMS. 30분 미입금 자동취소는 여전히 코드가 없고 운영자가 육안 판단 후 이 버튼으로 처리.
  - **문자5(대기접수완료)**: SMS 발송 없음(확정 결정) — 신청 완료 화면에서 대기 상태를 안내하는 것으로 충분.
  - **문자6(공석입금안내)**: 어드민 "대기→확정 전환" 버튼(2026-08-15 신규) — 유선으로 참여 의사를 확인한 대기자에게만 사용. `status`를 confirmed로 바꾸고 SMS.
  - **문자7(최소인원미달취소)**: 어드민 "회차 비활성화" 버튼(2026-08-15 신규, 세션 단위) — `sessions.status`를 cancelled로 바꾸고 해당 세션 confirmed/waiting 신청 전체를 일괄 cancelled 처리하며 각 대표 신청자에게 SMS.
- **최소 진행 인원(8명) 미달 자동판정** — **보류 확정**(2026-08-15). WYE-73 문서는 "행사 이틀 전 자동 판정+문자7 발송"을 설계했지만, 베타 규모라 운영자가 육안으로 판단해 "회차 비활성화" 버튼(문자7)을 수동으로 누르는 것으로 충분하다고 결정. `sessions.capacity_min` 컬럼은 참고용으로만 남아있고 확정 로직에 쓰이지 않음.
- **본인인증 검토** (2026-08-11, 팀 테스트 중 발견) — 형식 유효성 검사는 완료. 실제 "본인인증"(번호 소유자 확인)은 두 갈래: (a) PASS/통신사 본인인증 — 진짜 본인인증이지만 사업자등록번호 필요(사업자등록 이후 재검토), (b) 자체 SMS OTP — 기술적으로 가능하지만 남용 방지 로직 필요 — 당장은 보류.
- ~~이용약관/개인정보처리방침/환불정책 동의 문구 확정~~ — **완료 확인됨**(2026-08-15). `/terms`(제1~15조, 시행일 2026-08-14) · `/privacy` 페이지가 이미 존재하고 WYE-73 문서가 인용하는 조항 번호(제5~10조)·환불 비율(제8조)과도 일치함. 이 항목은 실제로는 오래전에 완료됐는데 문서 갱신이 안 돼 있었던 것 — 향후 약관 문구를 바꿀 땐 반드시 관련 SMS 템플릿(`src/lib/sms.ts`)·`RefundInfoDialog` 등 실제 구현과 같이 맞출 것.
- 04 실시간 모집 현황 단독 페이지, 05 참가 확인, 06 무통장입금 정식 안내(현재는 신청 완료 화면에 간이 버전만 있음), 09 문의하기.
- Phase 2: PG 결제 연동, 리뷰, 다회차/다지역 카탈로그, 애프터 매칭, 관리자 대시보드, 추천인 코드.

# 앞으로 할 일 (순서대로)

1. **문자1(신청확인) SMS 실발송 검증** — 2026-08-15 오후 코드상으로는 이미 재활성화됨(위 "문자 알림 7종" 참고). ⚠️ Vercel Production 환경에 SOLAPI 키(`SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER_NUMBER`)가 실제로 설정돼 있는지, 그리고 팀원 반복 테스트로 인한 요금 문제 재발 방지책(테스트 환경 분리는 `NEXT_PUBLIC_IS_TEST_ENV`로 이미 됨)이 충분한지 반드시 확인 후 실사용 트래픽을 받을 것.
2. **어드민 비밀번호/크론 시크릿 환경변수 설정** — 어드민 페이지(`/admin/login`)가 작동하려면 `.env.local`의 `ADMIN_PASSWORD`를 설정해야 하고(현재 비어있어 로그인이 항상 실패), 크론 API(`/api/cron/reminder`)가 작동하려면 `CRON_SECRET`을 설정해야 함(현재 없어 모든 크론 요청이 401). Vercel Production 환경변수에도 모두 등록 필요.
3. **외부 크론 서비스 실제 등록** — `/api/cron/reminder` 라우트는 완성되었지만, cron-job.org 같은 외부 서비스에 실제 등록하지 않아서 문자3(전날안내)이 자동 실행되지 않음. 위 `CRON_SECRET` 설정 후 `https://wouldyouescape.com/api/cron/reminder?token=[CRON_SECRET]`을 5~15분 주기로 호출하도록 등록할 것.
3-1. **`session_venues.venue_address` 실데이터 입력** (2026-08-15 컬럼 신설) — 문자3(전날안내) 템플릿이 이 값을 쓰는데 기존 8/29 세션 2건 모두 아직 비어있음. SQL Editor에서 실제 주소로 채워둘 것.
4. **동시성 검증** — Node.js 스크립트(임시, 스크래치패드 작성)로 모임/소개팅 각각 정원 근처까지 동시 신청을 `Promise.all`로 보냄 — 모임은 확정 24건 + 대기 1~26번을 정확히 받는지, 소개팅은 성별 각 12명 확정 + 대기 1~18번을 받는지, 51명 이상/성별 31명 이상은 모두 "정원마감:" 에러로 거부되는지 확인. `waiting_number` 순번이 race condition 없이 정확한지 검증. 테스트 후 생성된 신청 데이터는 `delete from applications where confirmation_code in (...)`로 정리.
5. **카카오 공유 시 메시지 포맷** — Open Graph 메타태그(`og:title`/`og:description`/`og:image`)는 SEO 작업으로 이미 세팅 완료(카카오톡 공유 시 기본 미리보기는 뜸). 카카오 SDK 공유 버튼("카톡으로 공유하기")은 아직 미착수.
6. 네이버 로그인 — 예전엔 "Supabase 기본 미지원(Custom OIDC 필요)"으로 적어뒀지만, 이후 실제로 네이버가 표준 OIDC를 지원하기 시작한 걸 확인함. 다만 로그인 시스템 자체가 지금 휴면 처리 상태라 우선순위는 낮음, 착수 전 재확인 필요.
7. 04~06, 09~12 나머지 베타 화면 순차 추가(이용약관/환불정책 문구 확정 포함), (나중) PG 결제 연동
8. **(사업자등록 완료 후)** 카카오 간편가입(카카오싱크) 전환 검토, 카카오 알림톡(번호 노출 없는 문자 대안)도 사업자등록 후 재검토.
9. **(보류)** 이메일 발송 문구 커스텀화 — 로그인 시스템이 휴면 처리되며 당장 불필요해짐.

# 설계 변경 이력 (요약)

- 최초 계획: 방탈출 테마 목록(`rooms`) + 로그인 신청(`applications`) + 리뷰(`reviews`), auth.uid() 기반 RLS.
- 1차 수정: 화면설계서 기준으로 회원가입 없는 1회성 신청 폼으로 단순화(무회원제) — `sessions`(회차) 개념 도입.
- 2차 수정: 참가자 성별·연령을 확실히 확인해야 해서(미성년자 술 제공 방지) **다시 회원제로 전환**. 이메일/비번 + 카카오/네이버 OAuth + 계정 연결 로직까지 실제로 완성.
- **3차 수정(2026-08-09, 현재)**: **술을 제공하지 않기로 사업 결정이 바뀌면서** 2차 수정의 원래 이유(미성년자 확인)가 사라짐. 계정 연결·중복 계정·orphan 계정 등 복잡도 증가를 감안해 **다시 비회원 구매 플로우로 전환**. 로그인/카카오/네이버 관련 코드(`src/app/{login,signup,auth,account}/**`, `src/lib/{kakao,naver,profile,oauthLink,accountLookup,age}.ts`, DB 테이블)는 **삭제하지 않고 휴면 처리** — 결제 연동 등으로 계정이 다시 필요해지면 참고. 이 전환과 함께 그룹 신청(대표자+동행자), 출생년도 1990~1999 제한, 전화번호+접수번호 기반 참여내역 조회(`/lookup`)도 함께 추가.
- 확정 로직도 초기 "16→20→24 4의 배수 단계식"에서 "1~20명 즉시확정 / 21~23명 대기 / 24명 도달 시 대기자 전원 확정+마감"으로 베타용 단순화한 뒤, 3차 수정에서 그룹 신청을 반영해 "신청 건수" 기준이 아니라 "참여 인원 합계" 기준으로 다시 다듬어짐.
- **4차 수정(2026-08-15)**: 3차 수정의 "술 미제공" 결정이 다시 뒤집힘 — WYE-73 문서화 과정에서 **소개팅 버전은 2부부터 음주를 제공**하기로 확정(그룹 버전은 여전히 미제공). 다만 이미 출생년도 제한이 19세를 훨씬 웃돌아 미성년자 확인 로직을 새로 추가할 필요는 없었음(2차 수정 때와 달리 나이 확인 자체가 이미 갖춰져 있었기 때문).

---

## 참고 문서

- **HISTORY.md** — 상세한 배경·시행착오·관련 파일 목록·트러블슈팅 기록. 새 항목의 full context를 알고 싶을 때 참고.
- **AGENTS.md** — Next.js 16/App Router 최신 컨벤션 확인용.
- **CLAUDE.local.md** — 개인 메모 (개발자 경험, 팀 협업 노트).
- **ANALYTICS.md** — GTM/GA4 설정 및 새 이벤트 추가 시 체크리스트.
