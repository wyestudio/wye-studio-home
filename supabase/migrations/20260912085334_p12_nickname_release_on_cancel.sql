-- Phase 12 — 취소한 신청이 닉네임을 계속 점유하던 문제
--
-- 적용: test 20260912085334 (적용 완료) / 운영 (미적용)
-- 되돌리기:
--   drop trigger if exists application_attendees_nickname_unique on application_attendees;
--   drop function if exists enforce_session_nickname_unique();
--   alter table application_attendees
--     add constraint application_attendees_session_id_nickname_key unique (session_id, nickname);
--
-- `unique (session_id, nickname)` 는 신청 상태를 보지 않는다. 그래서 취소한 뒤
-- 같은 회차에 다시 신청하면 **자기가 쓰던 닉네임을 다시 못 쓴다.**
--
-- 상태는 applications 에 있어서 부분 인덱스로는 표현할 수 없다(인덱스 조건에
-- 다른 테이블을 참조할 수 없다). 그래서 제약을 트리거로 옮긴다.
--
-- ⚠️ 경쟁 조건: submit_application_v2() 가 회차 행을 select ... for update 로
--    잠근 뒤 삽입하므로 같은 회차의 동시 신청은 직렬화된다. 트리거의 exists
--    검사도 그 안에서 돈다.

alter table application_attendees
  drop constraint application_attendees_session_id_nickname_key;

create or replace function enforce_session_nickname_unique() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.nickname is null or new.nickname = '' then
    return new;
  end if;

  if exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = new.session_id
      and x.nickname = new.nickname
      and x.id <> new.id
      and a.status <> 'cancelled'
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 이름을 적어주세요.';
  end if;

  return new;
end;
$$;

revoke execute on function enforce_session_nickname_unique() from public;

drop trigger if exists application_attendees_nickname_unique on application_attendees;
create trigger application_attendees_nickname_unique
  before insert or update of nickname on application_attendees
  for each row execute function enforce_session_nickname_unique();

-- 화면의 '중복확인' 버튼도 같은 기준으로 본다.
create or replace function check_nickname_available(p_session_id uuid, p_nickname text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select not exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = p_session_id
      and x.nickname = p_nickname
      and x.nickname is not null
      and a.status <> 'cancelled'
  );
$$;

revoke execute on function check_nickname_available(uuid, text) from public;
grant execute on function check_nickname_available(uuid, text) to anon, authenticated, service_role;
