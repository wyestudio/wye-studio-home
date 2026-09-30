# 02. 운영 DB 현 상태 (2026-09-30 실측)

대상: Supabase 운영 프로젝트 `jilghhbbtjyybzbgwdhq` / schema `public`.
**모든 수치는 스키마 파일이 아니라 라이브 DB 를 직접 조회한 결과다.**

> 이 문서는 **스냅샷**이다. 바뀌면 낡는다. 쓰기 전에 날짜를 보고, 판단이 걸린 일이면
> 라이브에 직접 물어볼 것. 권한은 `information_schema.role_table_grants` 말고
> **`has_table_privilege()` / `has_function_privilege()`** 로 본다 — 전자는 내가 볼 수
> 있는 ACL 을 전부 나열해서 "anon 에 열려 있다"로 오독하기 쉽다(2026-09-30 에 실제로 겪음).

**한눈에**: 표 38 · 뷰 11 · 함수 47 · 기록된 마이그레이션 109(로컬 파일 69)
회차 149 · 신청 73 · 참여자 102 · 활성 테마 1

---

## 1. 표 전경 (38개)

권한은 `has_table_privilege` 기준. `S`=select `I`=insert `U`=update `D`=delete.
**RLS 가 켜져 있고 정책이 0개면 grant 가 있어도 아무 행도 안 보인다** — 아래 대부분이 그렇다.

### 예약 핵심

| 표 | 행 | anon | auth | service_role | RLS/정책 |
|---|---:|---|---|---|---|
| `sessions` | 149 | S | S | SIUD | on / 1 |
| `applications` | 73 | – | – | SU | on / 0 |
| `application_attendees` | 102 | – | – | – | on / 0 |
| `themes` | 2 | S | S | SIUD | on / 1 |
| `theme_price_tiers` | 5 | S | S | SIUD | on / 1 |
| `theme_categories` | 1 | S | S | SIUD | on / 1 |
| `theme_schedules` | 1 | – | – | SIUD | on / 0 |
| `venues` | 2 | – | – | SIUD | on / 0 |
| `session_venues` | 2 | – | – | S | on / 0 |
| `reparticipation_allowances` | 1 | – | – | – | on / 0 |

`application_attendees` 와 `reparticipation_allowances` 는 **service_role 에도 grant 가 없다.**
접근은 전부 `security definer` 함수를 통해서만 이뤄진다.

### 쿠폰·정산

| 표 | 행 | anon | auth | service_role | RLS/정책 |
|---|---:|---|---|---|---|
| `coupons` | 880 | – | – | SIUD | on / 0 |
| `coupon_campaigns` | 4 | – | – | SIUD | on / 0 |
| `application_coupons` | 4 | – | – | S | on / 0 |
| `settlement_snapshots` | 0 | – | – | SI | on / 0 |
| `bank_transactions` | 0 | – | – | SIUD | on / 0 |
| `point_ledger` | 0 | – | – | SIUD | on / 1 |

### 운영·콘텐츠

| 표 | 행 | anon | auth | service_role | RLS/정책 |
|---|---:|---|---|---|---|
| `audit_logs` | 55 | – | – | SI | on / 0 |
| `admin_users` | 0 | – | – | SIUD | on / 0 |
| `utm_links` | 23 | – | – | SIUD | on / 0 |
| `notices` | 6 | S | S | SIUD | on / 1 |
| `faqs` | 7 | S | S | SIUD | on / 1 |
| `sms_templates` | 7 | – | – | SU | on / 0 |
| `slack_templates` | 4 | – | – | SU | on / 0 |
| `site_settings` | 0 | – | – | SIUD | on / 0 |
| `marketing_sms_optouts` | 0 | – | – | – | on / 0 |
| `codename_submissions` | 87 | – | – | SIUD | on / 0 |

### 신청 접수 (예약 외)

| 표 | 행 | service_role | RLS/정책 |
|---|---:|---|---|
| `sponsorship_group_applications` | 7 | – | on / 0 |
| `sponsorship_dating_applications` | 2 | – | on / 0 |
| `review_payback_applications` | 2 | – | on / 0 |

### 휴면 (로그인 시스템)

`profiles` 0 · `kakao_links` 0 · `naver_links` 0 — 전부 RLS on, 본인 한정 정책.

### ⚠️ 정리 안 된 백업 표 6개

`_backup_applications_20260913`(8) · `_backup_application_attendees_20260913`(12) ·
`_backup_theme_content_20260913b`(2) · `_backup_theme_content_20260914`(2) ·
`_backup_theme_content_20260915`(1) · `_backup_theme_content_20260915b`(2)

**`_backup_application_attendees_20260913` 에는 암호화된 PII 가 들어 있다.**
어느 역할에도 grant 가 없어 당장 새는 건 아니지만, 지울 시점을 정해야 한다.
(2026-09-08 문서에 있던 `_backup_applications_20260815` 는 이미 삭제됨)

---

## 2. 뷰 11개

| 뷰 | anon | auth | service_role | 비고 |
|---|---|---|---|---|
| `session_view` | S | S | S | 회차 + 테마 조인 — **`submit_application_v3` 가 읽는다** |
| `session_display` | – | – | S | 표시용(테마명·정원·장소·연령) 통일 |
| `venue_public` | S | S | S | 공개용 장소 |
| `theme_public_venue` | S | S | S | 테마별 공개 장소 |
| `public_short_link` | S | S | S | 짧은 주소 |
| `public_event_bubble` | S | S | S | 이벤트 배너 |
| `admin_application_view` | – | – | S | **PII 복호화 포함** |
| `admin_attendee_view` | – | – | S | **PII 복호화 포함** |
| `admin_sponsorship_group_applications_view` | – | – | S | PII 복호화 포함 |
| `admin_sponsorship_dating_applications_view` | – | – | S | PII 복호화 포함 |
| `admin_review_payback_applications_view` | – | – | S | PII 복호화 포함 |

`admin_*` 뷰 5종은 **anon/authenticated 에 권한이 없다**(소유자 postgres, `security_invoker` 미설정).

---

## 3. `sessions` — 옛 구조가 통째로 남아 있다

전체 149행 중 **값이 든 행 수**:

| 칼럼 | 채워진 행 | 뜻 |
|---|---:|---|
| `theme_id`, `min_age` | **149** | 현행 기준 |
| `slug`·`event_date`·`slot`·`theme_label`·`content_group`·`session_type`·`theme_name`·`price_krw` | **2** | 8/29 프리오픈 2건에만 |
| `capacity_max_male` 등 성별 정원 | 1 | 프리오픈 소개팅 1건 |
| `legacy_format` | 0 | 안 쓰임 |

**이게 오늘의 사고 원인이다.** 옛 함수들은 `content_group`·`session_type` 으로 분기하는데
새 회차는 그 값이 전부 `null` 이라 `null = null` 이 참이 되지 않는다 → 재참여 배타가
통째로 무력화됐었다. 경위는 [06-decisions.md](./06-decisions.md) D-02.

정원·요금은 `theme_price_tiers` + `themes` 가 기준이고, 회차의
`price_krw_override`·`capacity_*_override` 로 덮는다.

### 트리거

| 표 | 트리거 | 시점 | 함수 |
|---|---|---|---|
| `sessions` | `trg_sessions_generate_labels` | BEFORE INSERT | `sessions_generate_labels` |
| `applications` | `applications_set_cancelled_at` | BEFORE UPDATE | `set_cancelled_at` |
| `applications` | `applications_release_coupon_on_cancel` | AFTER UPDATE | `release_coupon_on_cancel` |
| `application_attendees` | `application_attendees_nickname_unique` | BEFORE INSERT/UPDATE | `enforce_session_nickname_unique` |

---

## 4. `applications` 42칼럼 · `application_attendees` 13칼럼

`applications` 에서 눈여겨볼 것:

- **금액**: `headcount` · `unit_price_krw` · `amount_krw` · `discount_krw`.
  앞 셋은 **nullable** 이다 → 넣지 않는 경로가 있으면 조용히 NULL 로 들어간다
  (실제로 구 `submit_application` 이 그랬다. 2026-09-28 에 어드민 경로를 v3 로 옮겨 막음)
- **동의 3세대 공존**: `agreed_terms` / `consent_no_rebooking`·`consent_phone_collection`·
  `consent_proxy_for_group` / `consent_required`·`consent_optional`·`consent_photo`·`consent_marketing`.
  현행은 마지막 세대
- **유입경로**: `utm_source`·`utm_medium`·`utm_campaign`·`utm_content`·`utm_term`·`referrer`·`landing_path`
- **`is_internal`**: `/internal` 로 켠 우리 기기 신청 표시. 현재 0건
- `waiting_number` 칼럼은 **없다** — 대기 순번은 조회 시점에 계산한다
- `coupon_id` 는 폐기. 정산 기준은 `application_coupons`

`application_attendees`: `name_enc`·`phone_enc` (암호화) + `phone_hash` (HMAC, 매칭 키) +
`birth_year`·`nickname`·`gender`·`experience_range`·`reminder_sms_sent_at`.

---

## 5. 함수 47개 — 세대가 겹쳐 있다

### 지금 쓰는 것

| 함수 | 실행 | 역할 |
|---|---|---|
| `submit_application_v3(…,text[])` | anon/auth/svc | **신청 생성 (현행)** |
| `check_active_applications_v2(text[],uuid)` | anon/auth/svc | 제출 전 재참여 사전확인 |
| `is_theme_participation_blocked(text,uuid)` | (내부) | **재참여 판정 — 여기 한 곳** |
| `is_theme_participation_blocked(text,uuid,uuid)` | (내부) | 위 + 제외할 신청(수정 화면용) |
| `preview_coupons(text[],uuid,int,int,text)` | anon/auth/svc | 쿠폰 여러 장 판정 |
| `preview_coupon(text,uuid,int,int,text)` | anon/auth/svc | 쿠폰 한 장 판정 |
| `lookup_application_v4(text,text)` | anon/auth/svc | 참여내역 조회 (현행) |
| `check_nickname_available(uuid,text)` | anon/auth/svc | 닉네임 사전확인 |
| `resolve_unit_price(uuid,int)` | anon/auth/svc | 인원별 단가 |
| `is_eligible_birth_year(int,int)` | — | 회차 `min_age` 기준 연령 판정 |
| `get_session_stats(uuid)` | anon/auth | 공개 집계 (정원·잔여) |
| `admin_update_application(uuid,text,text,jsonb)` | svc | 어드민 신청·참여자 수정 |
| `admin_search_applications(…)` | svc | 어드민 검색 |

### PII (전부 잠김 — anon 실행 불가)

`hash_phone` · `encrypt_pii` · `get_pii_key` 는 `postgres` 만, `decrypt_pii` 는
`postgres`+`service_role`. **2026-09-08 문서의 "PUBLIC 이라 anon 이 호출 가능" 경고는
이미 해소됐다** (2026-09-30 재확인: `hash_phone` 직접 호출 시 `permission denied`).

### ⚠️ 옛 세대가 아직 anon 에 열려 있다

| 함수 | 상태 |
|---|---|
| `submit_application(uuid,text,bool,bool,jsonb,text,bool,bool)` | **anon 호출 가능** |
| `submit_application_v2(…)` 2종 | **anon 호출 가능** |
| `check_active_applications(text[],uuid)` | **anon 호출 가능** |
| `lookup_application` · `_v2` · `_v3` | **anon 호출 가능** |

2026-09-30 확인: anon 키로 `submit_application` 을 직접 호출하면 권한 오류가 아니라
**로직 오류(`존재하지 않는 회차입니다.`)가 돌아온다** = 함수가 실제로 실행된다.

**왜 문제인가** — anon 키는 클라이언트 번들에 들어 있어 공개값이다. 구 함수는
`content_group` 기준이라 새 회차에서 재참여를 못 막고, 연령도 옛 출생년도 범위를 쓰며,
`headcount`·`amount_krw` 를 넣지 않는다. 즉 **REST 를 직접 때리면 현행 규칙을 우회한
신청을 만들 수 있고, 그 건은 금액이 NULL 로 남는다.**

### ⚠️ 그냥 지우면 안 된다 — 아직 부르는 코드가 있다

| 부르는 곳 | 함수 |
|---|---|
| `src/app/(site)/sessions/[slug]/apply/actions.ts:214` | `submit_application` (v1) |
| `src/app/(site)/sessions/[slug]/apply/actions.ts:47` | `check_active_applications` (v1) |

이건 **휴면 고객 경로**다(현행은 `/themes/[slug]/apply`). 라우트 자체는 빌드에 남아 있지만
`sessions.slug` 가 있는 회차가 **프리오픈 2건뿐이고 둘 다 `closed`** 라 실제로는 닿지 않는다.

그래서 순서는 이렇다:

1. `/sessions/[slug]` 계열 휴면 라우트를 정리하거나, 최소한 그 호출을 v3 로 옮긴다
2. 그 다음 `revoke execute … from anon, authenticated`
3. 삭제는 그 뒤에 (2026-08-14 에 이 계열 함수를 잘못 지워 서비스가 마비된 적이 있다.
   `wye-db-release` 의 증거 기반 절차를 따를 것)

**지금 당장은 손대지 않았다.**

---

## 6. 마이그레이션 이력

- `supabase_migrations.schema_migrations` 에 **109건** (`20260815074610` ~ `20260928040102`)
- `supabase/migrations/` 로컬 파일은 **69개** (`20260910065306` ~ `20260928033149`)

숫자가 다른 이유: 초기에는 SQL Editor 에서 손으로 실행하고 기록만 남긴 건이 많다.
**"무엇이 빠졌는지"는 파일 목록이 아니라 DB 에 물어볼 것** — `wye-db-release` 참고.

> `supabase-schema.sql` 은 갱신이 끊겼다. `submit_application_v3`·`preview_coupons`·
> `theme_id`·`min_age` 등이 전부 없다. **기록처는 `supabase/migrations/` 다.**

---

## 7. 실데이터 (2026-09-30)

| 상태 | 건 | 인원 | 금액 합 |
|---|---:|---:|---:|
| 확정 (confirmed) | 46 | 67 | 3,857,000원 |
| 취소 (cancelled) | 27 | 35 | 2,130,000원 |
| **합계** | **73** | **102** | |

- 입금 확인 완료 46건 · 내부 테스트 표시(`is_internal`) 0건 · 사용된 쿠폰 4장 (발행 880장)
- 활성 테마 1개(바-ㅇ탈출). 열린 미래 회차 **139개**, 2026-10-03 ~ 2027-03-13
- 재참여 예외(`reparticipation_allowances`) 1건 — 프리오픈 미참여자 1명, [D-02](./06-decisions.md) 참고

---

## 8. 이 문서를 다시 뽑을 때

```sql
-- 표/뷰 권한 (role_table_grants 말고 이걸로)
select c.relname, c.relkind,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_s,
       has_table_privilege('service_role', c.oid, 'SELECT') as svc_s,
       c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid=c.oid)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','v') order by 2 desc, 1;

-- 함수 권한
select p.oid::regprocedure, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_x
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' order by 1;

-- 표별 행 수
select c.relname,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname),
        false, true, '')))[1]::text::int as rows
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by 1;
```
