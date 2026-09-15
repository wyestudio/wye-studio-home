-- p31 : 테마 카테고리 설명 (물음표 말풍선)
--
-- 적용: test (2026-09-15) · 운영 (미적용 — 배포와 함께)
-- 되돌리기: alter table public.theme_categories drop column if exists description;
--
-- 왜
--   테마 상세 제목 옆 '파티형 방탈출' 을 손님이 이해하지 못할 것 같다는 의견.
--   옆에 물음표를 두고 누르거나 올리면 짧은 설명이 말풍선으로 뜬다.
--   설명은 카테고리마다 하나다 — 같은 카테고리의 테마가 여럿이어도 같은 문구가 나간다.
--
-- 권한: theme_categories 는 anon 에 테이블 단위 SELECT 가 이미 있어 새 칸도 그대로 읽힌다.
--       설명에는 공개해도 되는 문구만 넣는다.

alter table public.theme_categories
  add column if not exists description text;

comment on column public.theme_categories.description is
  '카테고리 설명. 테마 상세에서 카테고리 옆 물음표를 누르면 말풍선으로 보인다. 비우면 물음표가 안 나온다.';

-- 초안. 이미 적어둔 값은 덮지 않는다.
update public.theme_categories
   set description = '여러 팀이 한 공간에 모여 동시에 문제를 풀며 경쟁하는 방탈출이에요. '
                  || '사이사이 미니게임과 참가자끼리 어울리는 시간이 함께 진행돼요.',
       updated_at = now()
 where name = '파티형 방탈출' and description is null;
