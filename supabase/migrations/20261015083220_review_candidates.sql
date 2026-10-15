-- 후기 후보 수집함.
--
-- 왜 테마 콘텐츠(themes.content)에 바로 넣지 않는가
--   수집은 자동이고 게재는 사람이 고른다. 찾아온 글을 바로 사이트에 올리면 우리와
--   무관한 글(동명 가게·광고·지난 시즌 소개팅 후기)까지 고객 화면에 실린다.
--   여기는 **고르기 전의 대기열**이고, 고른 것만 themes.content 의 reviews 블록으로 간다.
--
-- ⚠️ url 의 unique 가 이 표의 핵심이다.
--    "관련없음(ignored)" 으로 치운 글은 내일 크론이 같은 글을 또 찾아온다. url 이
--    unique 라서 insert 가 튕기고(on conflict do nothing), 치운 글은 다시 뜨지 않는다.
--    unique 를 빼면 **매일 같은 글을 다시 치워야 한다** — 이 기능을 쓸 수 없게 된다.

create table if not exists public.review_candidates (
  id uuid primary key default gen_random_uuid(),
  discovered_at timestamptz not null default now(),

  -- 어디서 찾았나. naver 는 크론이 검색 API 로 찾아오고, instagram 은 어드민에서
  -- 주소를 붙여넣는다(인스타가 자동 수집을 막아 둬서 찾아오는 건 사람이 한다).
  channel text not null check (channel in ('naver', 'instagram')),

  -- 게시물 주소. 같은 글을 두 번 담지 않기 위한 기준이자 재수집 차단의 핵심.
  url text not null unique,

  -- 네이버 검색 API 가 주는 값들(제목·요약·블로거명·작성일). 인스타는 주소만 있으면
  -- 임베드가 알아서 그리므로 대부분 비어 있다.
  title text,
  excerpt text,
  author text,
  posted_at date,

  -- 썸네일. 네이버 검색 API 는 썸네일을 주지 않아 글의 og:image 에서 따로 가져온다.
  -- 그 주소는 만료될 수 있으므로, 게재를 고른 순간 우리 저장소로 옮기고 여기에
  -- 우리 주소를 다시 적는다(stored_thumbnail_url).
  thumbnail_url text,
  stored_thumbnail_url text,

  -- new: 아직 안 봤다 / published: 후기 블록에 넣었다 / ignored: 관련없음, 다시 안 뜬다
  status text not null default 'new'
    check (status in ('new', 'published', 'ignored')),

  -- 어느 테마의 후기 블록에 넣었는지. 뺄 때 어디서 빼야 하는지 알아야 한다.
  published_theme_slug text,

  decided_at timestamptz,
  admin_memo text,
  updated_at timestamptz not null default now()
);

comment on table public.review_candidates is
  '후기 후보 수집함. 고른 것만 themes.content 의 reviews 블록으로 간다 (/admin/reviews).';

-- 어드민 목록은 "안 본 것 먼저, 최근 것 먼저" 로 본다.
create index if not exists review_candidates_status_discovered_idx
  on public.review_candidates (status, discovered_at desc);

-- 정책을 하나도 두지 않는다 = anon·authenticated 는 이 표에 닿지 못한다.
-- 수집(크론)과 어드민 화면 모두 service_role 로만 읽고 쓴다.
alter table public.review_candidates enable row level security;
