-- p30 : 테마 장르(해시태그) + 시놉시스 초안
--
-- 적용: test (2026-09-15) · 운영 (미적용 — 배포와 함께)
-- 되돌리기: alter table public.themes drop column if exists genres;
--
-- 왜
--   방탈출 손님이 테마를 고를 때 보는 건 난이도 · 시간 · 장르 · 시놉시스다.
--   상세 화면 상단에서 이 넷을 크게 보여주려는데, 장르를 담을 칸이 없었다.
--   카테고리(theme_categories)는 '파티형 방탈출' 같은 **한 개의 분류**라
--   #문제방 #경쟁 #로맨스 처럼 여러 개 붙는 태그와는 성격이 다르다.
--
-- 시놉시스는 새 칸을 만들지 않는다. 기존 description 이 원래 상세 상단
-- '테마 정보 아래' 에 보이던 칸이고 운영·테스트 모두 비어 있었다.
-- 어드민 라벨만 '시놉시스' 로 바꿨다.

alter table public.themes
  add column if not exists genres text[] not null default '{}';

comment on column public.themes.genres is
  '장르 해시태그. 상세 화면에 #태그 로 보인다. # 없이 저장한다(앱이 붙여 그린다).';
comment on column public.themes.description is
  '시놉시스. 상세 화면 상단 정보 아래에 크게 보인다. 검색 결과 설명의 대체값으로도 쓰인다.';

-- 초안. 이미 누가 적어둔 값은 덮지 않는다.
--
-- ⚠️ updated_at 도 같이 올린다. 어드민 저장은 '화면을 열 때의 updated_at' 과 같을
--    때만 통과하는데, 이걸 안 올리면 마이그레이션 전에 열어둔 어드민 화면이 옛
--    내용(시놉시스 비어 있음)으로 덮어쓸 수 있다. 테스트 서버에서 실제로 지워졌다.
update public.themes
   set genres = array['문제방', '경쟁', '아케이드', '로맨스', '드라마'],
       updated_at = now()
 where slug = 'baotalchul' and genres = '{}';

update public.themes
   set description = '노을이 지는 거리 끝, 네온사인이 켜진 바에 오늘 처음 만난 사람들이 모여듭니다. '
                  || '문이 닫히는 순간 게임이 시작되고, 쏟아지는 문제를 가장 먼저 풀어낸 팀만이 이곳을 빠져나갈 수 있어요. '
                  || '남은 목숨은 하트 세 개. 경쟁 끝에 손에 쥐는 게 승리일지, 새로운 인연일지는 START 를 누른 당신에게 달렸습니다.',
       updated_at = now()
 where slug = 'baotalchul' and description is null;
