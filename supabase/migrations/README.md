# migrations/

**앞으로의 모든 스키마 변경은 여기에 파일로 남긴다.**

## 이름 규칙

```
<version>_<name>.sql        예: 20260910025453_p1_expand_themes_venues_core.sql
```

`version` 은 Supabase 마이그레이션 이력(`supabase_migrations.schema_migrations`)의 값과 일치시킨다.

## 적용 절차

1. 먼저 **테스트 프로젝트**(`wouldyouescape_test`)에 적용하고 검증한다.
2. 검증이 끝나면 **운영**(`wouldyouescape`)에 같은 SQL 을 적용한다.
3. `Schema Drift Check` 워크플로를 실행해 `supabase/schema.sql` 을 갱신한다
   (artifact `schema-snapshot` 을 받아 교체).
4. 마이그레이션 파일과 갱신된 `schema.sql` 을 함께 커밋한다.

## 규칙

- **Supabase SQL Editor 직접 실행 금지.** 드리프트 탐지가 잡아낸다.
- 신규 함수에는 반드시 `revoke execute on function <fn> from public;` 을 함께 넣는다.
  Postgres 는 `proacl` 이 NULL 이면 **기본값이 PUBLIC 실행 허용**이고
  Supabase 대시보드는 이 노출을 표시하지 않는다 (`v44` 사고 참고).
- 되돌리는 방법을 파일 상단 주석에 적는다.

## 이력 공백 (알아둘 것)

Supabase 마이그레이션 이력의 **가장 오래된 항목이 2026-08-15** 다.
그 이전(v1~v12 시대) 변경은 SQL Editor 에서 직접 실행돼 **기록이 없다.**
`supabase-schema.sql` 의 서술형 로그가 유일한 흔적이며, 현재 상태는
`supabase/schema.sql` 로 확인한다.
