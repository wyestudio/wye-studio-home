-- p32: 닉네임에 대문자를 허용하면서, 중복 판정은 대소문자를 구분하지 않도록 변경
--
-- 왜 필요한가
--   닉네임이 소문자만 허용이라 대표님이 대문자도 쓰게 해달라고 요청했다.
--   그런데 중복 검사가 `x.nickname = p_nickname` 이라 대소문자를 구분한다.
--   그대로 대문자만 열면 같은 회차에 wooju 와 Wooju 가 동시에 존재할 수 있고,
--   현장에서 서로를 못 알아본다. 그래서 판정 기준을 lower() 로 바꾼다.
--
--   저장은 입력한 그대로 둔다. 화면에는 본인이 쓴 대로 보이는 게 맞다.
--   비교할 때만 대소문자를 무시한다.
--
-- ⚠️ submit_application_v2() 는 건드리지 않는다. 그 함수는 닉네임 중복을
--    unique_violation 예외로만 처리하고, 실제 사전 검사는 이 함수가 한다.

create or replace function public.check_nickname_available(p_session_id uuid, p_nickname text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = p_session_id
      and x.nickname is not null
      -- 대소문자 무시. wooju 와 Wooju 는 같은 닉네임으로 본다.
      and lower(x.nickname) = lower(p_nickname)
      and a.status <> 'cancelled'
  );
$function$;
