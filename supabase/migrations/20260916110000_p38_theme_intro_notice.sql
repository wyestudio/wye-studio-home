-- Phase 38 — 테마 소개 화면의 강조 안내 문구
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기: alter table themes drop column if exists intro_notice;
--
-- 왜 (2026-09-16)
--   프리오픈 때 소개팅 회차를 운영했던 탓에 '우주이스케이프 = 소개팅' 으로 오해해
--   신청을 망설이는 사람이 있다는 의견. 테마 소개 첫 화면에서 "정식 오픈 회차는
--   소개팅 없이 그룹으로 진행한다" 를 바로 읽히게 하려고 칸을 만든다.
--
--   테마마다 다른 문구가 필요하므로(이 테마 한정) 테마의 칸으로 둔다. 어드민
--   테마 편집에서 고칠 수 있고, 비우면 아무것도 안 나온다.

alter table themes add column if not exists intro_notice text;

comment on column themes.intro_notice is
  '테마 소개(첫 화면) 시놉시스 아래 강조 안내. 비우면 안 나온다. **굵게** 표기 지원.';
