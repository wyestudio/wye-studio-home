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

## 3. 복구 절차

### 3-1. 백업 내려받기

GitHub → **Actions → DB Backup** → 복구하려는 날짜의 실행 → 하단 **Artifacts** 에서 다운로드.

### 3-2. 무결성 확인 후 복호화

```bash
# 무결성 확인
sha256sum -c wye-db-<STAMP>.sha256

# 복호화 (BACKUP_ENCRYPTION_PASSPHRASE 입력)
gpg --output restored.pgcustom --decrypt wye-db-<STAMP>.pgcustom.gpg
```

### 3-3. 내용 확인 (복구 전에 반드시)

```bash
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
