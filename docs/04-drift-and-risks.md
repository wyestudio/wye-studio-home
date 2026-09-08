# 04. 문서-코드-DB 불일치 및 리스크 (2026-09-08)

전부 **증거를 확인한 것만** 적었다. 추정은 "미확인"으로 명시했다.

---

## A. 문서 드리프트 — `CLAUDE.md`를 현 상태로 믿으면 안 되는 이유

`CLAUDE.md`의 "데이터 모델" 섹션은 **v23 기준**이라고 스스로 적고 있는데, 운영 DB는 그보다 20단계 이상 앞서 있다. 아래는 실제로 확인된 불일치다.

| # | `CLAUDE.md` 기술 | 실제 (2026-09-08 라이브) |
|---|---|---|
| 1 | 참가비 **69,000원** | 그룹 **55,000** / 소개팅 **65,000** (정가 79,000 / 89,000) |
| 2 | 소개팅 즉시확정선 **12명** | **10명** (`capacity_confirm_line_male/female = 10`) |
| 3 | `theme_label`이 분기·재참여 판정 기준 | **`session_type`** (`'그룹'`/`'소개팅'`)이 기준. `theme_label`은 표시용 문자열 |
| 4 | `applications.waiting_number` 컬럼 신설(v12) | **그런 컬럼 없음.** 조회 시점마다 실시간 계산 |
| 5 | 베타 회차는 8/22 2개 | 8/29 2개, 둘 다 `status='closed'` |
| 6 | `profiles`/`kakao_links`/`naver_links` + `find_account_by_email`/`find_account_by_phone` 잔존 | 테이블 3개는 잔존하나 **함수 2개는 이미 삭제됨** |
| 7 | 데이터 모델에 언급 없음 | `sessions.theme_name`, `sessions.session_type`, `sessions.difficulty` 컬럼 존재 |
| 8 | 언급 없음 | **`sms_templates` 테이블 + `/admin/sms-templates` 편집 화면** |
| 9 | 언급 없음 | 협찬 신청 2테이블 + 3RPC + 2뷰, 후기 페이백 1테이블 + 1RPC + 1뷰 |
| 10 | 언급 없음 | `applications.refund_completed_at`, `promoted_from_waiting_at` |
| 11 | 언급 없음 | `get_session_stats()`가 **입금확인 기준 카운트 3종** 추가 반환 |
| 12 | 언급 없음 | `trg_sessions_generate_labels` BEFORE INSERT 트리거 (title/theme_label 자동 생성) |
| 13 | 언급 없음 | `admin_update_application`, `check_active_applications`, `check_nickname_available` 함수 |
| 14 | 어드민 = 대시보드 + 세션상세 2화면 | **6화면** (+analytics, sponsorships, review-paybacks, sms-templates) |
| 15 | 언급 없음 | `admin.wouldyouescape.com` 서브도메인 분리, 사이트 전체 비밀번호 게이트, `/openyourdream` 이스터에그 |

**결론: 재설계 논의의 사실 근거는 `CLAUDE.md`가 아니라 이 문서 묶음과 라이브 DB여야 한다.**

---

## B. 스키마 파일 드리프트

| 파일 | 상태 |
|---|---|
| `supabase-schema.sql` (5,080줄) | **내용은 정확** — 최신 정의(v43)가 라이브와 일치함을 확인 (`submit_application`의 `session_type` 분기, 출생년도 1990~2001 / 1987~2007 동일). 단 **append-only 변경 로그**라서 `submit_application()`만 12번 재정의돼 있다. "현재 스키마가 무엇인가"를 이 파일로 답할 수 없다. |
| `supabase-schema-clean.sql` (805줄) | **심각하게 낡음.** `session_type`, `theme_name`, `difficulty`, `sms_templates`, 협찬/페이백 관련 문자열이 **단 한 번도 등장하지 않는다** (전부 0건). v13 무렵에서 멈춘 것으로 보이며, 이 파일을 "현재 스키마"로 읽으면 오해한다. |
| 버전 라벨 | **중복** — `v24.`가 2번, `v41.`이 2번 등장. 버전 번호로 순서를 판단할 수 없다. |
| 마이그레이션 테이블 | 26건, **가장 오래된 것이 2026-08-15**. 그 이전 변경은 추적 불가 |

> 2026-08-14의 프로덕션 함수 오삭제 장애(서비스 전체 마비)가 정확히 이 구조 때문에 발생했다. 재설계 시 **선언적 단일 스키마 + 순번 마이그레이션**으로 전환하는 것이 사실상 필수다.

---

## C. 보안 — 실증된 사항

### 🔴 A. PII 암호화 함수가 공개 REST API로 노출돼 있음

**증거 1** — `pg_proc.proacl` 조회 결과:

```
get_pii_key   → NULL      ← Postgres 기본 ACL = PUBLIC에 EXECUTE
encrypt_pii   → NULL      ← 동일
decrypt_pii   → NULL      ← 동일
hash_phone    → {postgres=X/postgres}      ← 올바르게 잠김
admin_update_application → {postgres=X/postgres, service_role=X/postgres}   ← 올바름
```

`proacl`이 `NULL`이면 Postgres는 기본값 `PUBLIC=X`를 적용한다. `anon`/`authenticated`는 `PUBLIC`에 포함되므로 **PostgREST의 `/rest/v1/rpc/...`로 호출 가능**하다.

**증거 2** — 공개 anon 키로 실제 호출:

```
POST https://jilghhbbtjyybzbgwdhq.supabase.co/rest/v1/rpc/encrypt_pii
     (apikey = NEXT_PUBLIC_SUPABASE_ANON_KEY)
→ HTTP 200, 암호문 반환
```

**증거 3** — Supabase 보안 린터도 동일하게 WARN으로 보고:
`anon_security_definer_function_executable` — `get_pii_key`, `encrypt_pii`, `decrypt_pii` 포함.

**의미**:
- `get_pii_key()`는 Vault에 저장된 **PII 암호화 키 자체**를 반환하는 함수다. 이게 anon에게 열려 있다.
- `decrypt_pii()`는 **복호화 오라클**이다. 암호문을 손에 넣은 사람은 누구나 평문으로 되돌릴 수 있다.
- 완화 요인: `applications`/`application_attendees` 테이블에 `anon` SELECT grant가 없어서 **암호문 자체를 API로 꺼낼 경로는 현재 없다**. 즉 "지금 당장 고객 정보가 새고 있다"는 아니다.
- 그러나 이 구조는 **PII 암호화의 전제(키가 서버 밖으로 나가지 않는다)를 무너뜨린다.** 앞으로 어느 테이블에든 select grant나 RLS 정책이 하나 잘못 열리는 순간, 암호화가 아무 방어도 되지 못한다.

> 확인은 여기까지만 하고 실제 키 추출은 시도하지 않았다. `get_pii_key`가 인자 없는 함수라 `{}` 바디로의 재호출이 필요했으나 진행하지 않았다 — ACL 상태가 세 함수 모두 동일하고 `encrypt_pii` 호출이 200으로 확인됐으므로 결론에는 영향이 없다.

**조치**: 세 함수 모두 `REVOKE EXECUTE … FROM PUBLIC`. 내부 호출은 `SECURITY DEFINER` 함수 안에서 이뤄지므로 revoke해도 기존 플로우는 깨지지 않는다. (이 작업은 되돌릴 수 있는 권한 변경이므로 안전하지만, 실행 전 스테이징(`wouldyouescape_test`)에서 신청/조회/취소 3플로우 회귀 확인 권장.)

### 🟡 B. 로그인이 "휴면"인데 회원가입 API는 열려 있음

`GET /auth/v1/settings` 실측: `"disable_signup": false`, `email: true`, `kakao: true`.
사이트에는 가입 진입점이 없지만 **Supabase Auth API를 직접 때리면 누구나 계정을 만들 수 있다.** 현재 `auth.users` = 0건이라 실제 악용 흔적은 없다.

→ 로그인을 부활시킬 계획이므로 "끄자"보다는 **부활 시점에 rate limit / 이메일 인증 / 봇 방어를 함께 설계**하는 쪽이 맞다. 부활 전까지는 `disable_signup: true`가 안전하다.

### 🟡 C. `applications`에 `authenticated` SELECT grant

```
applications :: authenticated → TRUNCATE, SELECT, REFERENCES, TRIGGER
```

의도된 설계("직접 select 정책·grant가 전혀 없음")와 어긋나는 grant다. RLS가 켜져 있고 정책이 0개라 **현재는 0행이 반환되므로 실제 유출은 없다.** 다만 나중에 정책을 하나 추가하는 순간 예상보다 넓게 열린다. → `REVOKE SELECT ON applications FROM authenticated`.

### 🟡 D. 백업 테이블 방치

`_backup_applications_20260815` — **실고객 신청 18건**이 `public` 스키마에 그대로 남아 있다. grant는 없지만, 보관 기간·삭제 책임자가 정해지지 않은 개인정보다. 개인정보 보호 관점에서 파기 또는 별도 스키마 이관이 필요하다.

### 🟡 E. 공개 리포지토리에 하드코딩된 게이트 코드

`src/lib/openYourDreamGateAuth.ts`의 `CORRECT_CODE = "43129573"`. 주석에 "env로 빼면 설정을 깜빡할 위험이 있어 하드코딩했다"고 근거가 적혀 있고 이스터에그 수준 보안이라는 판단도 명시돼 있다. 다만 **리포지토리가 public이므로 이 값은 누구나 읽을 수 있다** — "실물 명함을 가진 사람만 통과"라는 전제는 사실상 성립하지 않는다. 의도된 트레이드오프인지 재확인 필요.

### 🟢 F. 린터 기타

- `sessions_generate_labels()`의 `search_path`가 설정돼 있지 않음 (WARN). 다른 함수는 전부 `SET search_path`가 걸려 있다.
- `rls_enabled_no_policy` INFO 8건 — 이건 **의도된 설계**다(정책 없이 GRANT를 안 주는 방식). 오탐으로 취급해도 된다.

---

## D. 운영 리스크

### 1. 전날안내(문자3) 자동화가 없다

`/api/cron/reminder`는 완성돼 있으나 **어디에도 등록되지 않았다** (`vercel.json` 없음, GitHub Actions에는 keepalive만). 실제 운영은 어드민의 `SendReminderButton` 수동 발송으로 이뤄진 것으로 보인다.
→ 프리오픈 1회에는 문제없었지만, **매주 주말 반복 운영에서는 매주 수동 작업이 된다.**

### 2. 회차 등록이 SQL 수동

어드민에 회차 생성 UI가 없다. 매주 회차를 열려면 매주 Supabase SQL Editor를 연다는 뜻이다. 정기 운영의 최대 병목이며, **동시에 2026-08-14 장애와 같은 종류의 사고 위험**(운영자가 프로덕션 SQL을 직접 실행)을 매주 반복한다.

### 3. 무통장입금 수동 대사

`src/lib/bankAccount.ts`에 **개인 명의 카카오뱅크 계좌**가 하드코딩돼 있고, 입금 확인은 어드민에서 사람이 눈으로 보고 버튼을 누른다. 주 1회 → 주말마다 반복되면 부담이 선형 증가한다. 프리오픈 1회에도 취소 21건/환불 처리가 발생했다.

### 4. 운영자 행위 추적 불가

공유 비밀번호 1개. 신청 취소·환불 완료·수동 등록 같은 되돌리기 어려운 액션에 **누가 했는지 기록이 없다.**

### 5. 대기 순번이 저장되지 않음

앞 순번이 취소되면 뒤 순번이 당겨진다. 고객에게 안내한 순번과 나중에 조회한 순번이 달라질 수 있다.

### 6. Vercel Hobby 플랜 / public 리포지토리

상업적 운영과 플랜 약관, 그리고 "코드가 전부 공개"라는 사실이 정기 운영 규모에서도 유지 가능한 선택인지 재확인 필요.

### 7. Supabase Free 플랜 슬립 방지에 의존 중

`keepalive` 워크플로가 멈추면 7일 무활동 시 프로젝트가 일시정지된다. 매주 운영하면 자연 트래픽으로 해결되지만, 현재는 이 워크플로가 유일한 보험이다.

---

## E. 대시보드 실측으로 해소된 항목 (2026-09-08)

최초 작성 시 미확인이었으나, 로그인된 Chrome 창을 통해 전부 확인했다.

| 항목 | 결과 |
|---|---|
| 운영에 `SOLAPI_*` 3종 설정 여부 | ✅ **설정됨** (Aug 10 등록). CLAUDE.md "앞으로 할 일 1번" 해소 |
| 운영에 `NEXT_PUBLIC_IS_TEST_ENV`가 잘못 들어가 있는가 | ✅ **없음** — 정상 (테스트 프로젝트에만 존재) |
| `CRON_SECRET` / `ADMIN_PASSWORD` | ✅ 운영·테스트 양쪽 모두 설정됨 |
| `TEST_SUPABASE_*` 운영 잔존 여부 | ✅ 없음 (삭제 완료 확인) |
| Resend 커스텀 SMTP | ✅ 활성 — `smtp.resend.com:465`, `no-reply@wouldyouescape.com` |
| Data API 노출 설정 | ✅ `Automatically expose new tables` **OFF**, exposed schemas 2/2 |
| Enforce SSL | ✅ ON |

### 여전히 확인하지 않은 것

- **Cloudflare DNS·도메인 설정** — 이번 범위 밖
- **Solapi / Slack / GA4 콘솔 상태** — 이번 범위 밖
- 환경변수의 **실제 값** — 대시보드에서도 비공개(키 이름과 적용 환경만 확인 가능)

---

## F. 대시보드 실측에서 새로 드러난 리스크

### 🔴 G. 운영 Supabase에 **백업이 전혀 없다**

Backups 화면 원문: **"Free Plan does not include project backups."** Point-in-time recovery도 Free 미제공.

실고객 신청 58건·참여자 67건이 들어 있는 프로덕션 DB에 **스케줄 백업도, PITR도 없다.**
그리고 이 프로젝트는 이미 **2026-08-14에 프로덕션 함수를 잘못 삭제해 서비스 전체가 마비된 이력**이 있다. 그때는 함수 하나였지만, 같은 실수가 테이블/데이터에 일어나면 복구 수단이 없다.

정기 운영으로 전환하면 매주 신규 고객 데이터가 쌓인다. **Supabase Pro 전환 또는 자체 정기 덤프 중 하나는 재설계 착수 전에 반드시 갖춰야 한다.**

### 🟡 H. 운영 프로젝트의 Preview 배포가 운영 리소스를 그대로 쓴다

운영 Vercel 프로젝트의 환경변수가 거의 전부 `Production and Preview` 스코프다. 테스트 환경은 별도 프로젝트이므로, 여기서의 Preview는 **운영 프로젝트의 브랜치 프리뷰**를 뜻한다.

→ 프리뷰 배포가 **운영 Supabase에 쓰고, 운영 Solapi로 실제 문자를 보내고, 운영 Slack에 알린다.** `NEXT_PUBLIC_IS_TEST_ENV`가 운영 프로젝트에 없으므로 SMS 스킵 로직도 걸리지 않는다.

완화: 배포 보호(SSO)가 커스텀 도메인 외 전부에 걸려 외부인은 접근 불가. 그러나 팀 내부 프리뷰 테스트는 실제 고객 DB와 실제 문자 요금에 그대로 닿는다.

→ 최소 조치: 운영 프로젝트의 `SOLAPI_*`를 **Production 전용으로 좁히거나**, Preview 스코프에 `NEXT_PUBLIC_IS_TEST_ENV=true`를 추가.

### 🟡 I. DB 네트워크 제한 없음

Database Settings: **"Your database can be accessed by all IP addresses."**
`service_role` 키가 유출되면 어디서든 접속 가능하다. SSL은 강제돼 있으나 IP 제한은 없다. (Supabase 기본값이며 즉시 위험은 아니지만, 실사업 DB로서 검토 대상.)

### 🟡 J. 대시보드가 §C-A의 노출을 보여주지 않는다

Data API 설정 화면은 "**0 of 16 functions exposed**"라고 표시한다. 그러나 anon 키로 `/rest/v1/rpc/encrypt_pii`를 호출하면 **HTTP 200**이 돌아온다.

이 카운터는 **명시적으로 grant된 함수만** 세고, Postgres 기본 ACL(`PUBLIC=X`)로 열린 함수는 세지 않는다. 즉 §C-A의 PII 함수 노출은 **대시보드를 아무리 봐도 발견할 수 없다** — `pg_proc.proacl`을 직접 조회해야만 보인다.

→ 재설계 시 권한 점검은 대시보드가 아니라 **SQL 기반 체크리스트**로 해야 한다.
