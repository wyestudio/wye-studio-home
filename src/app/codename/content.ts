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
  {
    until: "2026-09-26",
    name: "1차 마감 · 2차 대기",
    dates: "2차 접수 9월 26일 시작",
    close: "2026-09-26",
    roundNo: 2,
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

/** 힌트는 순서대로만 열린다. 실제 문제가 바뀌면 이 문구를 교체한다. */
export const HINTS = [
  "홍보물을 다시 봐라. 무지개색 순서를 따라가면 코드네임이 드러난다.",
  "그 조직은 요원에게 꽃의 이름을 코드네임으로 붙인다. 네가 찾는 건 꽃 이름이다.",
  "우리가 그를 부르는 호칭은 '요원 J'. 그 J가 이름의 첫 글자다.",
];

/** 힌트를 열기 전에 보여 주는 가림막. 길이는 힌트 순서와 무관하다. */
export const HINT_MASKS = ["████ ████████ ███████", "███████ ███ ████", "█████ ██████████"];

/** 관제소가 보내는 말. 상황마다 한 줄씩 타이핑된다. */
export const COMMS = {
  intro: "단서를 해독한 요원이 나타났군. 이름만 확인되면 이 기록은 바로 봉인하겠다.",
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
