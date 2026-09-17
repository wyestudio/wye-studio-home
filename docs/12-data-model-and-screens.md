# 12. 데이터 모델과 화면 구조

> 이 문서는 2026-09-17에 `CLAUDE.md` 에서 옮겨온 것입니다. 매 세션 읽히는 파일을 짧게 유지하려고
> 규칙은 `CLAUDE.md`·스킬에 두고, 찾아볼 자료는 여기로 나눴습니다.

## 데이터 모델 (`supabase-schema.sql` 참고, v23)

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
- **submit_application()** (v7 `apply_and_recompute()` 대체, v8 암호화, v9 소개팅 분기, v12 대기 로직 재설계, v20 파라미터 정리, v23 배타 스코프+출생년도 재분리, v30 소개팅 출생년도 상한 확장, v31 동시성 버그 2건 수정, v40 그룹 출생년도 상한 확장) — SECURITY DEFINER, `anon`+`authenticated` 실행 가능. 참여자 배열(jsonb)을 받아 ①약관 동의 ②(소개팅만) 그룹 크기 1 강제 + 성별 필수 ③출생년도 범위(**테마별 분기 — 소개팅 1990~2001 / 그룹 1987~2007**, v23에서 복원, v30에서 소개팅 상한 1999→2001로 확장, v40에서 그룹 상한 2006→2007로 확장) ④컨텐츠 그룹 상호배타(전화번호 해시 + `content_group` 기준, v23) ⑤정원 초과 여부를 순서대로 검증 후 `applications`+`application_attendees`를 한 트랜잭션에 삽입. **그룹 전체가 들어갈 자리가 없으면 신청 자체를 거부**(부분 확정 없음, `"정원마감:"` 접두사 에러로 구분). 자동 승격 로직 없음(v12에서 완전 삭제).
  - ⚠️ v20 주석에 기록된 드리프트 이력: 한때 출생년도 검증이 ad-hoc하게 전 테마 통합 1987~2006으로 바뀌어 있었던 적이 있음(언제/누가 바꿨는지 기록 없음) — v23에서 테마별 분기로 복원했지만, 이 함수는 프로덕션 DB를 직접 고친 이력이 있었다는 뜻이니 향후 동작이 이 파일과 다르게 느껴지면 `pg_get_functiondef`로 실제 정의를 직접 대조할 것.
  - **v31(2026-08-20)**: wouldyouescape_test에서 동시 신청 스트레스 테스트(Promise.all 60~200건) 중 발견한 버그 2건 수정. (1) 대기 순번(waiting_number)이 `created_at`(=트랜잭션 시작 시각) 비교로 계산돼 동시 요청 시 순번 중복/누락 발생 가능 — 자기 자신을 제외한 현재 대기 건수 카운트 + 1 방식으로 교체(타임스탬프 비의존). (2) 소개팅 정원 체크가 성별 무관하게 `capacity_max_female`만 참조 — 성별 분기 추가(현재 남녀 정원이 둘 다 30이라 지금까지 겉으로 안 드러났음). test에서 재검증 후 운영에도 동일 적용 완료, `supabase-schema.sql`에도 기록함. 정원 로직 자체(오버부킹 여부)는 이번 테스트에서 문제 없음 확인됨 — `select ... for update` 락이 동시 요청을 정확히 직렬화하고 있었음.
  - **v40(2026-08-26)**: 그룹(모임) 출생년도 상한 2006→2007 확장. `src/lib/eligibility.ts`의 `MEETING_BIRTH_YEAR_MAX`, `application_attendees.birth_year` CHECK 제약, `submit_application()` 검증 로직 3곳을 동시에 갱신. 실사용자 접속 중 배포였기 때문에 (1) wouldyouescape_test에서 경계값(1986 거부/2007 승인/2008 거부) RPC 호출로 먼저 검증, (2) 테이블 CHECK 제약을 먼저 넓힌 뒤 함수를 교체하는 순서로 운영 반영(반대 순서면 넓어진 함수가 여전히 좁은 CHECK 제약에 막히는 순간이 생김), (3) 테이블 39행이라 두 DDL 모두 밀리초 단위로 끝나 다운타임 없음.
- **확정 로직 (v12 재설계)**: 비소개팅은 참여 인원이 24명 이하면 confirmed, 25~49명은 waiting, 50명 도달 시 신청 거부. 소개팅은 성별별로 독립 판정. **자동 승격 없음** — 모든 대기자는 영구 대기, 운영자가 수동으로 판정할 때까지.
- **get_session_stats(session_id)** (v7 재작성, v9에서 성별 카운트, v12에서 대기 구조 유지) — "신청 건수"가 아니라 "참여 인원 합계" 기준으로 confirmed/waiting 카운트 + 성별별 카운트. 비로그인 방문자도 볼 수 있는 공개 집계.
- **lookup_application(phone_digits, confirmation_code)** (v7 신규, v8에서 해시 매칭+복호화 반영) — 로그인 없이 참여내역을 조회. 접수번호는 **6자리 숫자**(100000~999999, 중복 시 재생성). 상세는 HISTORY.md 참고.
- **cancel_application(phone_digits, confirmation_code, refund_bank_name?, refund_account_number?, refund_account_holder?)** (v13-2 신규, v18에서 환불계좌 파라미터 추가) — 로그인 없이 참여자 본인이 `/lookup` 화면에서 셀프 취소. 상태를 `cancelled`로 바꾸고 환불계좌 정보를 저장(암호화). 환불 비율(48시간 전 100% / 24시간 전 50% / 이후 0%)은 `src/lib/format.ts`의 `calculateRefundAmount()`가 클라이언트에서 계산해 화면에 보여주고, 결제 확인된 취소 건은 `sendCancellationSlackAlert`로 `SLACK_REFUND_WEBHOOK_URL`에 환불 알림이 감. **지금까지 이 문서에 전혀 기록돼 있지 않던 기능**이었음(2026-08-15 WYE-73 문서 대조 중 발견) — `/lookup` 결과 화면(`LookupResult.tsx`)에 취소 버튼과 `RefundInfoDialog`가 이미 구현돼 있었음.
- `reviews`, 관리자 대시보드는 이번 스키마에 없음(Phase 2).
- **~~profiles / kakao_links / naver_links / find_account_by_email / find_account_by_phone~~** — 휴면 처리된 로그인 시스템이 쓰던 테이블/함수. 삭제하지 않고 스키마에 그대로 남아있음.

**중요한 교훈**: Supabase는 새 테이블을 만들어도 RLS 정책과 별개로 `anon`/`authenticated` 롤에 테이블 자체 권한(GRANT)을 자동으로 주지 않는다. 반대로 `session_venues`/`applications`/`application_attendees`처럼 **의도적으로 막고 싶은 테이블은 grant를 아예 안 주면 된다**. 이 규칙은 `service_role`에도 그대로 적용됨 — RLS는 우회하지만 테이블 GRANT는 별개.

## 화면 / 라우팅 구조

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
