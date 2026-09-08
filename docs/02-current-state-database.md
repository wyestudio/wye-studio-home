# 02. 운영 DB 현 상태 (2026-09-08 실측)

대상: Supabase 운영 프로젝트 `jilghhbbtjyybzbgwdhq` / schema `public`.
**모든 내용은 스키마 파일이 아니라 라이브 DB를 직접 조회한 결과다.**

---

## 1. 테이블 전경

| 테이블 | 행 수 | RLS | 성격 |
|---|---:|---|---|
| `sessions` | 2 | on (공개 select 정책 1개) | 회차 |
| `session_venues` | 2 | on (정책 0, grant 0) | 장소 — 완전 비공개 |
| `applications` | 58 | on (정책 0) | 신청 건 |
| `application_attendees` | 67 | on (정책 0) | 참여자 개인 |
| `sms_templates` | 7 | on (정책 0, `service_role`만 grant) | **문자 템플릿 (DB 기반)** |
| `sponsorship_group_applications` | 7 | on (정책 0) | 협찬 신청 (그룹) |
| `sponsorship_dating_applications` | 2 | on (정책 0) | 협찬 신청 (소개팅) |
| `review_payback_applications` | 2 | on (정책 0) | 후기 페이백 신청 |
| `profiles` | 0 | on (본인 select/insert/update) | 휴면 로그인 |
| `kakao_links` | 0 | on (본인 select) | 휴면 로그인 |
| `naver_links` | 0 | on (본인 select) | 휴면 로그인 |
| `_backup_applications_20260815` | **18** | on (정책 0) | **정리 안 된 백업 테이블** |

**뷰 5종** (전부 `service_role`에만 SELECT grant, PII 복호화 포함):
`admin_application_view`, `admin_attendee_view`, `admin_sponsorship_group_applications_view`, `admin_sponsorship_dating_applications_view`, `admin_review_payback_applications_view`

---

## 2. `sessions` — 실제 컬럼

```
id                            uuid pk
slug                          text unique          -- 고객 URL용 ('0829-meeting')
event_date                    date
slot                          text  CHECK IN ('afternoon','evening')     ← 하루 2슬롯 고정
title                         text                 -- 트리거가 자동 생성
theme_label                   text                 -- 트리거가 자동 생성
theme_name                    text                 -- '바-ㅇ탈출'
session_type                  text  CHECK IN ('그룹','소개팅')            ← 현행 분기 기준
content_group                 text                 -- 크로스테마 배타 스코프
difficulty                    smallint default 3 CHECK 1..5
start_at / end_at             timestamptz
venue_area                    text                 -- '서울 신림역 인근' (공개용 대략 위치)
price_krw / original_price_krw integer
capacity_min                  int default 16       -- 참고용, 로직에 미사용
capacity_confirm_line         int default 24
capacity_max                  int default 50
capacity_confirm_line_male    int null             ┐
capacity_confirm_line_female  int null             │ 소개팅 전용
capacity_max_male             int null             │ (그룹은 전부 null)
capacity_max_female           int null             │
male_closed / female_closed   bool default false   ┘
status                        text CHECK IN ('open','closed','cancelled')
description                   text null
created_at                    timestamptz
```

### ⚠️ `theme_label` → `session_type` 전환이 이미 끝났다

CLAUDE.md는 "`theme_label`이 재참여 방지·분기 기준"이라고 적혀 있지만, **라이브 `submit_application()`은 전부 `v_session.session_type = '소개팅'` 으로 분기한다** (8곳). 프론트의 `src/lib/theme.ts`도 이미 `isDatingTheme(sessionType)`로 바뀌어 있다. `theme_label`은 표시용 문자열로만 남았다.

### 트리거 `trg_sessions_generate_labels` (BEFORE INSERT)

`theme_label`이 null이면 `theme_name + '(ver.소개팅|모임)'`으로, `title`이 null이면 `MM/DD(요일) 오후|저녁 · theme_label`로 자동 생성한다.
→ **회차를 INSERT할 때 라벨/타이틀은 자동으로 채워진다.** 어드민 회차 등록 UI를 만들 때 이 트리거를 그대로 활용 가능.
(단 이 함수만 `search_path`가 설정돼 있지 않다 — Supabase 린터 WARN.)

### 현재 들어있는 회차 2건 (실데이터)

| slug | type | 일시 | 가격 (정가) | 정원 | 상태 |
|---|---|---|---|---|---|
| `0829-meeting` | 그룹 | 2026-08-29 13:00~16:30 KST | **55,000** (79,000) | confirm 24 / max 50 | `closed` |
| `0829-dating` | 소개팅 | 2026-08-29 19:00~23:30 KST | **65,000** (89,000) | 성별 confirm **10** / 성별 max 30 / 총 60 | `closed` |

> CLAUDE.md의 "인당 6.9만원", "소개팅 즉시확정 12명"은 **둘 다 현행과 다르다.**

---

## 3. `applications` — 실제 컬럼

```
id, session_id
depositor_name_enc            bytea        -- 암호화
confirmation_code             text unique  -- 6자리 숫자
status                        CHECK IN ('waiting','confirmed','cancelled')
payment_status                CHECK IN ('pending','confirmed','cancelled')
notes                         text CHECK len<=200
agreed_terms                  bool         -- v20에서 대체됨, 잔존 컬럼
consent_required              bool         -- 현행 필수동의
consent_optional              bool         -- 현행 선택동의
consent_photo / consent_marketing          bool
consent_no_rebooking / consent_phone_collection / consent_proxy_for_group   -- 구버전 잔존
refund_bank_name              text
refund_account_number_enc     bytea
refund_account_holder_enc     bytea
refund_completed_at           timestamptz  -- 환불 완료 체크
promoted_from_waiting_at      timestamptz  -- 대기→확정 승격 이력
confirmation_sms_sent_at / payment_confirmed_sms_sent_at / reminder_sms_sent_at
created_at
```

### ⚠️ `waiting_number` 컬럼은 **존재하지 않는다**

CLAUDE.md는 "v12에서 `applications.waiting_number` 컬럼 신설"이라고 적혀 있지만 실제 테이블에 그런 컬럼은 없다.
대기 순번은 **`submit_application()` 반환값과 `lookup_application()` 조회 시점에 그때그때 계산**된다(같은 세션/같은 성별의 waiting 건수 + 1). 저장되지 않으므로 **순번은 조회 시점마다 달라질 수 있다** — 앞 순번이 취소되면 뒤 순번이 당겨진다. 재설계 시 "순번을 고정할지 실시간 계산할지"는 의도적으로 결정해야 할 항목이다.

### 동의 컬럼 3세대가 공존

`agreed_terms`(1세대) → `consent_no_rebooking`/`consent_phone_collection`/`consent_proxy_for_group`(2세대) → `consent_required`/`consent_optional`(3세대). 현재 쓰는 건 3세대뿐이고 나머지는 잔존 컬럼이다.

---

## 4. `application_attendees`

```
id, application_id, session_id
is_representative   bool
name_enc            bytea    -- 암호화
phone_enc           bytea    -- 암호화
phone_hash          text     -- HMAC, 매칭/중복판정 전용
birth_year          int   CHECK between 1987 and 2007      ← 현행 나이 게이트
nickname            text null  (session_id + nickname unique)
gender              CHECK IN ('M','F')
experience_range    CHECK IN ('0','1-50','50-100','100-200','200+')
created_at
```

**`phone_hash`가 사실상의 사용자 식별자다.** 계정이 없는 현 구조에서 "같은 사람"을 판정하는 유일한 키. 로그인을 부활시킬 때 계정 ↔ 기존 신청 연결의 축이 될 값.

---

## 5. 함수 16종 (실측)

| 함수 | 실행 권한 | 역할 |
|---|---|---|
| `submit_application(uuid,text,bool,bool,jsonb,text,bool,bool)` | anon, authenticated | **신청 생성 (핵심)** |
| `lookup_application(text,text)` | anon, authenticated | 전화번호+접수번호 조회 |
| `cancel_application(text,text,text,text,text)` | anon, authenticated | 셀프 취소 + 환불계좌 저장 |
| `get_session_stats(uuid)` | anon, authenticated | 공개 집계 (9개 카운트) |
| `check_active_applications(text[],uuid)` | anon, authenticated | 제출 전 중복 사전확인 |
| `check_nickname_available(uuid,text)` | anon, authenticated | 닉네임 사전확인 |
| `submit_sponsorship_group_application(...)` | anon, authenticated | 협찬 신청 (그룹) |
| `submit_sponsorship_dating_application(...)` | anon, authenticated | 협찬 신청 (소개팅) |
| `submit_review_payback_application(...)` | anon, authenticated | 후기 페이백 신청 |
| `admin_update_application(uuid,text,text,jsonb)` | **service_role만** | 어드민 신청/참여자 수정 |
| `hash_phone(text)` | **postgres만** | HMAC 해시 |
| `encrypt_pii(text)` | **⚠️ PUBLIC (기본 ACL)** | 암호화 |
| `decrypt_pii(bytea)` | **⚠️ PUBLIC (기본 ACL)** | 복호화 |
| `get_pii_key()` | **⚠️ PUBLIC (기본 ACL)** | Vault에서 키 반환 |
| `rls_auto_enable()` | PUBLIC (이벤트 트리거용) | 신규 테이블 자동 RLS |
| `sessions_generate_labels()` | (트리거) | 라벨 자동 생성 |

> `encrypt_pii` / `decrypt_pii` / `get_pii_key`의 `proacl`이 `NULL`이다 = Postgres 기본값 `PUBLIC=X`가 적용됨 = **anon이 REST로 호출 가능**. 반면 `hash_phone`은 `{postgres=X/postgres}`로 정확히 잠겨 있다. 상세와 실증은 [04-drift-and-risks.md](./04-drift-and-risks.md) §보안-A.

### `submit_application()` 로직 요약 (라이브 정의 기준)

`sessions` 행을 `for update`로 잠근 뒤 순서대로 검증:

1. 필수 약관 동의 여부
2. 회차 존재 + `status = 'open'`
3. 참여 인원 ≥ 1
4. **소개팅이면** 그룹 크기 = 1 강제 + 성별 필수
5. **출생년도**: 소개팅 `1990~2001` / 그룹 `1987~2007` (테마별 분기)
6. 전 참여자 성별 필수
7. 그룹 내부 전화번호 중복 금지
8. **`content_group` 단위 배타** — 같은 컨텐츠에 취소되지 않은 신청이 이미 있으면 거부
9. 정원 판정 — 소개팅은 성별별(`male_closed`/`female_closed`, `capacity_max_male/female`), 그룹은 인원 합계 vs `capacity_max`. **그룹 전체가 못 들어가면 신청 자체를 거부**(부분 확정 없음, `'정원마감:'` 접두사)
10. 6자리 접수번호 생성 (최대 20회 재시도)
11. `confirmed`/`waiting` 판정 → `applications` + `application_attendees` 삽입
12. 정원 도달 시 `male_closed`/`female_closed`/`status='closed'` 갱신
13. 대기면 순번 계산해서 반환값에만 포함

**자동 승격 로직 없음** — 대기자는 운영자가 어드민에서 수동 승격.

### `get_session_stats()` 반환 (9개)

`confirmed_count`, `waiting_count`, `male_confirmed_count`, `male_waiting_count`, `female_confirmed_count`, `female_waiting_count`, **`paid_confirmed_count`, `male_paid_confirmed_count`, `female_paid_confirmed_count`**

뒤 3개는 2026-08-28 마이그레이션(`get_session_stats_add_paid_confirmed_counts`)으로 추가됐다. 마감/마감임박 뱃지는 **입금 확인까지 끝난 인원** 기준으로 판정한다(확정만 되고 미입금인 자리를 마감으로 세지 않기 위해).

---

## 6. 권한 구조 (실측)

**설계 원칙**: 테이블 직접 접근은 전부 막고, `SECURITY DEFINER` RPC로만 통과시킨다. RLS 정책이 아니라 **GRANT 자체를 안 주는 방식**이 1차 방어선이다.

```
sessions        → anon/authenticated/service_role  SELECT  (+ RLS 공개 정책)
session_venues  → service_role만 SELECT            (anon은 존재조차 모름)
applications    → service_role  SELECT, UPDATE
                  authenticated SELECT  ⚠️ 의도치 않은 grant (RLS 정책 0개라 실제로는 0행)
application_attendees → 아무도 SELECT 없음
sms_templates   → service_role  SELECT, UPDATE
협찬/페이백 3종  → 아무도 SELECT 없음 (뷰를 통해 service_role만)
admin_*_view 5종 → service_role  SELECT
profiles        → authenticated SELECT/INSERT/UPDATE (+ 본인 RLS)
kakao_links / naver_links → authenticated SELECT (+ 본인 RLS)
```

이벤트 트리거 `ensure_rls`(→`rls_auto_enable()`)가 신규 테이블에 자동으로 RLS를 켠다.

---

## 7. 마이그레이션 이력

`supabase_migrations.schema_migrations`에 **26건**이 기록돼 있고, **가장 오래된 것이 `20260815074610`(2026-08-15)** 이다.
→ **8/15 이전의 모든 스키마 변경(v1~v12 시대)은 마이그레이션 기록이 없다.** SQL Editor에서 직접 실행됐고, 유일한 흔적은 `supabase-schema.sql`의 서술형 로그뿐이다.

최근 마이그레이션 흐름:
```
0815 v12_9 동의 분리 / v21 뷰 확장 / v22 grant / v23 content_group
0816 check_active_applications (+grants)
0817 v25 sms_templates / v26 nickname grant / v25b service_role grant
0820 소개팅 출생년도 1990~2001 / v31 동시성 버그 2건 / prod 드리프트 2건 수정
0821 sessions.difficulty / v32 consent_photo·marketing / 뷰 확장
0826 v36 협찬 / sms_templates RLS / v37 출생년도·성별 / admin_update_application
     / v38 소개팅협찬 여성전용 / v40 그룹 출생년도 2007
0827 refund_completed_at / promoted_from_waiting_at / v39 후기페이백
0828 get_session_stats 입금확인 카운트 추가
```

---

## 8. 실데이터 현황 (프리오픈 결과)

신청 기간: **2026-08-20 ~ 2026-08-28**

| | 신청 건 | 참여 인원 |
|---|---:|---:|
| 확정 (confirmed) | 36 | 40 |
| 대기 (waiting) | 1 | 1 |
| 취소 (cancelled) | 21 | 26 |
| **합계** | **58** | **67** |

입금 확인 완료: 35건

### 회차별

| 회차 | 상태 | 건 | 인원 | 남 | 여 |
|---|---|---:|---:|---:|---:|
| `0829-meeting` (그룹) | confirmed·paid | 16 | **20** | 12 | 8 |
| `0829-meeting` | cancelled | 8 | 13 | 4 | 9 |
| `0829-dating` (소개팅) | confirmed·paid | 19 | **19** | 10 | 9 |
| `0829-dating` | confirmed·미입금 | 1 | 1 | 0 | 1 |
| `0829-dating` | waiting | 1 | 1 | 1 | 0 |
| `0829-dating` | cancelled | 13 | 13 | 9 | 4 |

관찰:
- **취소율이 높다** — 67명 중 26명(39%)이 취소. 소개팅 쪽은 남성 취소가 9/13으로 두드러진다.
- 그룹은 16건→20명으로 **그룹 신청(동행자 포함)이 실제로 쓰였다**(평균 1.25명/건). 소개팅은 정책상 전부 1인 1건.
- 닉네임 입력: 67명 중 48명. 경험치(`experience_range`): 67명 전원.
- 부가 파이프라인 실적: 협찬 그룹 7건, 협찬 소개팅 2건, 후기 페이백 2건.
- `auth.users` = **0건** — 로그인 시스템은 실제로 한 번도 쓰이지 않았다.

> **이 데이터는 실제 고객 데이터다.** 소개팅 버전을 제거할 때 `session_type='소개팅'` 관련 스키마를 삭제하면 33건의 신청 이력이 함께 무의미해진다. 삭제가 아니라 **아카이빙 전략**이 필요하다.
