-- 유입경로(UTM) 링크 관리
--
-- 적용: test 20260917053335 (적용 완료, 2026-09-17) / 운영 20260917055136 (적용 완료, 2026-09-17)
--   ⚠️ 파일명 앞자리와 DB 에 기록된 번호가 다르다. 적용 도구가 실행 시각으로 번호를
--      새로 매기기 때문이다. "무엇이 적용됐나" 는 위 번호로 DB 에 물어본다.
-- 되돌리기:
--   drop view if exists public.public_short_link;
--   drop table if exists public.utm_links;
--   (신청·결제·정산 어디도 이 표를 참조하지 않으므로 지워도 다른 기능에 영향이 없다)
--
-- 왜 필요한가
--   지금 쓰는 링크 16개가 컨플루언스 표(WYE-89)와 next.config 두 곳에만 있고,
--   시스템은 그 존재를 모른다. 새 링크가 필요하면 문서에서 규칙을 읽어 손으로
--   주소를 조합해야 하는데, utm_source=instgram 처럼 한 글자만 틀려도 그 유입은
--   별개 채널로 집계되어 통계에서 사라진다.
--
-- ⚠️ 이 표는 **분석·홍보용**이다. 신청·결제·정산 어디에도 영향을 주지 않는다.
--    잼핏 정산 기준은 계약상 '전용 쿠폰 사용 + 실제 입금' 이고 UTM 은 보조자료다
--    (제휴계약 제2조, WYE-89 2.6). 이 표를 정산 계산에 끌어다 쓰지 말 것.
--
-- ⚠️ 이미 배포된 짧은 주소(/open-event, *.go)는 next.config 와 라우트 핸들러에
--    그대로 둔다. 외부에 뿌린 주소를 DB 조회에 의존하게 만들 이유가 없다.
--    그 링크들은 managed_by='code' 로 **목록에만** 싣는다 — 어드민에서 고쳐도
--    실제 동작은 바뀌지 않으므로 화면에서 그렇게 표시해야 한다.

create table if not exists public.utm_links (
  id            uuid primary key default gen_random_uuid(),

  -- 어디에 거는 링크인지. 목록에서 사람이 알아보는 이름.
  -- 예: '잼핏 상세페이지 홈페이지 예약하기'
  label         text not null,

  -- 짧은 주소의 경로 한 칸. 'open-event' 처럼 앞의 / 없이 넣는다.
  -- 비우면 짧은 주소 없이 UTM 링크만 쓴다.
  slug          text,

  -- 도착 경로. '/themes/baotalchul' 처럼 / 로 시작한다.
  landing_path  text not null check (landing_path ~ '^/'),

  -- WYE-89 1.1 의 네 축. source/medium/campaign 은 비우지 않는다 —
  -- campaign 이 비면 GA4 가 (not set) 으로 집계해 같은 채널 유입이 갈라진다.
  utm_source    text not null check (utm_source ~ '^[a-z0-9_]+$'),
  utm_medium    text not null,
  utm_campaign  text not null check (utm_campaign ~ '^[a-z0-9_]+$'),
  utm_content   text,
  utm_term      text,

  -- 'db'  : 이 표가 실제 동작을 결정한다(짧은 주소 해석 포함)
  -- 'code': next.config / 라우트 핸들러에 박혀 있다. 여기 값은 기록일 뿐이다
  managed_by    text not null default 'db' check (managed_by in ('db', 'code')),

  -- 끝난 이벤트 링크는 지우지 않고 내린다. 지우면 과거 유입의 뜻을 잃는다.
  status        text not null default 'active' check (status in ('active', 'disabled')),

  note          text,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- WYE-89 1.1 이 정한 다섯 값. 여기를 벗어나면 GA4 기본 채널 그룹이
  -- 분류하지 못해 '미분류(Unassigned)' 로 빠진다.
  -- 규칙 수립 이전에 배포된 링크(managed_by='code')는 profile·post·shorts·video 를
  -- 쓰고 있어 예외로 둔다 — 고칠 대상이지 기록을 막을 대상이 아니다.
  constraint utm_links_medium_rule check (
    managed_by = 'code'
    or utm_medium in ('social', 'paid_social', 'referral', 'affiliate', 'display')
  ),

  -- 짧은 주소는 소문자·숫자·하이픈·점만. 점을 허용하는 이유는 이미 배포된
  -- ig.go, yt-shorts.go 같은 주소를 그대로 기록해야 하기 때문이다.
  -- 실제 페이지 경로와 겹치는지는 DB 가 알 수 없으므로 어드민에서 막는다.
  constraint utm_links_slug_shape check (slug is null or slug ~ '^[a-z0-9][a-z0-9.-]*$')
);

-- 짧은 주소는 겹치면 안 된다. 비운 행이 여럿이어야 하므로 부분 유니크로.
create unique index if not exists utm_links_slug_key
  on public.utm_links (slug)
  where slug is not null;

create index if not exists utm_links_status_sort_idx
  on public.utm_links (status, sort, created_at);

comment on table public.utm_links is
  '유입경로(UTM) 링크 목록. 분석·홍보용이며 신청·결제·정산에 영향을 주지 않는다. 규칙은 WYE-89 문서.';
comment on column public.utm_links.managed_by is
  'code = next.config/라우트 핸들러에 박혀 있어 이 표를 고쳐도 동작이 바뀌지 않는다(기록용).';
comment on column public.utm_links.slug is
  '짧은 주소 경로(앞의 / 없이). managed_by=db 인 행만 실제로 해석된다.';

-- 어드민(service_role)만 쓴다. 테이블 GRANT 가 이 프로젝트의 1차 방어선이다.
alter table public.utm_links enable row level security;
revoke all on public.utm_links from anon, authenticated;

-- ⚠️ 새 표는 기본값으로 아무 권한이 없다. 명시하지 않으면 어드민에서
--    'permission denied' 가 난다(실제로 겪음).
grant select, insert, update, delete on public.utm_links to service_role;

-- 짧은 주소 해석용 공개 뷰.
-- 리다이렉트 라우트가 요청마다 읽으므로 service_role 키를 쓰지 않는다.
-- 살아 있는 짧은 주소의 목적지만 내보낸다 — label·note 는 내부 메모다.
create or replace view public.public_short_link as
select
  slug,
  landing_path,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term
from public.utm_links
where status = 'active'
  and managed_by = 'db'
  and slug is not null;

grant select on public.public_short_link to anon, authenticated, service_role;

comment on view public.public_short_link is
  '짧은 주소 해석용. 활성·DB관리 행의 목적지만 공개한다.';

-- 처음 한 번만 채운다. 이미 행이 있으면 건드리지 않는다.
-- 값 출처: WYE-89 v8 (2026-09-17) 와, 같은 날 운영 도메인 16개 경로에
-- 실제 요청을 보내 확인한 응답.
insert into public.utm_links
  (label, slug, landing_path, utm_source, utm_medium, utm_campaign, utm_content, managed_by, sort, note)
select * from (values
  -- ── 규칙(WYE-89 1.1)에 따라 만든 링크 ──────────────────────────────
  ('인스타그램 바이오 링크',        null, '/contents',           'instagram',       'social',      'profile',           'bio_link',        'db', 10, null),
  ('인스타그램 카드뉴스 (피드)',     null, '/contents',           'instagram',       'social',      'feed',              'cardnews_survey', 'db', 20, null),
  ('인스타그램 카드뉴스 (유료 부스트)', null, '/contents',         'instagram',       'paid_social', 'feed',              'cardnews_survey', 'db', 30, null),
  ('카카오톡 채널 홈',              null, '/',                   'kakao_channel',   'social',      'always_on',         null,              'db', 40, '채널 홈 URL 100자 제한 — utm_content 생략'),
  ('카카오톡 채널 신청하기 버튼',    null, '/contents',           'kakao_channel',   'social',      'always_on',         'apply',           'db', 50, null),
  ('네이버 플레이스 홈페이지',       null, '/',                   'naver_place',     'referral',    'always_on',         null,              'db', 60, '업체정보 URL 100자 제한 — utm_content 생략'),
  ('잼핏 상세페이지 예약하기',       null, '/themes/baotalchul',  'zamfit',          'affiliate',   'partnership',       'detail_page',     'db', 70, '2026-09-17 잼핏 요청으로 위치별 5종에서 단일 링크로 교체'),
  ('오방 네이버카페 메인 배너',      null, '/themes/baotalchul',  'naver_cafe_oban', 'display',     'main_banner',       null,              'db', 80, '제휴계약 제11조 마케팅 지원(7일)'),

  -- ── 코드에 박혀 있는 짧은 주소 (기록용) ────────────────────────────
  ('926 오픈 쿠폰 이벤트',          'open-event',      '/themes/baotalchul', 'instagram', 'social',  'coupon_event_0926', null, 'code', 100, 'src/app/(site)/open-event/route.ts'),
  ('인스타 프로필 (프리오픈)',       'ig.go',           '/contents',          'instagram', 'profile', 'preopening',        null, 'code', 110, '규칙 수립 이전'),
  ('인스타 8월 게시물 (소개팅)',     'ig-dating.go',    '/themes/baotalchul', 'instagram', 'post',    '0829_dating',       null, 'code', 111, '규칙 수립 이전'),
  ('인스타 8월 게시물 (그룹)',       'ig-meeting.go',   '/themes/baotalchul', 'instagram', 'post',    '0829_meeting',      null, 'code', 112, '규칙 수립 이전'),
  ('당근 프로필 (프리오픈)',         'dg.go',           '/contents',          'daangn',    'profile', 'preopening',        null, 'code', 120, '규칙 수립 이전'),
  ('당근 8월 게시물 (소개팅)',       'dg-dating.go',    '/themes/baotalchul', 'daangn',    'post',    '0829_dating',       null, 'code', 121, '규칙 수립 이전'),
  ('당근 8월 게시물 (그룹)',         'dg-meeting.go',   '/themes/baotalchul', 'daangn',    'post',    '0829_meeting',      null, 'code', 122, '규칙 수립 이전'),
  ('유튜브 채널',                   'yt.go',           '/contents',          'youtube',   'profile', 'channel',           null, 'code', 130, '규칙 수립 이전'),
  ('유튜브 쇼츠',                   'yt-shorts.go',    '/contents',          'youtube',   'shorts',  'content',           null, 'code', 131, '규칙 수립 이전'),
  ('유튜브 8월 영상 (소개팅)',       'yt-dating.go',    '/themes/baotalchul', 'youtube',   'video',   '0829_dating',       null, 'code', 132, '규칙 수립 이전'),
  ('유튜브 8월 영상 (그룹)',         'yt-meeting.go',   '/themes/baotalchul', 'youtube',   'video',   '0829_meeting',      null, 'code', 133, '규칙 수립 이전'),
  ('틱톡 프로필',                   'tiktok.go',       '/contents',          'tiktok',    'profile', 'content',           null, 'code', 140, '규칙 수립 이전'),
  ('틱톡 영상',                     'tiktok-video.go', '/contents',          'tiktok',    'video',   'content',           null, 'code', 141, '규칙 수립 이전')
) as seed(label, slug, landing_path, utm_source, utm_medium, utm_campaign, utm_content, managed_by, sort, note)
where not exists (select 1 from public.utm_links);
