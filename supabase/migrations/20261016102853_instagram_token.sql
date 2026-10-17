-- 우리 인스타 계정 액세스 토큰 보관.
--
-- 왜 환경변수가 아니라 표인가
--   인스타 토큰은 60일이면 만료되고, 만료 전에 갱신하면 **새 토큰**이 나온다.
--   환경변수는 코드가 고쳐 쓸 수 없어서 60일마다 사람이 Vercel 에 다시 넣어야 한다.
--   크론이 갱신한 토큰을 여기에 적어 두면 사람이 손댈 일이 없다.
--   처음 한 번만 환경변수(IG_OWN_ACCESS_TOKEN)로 넣고, 그 뒤로는 이 표가 우선한다.
--
-- ⚠️ 토큰이 그대로 들어 있다. 정책을 두지 않아 anon·authenticated 는 닿지 못하고,
--    서버(service_role)만 읽고 쓴다.

create table if not exists public.instagram_tokens (
  -- 계정이 하나라 'own' 한 줄만 쓴다. 나중에 계정이 늘면 키를 늘린다.
  id text primary key default 'own',
  access_token text not null,
  -- 인스타가 알려준 만료 시각. 갱신할 때마다 60일 뒤로 밀린다.
  expires_at timestamptz,
  refreshed_at timestamptz not null default now()
);

comment on table public.instagram_tokens is
  '우리 인스타 계정 토큰. 크론이 60일 만료 전에 갱신해 여기 적는다 (src/lib/instagramOwn.ts).';

alter table public.instagram_tokens enable row level security;

-- ⚠️ RLS 와 별개로 grant 가 있어야 service_role 이 표에 닿는다(새 표에 자동으로 붙지 않는다).
grant select, insert, update on public.instagram_tokens to service_role;
