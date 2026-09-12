-- ensure_rls 이벤트 트리거가 한 번도 동작한 적이 없던 문제
--
-- 적용: test 20260912xxxx · 운영 적용 완료 (2026-09-12). 양쪽 모두 일회용 테이블로
--       실제 동작(새 테이블 RLS 자동 on)까지 확인한 뒤 프로브를 지웠다.
-- 되돌리기: 아래 옛 정의로 create or replace (권하지 않는다 — 옛 정의는 동작하지 않는다)
--   create or replace function public.rls_auto_enable() returns event_trigger
--   language plpgsql security definer set search_path to 'public' as $old$
--   begin execute 'alter table ' || quote_ident(pg_event_trigger_table_spec())
--         || ' enable row level security'; exception when others then null; end; $old$;
--
-- ⚠️ 무엇이 문제였나
--    옛 본문이 **존재하지 않는 함수** pg_event_trigger_table_spec() 를 불렀다.
--    바로 뒤의 `exception when others then null` 이 그 오류를 통째로 삼켜서,
--    새 테이블이 생겨도 RLS 가 켜지지 않았고 아무 흔적도 남지 않았다.
--    이벤트 트리거는 "조용히 아무것도 안 하는" 상태로 오래 방치돼 있었다.
--
--    다행히 실제 노출은 없었다 — 각 마이그레이션이 enable row level security 를
--    직접 적어 왔다. 2026-09-12 점검에서 public 스키마 31개 테이블 전부 RLS on,
--    anon SELECT 가 열린 건 의도된 6개(themes / notices / faqs / sessions /
--    theme_categories / theme_price_tiers)뿐인 것을 확인했다.
--
-- 올바른 API 는 pg_event_trigger_ddl_commands() 다.
-- ⚠️ 예외는 계속 삼키되 null 이 아니라 WARNING 으로 남긴다. 여기서 예외를 올리면
--    RLS 를 못 켜는 순간 CREATE TABLE 자체가 실패한다 — 그게 더 위험하다.
--    대신 이제는 실패가 로그에 보인다.
-- ⚠️ public 스키마만 손댄다. 확장(extension) 설치가 만드는 테이블까지 건드리면
--    설치가 깨질 수 있다.
--
-- 트리거 자체(ensure_rls, ddl_command_end, tags: CREATE TABLE / CREATE TABLE AS /
-- SELECT INTO)는 이미 있으므로 함수 본문만 바꾼다.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  for r in
    select object_identity
    from pg_event_trigger_ddl_commands()
    where object_type = 'table'
      and schema_name = 'public'
  loop
    begin
      execute format('alter table %s enable row level security', r.object_identity);
    exception when others then
      raise warning 'rls_auto_enable: % 에 RLS 를 켜지 못했습니다 (%)', r.object_identity, sqlerrm;
    end;
  end loop;
end;
$$;
