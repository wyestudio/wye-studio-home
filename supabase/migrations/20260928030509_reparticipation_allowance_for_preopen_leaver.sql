-- 프리오픈 참가자 1명에게 재참여 1회 허용 (2026-09-28)
--
-- 8/29 프리오픈(소개팅) 참가자 중 한 명이 컨텐츠 시작 전에 개인사정으로 귀가해
-- 방탈출 문제를 하나도 접하지 않았다. 같은 테마 1회 제한(D-02)이 막으려는 것은
-- "문제를 이미 아는 사람이 다시 오는 것"이므로, 이 사람은 규칙의 대상이 아니다.
--
-- 전화번호 평문을 쓰지 않는다 — 기존 참여 기록의 phone_hash 를 그대로 옮긴다.
-- 대상이 정확히 1명(1행)이 아니면 중단한다.

do $$
declare
  v_hash     text;
  v_theme_id uuid;
  v_count    int;
begin
  select count(*) into v_count
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
   where aa.nickname = '강치';

  if v_count <> 1 then
    raise exception '닉네임 "강치" 참여 기록이 1건이 아닙니다 (%건). 확인 후 다시 실행하세요.', v_count;
  end if;

  select aa.phone_hash, s.theme_id into v_hash, v_theme_id
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
   where aa.nickname = '강치';

  insert into public.reparticipation_allowances
         (phone_hash, theme_id, max_participations, reason)
  values (v_hash, v_theme_id, 2,
          '프리오픈(8/29 소개팅) 참가자. 컨텐츠 시작 전 개인사정으로 귀가해 방탈출 문제 미접촉 — 1회 재참여 허용')
  on conflict (phone_hash, theme_id) do update
     set max_participations = excluded.max_participations,
         reason             = excluded.reason;
end $$;
