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

`.github/workflows/schema-drift-check.yml` 이 운영 DB 를 떠서 이 `schema.sql` 과
대조한다. **자동으로 돌지 않는다** — 도는 때는 둘뿐이다.

- `supabase/schema.sql` 또는 `supabase/migrations/**` 를 건드리는 PR
- Actions 탭에서 직접 실행 (Schema Drift Check > Run workflow)

2026-09-14 까지는 매일 돌며 Slack 으로 알렸으나, 울리는 대부분이 "우리가 한
변경인데 스냅샷만 안 갱신한 것" 이라 잡음이 더 컸다. 알림과 cron 을 뺐다.

**⚠️ 그래서 이제 사람이 챙겨야 한다.** 운영 DB 를 SQL Editor 에서 직접 고쳤다면
(분류기가 막아서 손으로 실행하는 경우가 실제로 있다) **그 직후에** 이 워크플로를
한 번 수동 실행할 것. 검사가 실패하면 artifact `schema-snapshot` 을 받아
`supabase/schema.sql` 을 교체하고 커밋한다.

**검사가 실패했을 때 읽는 법** — 로그에 `--- 차이 (앞 200줄) ---` 이 찍혔는지 먼저 본다.
안 찍혔으면 검사 자체가 깨진 것(접속 실패·pg_dump 버전 등)이고 드리프트가 아니다.
찍혔으면 diff 의 객체 이름을 `migrations/` 에서 grep 해, 근거 파일이 없으면
**마이그레이션을 거치지 않은 변경**이다 — 2026-08-14 장애와 같은 유형이니 그냥 덮지 말 것.

## 왜 이렇게 바꿨나

기존에는 두 파일이 있었으나 **둘 다 현재 상태를 답하지 못했다.**

- `supabase-schema.sql` (5,080줄) — append-only 변경 로그.
  `submit_application()` 만 12번 재정의돼 있어 "지금 정의"를 찾기 어렵다.
- `supabase-schema-clean.sql` (805줄) — v13 무렵에서 정지.
  `session_type` · `sms_templates` · 협찬/페이백 관련 문자열이 **0건** 등장한다.

2026-08-14 에 프로덕션 함수를 잘못 삭제해 서비스가 마비된 장애의 직접 원인이
"원본이 어디에 있는지 알 수 없는 ad-hoc 함수" 였다. 이 전환은 그 재발 방지책이다.

두 옛 파일은 **히스토리 참고용으로 남겨두되 현재 상태의 근거로 쓰지 않는다.**
