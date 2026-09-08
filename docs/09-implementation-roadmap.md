# 09. 구현 로드맵 · 배포 전략

**작성일**: 2026-09-08
**근거**: [06](./06-decisions.md) 결정 · [07](./07-architecture-domain-and-data.md) 데이터 모델 · [08](./08-architecture-screens-and-admin.md) 화면·어드민

---

## 1. 지금 배포 상태 (2026-09-08 기준)

> 사용자 질문: *"이거 지금 바로 운영에 반영되고 있는 거 아니지?"*

### 코드 — **아무것도 배포되지 않았다** ✅

| 항목 | 상태 |
|---|---|
| 커밋 5개 (`80bcd77` ~ `072ac6d`) | **로컬 `develop`에만 존재. push 안 함** |
| `test.wouldyouescape.com` | 변화 없음 |
| `www.wouldyouescape.com` | 변화 없음 (마지막 배포 2026-08-30) |

지금까지 만든 건 **전부 문서와 워크플로 파일**이고, 애플리케이션 코드는 한 줄도 건드리지 않았다.

### 운영 DB — **변경 1건이 반영되어 있다** ⚠️

| 마이그레이션 | 내용 | 검증 |
|---|---|---|
| `v44_revoke_pii_functions_from_public` | `encrypt_pii`/`decrypt_pii`/`get_pii_key`의 PUBLIC 실행권한 회수 | 적용 후 운영 사이트 `/`, `/contents`, `/lookup`, `/sessions/0829-meeting` **전부 HTTP 200**. 어드민 복호화 뷰도 정상 |

**되돌리려면**: `grant execute on function public.<fn> to public;` — 언제든 복구 가능하다.

### ⭐ 지금이 마이그레이션 최적기인 이유

```
모집 중인 회차   0건
미래 회차        0건
최근 7일 신청    0건
마지막 신청      2026-08-28
```

**진행 중인 회차가 없어 신규 신청 트래픽이 0이다.** 즉 스키마를 바꾸는 동안 **깨질 실시간 플로우가 없다.** 다음 회차를 열기 전에 끝내는 것이 이번 작업의 가장 큰 이점이다.

> 살아 있는 트래픽은 `/lookup`(지난 참가자의 참여내역 조회)뿐이다. 이 경로는 이번 변경에서 **건드리지 않는다.**

> 📌 **`refund_completed_at`이 비어 있는 건에 대해** (2026-09-08 사용자 확인):
> 취소 21건 중 `refund_completed_at`이 비어 있는 16건은 **입금 전 단순 취소 건이라 환불할 금액 자체가 없었다.** 이 컬럼이 필요 없는 건들이므로 정상이다.
>
> 참고로 실제 데이터는 이렇다 — 취소 21건 중 입금확인 문자(문자2)가 나간 건 10건, 환불계좌가 입력된 건 5건, 환불완료로 표시된 건 5건.
> **신규 설계에서는 "환불 대상"과 "환불 완료"를 구분해서 판단해야 한다.** `refund_completed_at is null` 하나로 미환불을 판정하면 입금 전 취소 건까지 환불 대기로 잡힌다 → [08 어드민 대시보드](./08-architecture-screens-and-admin.md)의 "환불 대기" 카운트는 **결제가 확인됐던 건에 한정**할 것.

---

## 2. 배포 전략 — 테스트에서 다 보고, 운영은 한 번에

사용자 요구: *"테스트에 일단 올려서 보고 한번에 운영에 열고 싶다."*
현재 구조가 이미 이걸 지원한다.

```
   develop ──push──> Vercel 테스트 프로젝트 ──> test.wouldyouescape.com
      │                                          (SITE_ACCESS_PASSWORD 게이트로 외부 차단)
      │                                          여기서 원하는 만큼 확인
      │
      └──merge──> main ──> Vercel 운영 프로젝트 ──> www.wouldyouescape.com
                                                    ⭐ 이 머지 한 번이 곧 오픈
```

**코드는 이 방식으로 완벽히 통제된다.** 테스트 사이트는 비밀번호 게이트가 걸려 있어 고객이 볼 수 없고, 문자도 나가지 않는다(`NEXT_PUBLIC_IS_TEST_ENV`).

### ⚠️ 그런데 DB는 코드처럼 "한 번에" 바뀌지 않는다

이게 이번 작업의 **핵심 난점**이다.

```
코드:  develop → main 머지 = 순간적으로 전환      (되돌리기 쉬움)
DB:    운영 DB와 테스트 DB는 완전히 별개 프로젝트  (되돌리기 어려움)
```

**`main`에 머지하는 순간 새 코드는 새 스키마(`themes` 테이블 등)를 요구한다.** 그런데 운영 DB에 그게 없으면 **머지 즉시 전체 장애**다.

→ 해결책은 **DB를 코드보다 먼저 준비해두는 것**이다.

---

## 3. 마이그레이션 원칙 — Expand · Migrate · Contract

DB 변경을 세 단계로 쪼개, **각 단계가 단독으로 안전**하게 만든다.

```
[ Expand  ]  신규 테이블·컬럼을 "추가"만 한다
             → 기존 코드는 모르는 테이블이므로 아무 영향 없음
             → 운영 DB에 미리 넣어둘 수 있다 ⭐

[ Migrate ]  데이터를 신규 구조로 옮기고, 신규 코드를 배포한다
             → 테스트에서 전수 검증 후 main 머지 (오픈)

[ Contract ]  더 이상 쓰지 않는 구 컬럼·테이블을 제거한다
             → 신규 시스템이 몇 주 안정된 뒤에만
             → 되돌릴 수 없으므로 가장 마지막
```

**Expand 단계를 운영 DB에 미리 적용해두면**, 오픈 당일에 할 일이 **머지 한 번**으로 줄어든다. 이게 "한 번에 열고 싶다"를 안전하게 만드는 방법이다.

> Contract를 몇 주 미루는 이유: `session_type`, 성별 정원 6컬럼, `content_group`, `slot` 제거는 **되돌릴 수 없다.** 운영 중 예상 못 한 참조가 드러날 수 있다. 2026-08-14 프로덕션 함수 오삭제 장애의 교훈 그대로다.

---

## 4. 단계별 로드맵

### Phase 0 — 기반 정리 (코드 배포 없음, 리스크 최저)

지금 바로 할 수 있고, 뒤 단계의 전제가 되는 것들.

| # | 작업 | 상태 |
|---|---|---|
| 0-1 | **백업 시크릿 3개 등록 + 첫 백업 검증** | ⏳ 담당자 조치 대기 ([런북 §1](./RUNBOOK-db-backup-restore.md)) |
| 0-2 | **Vault PII 키 별도 보관** | ⏳ 담당자 조치 대기 |
| 0-3 | `v45` 위생 마이그레이션 (`applications`의 `authenticated` SELECT 회수, `sessions_generate_labels` search_path) | ⏳ 권한 승인 대기 |
| 0-4 | **크론 실행 기반 구축** | 미착수 |
| 0-5 | **스키마 관리 전환** — `supabase/migrations/` + 선언형 `supabase/schema.sql` | 미착수 |

> **0-1은 다음 단계의 하드 전제다.** 스키마를 크게 바꾸기 전에 되돌아갈 지점이 반드시 있어야 한다.
>
> **0-4가 왜 필요한가**: 현재 `/api/cron/reminder`가 **어디에도 등록되지 않아 자동 실행되지 않는다**(`vercel.json` 없음, GitHub Actions에는 keepalive만). 전날안내 문자는 지금 어드민 버튼으로 수동 발송 중이다. 매주 운영에서는 이게 매주 수작업이 되고, **입금 자동 매칭도 크론 위에서 돈다.** 크론 기반이 없으면 Phase 5가 성립하지 않는다.

### Phase 1 — Expand: 운영 DB에 신규 스키마 추가

**기존 코드에 영향 없음.** 테스트 DB에 먼저 적용 → 검증 → 운영 DB 적용.

```
신규 테이블   venues, themes, bank_transactions, site_settings,
              notices, faqs, admin_users, audit_logs, point_ledger

신규 컬럼     sessions      + theme_id(nullable), *_override, legacy_format, legacy_slug
              applications  + user_id, headcount, unit_price_krw,
                              amount_krw, depositor_name_hash

신규 함수     normalize_depositor_name(), is_eligible_birth_year()
신규 뷰       session_view, venue_public
```

`theme_id`를 **nullable로 추가**하는 게 핵심이다. Phase 2에서 값을 채운 뒤 `not null`로 조인다.

> 모든 신규 함수는 생성 즉시 `revoke execute from public` — [07 §6](./07-architecture-domain-and-data.md)의 v44 재발 방지 규칙.

### Phase 2 — Migrate: 데이터 이관

| # | 작업 |
|---|---|
| 2-1 | `venues` 1건 생성 (**실제 주소 입력 필요** — 현재 `venue_address`가 비어 있다) |
| 2-2 | `themes` 「바-ㅇ탈출」 1건 생성 + `content` JSONB에 기존 하드코딩 콘텐츠 이관 |
| 2-3 | 기존 회차 2건에 `theme_id` 연결, `legacy_format`/`legacy_slug`/`*_override` 채우기 |
| 2-4 | `applications` 58건에 `headcount`/`unit_price_krw`/`amount_krw`/`depositor_name_hash` 채우기 |
| 2-5 | **검증** — 아래 쿼리 결과가 이관 전후로 동일해야 한다 |

```sql
-- 재참여 차단 대상 인원 (이관 전후 동일해야 함)
select count(distinct aa.phone_hash)
from application_attendees aa
join applications ap on ap.id = aa.application_id
where ap.status <> 'cancelled';

-- 회차별 인원 (이관 전후 동일해야 함)
select s.id, count(aa.id)
from sessions s
join applications ap on ap.session_id = s.id and ap.status <> 'cancelled'
join application_attendees aa on aa.application_id = ap.id
group by s.id;
```

> `content_group = 'baotalchul'`이 곧 「바-ㅇ탈출」 테마이므로 **1:1 치환**이다. 소개팅·그룹 참여자 모두 같은 테마에 묶여 재참여가 차단된다 — [D-05 정정](./06-decisions.md) 의도 그대로.

### Phase 3 — 신규 코드 (테스트에서 전수 검증) ⭐ 가장 큰 덩어리

`develop`에 쌓고 `test.wouldyouescape.com`에서 확인한다. **운영은 아직 그대로다.**

| 순서 | 범위 | 왜 이 순서인가 |
|---|---|---|
| 3-1 | **어드민: 테마 · 회차 · 장소 CRUD** | 이게 없으면 테스트에서 회차를 못 만들어 나머지를 검증할 수 없다 |
| 3-2 | **공개 화면**: `/themes/[slug]` + 날짜 선택, `/contents` 테마 그리드, 홈 카드 | |
| 3-3 | **신청 플로우**: 소개팅 분기 제거, 만 14세, 성별 선택, 입금자명 강조, 완료 화면 | |
| 3-4 | **어드민: 신청 목록 + 검색**, 대시보드 처리 대기 | |
| 3-5 | 라우팅 정리: `/sessions/*` → `/themes/*` 리다이렉트, UTM 짧은 링크 6개, `sitemap.ts` | |

**테스트 검증 체크리스트** (오픈 전 전부 통과해야 함):

- [ ] 테마 등록 → 회차 4주치 반복 생성 → 공개 화면에 날짜 4개 노출
- [ ] 타임테이블이 회차 시각에 따라 자동 계산 (14시 / 19시 회차 각각 확인)
- [ ] 1인 신청 / 그룹 신청(동행자 포함) 각각 성공
- [ ] 만 14세 경계값: `올해-15`년생 승인, `올해-14`년생 거부
- [ ] 성별 미입력으로 신청 성공 (선택 입력)
- [ ] **재참여 차단**: 같은 전화번호로 같은 테마 재신청 시 거부
- [ ] 다른 테마는 신청 가능 (테마 2개 만들어 확인)
- [ ] 정원 도달 시 마감 처리, 대기 상태 진입, 대기 순번 표시
- [ ] `/lookup` 조회 — **기존 8/29 참가자 데이터가 그대로 조회되는지** ⭐
- [ ] 셀프 취소 + 환불계좌 입력
- [ ] 어드민: 입금확인 / 취소 / 대기승격 / 회차비활성화 4종 액션 + 문자 발송
- [ ] `/sessions/0829-meeting` → `/themes/baotalchul` 리다이렉트
- [ ] UTM 짧은 링크 13개 전부 정상 목적지
- [ ] 문자 템플릿 7종 미리보기 정상
- [ ] 모바일 뷰포트 확인

> `/lookup` 항목이 ⭐인 이유: 기존 고객 67명의 참여내역 조회가 깨지면 **실제 고객 피해**다. 이번 변경에서 가장 조심할 지점.

### Phase 4 — 운영 오픈 (머지 한 번)

**전제**: Phase 1·2가 운영 DB에 이미 적용돼 있고, Phase 3이 테스트에서 전부 통과.

**당일 절차**:

1. `db-backup.yml` **수동 실행** → 백업 성공 확인
2. 운영 DB 상태 재확인 (Phase 2 검증 쿼리 재실행)
3. `develop` → `main` 머지 → Vercel 자동 배포
4. 배포 후 **5분 내 스모크 테스트**:
   - `/`, `/contents`, `/themes/baotalchul` HTTP 200
   - `/lookup`에서 기존 접수번호로 조회 성공
   - 신규 회차 신청 1건 실제 진행 후 취소
5. Slack 알림·문자 발송 정상 확인
6. 이상 시 → **롤백**(아래 §5)

> 4-2단계에서 **신청 폼에 실제로 1건 넣어보는 것**을 권한다. 테스트 DB에서 통과해도 운영 DB의 데이터 상태는 다르다.

### Phase 5 — 입금 자동화 (오픈뱅킹) — **오픈과 분리**

⚠️ **오픈뱅킹은 이용기관 심사 기간이 있어 오픈 일정에 맞추지 못할 수 있다.**

→ **Phase 4(오픈)는 입금 자동화 없이도 가능하도록 설계한다.** 그때까지는 현행 어드민 "입금확인" 버튼(수동)을 그대로 쓴다. 지금까지 그렇게 운영해왔으므로 후퇴가 아니다.

| # | 작업 |
|---|---|
| 5-1 | 오픈뱅킹 vs 은행 기업 OpenAPI 비교 후 선택, 이용기관 신청 |
| 5-2 | 거래내역 수집 크론 → `bank_transactions` |
| 5-3 | 자동 매칭 로직 (금액 + 입금자명 해시) |
| 5-4 | **어드민 미매칭 입금 화면** ← 자동화보다 이게 먼저 있어야 한다 |
| 5-5 | 30분 미입금 자동취소 |
| 5-6 | 입금 계좌를 개인 → 사업자 명의로 변경 검토, `site_settings`로 이전 |

> 5-4를 5-3보다 먼저 만들어도 된다. 미매칭 처리 화면은 **수동 운영 상태에서도 유용**하다.

### Phase 6 — 로그인 · 포인트

| # | 작업 |
|---|---|
| 6-1 | 휴면 로그인 진입점 복구 (`/login`, `/signup`, `/account`) + 헤더 노출 |
| 6-2 | 테스트 Vercel에 `KAKAO_*` / `NAVER_*` 키 추가 (현재 없음) |
| 6-3 | 네이버 OIDC 현행 재확인 → 가능하면 Supabase Custom OIDC로 단순화 |
| 6-4 | 신청 ↔ 계정 연결 (`user_id`), 비회원 신청 **사후 귀속** (전화번호+접수번호 확인) |
| 6-5 | 재신청 자동입력 · 참여 이력 화면 |
| 6-6 | 포인트 원장 + 적립·사용 규칙 |
| 6-7 | `disable_signup` 정책 확정 + rate limit |

### Phase 7 — 어드민 나머지

정산·매출, 고객 관리, 공지·FAQ 편집, 문자 발송 이력, 운영자 계정·역할·감사로그.

> **감사로그는 앞당길 가치가 있다.** 되돌리기 어려운 액션이 늘어나기 전에 들어가는 게 낫다.

### Phase 8 — Contract: 구 스키마 제거

신규 시스템이 **최소 2~3주 안정 운영된 뒤**에만.

```
sessions      - session_type, slot, content_group, theme_label,
                capacity_confirm_line_male/female, capacity_max_male/female,
                male_closed, female_closed
applications  - agreed_terms, consent_no_rebooking,
                consent_phone_collection, consent_proxy_for_group
테이블         - session_venues, _backup_applications_20260815
```

> `_backup_applications_20260815`(실고객 18건)는 개인정보 보관 기간 관점에서 **파기 대상**이다. 삭제 전 백업 확보 필수.

---

## 5. 롤백 계획

| 단계 | 롤백 방법 | 난이도 |
|---|---|---|
| Phase 1 (Expand) | 신규 테이블 `drop` — 기존 코드가 안 쓰므로 무해 | 쉬움 |
| Phase 2 (Migrate) | 채운 컬럼을 `null`로 되돌림. 기존 컬럼은 그대로 살아 있음 | 쉬움 |
| Phase 3 (테스트) | `develop`만 되돌리면 됨. 운영 무관 | 쉬움 |
| **Phase 4 (오픈)** | **Vercel에서 직전 배포로 Instant Rollback** | 쉬움 ⭐ |
| Phase 8 (Contract) | **불가능** — 그래서 마지막에, 백업 확보 후 | 어려움 |

**Phase 4 롤백이 쉬운 이유**: Expand·Migrate가 이미 끝나 있고 **구 컬럼을 지우지 않았기 때문**에, 구 코드가 여전히 동작한다. Contract를 뒤로 미루는 진짜 이유가 이것이다.

---

## 6. 지금 순서에서 가장 중요한 3가지

1. **백업 시크릿 등록(0-1)이 모든 것의 전제다.** 되돌아갈 지점 없이 스키마를 바꾸면 안 된다.
2. **다음 회차를 열기 전에 Phase 1·2를 끝내는 게 유리하다.** 지금 신청 트래픽이 0이라 깨질 실시간 플로우가 없다. 회차를 열고 나면 이 창이 닫힌다.
3. **오픈(Phase 4)과 입금 자동화(Phase 5)를 분리한다.** 오픈뱅킹 심사에 오픈 일정을 묶지 않는다.

---

## 7. 착수 전 확정이 필요한 항목

| # | 항목 | 막는 단계 |
|---|---|---|
| 1 | 대관 장소 **실제 주소** (현재 `venue_address` 비어 있음) | Phase 2 |
| 2 | 테마 기본 가격·정원·소요시간 확정값 | Phase 2 |
| 3 | 첫 정기 회차 일정 (요일·시각·몇 주치) | Phase 3 검증 |
| 4 | FAQ 서식 표현 방식 (JSX 혼재로 그대로 이관 불가) | Phase 7 |
| 5 | 테마 이미지 저장소 (Supabase Storage 도입 여부) | Phase 3-1 |
| 6 | 크론 실행 방식 (Vercel Cron vs 외부 서비스) | Phase 0-4 |
| 7 | 오픈뱅킹 vs 은행 기업 OpenAPI | Phase 5-1 |
