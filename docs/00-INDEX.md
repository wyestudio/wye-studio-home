# 현 상태 분석 문서 (아키텍처 재설계 기반자료)

**작성일**: 2026-09-08
**목적**: 8/29 프리오픈 전용으로 만들어진 현재 홈페이지를, 매주 주말 정기 운영이 가능한 범용 서비스로 재설계하기 위한 **현 상태 실측 기록**.

## 이 문서 묶음의 원칙

이 문서들은 **코드만 읽고 쓴 것이 아니라, 2026-09-08 시점의 라이브 운영 환경을 직접 조회해서** 작성했다.

| 대상 | 확인 방법 | 신뢰도 |
|---|---|---|
| DB 스키마·함수·권한·데이터 | 운영 Supabase(`jilghhbbtjyybzbgwdhq`)에 직접 SQL 실행 (`pg_proc`, `pg_policies`, `information_schema`) | 실측 |
| Supabase Auth 설정 | `GET /auth/v1/settings` 직접 호출 + 대시보드 확인 | 실측 |
| PII RPC 공개 노출 | 공개 anon 키로 `/rest/v1/rpc/encrypt_pii` 실제 호출 → HTTP 200 확인 | 실측 |
| Vercel 프로젝트·도메인·배포보호 | Vercel API 직접 조회 | 실측 |
| **Vercel 환경변수 (운영/테스트 양쪽)** | 브라우저로 대시보드 직접 확인 (키 이름·적용 환경·등록일. 값은 비공개) | 실측 |
| Supabase 플랜·컴퓨트·백업·SSL·네트워크·Data API·SMTP | 브라우저로 대시보드 직접 확인 | 실측 |
| 애플리케이션 코드 | 리포지토리 직접 grep/read (커밋 `1b0453b`, main) | 실측 |

> 최초 작성 시 Vercel/Supabase 대시보드 접근에 실패해 일부 항목이 "미확인"이었으나, 이후 사용자가 로그인된 Chrome 창을 연결해줘서 **전 항목 실측으로 대체 완료**(2026-09-08).

> ⚠️ **`CLAUDE.md`를 현 상태의 근거로 쓰지 말 것.** 데이터 모델 섹션이 `v23` 기준에서 멈춰 있는 반면 운영 DB는 그보다 20단계 이상 앞서 있다. 구체적 불일치는 [04-drift-and-risks.md](./04-drift-and-risks.md) 참고.

## 문서 목록

| 문서 | 내용 |
|---|---|
| [01-current-state-infrastructure.md](./01-current-state-infrastructure.md) | GitHub / Vercel / Supabase / 도메인 / 외부 서비스 / 환경변수 |
| [02-current-state-database.md](./02-current-state-database.md) | 운영 DB 실측 구조 — 테이블·뷰·함수·권한·트리거·실데이터 |
| [03-current-state-application.md](./03-current-state-application.md) | 라우팅·화면·서버액션·관리자 기능 인벤토리 |
| [04-drift-and-risks.md](./04-drift-and-risks.md) | 문서-코드-DB 불일치 + 보안·운영 리스크 (증거 포함) |
| [05-redesign-gap-analysis.md](./05-redesign-gap-analysis.md) | 요구 변경사항 6건별 갭 분석 + 재설계 전 결정해야 할 항목 |

### 결정 · 설계 (현 상태 분석을 바탕으로 작성)

| 문서 | 내용 |
|---|---|
| [06-decisions.md](./06-decisions.md) | **결정 기록** — D-01~D-10, 사용자 질의응답으로 확정 |
| [07-architecture-domain-and-data.md](./07-architecture-domain-and-data.md) | 설계(1) 도메인 · 데이터 모델 · RPC · 권한 · 마이그레이션 |
| [08-architecture-screens-and-admin.md](./08-architecture-screens-and-admin.md) | 설계(2) 공개 화면 · 라우팅 · 신청 폼 · 어드민 IA |
| [09-implementation-roadmap.md](./09-implementation-roadmap.md) | **구현 로드맵 · 배포 전략** — Phase 0~8, 롤백 계획 |
| [RUNBOOK-db-backup-restore.md](./RUNBOOK-db-backup-restore.md) | 운영 런북 — DB 백업 설정 · 복구 절차 |

### 반영 결과

| 문서 | 내용 |
|---|---|
| [10-production-rollout-2026-09-12.md](./10-production-rollout-2026-09-12.md) | **운영 반영 완료 보고** (2026-09-12) — 마이그레이션 29건 · 커밋 106개 · 실 플로우 검증 · 발견한 결함 4건 |
