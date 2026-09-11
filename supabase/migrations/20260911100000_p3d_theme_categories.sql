-- 테마 카테고리 (테마당 1개)
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기:
--   alter table themes drop column category_id;
--   drop table theme_categories;
--
-- 앞으로 파티형 방탈출 외에 웹 방탈출·일반 방탈출 등이 생긴다.
-- 상세 화면의 "그룹 파티형 방탈출" 자리에 들어갈 분류다.
--
-- 문자열 컬럼이 아니라 테이블로 둔 이유: 이름을 바꾸면 그 카테고리를 쓰는
-- 테마 전부에 한 번에 반영돼야 한다. 문자열이면 테마마다 따로 고쳐야 한다.

create table if not exists theme_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table themes
  add column if not exists category_id uuid references theme_categories(id) on delete set null;

create index if not exists themes_category_idx on themes(category_id);

alter table theme_categories enable row level security;

drop policy if exists theme_categories_select_all on theme_categories;
create policy theme_categories_select_all on theme_categories for select using (true);

grant select on theme_categories to anon, authenticated;
grant select, insert, update, delete on theme_categories to service_role;

insert into theme_categories (name, sort_order) values ('파티형 방탈출', 1)
on conflict (name) do nothing;

update themes set category_id = (select id from theme_categories where name = '파티형 방탈출')
 where category_id is null;
