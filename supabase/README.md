# supabase/

DB 스키마 관리 디렉터리. **여기가 스키마의 단일 기준(source of truth)이다.**

## 파일

| 파일 | 역할 |
|---|---|
| `schema.sql` | **현재 운영 DB 스키마 전체.** 이 파일 하나만 읽으면 지금 스키마를 알 수 있다 |
| `migrations/` | 순번 마이그레이션. 앞으로의 모든 스키마 변경이 여기에 쌓인다 |

## 규칙

1. **스키마 변경은 마이그레이션으로만.** Supabase SQL Editor 직접 실행 금지.
2. `schema.sql` 은 **손으로 고치지 않는다.** 운영 DB 를 떠서 생성되는 파일이다.
3. 신규 함수를 만들면 반드시 `revoke execute on function <fn> from public;` 을 함께 넣는다.
   Postgres 는 `proacl` 이 NULL 이면 **기본값이 PUBLIC 실행 허용**이고,
   Supabase 대시보드는 이 노출을 표시하지 않는다 (`v44` 사고 참고).

## 드리프트 탐지

`.github/workflows/schema-drift-check.yml` 이 매일(KST 04:40) 운영 DB 를 떠서
이 `schema.sql` 과 대조하고, 다르면 Slack 으로 알린다.

**알림이 오면** = 마이그레이션을 거치지 않은 변경이 운영 DB 에 들어갔다는 뜻이다.
Actions 실행 로그의 diff 를 확인하고, 정당한 변경이면 마이그레이션으로 기록한 뒤
`schema.sql` 을 갱신한다(artifact `schema-snapshot` 을 받아 교체).

## 왜 이렇게 바꿨나

기존에는 두 파일이 있었으나 **둘 다 현재 상태를 답하지 못했다.**

- `supabase-schema.sql` (5,080줄) — append-only 변경 로그.
  `submit_application()` 만 12번 재정의돼 있어 "지금 정의"를 찾기 어렵다.
- `supabase-schema-clean.sql` (805줄) — v13 무렵에서 정지.
  `session_type` · `sms_templates` · 협찬/페이백 관련 문자열이 **0건** 등장한다.

2026-08-14 에 프로덕션 함수를 잘못 삭제해 서비스가 마비된 장애의 직접 원인이
"원본이 어디에 있는지 알 수 없는 ad-hoc 함수" 였다. 이 전환은 그 재발 방지책이다.

두 옛 파일은 **히스토리 참고용으로 남겨두되 현재 상태의 근거로 쓰지 않는다.**
