/**
 * /codename — 코드네임 맞히기 이벤트의 문구·일정.
 *
 * 문제나 일정이 바뀌면 **이 파일만** 고치면 된다. 화면(CodenameReport.tsx)과
 * 서버 액션(actions.ts)이 같은 값을 읽는다.
 *
 * ⚠️ 정답 문자열은 여기에 두지 않는다. 이 파일은 브라우저로도 내려간다 —
 *    정답은 서버 환경변수 EVENT_CODENAME_ANSWER 에만 둔다.
 */

/** 코드네임 자릿수 — 문제가 바뀌면 이 값만 고친다. */
export const CODENAME_LENGTH = 7;

/** 접수증에서 복사해 가는 인증 댓글 문구. */
export const CERT_PHRASE = "요원 신원 확인 완료 🌼";

export type Round = {
  /** 이 날(YYYY-MM-DD) 전까지 이 회차로 본다. */
  until: string;
  name: string;
  dates: string;
  /** 남은 기간(D-n) 계산 기준일. null 이면 D-day 를 숨긴다. */
  close: string | null;
  /** DB 에 기록할 회차 번호. */
  roundNo: 1 | 2;
  /** 추첨이 끝나고 카드 수령 확인용으로만 받는 기간. */
  always?: boolean;
  /**
   * 접수를 닫은 기간. 화면은 폼 대신 마감 안내를 띄우고,
   * 서버 액션(actions.ts)도 저장을 거절한다.
   *
   * ⚠️ 화면만 닫으면 막은 게 아니다 — 서버 액션은 주소만 알면 그대로 호출된다.
   *    닫을 때는 반드시 양쪽을 같이 닫는다.
   */
  closed?: boolean;
};

export const ROUNDS: Round[] = [
  {
    until: "2026-09-20",
    name: "1차 응모 접수 예정",
    dates: "9월 20일 오픈 · 발표 9월 25일",
    close: "2026-09-20",
    roundNo: 1,
  },
  {
    until: "2026-09-25",
    name: "1차 응모 접수 중",
    dates: "9월 20일~9월 24일 · 발표 9월 25일",
    close: "2026-09-25",
    roundNo: 1,
  },
  // 1차 마감 · 2차 대기(2026-09-25 하루). **닫아 둔다.**
  //
  // ⚠️ closed 를 빼지 않는다. 이 줄은 원래 roundNo: 2 에 closed 도 없어서,
  //    1차 마감 다음 날인 이 하루에 들어온 제출이 그대로 round = 2 로
  //    저장되게 돼 있었다(회차 판정이 날짜 기반이라 그렇다).
  //    접수는 9월 26일부터다 — 그 전날은 받지 않는다.
  {
    until: "2026-09-26",
    name: "1차 마감 · 2차 대기",
    dates: "2차 접수 9월 26일 시작 · 1차 발표 9월 25일",
    close: null,
    roundNo: 1,
    closed: true,
  },
  {
    until: "2026-10-26",
    name: "2차 응모 접수 중",
    dates: "9월 26일~10월 25일 · 발표 10월 27일",
    close: "2026-10-26",
    roundNo: 2,
  },
  {
    until: "2099-01-01",
    name: "비하인드 카드 상시 접수",
    dates: "초청권 추첨 종료 · 카드 대상 등록",
    close: null,
    roundNo: 2,
    always: true,
  },
];

/*
 * ⚠️ 2차는 2026-09-26 00:00(KST)에 **아무도 손대지 않아도 저절로 열린다.**
 *    그 전에 반드시 확인할 것:
 *
 *    1. 2차 정답이 1차와 다르면 EVENT_CODENAME_ANSWER(Vercel 환경변수)를
 *       **먼저** 바꾼다. 안 바꾸면 2차 제출이 1차 정답으로 채점된다.
 *    2. 코드네임 자릿수가 달라지면 이 파일의 CODENAME_LENGTH 도 같이 고친다.
 *       화면 검증과 DB 저장이 둘 다 이 값을 본다.
 *    3. 힌트가 바뀌면 hints.ts 의 HINTS 와 이 파일의 HINT_MASKS 를
 *       **길이까지 같이** 맞춘다.
 *
 * 2차도 닫아야 할 일이 생기면 위 "2차 응모 접수 중" 줄에 closed: true 를
 * 붙이는 게 아니라, until 을 지난 날짜로 당겨 마감 줄이 잡히게 한다.
 */

/**
 * 지금이 어느 회차인지. 화면과 서버가 같은 규칙으로 판정한다.
 *
 * ⚠️ DB 에 넣을 회차는 반드시 서버에서 이 함수로 다시 구한다.
 *    브라우저가 보낸 회차를 믿으면 마감 뒤에도 1차로 밀어 넣을 수 있다.
 */
export function currentRound(now: Date = new Date()): Round {
  // 한국 시간 기준 날짜(YYYY-MM-DD)로 비교한다. 서버는 UTC 로 돌아간다.
  const seoul = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const stamp = seoul.toISOString().slice(0, 10);
  return ROUNDS.find((r) => stamp < r.until) ?? ROUNDS[ROUNDS.length - 1];
}

/** 마감까지 남은 날. 오늘 마감이면 0, 회차에 마감이 없으면 null. */
export function daysLeft(round: Round, now: Date = new Date()): number | null {
  if (!round.close) return null;
  const close = new Date(`${round.close}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((close - now.getTime()) / 86_400_000));
}

/**
 * 힌트를 열기 전에 보여 주는 가림막. **이 배열의 길이가 화면의 힌트 칸 수를 정한다.**
 *
 * ⚠️ 힌트 원문은 여기 두지 않는다 — 이 파일은 클라이언트 번들로 내려가므로 잠긴
 *    힌트까지 개발자도구로 읽힌다. 원문은 서버 전용 hints.ts 에 있고, 열람 버튼을
 *    누를 때 revealHint() 서버 액션으로 한 줄씩 받아 온다.
 *    힌트를 늘리거나 줄이면 hints.ts 의 HINTS 와 **길이를 같이** 맞춘다.
 */
export const HINT_MASKS = ["████ ████████ ███████", "███████ ███ ████", "█████ ██████████"];

/** 관제소가 보내는 말. 상황마다 한 줄씩 타이핑된다. */
export const COMMS = {
  intro: "단서를 해독한 요원이 나타났군. 이름만 확인되면 이 기록은 바로 봉인하겠다.",
  /** 마감된 회차에서 intro 대신 나온다. */
  closed: "이 사건은 종결됐다. 접수창구는 닫혔고, 결과는 게시판에 붙여 뒀다.",
  codenameFocus: "신중하게. 여기 적힌 이름만 기록으로 남는다.",
  codenameFilled: "일곱 자리, 형식은 맞는군.",
  nickname: (value: string) => `${value} 요원, 명단에 올렸다.`,
  hint: "자료 일부를 열어줬다. 여기까지가 규정이야.",
  consent: "서명 확인. 이제 봉인해도 좋다.",
  invalid: "기록이 비었다. 빈 칸을 확인해라.",
  duplicate: "같은 번호로 봉인된 기록이 이미 있다.",
  keepOld: "기존 기록은 그대로 둔다.",
  sealing: "관제소로 넘긴다.",
  sealed: "수고했다, 요원. 나머지는 현장에서 보자.",
  failed: "전송이 끊겼다. 잠시 뒤 다시 보내라.",
} as const;

/* ══════════════ 마감 화면에서 내보내는 링크 ══════════════ */

/**
 * "신청하러 가기" — 바-ㅇ탈출 테마 상세.
 *
 * ⚠️ utm 을 붙이지 않는다. 유입경로는 **첫 도착 한 번만** 기록한다
 *    (first-touch, src/lib/attribution.ts). 오방카페에서 utm 을 달고 들어온
 *    손님에게 내부 링크로 utm 을 다시 씌우면 진짜 출처가 가려진다.
 *    내부 이동은 attribution.ts 가 애초에 출처로 치지도 않는다.
 */
export const APPLY_URL = "/themes/baotalchul";

/** 마감 안내 문구. */
export const CLOSED = {
  badge: "CLOSED",
  title: "1차 접수가 마감되었습니다",
  body: "9월 24일 자정으로 코드네임 보고가 끝났습니다. 당첨자는 오방카페 이벤트 게시글에서 발표합니다.",
  next: "2차 접수는 9월 26일부터 시작됩니다. 발표는 10월 27일입니다.",
} as const;
