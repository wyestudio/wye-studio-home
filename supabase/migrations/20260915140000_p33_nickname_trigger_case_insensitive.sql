-- p33: 닉네임 중복을 막는 트리거도 대소문자를 구분하지 않게 맞춘다
--
-- 왜 필요한가
--   p32 에서 대문자를 허용하고 사전 검사(check_nickname_available)를 lower()
--   비교로 바꿨는데, **실제로 막는 쪽**인 이 트리거는 `x.nickname = new.nickname`
--   그대로였다. 그러면 화면은 Wooju 를 거부하는데 DB 는 통과시킨다 —
--   보증이 화면보다 느슨해지는 상태라, 폼을 거치지 않는 경로(어드민 직접 입력 등)로
--   같은 회차에 wooju 와 Wooju 가 같이 들어갈 수 있다.
--
--   이 트리거가 실제 방어선이다. submit_application_v2() 가 세션 행을
--   `for update` 로 잠근 뒤 insert 하므로, 같은 회차 동시 제출은 직렬화되고
--   두 번째 트랜잭션의 트리거가 첫 번째가 커밋한 행을 보고 거부한다.
--
--   유니크 인덱스를 쓰지 않는 이유: "취소된 신청의 닉네임은 다시 쓸 수 있다"
--   (p12 에서 정한 규칙)를 인덱스로는 표현할 수 없다. status 는 applications 에
--   있고 닉네임은 application_attendees 에 있어 부분 인덱스로 못 건다.
--
-- ⚠️ submit_application_v2() 는 건드리지 않는다.

create or replace function public.enforce_session_nickname_unique() returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.nickname is null or btrim(new.nickname) = '' then
    return new;
  end if;

  if exists (
    select 1
    from application_attendees x
    join applications a on a.id = x.application_id
    where x.session_id = new.session_id
      -- 대소문자 무시. 같은 회차에 wooju 와 Wooju 가 같이 있으면
      -- 현장에서 서로를 못 알아본다. 판정 기준을 check_nickname_available() 과
      -- 똑같이 맞춰야 화면 안내와 실제 거부가 어긋나지 않는다.
      and lower(x.nickname) = lower(new.nickname)
      and x.id <> new.id
      and a.status <> 'cancelled'
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 이름을 적어주세요.';
  end if;

  return new;
end;
$function$;
