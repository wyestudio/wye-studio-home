/**
 * 관리자 홈 「오늘 할 일」 — 줄의 모양과 규칙(2026-11-27 대표님 — 관리자 개편 2단계).
 *
 * 할 일은 저장하지 않고 **지금 데이터에서 그때그때 계산**한다(admin/page.tsx). 저장하는 것은
 * 운영자가 직접 적은 일(admin_todos)과 자동 할 일을 끝냄으로 체크한 기록(admin_todo_dismissals) 둘뿐이다.
 *
 * ⚠️ 이 파일은 "use client" 화면(HomeTodos)도 import 한다 — 감출 값을 적지 않는다.
 */

/** 탭. 확인 = 눈으로 보고 처리할 것 · 문자 = 안내를 보낼 것 · 준비 = 행사 전에 챙길 것. */
export type TodoTab = "check" | "sms" | "prep";

export const TODO_TABS: { key: "all" | TodoTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "check", label: "확인" },
  { key: "sms", label: "문자" },
  { key: "prep", label: "준비" },
];

export type HomeTodo = {
  /** 줄을 가르는 키. 체크할 수 있는 자동 할 일은 이 키로 끝냄을 기억한다. */
  key: string;
  tab: TodoTab;
  /** 줄 앞 표시(파티 · 노말 · 단체). 어디 일인지 색이 아니라 글자로 가른다. */
  scope: string | null;
  /** 무엇을 · 어느 건 */
  title: string;
  /** 왜 지금 */
  sub: string;
  /** 누르면 그 일을 처리하는 화면으로. 직접 적은 일은 없다. */
  href: string | null;
  /** 급한 정도 — 작을수록 위. */
  urgency: number;
  /**
   * 체크할 수 있는가.
   * 건수 줄(미매칭 입금 · 입금 확인 전 · 기한 넘김 · 환불 대기 · 새 단체 견적)은 **못 한다** —
   * 처리해서 0건이 되면 저절로 사라진다. 돈이 걸린 일을 체크로 숨기는 실수를 막는다(2026-11-27 대표님).
   */
  checkable: boolean;
  done: boolean;
  /** 직접 적은 일이면 admin_todos.id — 삭제 버튼이 붙는다. */
  manualId: string | null;
};

/** 직접 적는 할 일의 글자 수(docs/04 유효성 검사표 — 화면 · 서버 액션 · DB 제약이 같은 값). */
export const TODO_TEXT_MAX = 60;

/**
 * 파티모드 회차를 「진행 확정」 으로 보는 기준(2026-11-27 대표님).
 * 입금이 확인된 사람이 한 명이라도 있으면 진행으로 본다 — 두 명만 들어와도 협찬으로 채워 진행하기 때문이다.
 * 입금 확인 전이라도 확정 인원이 최소 인원(6명)에 닿으면 진행으로 본다.
 */
export const PARTY_MIN_HEADCOUNT = 6;
export function isPartyGo(s: { confirmed: number; paid_confirmed: number }): boolean {
  return s.paid_confirmed >= 1 || s.confirmed >= PARTY_MIN_HEADCOUNT;
}

/** 전날 · 당일 회차 준비 줄의 키. 날짜가 들어 있어 전날 체크해도 당일에는 다시 나온다. */
export function sessionPrepKey(sessionId: string, today: string): string {
  return `session-prep:${sessionId}:${today}`;
}

/** 체크할 수 있는 자동 할 일의 키인가 — 서버 액션이 이 모양만 받는다(주소 · 폼 값은 누구나 바꿀 수 있다). */
export function isDismissableKey(key: string): boolean {
  return /^session-prep:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{4}-\d{2}-\d{2}$/.test(key);
}

/** 남은 일 먼저(급한 순), 끝낸 일은 아래로. */
export function sortTodos(list: HomeTodo[]): HomeTodo[] {
  return [...list].sort((a, b) => Number(a.done) - Number(b.done) || a.urgency - b.urgency || a.key.localeCompare(b.key));
}
