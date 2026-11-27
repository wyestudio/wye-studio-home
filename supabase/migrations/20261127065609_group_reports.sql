-- 단체 플레이 리포트(관리자 개편 6단계, 2026-11-27 대표님) — 단체별로 리포트에 적은 내용을 보관한다.
--
-- 무엇을 두나: 글자(제목 · 일시 · 진행자 · 인사말) · 게임 이름 · 팀(팀명 · 팀원 닉네임 · 상 이름 · 한줄평) · 점수 · 꾸밈(다크/라이트 · 포인트색).
-- 무엇을 두지 않나: **사진**. 사진에는 참가자 얼굴이 들어가서 서버에 두지 않기로 했다(2026-11-27 대표님).
--   사진은 리포트 화면 안에만 있고, 운영자가 [HTML 저장] · [PDF / 인쇄] 로 자기 컴퓨터에 보관한다.
--   (서버 액션이 저장 전에 사진 칸을 걸러내고, 아래 크기 제한이 한 번 더 막는다 — 사진 한 장만 섞여도 넘는다.)
--
-- 보안: RLS 를 켜고 정책을 두지 않는다. 어드민 서버(service_role)만 읽고 쓴다.
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 리포트 틀 파일은 따로 올린다(admin-tools/play-report.html).
--
-- 되돌리기:
--   drop table if exists public.group_reports;

create table if not exists public.group_reports (
  inquiry_id uuid primary key references public.group_booking_inquiries(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 60000),
  updated_at timestamptz not null default now()
);
comment on table public.group_reports is '단체 플레이 리포트에 적은 내용(글자 · 팀 · 점수). 사진은 두지 않는다.';

alter table public.group_reports enable row level security;
revoke all on public.group_reports from anon, authenticated;
grant select, insert, update, delete on public.group_reports to service_role;
