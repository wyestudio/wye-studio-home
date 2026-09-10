# 07. 신규 아키텍처 설계 (1) — 도메인 · 데이터 모델

**작성일**: 2026-09-08
**근거**: [01~05](./00-INDEX.md) 현 상태 실측 + [06-decisions.md](./06-decisions.md) 결정 11건
**범위**: 도메인 모델, DB 스키마, RPC, 권한, 데이터 마이그레이션
**이어지는 문서**: `08-` 화면·어드민 설계 / `09-` 구현 로드맵

---

## 1. 설계 목표

| # | 목표 | 지금 무엇이 막고 있나 |
|---|---|---|
| G1 | **매주 회차를 여는 데 개발자가 필요 없을 것** | 회차 등록 UI 없음 → 매주 SQL Editor 직접 실행 |
| G2 | **테마 추가에 배포가 필요 없을 것** | 테마 콘텐츠가 `sessions/[slug]/page.tsx`에 코드로 박혀 있음 |
| G3 | **회차가 쌓여도 화면이 지저분해지지 않을 것** | 회차마다 카드가 늘어나 "뭐가 다른데?"가 됨 |
| G4 | **입금 확인이 자동으로 될 것** | 통장 육안 확인 + 수동 버튼 |
| G5 | **스키마의 현재 상태를 파일 하나로 알 수 있을 것** | 5,080줄 append-only 로그 + v13에서 멈춘 clean 파일 |
| G6 | **되돌릴 수 없는 사고에 대비할 것** | 백업 없음(→ 해결됨), 감사로그 없음 |

## 2. 설계 원칙

1. **운영자가 바꿀 값은 DB에, 개발자가 바꿀 것만 코드에.**
   이미 `sms_templates` + `/admin/sms-templates`로 성공한 패턴이다. 테마·공지·FAQ·계좌정보로 확장한다.
2. **테이블은 잠그고 RPC로만 통과시킨다.**
   현행의 가장 잘 된 부분이다. `anon`에 테이블 GRANT를 주지 않고 `SECURITY DEFINER` 함수로만 여는 방식을 유지한다.
3. **PII는 저장 시 암호화, 매칭은 해시.**
   `encrypt_pii` / `hash_phone` 체계를 유지한다. 신규 테이블도 동일 규칙을 따른다.
4. **스키마는 선언형 단일 파일 + 순번 마이그레이션.**
   `supabase-schema.sql`(변경 로그)과 `supabase-schema-clean.sql`(v13에서 정지)의 이중 구조를 폐기한다. G5.
5. **되돌리기 어려운 것은 기록을 남긴다.** 취소·환불·수동등록·회차비활성화는 감사로그 대상.

---

## 3. 도메인 모델

### 3-1. 핵심 변화 — `sessions` 한 덩어리를 셋으로 분해

```
[ 현재 ]                          [ 변경 후 ]

┌─────────────────────┐           ┌──────────┐     ┌──────────┐
│      sessions       │           │  themes  │────>│  venues  │
│                     │           │  (상품)  │     │  (장소)  │
│ 날짜 · 시간         │           └────┬─────┘     └──────────┘
│ 가격 · 정원         │    ──>         │ 1
│ 장소                │                │ N
│ 테마명 · 형식       │           ┌────▼─────┐
│ 모집 상태           │           │ sessions │
│ (설명은 코드에)     │           │  (일정)  │  날짜 · 시간 · 모집상태
└─────────────────────┘           └──────────┘
   회차마다 전부 반복                테마 1개 : 회차 N개
```

- **테마(theme)** = 상품. 「바-ㅇ탈출」. 소개글·이미지·난이도·진행방식·**가격·정원·소요시간·장소**를 갖는다. 한 번 등록하면 계속 쓴다.
- **회차(session)** = 일정. "10/5(토) 14:00". 매주 새로 만든다. **날짜와 모집 상태만** 갖는다.
- **장소(venue)** = 대관 장소. 공개용 대략 위치와 비공개 정확 주소를 분리 보관한다.

> 근거: [D-01](./06-decisions.md#d-01-테마--회차-2단-구조로-분리-). 이 구조라야 *"테마를 고르고 → 들어가서 날짜를 선택하고 → 신청"* 흐름이 가능하고(G3), 회차가 늘어도 목록 화면은 그대로다.

### 3-2. 전체 엔티티

```
venues ──1:N── themes ──1:N── sessions ──1:N── applications ──1:N── application_attendees
                                                     │
                                                     ├── bank_transactions   (입금 자동 매칭)
                                                     └── point_ledger        (단골 혜택)

auth.users ──1:N── applications        (nullable — 비회원 신청은 null)
auth.users ──1:N── point_ledger

독립: notices, faqs, sms_templates, site_settings, audit_logs
보존: sponsorship_*, review_payback_applications, profiles/kakao_links/naver_links
```

### 3-3. 사라지는 개념

| 개념 | 처리 |
|---|---|
| `session_type` (`'그룹'` / `'소개팅'`) | **제거.** 과거 회차 표시용으로만 `sessions.legacy_format`에 남긴다 |
| 성별 분리 정원 6컬럼 | **제거.** 소개팅 전용이었다 |
| `content_group` (문자열) | **`theme_id` 외래키로 대체.** 의미는 동일 |
| `slot` (`afternoon`/`evening`) | **제거.** `starts_at`이 시각을 온전히 표현한다 |
| 테마별 출생년도 분기 | **제거.** 만 14세 단일 규칙 |

---

## 4. 데이터 모델

> 아래는 **설계 의도를 보이기 위한 DDL 스케치**다. 실제 적용은 마이그레이션 파일로 나눠서 하고, 컬럼 타입·제약은 구현 시 확정한다.

### 4-1. `venues` — 장소

```sql
create table venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,          -- '뮤트스페이스 더클래식 봉천점'  (비공개)
  address       text not null,          -- 정확 주소                      (비공개, 전날안내 SMS용)
  area_label    text not null,          -- '서울 신림역 인근'             (공개)
  parking_note  text,
  map_url       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

**공개/비공개 분리**: 현행 `session_venues`가 "grant를 아예 주지 않아 `anon`은 존재조차 모른다"는 좋은 설계였다. 이를 유지하되, 공개해야 하는 `area_label`만 별도 뷰로 연다.

```sql
create view venue_public as select id, area_label from venues where is_active;
-- venues 본체: anon/authenticated 에 grant 없음. venue_public 만 select 허용.
```

### 4-2. `themes` — 테마(상품)

```sql
create table themes (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,       -- 'baotalchul'
  name                  text not null,              -- '바-ㅇ탈출'
  tagline               text,
  description           text,

  -- 스펙
  difficulty            smallint not null default 3 check (difficulty between 1 and 5),
  duration_minutes      int not null,               -- 210 (3시간 30분)
  min_age_floor         int,                        -- 테마 자체의 최소 연령 하한(선택).
                                                    -- 시각과 무관하게 성인 전용인 테마용

  -- 가격 · 정원 (회차가 물려받음)
  price_krw             int not null,
  original_price_krw    int,
  capacity_confirm_line int not null,               -- 즉시확정 인원
  capacity_max          int not null,               -- 정원
  capacity_min          int,                        -- 최소 진행 인원(참고용)

  venue_id              uuid not null references venues(id),

  -- 표현
  accent_color          text,                       -- '#3dffb0'
  hero_image_path       text,
  content               jsonb not null default '{}',

  -- 노출 제어
  is_active             boolean not null default true,   -- false = 신규 신청 불가
  is_listed             boolean not null default true,   -- false = 목록/sitemap 미노출
  sort_order            int not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
```

#### `content` JSONB 구조

지금 `sessions/[slug]/page.tsx`에 하드코딩된 4개 블록을 그대로 옮긴다.

```jsonc
{
  "for_you":     [{ "emoji": "🙋", "title": "…", "desc": "…" }],   // 이런 분께 추천
  "steps":       [{ "emoji": "🧊", "title": "…", "desc": "…" }],   // 진행 방식
  "timetable":   [{ "offset_min": 0, "title": "현장 접수", "desc": "…" }],
  "precautions": [{ "title": "…", "desc": "…" }]
}
```

**왜 정규화 테이블이 아니라 JSONB인가**: 이 네 블록은 *순서 있는 표시 전용 콘텐츠*이고, 어드민에서 **통째로 편집**된다. 절대 조건 검색·조인 대상이 아니다. 자식 테이블 4개로 쪼개면 정렬 컬럼과 조인만 늘고 얻는 게 없다.
**대가**: DB가 구조를 검증해주지 않는다 → 어드민 저장 시 **애플리케이션 레벨 스키마 검증(zod 등)이 필수**다.

#### ⭐ `timetable`은 절대시각이 아니라 **상대 오프셋**으로

현재는 타임테이블이 `13:00 / 13:40 / 14:00 / 15:30`처럼 **절대시각으로 코드에 박혀** 있다. 그래서 오후 회차와 저녁 회차가 각각 다른 배열을 갖는다.

새 구조는 **시작 시각으로부터의 경과 분(`offset_min`)** 만 저장하고, 화면에서 `session.starts_at + offset_min`으로 렌더링한다.

```
theme.timetable = [
  { offset_min:   0, title: "현장 접수 & 팀별 배치 확인" },
  { offset_min:  40, title: "1부 컨텐츠 안내" },
  { offset_min:  60, title: "방탈출 진행 + 미니게임" },
  { offset_min: 150, title: "2부 다과 타임 & 상품교환" }
]

→ 14:00 시작 회차 : 14:00 / 14:40 / 15:00 / 16:30
→ 19:00 시작 회차 : 19:00 / 19:40 / 20:00 / 21:30   (같은 데이터로 자동 계산)
```

**효과**: 회차 시각이 몇 시든 타임테이블을 다시 입력할 필요가 없다. 이게 없으면 G1(매주 개발자 없이 회차 개설)이 반쪽이 된다.

### 4-3. `sessions` — 회차(일정)

```sql
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  theme_id    uuid not null references themes(id),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,   -- 미입력 시 starts_at + theme.duration_minutes 자동
  status      text not null default 'open'
              check (status in ('open','closed','cancelled')),
  min_age     int not null,          -- ⭐ 이 회차에 실제 적용된 최소 연령 (D-03)
                                     --   생성 시 자동 계산: starts_at(KST) < 18:00 ? 16 : 19
                                     --   themes.min_age_floor 가 있으면 그보다 낮출 수 없다
                                     --   어드민에서 조정 가능

  -- 회차별 예외 (null = 테마 값 사용)
  price_krw_override             int,
  capacity_confirm_line_override int,
  capacity_max_override          int,
  venue_id_override              uuid references venues(id),

  -- 과거 데이터 보존 (신규 회차는 null)
  legacy_format text,                 -- '그룹' | '소개팅'
  legacy_slug   text unique,          -- '0829-meeting'

  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (theme_id, starts_at)
);
```

**override 컬럼을 지금 넣는 이유**: [D-01](./06-decisions.md#d-01-테마--회차-2단-구조로-분리-)에서 "회차별 덮어쓰기는 지금 넣지 않되 확장 여지를 남긴다"고 정했다. `nullable` 컬럼은 **기본값이 곧 "테마를 따른다"** 이므로, 지금은 어드민에 입력란을 노출하지 않고 컬럼만 두면 된다. 나중에 "연말 특별 회차만 가격 다르게"가 필요할 때 **스키마 변경 없이 입력란만 열면 된다.**

실효값은 뷰로 한 번만 정의해 애플리케이션 전체가 공유한다.

```sql
create view session_view as
select
  s.id, s.theme_id, s.starts_at, s.ends_at, s.status, s.legacy_format,
  t.slug as theme_slug, t.name as theme_name, t.difficulty, t.duration_minutes,
  coalesce(s.price_krw_override,             t.price_krw)             as price_krw,
  coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line) as capacity_confirm_line,
  coalesce(s.capacity_max_override,          t.capacity_max)          as capacity_max,
  coalesce(s.venue_id_override,              t.venue_id)              as venue_id
from sessions s join themes t on t.id = s.theme_id;
```

> ⚠️ **코드 어디에서도 `sessions` 테이블을 직접 읽지 않는다.** 반드시 `session_view`를 쓴다. 그래야 override 규칙이 한 곳에만 존재한다.

### 4-4. `applications` — 신청

```sql
create table applications (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references sessions(id),
  user_id            uuid references auth.users(id),   -- ⭐ nullable = 비회원 신청

  depositor_name_enc bytea not null,
  confirmation_code  text unique not null,             -- 6자리

  status             text not null default 'waiting'
                     check (status in ('waiting','confirmed','cancelled')),
  payment_status     text not null default 'pending'
                     check (payment_status in ('pending','confirmed','cancelled')),

  -- 금액 (신청 시점 스냅샷 — 나중에 테마 가격이 바뀌어도 과거 신청은 불변)
  headcount           int  not null check (headcount >= 1),
  unit_price_krw      int  not null,
  amount_krw          int  not null,   -- headcount * unit_price_krw
  depositor_name_hash text not null,   -- ⭐ 입금자명 정규화 후 HMAC (매칭 키, 4-6 참고)

  -- 동의
  consent_required   boolean not null default false,
  consent_optional   boolean not null default false,
  consent_photo      boolean not null default false,
  consent_marketing  boolean not null default false,

  -- 환불
  refund_bank_name            text,
  refund_account_number_enc   bytea,
  refund_account_holder_enc   bytea,
  refund_completed_at         timestamptz,

  promoted_from_waiting_at    timestamptz,
  notes                       text check (notes is null or char_length(notes) <= 200),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
```

#### 현행 대비 변경

| | 변경 |
|---|---|
| ➕ `user_id` | **계정 연결(nullable).** 비회원 신청은 `null`. [D-06](./06-decisions.md#d-06-로그인-부활--실익-4가지-모두-채택-) |
| ➕ `headcount` / `unit_price_krw` / `amount_krw` | 금액을 신청 시점에 확정 저장. 오픈뱅킹 매칭의 근거 |
| ➕ `depositor_name_hash` | 입금자명을 **복호화 없이** 매칭하기 위한 HMAC. `phone_hash`와 같은 기법 |
| ➖ `agreed_terms`, `consent_no_rebooking`, `consent_phone_collection`, `consent_proxy_for_group` | **잔존 컬럼 정리.** 현재 3세대 동의 컬럼이 공존 중 |
| 유지 | `confirmation_sms_sent_at` 등 SMS 중복발송 방지 마커 3종 |

#### 대기 순번은 계속 저장하지 않는다

현행처럼 조회 시점에 계산한다. 앞 순번이 취소되면 뒤가 당겨지는 것이 **운영상 옳은 동작**이기 때문이다. 다만 **고객 안내 문구에 "순번은 앞선 취소에 따라 당겨질 수 있다"를 명시**해, 안내한 순번과 조회 순번이 달라 보이는 혼선을 막는다.

### 4-5. `application_attendees` — 참여자

현행 구조를 거의 그대로 유지한다. 잘 되어 있다.

```sql
create table application_attendees (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references applications(id) on delete cascade,
  session_id       uuid not null references sessions(id),
  is_representative boolean not null default false,

  name_enc         bytea not null,
  phone_enc        bytea not null,
  phone_hash       text  not null,        -- HMAC — 재참여/중복 판정 키

  birth_year       int   not null,        -- ⭐ CHECK 는 4-7 참고 (연도 상수 금지)
  gender           text check (gender in ('M','F')),   -- ⭐ 선택 입력 (nullable)
  nickname         text,
  experience_range text check (experience_range in ('0','1-50','50-100','100-200','200+')),

  created_at       timestamptz not null default now(),
  unique (session_id, nickname)
);

create index on application_attendees (phone_hash);
```

변경점은 둘뿐이다: **`gender` 필수 검증 제거**([D-04](./06-decisions.md#d-04-성별--선택-입력으로-전환-)), **`birth_year` CHECK 를 동적 규칙으로**([D-03](./06-decisions.md#d-03-나이-제한--출생연도-기준-보수적-판정-)).

### 4-6. `bank_transactions` — 입금 자동 매칭 ⭐신규

[D-07a](./06-decisions.md#d-07a-입금-확인-자동화--오픈뱅킹-api-방식-)의 오픈뱅킹 방식을 받치는 테이블이다.

```sql
create table bank_transactions (
  id                     uuid primary key default gen_random_uuid(),
  external_id            text unique not null,   -- 은행/오픈뱅킹 거래 고유번호 (중복 수집 방지)
  transacted_at          timestamptz not null,
  amount_krw             int not null,
  depositor_name_enc     bytea,                  -- 입금자명도 PII → 암호화 보관
  depositor_name_hash    text,                   -- ⭐ 정규화 후 HMAC (매칭 키)
  raw                    jsonb not null,         -- 원본 응답 보존 (분쟁·디버깅용)

  matched_application_id uuid references applications(id),
  matched_at             timestamptz,
  matched_by             text check (matched_by in ('auto','manual')),
  ignored_at             timestamptz,            -- 우리 매출이 아닌 입금 처리
  ignored_reason         text,

  created_at             timestamptz not null default now()
);

create index on bank_transactions (amount_krw, depositor_name_hash)
  where matched_application_id is null and ignored_at is null;
```

#### ⭐ 매칭 키 — 입금액 + 입금자명

오픈뱅킹은 **입금자명·금액·시각**만 준다. **금액과 입금자명이 둘 다 일치할 때만** 자동 확정한다.

> **설계 변경 이력 (2026-09-08)**: 초안에서는 *금액 끝자리 유니크화*(110,001 / 110,002 …)를 제안했으나 **사용자가 기각**했다 — 고객 입장에서 낯선 금액은 의심을 부르고, 반올림해 입금하면 오히려 실패한다. **입금자명을 정확히 입력하도록 UI로 안내**하는 방식으로 확정. [D-07a](./06-decisions.md#d-07a-입금-확인-자동화--오픈뱅킹-api-방식-) 참고.

**복호화 없이 매칭하기 위해 해시를 쓴다.** `depositor_name_enc`는 암호화돼 있어 그대로는 비교할 수 없다. 이미 전화번호에 쓰고 있는 `phone_hash`와 **같은 기법**을 입금자명에 적용한다.

```sql
-- 입금자명 정규화 (Postgres 17.6 에서 아래 표의 결과로 실측 검증됨)
create function normalize_depositor_name(p_name text) returns text
language sql immutable as $$
  select lower(
    regexp_replace(
      regexp_replace(normalize(coalesce(p_name, ''), NFC),
                     '[\(（].*?[\)）]', '', 'g'),   -- ① 괄호와 그 "안의 내용"까지 제거
      '[[:space:][:punct:]]', '', 'g'              -- ② 남은 공백·기호 제거
    )
  );
$$;

-- 신청 저장 시 / 거래내역 수집 시 동일하게 계산
depositor_name_hash := hash_phone(normalize_depositor_name(입금자명));
```

> `hash_phone()`은 이름이 전화번호 전용처럼 보이지만 실체는 **범용 HMAC 함수**다. 재사용하거나, 의미를 명확히 하려면 `hash_text()`로 이름만 바꿔 함께 쓴다.

#### 정규화 실측 결과 (2026-09-08, Postgres 17.6)

| 입력 | 정규화 결과 | `김민수`와 매칭 |
|---|---|---|
| `김민수` | `김민수` | ✅ |
| `김 민 수` | `김민수` | ✅ |
| `김민수 ` / ` 김민수` | `김민수` | ✅ |
| `김민수(카카오)` | `김민수` | ✅ |
| `김민수（주）` (전각 괄호) | `김민수` | ✅ |
| `김민수*` | `김민수` | ✅ |
| `KIM MINSU` / `kim minsu` | `kimminsu` | ✅ 서로 일치 |
| `(주)우주이스케이프` | `우주이스케이프` | — (다른 이름) |
| `김민수-1` | `김민수1` | ❌ **매칭 실패** |

> ⚠️ **①번 단계(괄호 안 내용 제거)가 없으면 `김민수(카카오)` → `김민수카카오`가 되어 매칭에 실패한다.** 초안에는 이 단계가 빠져 있었고, 위 표는 실제 DB에서 돌려 확인한 결과다.
>
> `김민수-1`처럼 **숫자 접미가 붙는 경우는 여전히 실패**한다. 은행별로 어떤 부가문자가 붙는지는 실운영 데이터를 봐야 알 수 있으므로, **초기 몇 주간 미매칭 사례를 수집해 정규화 규칙을 보강**한다. 규칙을 처음부터 과하게 공격적으로 만들면 **서로 다른 사람을 같은 사람으로 오인**할 수 있으니, 느슨하게 시작해 데이터를 보고 좁힌다.

#### 매칭 판정

```
거래 1건에 대해:
  amount_krw 일치  AND  depositor_name_hash 일치
  AND payment_status = 'pending'  AND status <> 'cancelled'

  ├─ 정확히 1건   → 자동 확정 (matched_by='auto') + 문자2 발송
  ├─ 0건          → 미매칭 큐 → 어드민 수동 처리
  └─ 2건 이상     → 모호 → 미매칭 큐 → 어드민 수동 처리
```

#### 이 방식이 성립하기 위한 전제 (필수)

**입금자명이 정확히 일치해야만 자동 확인된다는 것을 고객이 알아야 한다.** UI 3곳에 강조 문구를 넣는다.

| 위치 | 문구 성격 |
|---|---|
| **신청 폼** 입금자명 입력란 | "실제로 **입금하실 분의 성함**과 정확히 일치해야 자동 확인됩니다" — 입력란 바로 아래 경고 스타일 |
| **신청 완료 화면** | 입금액·입금자명을 나란히 크게 재확인 노출 |
| **문자1(신청확인)** | 동일 문구 포함 (`sms_templates`에서 편집 가능) |

#### 그래도 남는 실패 케이스 → 어드민 "미매칭 입금" 화면이 필수

| 케이스 | 자동 매칭 결과 |
|---|---|
| 동명이인이 같은 인원수로 신청 | 2건 이상 매칭 → 모호 |
| 가족·지인·회사명으로 입금 | 0건 |
| 금액 오입력, 중복 입금, 분할 입금 | 0건 |
| 은행이 이름에 부가정보를 덧붙임 | 정규화가 못 흡수하면 0건 |

> **완전 자동화는 불가능하다.** 자동 매칭은 대부분을 걷어내는 장치이고, 나머지를 사람이 빠르게 처리할 화면이 반드시 함께 있어야 한다. 08 문서의 어드민 설계에 이 화면을 1순위로 넣는다.

### 4-7. 나이 규칙 — 연도를 상수로 박지 않는다

현행 `check (birth_year between 1987 and 2007)`은 **해가 바뀌면 사람이 고쳐야 하는 폭탄**이다.

```sql
-- 회차의 min_age 를 만족하는 것이 "확실한" 출생연도만 통과 (보수적 판정)
create function is_eligible_birth_year(p_year int, p_min_age int) returns boolean
language sql stable as $$          -- ⚠️ immutable 아님 (아래 설명)
  select p_year <= extract(year from (now() at time zone 'Asia/Seoul'))::int - (p_min_age + 1);
$$;

-- 회차 생성 시 min_age 자동 계산 (D-03: 18시 기준 분기)
create function default_min_age(p_starts_at timestamptz, p_theme_floor int default null)
returns int language sql immutable as $$
  select greatest(
    case when extract(hour from (p_starts_at at time zone 'Asia/Seoul')) < 18 then 16 else 19 end,
    coalesce(p_theme_floor, 0)
  );
$$;
```

| 회차 시작 (KST) | `min_age` | 2026년 기준 허용 출생연도 |
|---|---|---|
| 18:00 이전 | 16 | **2009년생 이하** |
| 18:00 이후 | 19 | **2006년생 이하** |

> `min_age` 를 **회차에 저장**하는 이유: 시각에서 매번 유도하면, 나중에 18시 기준이 바뀔 때 **과거 회차의 적용 기준까지 소급해 바뀐다.** 저장해두면 "그 회차에 실제로 적용된 규칙"이 영구히 남는다.

> ⚠️ **`immutable`로 선언하면 안 된다.** `now()`를 쓰는 함수를 `immutable`로 표시하면 플래너가 결과를 상수로 접어버려, **해가 바뀌어도 옛 기준이 그대로 남는** 사고가 난다. 반드시 `stable`이다.
>
> **그리고 Postgres는 이 실수를 막아주지 않는다.** 운영과 동일한 Postgres 17.6에서 직접 확인한 결과, `now()`를 쓰는 함수를 `immutable`로 선언해도 **아무 오류 없이 생성된다.** 전적으로 작성자 책임이므로 코드리뷰 체크 항목으로 둔다.

#### 나이 판정을 CHECK 제약이 아니라 함수 안에 두는 이유

```sql
-- 테이블 CHECK 은 넓은 위생 검사만
birth_year int not null check (birth_year between 1900 and 2100)
-- 실제 만 14세 판정은 submit_application() 안에서만 수행
```

> **검증 결과(2026-09-08, Postgres 17.6 실측)**: 흔히 "CHECK 제약에는 시간 의존 표현식을 못 쓴다"고 알려져 있으나, **실제로는 Postgres가 허용한다.** `check (y <= extract(year from now())::int - 15)` 형태의 테이블이 오류 없이 생성됐다.
>
> 그럼에도 쓰지 않는 이유는 **금지돼서가 아니라 위험해서**다.
>
> 1. **의미가 시간에 따라 변한다.** 같은 제약이 작년과 올해 다른 것을 뜻한다. 어떤 데이터가 유효한지 스키마만 봐서는 알 수 없다.
> 2. **덤프/복구가 비결정적이 된다.** CHECK 은 복구 시 INSERT마다 재평가된다. 즉 **복구를 언제 하느냐에 따라 결과가 달라진다.** 자체 백업 체계([D-08](./06-decisions.md#d-08-db-백업--자체-백업-스크립트-))를 갖춘 지금, 복구가 시점에 좌우되는 설계는 받아들일 수 없다.
> 3. **`v40` 교훈의 재발 위험.** 현행 `check (birth_year between 1987 and 2007)`처럼 제약과 함수가 어긋나면 신청이 막힌다. 판정 로직을 **한 곳(함수)에만** 두면 이 종류의 불일치가 원천적으로 사라진다.
>
> 결론적으로 규칙은 `submit_application()` 한 곳에만 존재하고, 테이블 CHECK 은 오타 방지용 위생 검사만 담당한다.

상한(하한 연도) 제한은 **없앤다.**

### 4-8. 그 밖의 신규 테이블 (요약)

| 테이블 | 목적 | 근거 |
|---|---|---|
| `point_ledger` | 적립·차감 이력. 잔액은 합계로 계산(원장 방식) | [D-06](./06-decisions.md#d-06-로그인-부활--실익-4가지-모두-채택-) 실익 4 |
| `notices` / `faqs` | 공지·FAQ를 코드에서 DB로 | [D-09](./06-decisions.md#d-09-어드민-범위--쇼핑몰급-전체-) |
| `site_settings` | 입금 계좌 등 운영 설정 (현재 `bankAccount.ts` 하드코딩) | [D-07](./06-decisions.md#d-07-결제--무통장계좌이체-유지--입금-확인-자동화-) |
| `admin_users` | 운영자 계정·역할 (현재 공유 비밀번호 1개) | [D-09](./06-decisions.md#d-09-어드민-범위--쇼핑몰급-전체-) |
| `audit_logs` | 되돌리기 어려운 액션 기록 | 원칙 5 |

`point_ledger`는 잔액 컬럼을 두지 않고 **원장(ledger)** 으로만 관리한다. 잔액 컬럼과 이력이 어긋나는 사고가 정산 시스템의 대표적 실패 모드이기 때문이다.

`faqs`는 주의가 필요하다 — 현재 `FaqSection.tsx`의 답변에 **JSX가 섞여 있어** 문자열로 그대로 옮길 수 없다. 마크다운 등 서식 표현 방식을 먼저 정해야 한다.

---

## 5. 핵심 로직

### 5-1. `submit_application()` 재작성

현행 8단계 검증에서 **소개팅 분기 8곳이 전부 사라지고**, 판정 기준이 바뀐다.

```
 1. 필수 약관 동의
 2. 회차 존재 + status = 'open'  (session_view 로 실효값 조회, FOR UPDATE 로 잠금)
 3. 참여 인원 >= 1
 4. 출생년도: 회차의 min_age 기준 판정      ← 테마별 분기 제거, 시각별 차등(D-03)
 5. 그룹 내부 전화번호 중복 금지
 6. ⭐ 재참여 배타: theme_id 기준           ← content_group 문자열 → 외래키
 7. 정원 판정: 인원 합계 vs capacity_max    ← 성별 분기 제거
 8. 접수번호 생성 + amount_krw / depositor_name_hash 확정   ← 신규 (입금 매칭용)
 9. applications + application_attendees 삽입
10. 정원 도달 시 status='closed'
```

**유지할 것**: `select … for update` 직렬화(2026-08-20 스트레스 테스트로 오버부킹 없음이 검증됨), 그룹 전체가 못 들어가면 신청 자체를 거부(부분 확정 없음), `'정원마감:'` 접두사 에러 구분.

**제거할 것**: 성별 필수 검증, 성별 정원, `male_closed`/`female_closed`, 소개팅 1인 강제.

#### 재참여 판정 (D-02)

```sql
-- 같은 테마에 취소되지 않은 신청이 이미 있으면 거부
exists (
  select 1
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  join sessions s      on s.id  = ap.session_id
  where ap.status <> 'cancelled'
    and s.theme_id = v_theme_id          -- ← content_group 대신
    and aa.phone_hash = hash_phone(입력전화번호)
)
```

**로그인 부활 후**: 판정 키가 `phone_hash` 하나에서 `phone_hash OR user_id` 둘로 늘어난다. 같은 사람이 다른 전화번호로 계정에 로그인해 재신청하는 경로를 막기 위함이다. **1단계에서는 `phone_hash`만 사용**하고, 계정 도입 시 확장한다.

### 5-2. 입금 자동 매칭 파이프라인

```
[크론 5~10분 주기]
  │
  ├─ 1. 오픈뱅킹 거래내역 조회 (마지막 수집 시점 이후)
  ├─ 2. bank_transactions 에 upsert  (external_id 유니크 → 중복 수집 방지)
  ├─ 3. 미매칭 거래 각각에 대해:
  │        amount_krw 와 depositor_name_hash 가 모두 일치하고
  │        payment_status='pending' AND status<>'cancelled' 인 신청 탐색
  │        ├─ 정확히 1건  → 자동 확정 (matched_by='auto')
  │        │                 payment_status='confirmed'
  │        │                 문자2(입금확인) 발송
  │        └─ 0건 또는 2건+ → 미매칭으로 남김 → 어드민 처리 대기
  └─ 4. 처리 결과 요약을 Slack 알림
```

**폴링이라 실시간이 아니다.** 고객은 입금 후 최대 조회 주기만큼 기다린다. 완료 화면과 안내 문자에 *"입금 확인까지 최대 10분 정도 걸릴 수 있습니다"* 를 명시한다.

> ⚠️ **선결 조건**: 현재 `/api/cron/reminder`가 어디에도 등록되지 않아 자동 실행되지 않는다. 입금 매칭 크론을 붙이기 전에 **크론 실행 기반부터 갖춰야 한다**(`vercel.json` cron 또는 외부 크론). 이건 09 로드맵의 선행 과제다.

### 5-3. 미입금 자동취소

가상계좌와 달리 자동 만료가 없으므로 직접 구현한다. 같은 크론에서 처리한다.

```
payment_status='pending' AND created_at < now() - interval '30 minutes'
  → status='cancelled', payment_status='cancelled'
  → 문자4(미입금취소) 발송
  → 해당 회차 정원이 즉시 회수되어 대기자에게 자리가 돌아감
```

30분이라는 값은 `site_settings`에 두어 운영 중 조정 가능하게 한다.

---

## 6. 권한 모델

현행의 가장 잘 된 설계를 그대로 계승한다 — **테이블 GRANT를 주지 않는 것이 1차 방어선**이고 RLS는 2차다.

| 대상 | `anon` / `authenticated` | `service_role` |
|---|---|---|
| `themes`, `sessions`, `session_view`, `venue_public` | `SELECT` | `SELECT` |
| `venues`, `applications`, `application_attendees`, `bank_transactions`, `point_ledger`, `audit_logs`, `admin_users`, `site_settings` | **없음** | 필요한 것만 |
| `notices`, `faqs` | `SELECT` (게시된 것만 뷰로) | `SELECT`, `UPDATE` |
| `admin_*_view` (복호화 뷰) | **없음** | `SELECT` |

### 함수 권한 (v44 교훈 반영)

```sql
-- 신규 함수를 만들 때마다 반드시 명시적으로 처리한다.
revoke execute on function <fn> from public;   -- ⭐ 기본 ACL(PUBLIC=X) 차단
grant  execute on function <fn> to anon, authenticated;   -- 공개 RPC 만
```

> **왜 이걸 규칙으로 못박는가**: Postgres 함수는 `proacl`이 `NULL`이면 **기본값이 PUBLIC 실행 허용**이다. `encrypt_pii`/`decrypt_pii`/`get_pii_key`가 정확히 이래서 공개 REST API로 열려 있었다(v44에서 회수 완료). 게다가 **Supabase 대시보드는 이 노출을 표시하지 않는다** — "0 of 16 functions exposed"로 보인다.
> → 신규 함수 생성 시 `revoke … from public`을 **의무화**하고, 아래 점검 쿼리를 CI 또는 정기 점검에 넣는다.

```sql
-- 기본 ACL 로 방치된 함수 탐지 (proacl IS NULL = PUBLIC 실행 가능)
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proacl is null;
```

---

## 7. 스키마 관리 방식 전환 (G5)

| | 현재 | 변경 후 |
|---|---|---|
| `supabase-schema.sql` | 5,080줄 append-only 변경 로그. `submit_application()`만 12번 재정의 | **폐기**(히스토리 참고용으로 보존) |
| `supabase-schema-clean.sql` | v13 무렵에서 정지. `session_type`·`sms_templates` 등이 0건 등장 | **폐기** |
| 신규 | — | `supabase/migrations/` **순번 마이그레이션** + `supabase/schema.sql` **선언형 현재 상태** |

**규칙**:
1. 모든 스키마 변경은 마이그레이션 파일로만. **SQL Editor 직접 실행 금지.**
2. `schema.sql`은 항상 "현재 상태"를 담는다 — 이 파일만 읽으면 지금 스키마를 알 수 있어야 한다.
3. 버전 번호(v44 등)로 순서를 판단하지 않는다. 현재 `v24`·`v41`이 각각 두 번 등장해 이미 신뢰할 수 없다.

> 2026-08-14 프로덕션 함수 오삭제 장애의 직접 원인이 "원본이 어디 있는지 알 수 없는 ad-hoc 함수"였다. 이 전환은 그 재발 방지책이다.

---

## 8. 데이터 마이그레이션 계획

기존 실고객 데이터: **신청 58건 / 참여자 67명 / 회차 2건**. [D-05](./06-decisions.md#d-05-소개팅-기존-데이터--그대로-보존-)에 따라 **전부 보존**한다.

### 8-1. 매핑

```
venues        ← session_venues 2건을 1건으로 통합 (같은 장소)
                venue_address 가 비어 있으므로 실주소 입력 필요

themes        ← 「바-ㅇ탈출」 1건 신규 생성
                content_group='baotalchul' 이 곧 이 테마다
                content JSONB ← sessions/[slug]/page.tsx 하드코딩 내용 이관
                가격/정원 ← 그룹 회차 기준(55,000 / 24 / 50)으로 설정

sessions      ← 기존 2건
                theme_id            = 「바-ㅇ탈출」
                legacy_format       = '그룹' | '소개팅'
                legacy_slug         = '0829-meeting' | '0829-dating'
                price_krw_override  = 55,000 | 65,000   ← 가격이 달랐으므로 override 사용
                capacity_*_override = 소개팅 회차의 정원 차이 반영
                status              = 'closed' (유지)

applications  ← 58건 그대로
                user_id           = null (전부 비회원)
                headcount         = 참여자 수 (application_attendees 카운트)
                unit_price_krw    = 해당 회차 가격
                amount_krw          = headcount * unit_price
                depositor_name_hash = 기존 depositor_name_enc 복호화 후 재계산
                동의 컬럼 3세대 → consent_required / consent_optional 로 정리

application_attendees ← 67건 그대로 (컬럼 변경 없음)
```

### 8-2. ⭐ 재참여 배타 관계가 그대로 보존되는지 확인

이번 마이그레이션에서 **가장 중요한 검증 항목**이다.

```
현재: content_group = 'baotalchul' 인 회차에 신청한 사람은 재신청 불가
변경: theme_id = 「바-ㅇ탈출」 인 회차에 신청한 사람은 재신청 불가
```

기존 두 회차가 **모두 같은 `content_group`** 이었고 **모두 같은 테마**로 이관되므로, **판정 결과가 1:1로 동일하다.** 즉 소개팅에 참여했던 분도, 그룹에 참여했던 분도, 앞으로 바-ㅇ탈출을 신청할 수 없다 — [D-05의 정정](./06-decisions.md#-정정-2026-09-08--소개팅과-그룹은-같은-테마다)에서 확인한 의도 그대로다.

**검증 쿼리**(마이그레이션 전후로 실행해 결과가 같아야 한다):

```sql
-- 재참여 차단 대상 인원 수
select count(distinct aa.phone_hash)
from application_attendees aa
join applications ap on ap.id = aa.application_id
where ap.status <> 'cancelled';
```

### 8-3. 절차

1. **테스트 프로젝트(`wouldyouescape_test`)에 먼저 전체 적용**하고 검증한다.
2. 운영 적용 **직전에 수동 백업 1회**(`db-backup.yml` workflow_dispatch).
3. 신규 테이블 생성 → 데이터 이관 → 검증 → 구 컬럼 제거는 **마지막에 별도 마이그레이션으로**.
4. 구 컬럼(`session_type`, 성별 정원 6종, `content_group`, `slot`)은 **한동안 남겨둔다.** 신규 코드가 안정된 뒤 제거한다.

> 컬럼 제거를 나중으로 미루는 이유: 되돌릴 수 없는 작업이고, 운영 중 예상 못 한 참조가 드러날 수 있다. `CLAUDE.md`의 2026-08-14 교훈 그대로다.

---

## 9. 이번 설계에서 **일부러 하지 않은 것**

| 항목 | 이유 |
|---|---|
| 회차별 override 입력 UI | 컬럼만 두고 UI는 열지 않는다. 필요해질 때 스키마 변경 없이 연다([D-01](./06-decisions.md#d-01-테마--회차-2단-구조로-분리-)) |
| 대기자 자동 승격 | 현행대로 운영자 수동 판단. 전화로 참여 의사를 확인하는 절차가 실재한다 |
| `waiting_number` 저장 | 계산 방식 유지. 앞 취소 시 당겨지는 게 옳은 동작 |
| 카드 결제 / PG | [D-07](./06-decisions.md#d-07-결제--무통장계좌이체-유지--입금-확인-자동화-)에서 무통장만 하기로 확정 |
| 성별 기반 팀 배정 로직 | 성별이 선택 입력이 되어 빈칸이 생긴다([D-04](./06-decisions.md#d-04-성별--선택-입력으로-전환-)). 운영상 필요해지면 빈칸 처리 규칙부터 정한다 |

---

## 10. 이 문서 기준 남은 결정 사항

| # | 항목 | 필요 시점 |
|---|---|---|
| 1 | 오픈뱅킹 vs 은행 기업 OpenAPI 중 어느 쪽으로 갈지 | 입금 매칭 구현 착수 전 |
| 2 | 입금자명 정규화 규칙의 세부 (은행별 부가정보 패턴 수집 후 확정) | 입금 매칭 구현 중 |
| 3 | FAQ 서식 표현 방식 (마크다운 / 제한적 HTML / 블록) | 콘텐츠 관리 구현 전 |
| 4 | 운영자 인증을 Supabase Auth 역할 기반으로 갈지, 별도 인증 유지할지 | 어드민 재설계 착수 전 |
| 5 | 테마 이미지 저장소 (Supabase Storage 도입 여부) | 테마 CRUD 구현 전 |
| 6 | 입금 계좌를 개인 명의 → 사업자 명의로 변경할지 | 입금 매칭 구현 전 |

---

**다음 문서**: `08-` 화면·어드민 설계 (공개 화면 흐름, 어드민 IA, 라우팅 재편)
