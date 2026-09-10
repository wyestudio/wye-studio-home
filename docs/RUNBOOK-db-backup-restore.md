# 런북 — DB 백업 / 복구

**대상**: 운영 Supabase `wouldyouescape` (`jilghhbbtjyybzbgwdhq`)
**배경**: [06-decisions.md D-08](./06-decisions.md) — Supabase Free 플랜은 백업을 제공하지 않아 자체 백업을 운영한다.
**구현**: `.github/workflows/db-backup.yml`

---

## 1. 최초 설정 (한 번만 — 담당자가 직접 해야 함)

⚠️ 아래 값은 **비밀번호·비밀키**이므로 반드시 본인이 직접 등록해야 한다.

### 1-1. GitHub Secrets 3개 등록

`github.com/wyestudio/wye-studio-home` → **Settings → Secrets and variables → Actions → New repository secret**

| Secret 이름 | 값 | 비고 |
|---|---|---|
| `SUPABASE_DB_URL` | **Session Pooler** 연결 문자열 | 아래 1-2 참고 |
| `BACKUP_ENCRYPTION_PASSPHRASE` | 충분히 긴 무작위 문자열 (32자 이상 권장) | 아래 1-3 참고 |
| `SLACK_WEBHOOK_URL` | 실패 알림용 (선택) | 이미 있으면 재사용 |

### 1-2. `SUPABASE_DB_URL` — 반드시 **Session Pooler**를 쓸 것

Supabase 대시보드 → 상단 **Connect** → **Session pooler** 탭에서 복사한다.

```
postgresql://postgres.jilghhbbtjyybzbgwdhq:[비밀번호]@aws-<region>.pooler.supabase.com:5432/postgres
                                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 이 형태여야 함
```

> 🚫 **Direct connection(`db.jilghhbbtjyybzbgwdhq.supabase.co:5432`)을 넣으면 작동하지 않는다.**
> Free 플랜의 direct 엔드포인트는 **IPv6 전용**이고, **GitHub Actions 러너는 IPv4 전용**이다
> (Supabase 공식 문서가 GitHub Actions 를 IPv6 미지원 플랫폼으로 명시). Session Pooler 는 모든 요금제에서 IPv4다.

DB 비밀번호를 모르면 대시보드 → **Database → Settings → Reset database password** 에서 재설정한다.

### 1-3. `BACKUP_ENCRYPTION_PASSPHRASE` — 잃어버리면 백업을 못 연다

로컬에서 생성:

```bash
openssl rand -base64 48
```

> 🔑 이 값을 **비밀번호 관리자에 반드시 별도 보관**할 것. 이 문자열이 없으면 백업 파일은 복구 불가능한 암호문 덩어리다.
> GitHub Secret 은 등록 후 다시 볼 수 없다.

### 1-4. ⚠️ Vault 의 PII 암호화 키를 별도 보관할 것 (매우 중요)

`application_attendees.name_enc` / `phone_enc`, `applications.depositor_name_enc` 등은 **Supabase Vault 에 저장된 `app_pii_key`** 로 암호화돼 있다.

**이 키는 `pg_dump` 에 포함되지 않는다.** 즉 백업 파일만 있고 키가 없으면, 복구해도 고객 이름·전화번호를 **영구히 읽을 수 없다.**

→ 담당자가 직접 SQL Editor 에서 키 값을 확인해 **비밀번호 관리자에 보관**할 것. (이 문서에는 절대 적지 않는다.)

### 1-5. 동작 확인

Actions 탭 → **DB Backup** → **Run workflow** 로 수동 실행해 성공하는지 확인한다.

#### ✅ 최초 실행 기록 (2026-09-10)

| 항목 | 결과 |
|---|---|
| 워크플로 실행 | 성공 (44초) |
| artifact | `wye-db-backup-20260910T013953Z` · **68KB** · 90일 보관 |
| SHA-256 무결성 | ✅ OK |
| 파일 형식 | ✅ `PGP symmetric key encrypted data - AES with 256-bit key salted & iterated - SHA512` |
| 평문 유출 검사 | ✅ 암호문에서 `PGDMP`·테이블명 등 평문 흔적 없음 |
| Slack 실패 알림 | ✅ 동작 확인 (첫 시도 실패 시 실제로 발송됨) |

**첫 시도는 실패했고 원인은 `pg_dump` 버전이었다.** Ubuntu 의 `/usr/bin/pg_dump` 는 실제 바이너리가 아니라 버전을 고르는 래퍼라, `postgresql-client-17` 을 설치해도 러너에 미리 깔린 16 을 선택해 `server version mismatch` 로 실패했다. `/usr/lib/postgresql/17/bin` 을 `GITHUB_PATH` 에 올려 해결했고, 같은 문제가 조용히 재발하지 않도록 **버전 검증 단계**를 추가했다.

#### ✅ 복호화 · 내용 검증까지 완료 (2026-09-10)

담당자가 실제 암호로 복호화에 성공했고, 덤프 내용까지 확인했다.

| 항목 | 결과 |
|---|---|
| GPG 복호화 | ✅ 성공 |
| 덤프 헤더 | ✅ `PGDMP` (정상 커스텀 포맷) |
| public 테이블 12개 | ✅ **전부 스키마 + 데이터 포함** |
| 함수 / 뷰 / 트리거 / 타입 | ✅ 16 / 5 / 1 / 1 — 운영 DB 실측치와 일치 |
| 핵심 함수 | ✅ `submit_application` · `lookup_application` · `cancel_application` · `get_session_stats` |
| `auth.users` | ✅ 스키마 + 데이터 (로그인 부활 대비) |

**→ 백업 생성 → 암호화 → 복호화 → 복구 가능성까지 전 구간이 증명되었다.**

> **`pg_restore` 버전이 백업보다 높아도 된다.** 이번 검증은 백업(`pg_dump` 17) 을 `pg_restore` 18.6 으로 읽었고 문제없었다.
> 반대 방향(낮은 도구로 높은 백업 읽기)만 실패한다 — 첫 백업이 `pg_dump` 16 으로 서버 17 을 덤프하려다 실패한 것이 그 경우다.

#### 🧹 검증 후 정리 (중요)

복호화한 `restored.pgcustom` 은 **암호가 풀린 고객 데이터**다. 검증이 끝나면 반드시 지운다.

```bash
rm -rf ~/backup-test
```

#### 재검증 절차 (분기 1회)

```bash
brew install gnupg libpq                              # 최초 1회
export PATH="$(brew --prefix libpq)/bin:$PATH"        # libpq 는 keg-only
gh run download <RUN_ID> --dir ~/backup-test
cd ~/backup-test/wye-db-backup-*
shasum -a 256 -c *.sha256
gpg --output restored.pgcustom --decrypt *.pgcustom.gpg
pg_restore --list restored.pgcustom | grep -E "applications|sessions" | head
rm -rf ~/backup-test                                  # 끝나면 반드시 삭제
```

---

## 2. 평소 동작

| 항목 | 값 |
|---|---|
| 실행 주기 | 매일 **18:30 UTC = 03:30 KST** |
| 대상 스키마 | `public` (앱 전체) + `auth` (계정) |
| 형식 | `pg_dump --format=custom --compress=9` |
| 암호화 | GPG 대칭키 **AES256** (S2K SHA512, count 65011712) |
| 보관 | GitHub Actions artifact, **90일** |
| 실패 시 | Slack 알림 |

### 왜 암호화가 필수인가

이 저장소는 **public** 이다. public 저장소의 Actions artifact 는 *"read access to the repository"* 만 있으면 내려받을 수 있고, public 저장소는 **모두가 read 권한을 가진다.** 즉 artifact 는 사실상 공개다. 덤프는 실고객 개인정보 원본이므로 암호화 없이는 절대 올리면 안 된다.

### 남아 있는 한계 (인지하고 선택한 것)

- **복구가 수동**이다 (Supabase Pro 의 대시보드 클릭 복구와 다름).
- 백업 사이 최대 **24시간치 데이터는 유실**된다.
- artifact 보관은 **90일**이 상한이다. 더 길게 보관하려면 외부 스토리지(예: Cloudflare R2)로 옮겨야 한다.
- 백업 잡이 조용히 실패할 수 있으므로 **Slack 실패 알림 설정이 사실상 필수**다.

---

## ⚠️ 헷갈리기 쉬운 두 개의 비밀값 — 반드시 구분할 것

실제로 혼동이 발생한 적이 있다(2026-09-10). 복구는 스트레스 상황에서 하게 되므로 여기서 못 박아둔다.

| | 무엇을 여는가 | 출처 | 언제 쓰나 |
|---|---|---|---|
| **`BACKUP_ENCRYPTION_PASSPHRASE`** | **백업 파일(.gpg) 자체** | `openssl rand -base64 48` 로 생성 → GitHub Secret 등록 | 복구 **1단계** (파일 열기) |
| **Vault `app_pii_key`** | 복구된 **DB 안의** 암호화 컬럼 (고객 이름·전화번호) | `select decrypted_secret from vault.decrypted_secrets where name='app_pii_key'` | 복구 **마지막** (데이터 읽기) |

> **백업 파일 = 금고**, `BACKUP_ENCRYPTION_PASSPHRASE` = **금고 열쇠**.
> Vault 키는 금고를 연 뒤 **안에 든 서류를 읽는 암호**다. 순서가 다르고 값도 완전히 다르다.

**증상별 판별**:

| 증상 | 원인 | 조치 |
|---|---|---|
| `gpg: decryption failed: Bad session key` | `BACKUP_ENCRYPTION_PASSPHRASE` 가 틀림 (Vault 키를 넣었을 가능성 높음) | 올바른 백업 암호로 재시도 |
| 복구는 됐는데 이름·전화번호가 깨져 보임 | Vault 키가 없거나 다름 | 새 프로젝트 Vault 에 `app_pii_key` 를 동일 값으로 등록 |

---

## 3. 복구 절차

### 3-1. 백업 내려받기

GitHub → **Actions → DB Backup** → 복구하려는 날짜의 실행 → 하단 **Artifacts** 에서 다운로드.

### 3-2. 무결성 확인 후 복호화

> ⚠️ **사전 준비 (2026-09-10 확인: 이 Mac 에는 둘 다 없었다).** 복구는 급한 상황에서 하게 되므로 **미리 설치해둘 것.**
>
> ```bash
> # 1) 백업 파일 복호화용
> brew install gnupg
>
> # 2) 덤프 확인·복구용 (pg_restore)
> brew install libpq
> export PATH="$(brew --prefix libpq)/bin:$PATH"
> pg_restore --version
> ```
>
> `libpq` 는 Homebrew 가 PATH 에 자동 등록하지 않는 keg-only 패키지다. **`export PATH` 를 빠뜨리면 `zsh: command not found: pg_restore` 가 난다.**
> 영구 적용: `echo 'export PATH="$(brew --prefix libpq)/bin:$PATH"' >> ~/.zshrc`

```bash
# 무결성 확인 (macOS 는 sha256sum 대신 shasum -a 256)
shasum -a 256 -c wye-db-<STAMP>.sha256

# 복호화 (BACKUP_ENCRYPTION_PASSPHRASE 입력 프롬프트가 뜬다)
gpg --output restored.pgcustom --decrypt wye-db-<STAMP>.pgcustom.gpg
```

### 3-3. 내용 확인 (복구 전에 반드시)

```bash
# 가장 빠른 사전 확인 — 정상적인 커스텀 덤프면 'PGDMP' 로 시작한다
head -c 5 restored.pgcustom

# 어떤 객체가 들어있는지 목록만 먼저 본다
pg_restore --list restored.pgcustom | head -50

# 특정 테이블 데이터가 실제로 들어있는지 확인
pg_restore --list restored.pgcustom | grep -E "applications|application_attendees|sessions"
```

### 3-4. ⛔ 운영에 바로 덮어쓰지 말 것

**반드시 아래 순서를 지킨다.**

1. **새 Supabase 프로젝트를 만들어 먼저 복구**하고 데이터가 온전한지 확인한다.
2. 확인이 끝난 뒤에야 운영 반영을 판단한다.
3. 운영에 반영하기 전, **현재 운영 상태를 먼저 덤프**해둔다(잘못된 복구로 상황이 더 나빠지는 것을 막는다).

```bash
# 검증용 프로젝트에 복구
export TARGET_DB_URL="postgresql://postgres.<새프로젝트ref>:[비밀번호]@aws-<region>.pooler.supabase.com:5432/postgres"

pg_restore \
  --dbname="$TARGET_DB_URL" \
  --no-owner \
  --no-privileges \
  --clean --if-exists \
  --verbose \
  restored.pgcustom
```

### 3-5. 복구 후 반드시 확인할 것

```sql
-- 1. 행 수
select 'sessions' t, count(*) from sessions
union all select 'applications', count(*) from applications
union all select 'application_attendees', count(*) from application_attendees
union all select 'sms_templates', count(*) from sms_templates;

-- 2. PII 복호화가 되는가 (Vault 키가 새 프로젝트에도 있어야 함 — 1-4 참고)
select decrypt_pii(name_enc) is not null as pii_ok from application_attendees limit 1;

-- 3. 권한 상태 (pg_dump --no-privileges 라 GRANT 는 복구되지 않는다!)
select p.proname, coalesce(p.proacl::text,'NULL(=PUBLIC 실행가능)') from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('get_pii_key','encrypt_pii','decrypt_pii','hash_phone');
```

> ⚠️ **`--no-privileges` 로 덤프하므로 GRANT/REVOKE 는 복구되지 않는다.**
> 복구 후에는 `supabase-schema.sql` 의 grant 문과 마이그레이션 `v44_revoke_pii_functions_from_public` 을
> **반드시 다시 적용**해야 한다. 그러지 않으면 PII 함수가 다시 PUBLIC 에 열린 상태가 된다.

---

## 4. 정기 점검 (분기 1회 권장)

백업은 "복구해본 적 있는 백업"만 백업이다.

- [ ] 최근 artifact 를 실제로 내려받아 복호화가 되는가
- [ ] 새 프로젝트에 복구해 행 수가 맞는가
- [ ] Vault PII 키로 복호화가 되는가
- [ ] `BACKUP_ENCRYPTION_PASSPHRASE` 가 비밀번호 관리자에 살아있는가
- [ ] 백업 잡이 최근 30일간 실패 없이 돌았는가
