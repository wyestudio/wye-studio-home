-- themes.difficulty 를 0.5 단위로 — smallint → numeric(2,1)
--
-- 적용: test 20261011084740 (적용 완료, 2026-10-14) / 운영 (미적용)
--
-- 왜
--   난이도 3 과 4 사이가 너무 멀다. "3 보다 어렵지만 4 는 아닌" 테마를 3.5 로
--   적을 수 있어야 한다. 값 자체는 여기서 바꾸지 않는다 — 어드민에서 고른다.
--
-- ⚠️ session_view 가 themes.difficulty 를 그대로 내보낸다. postgres 는 뷰가 쓰는
--    칸의 타입 변경을 거부하므로(cannot alter type of a column used by a view)
--    뷰를 내렸다 다시 올려야 한다.
-- ⚠️ 뷰 정의를 이 파일에 적어 두지 않고 **지금 DB 에 있는 것을 받아 그대로 다시
--    올린다.** test 와 운영의 session_view 가 다르기 때문이다 — 운영에는 아직
--    theme_mode 칸이 없다(20261008075810 미적용). 적어 두면 한쪽을 덮어쓴다.
-- ⚠️ 뷰를 drop 하면 grant 가 같이 날아간다. 고객 화면이 anon 으로 session_view 를
--    읽으므로 반드시 다시 grant 한다.
--
-- 적용 직후 대조 (정의가 한 글자도 안 바뀌었는지):
--   select md5(pg_get_viewdef('public.session_view'::regclass, true));
--   test 적용 전 3e6782d4907986559e031ca994bd6640 (2026-10-11 실측)
--   운영 적용 전 266fb58f25086e746b69530620f657de (2026-10-11 실측 — 앞선
--     마이그레이션 20261008075810 을 먼저 적용하면 이 값이 바뀐다. 그때는
--     이 파일을 돌리기 직전에 다시 재서 그 값과 대조한다)
--
-- 되돌리는 법
--   반칸(.5)이 저장된 테마가 있으면 먼저 정수로 올려/내려야 한다. 그대로
--   smallint 로 되돌리면 postgres 가 반올림해 3.5 가 조용히 4 가 된다.
--     update themes set difficulty = round(difficulty) where difficulty <> round(difficulty);
--   그 다음 같은 모양으로 뷰를 내렸다 올리며 타입을 되돌린다.
--     do $$ declare v_def text; begin
--       select pg_get_viewdef('public.session_view'::regclass, true) into v_def;
--       execute 'drop view public.session_view';
--       alter table public.themes alter column difficulty type smallint using difficulty::smallint;
--       execute 'create view public.session_view as ' || v_def;
--     end $$;
--     alter table public.themes drop constraint themes_difficulty_check;
--     alter table public.themes add constraint themes_difficulty_check
--       check (difficulty >= 0 and difficulty <= 5);
--     grant select on public.session_view to anon, authenticated, service_role;

do $$
declare
  v_def text;
begin
  select pg_get_viewdef('public.session_view'::regclass, true) into v_def;

  execute 'drop view public.session_view';

  alter table public.themes
    alter column difficulty type numeric(2,1) using difficulty::numeric(2,1);

  execute 'create view public.session_view as ' || v_def;
end $$;

-- 이름을 그대로 쓴다 — adminGuard.toActionError 가 이 이름으로 메시지를 다듬는다.
alter table public.themes drop constraint themes_difficulty_check;
alter table public.themes add constraint themes_difficulty_check
  check (
    difficulty >= 0 and difficulty <= 5
    -- 0.5 단위만. 3.7 같은 값이 들어오면 화면의 자물쇠가 반칸으로 뭉개진다.
    and difficulty * 2 = trunc(difficulty * 2)
  );

grant select on public.session_view to anon, authenticated, service_role;

comment on column public.themes.difficulty is '난이도 1~5, 0.5 단위. 0 은 미정 — 화면에서 감춘다.';
