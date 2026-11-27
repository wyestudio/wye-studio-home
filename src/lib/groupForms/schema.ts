/**
 * 단체 예약 공개 폼의 양식(관리자 개편 docs/04).
 *
 * 문구 · 선택지 · 글자 수를 화면 코드에 박지 않고 **이 데이터 한 곳**에 둔다. 폼 화면(FormFlow)과 서버 검증이
 * 같은 데이터를 읽는다. 문구를 고치려면 여기만 고친다.
 * (「설문 양식」 편집 화면이 생기면 이 데이터를 DB 로 옮겨 운영자가 고치게 한다 — 그때 version 이 올라간다.)
 *
 * 받은 답에는 그때의 version 을 같이 저장한다 — 문항이 바뀌어도 예전 답이 깨지지 않게.
 *
 * ⚠️ 이 파일은 "use client" 화면이 import 한다 — 전부 고객에게 보이는 문구다. 감출 값을 적지 않는다.
 */

export type QuestionType = "text" | "textarea" | "tel" | "number" | "radio" | "checkbox" | "scale" | "agree" | "date" | "time";

export type Question = {
  id: string;
  /** 짧은 이름 — 요약 · 오류 문구 · 관리자 화면에 쓴다. */
  label: string;
  /** 화면에 크게 보이는 질문. 없으면 label. */
  ask?: string;
  help?: string;
  /** 입력 예시(흐린 글씨). */
  ph?: string;
  type: QuestionType;
  /** 글 칸의 검증 종류 — name(이름) · url(https 주소). */
  kind?: "name" | "url";
  required?: boolean;
  /** 글: 최소/최대 글자 수. 숫자: 최소/최대 값. */
  min?: number;
  max?: number;
  /** 닉네임 폭 상한(아스키 1 · 그 밖 1.5). */
  width?: number;
  /** 기호만 있어도 되는 칸(화면 · PPT 에 그대로 쓰는 값). */
  free?: boolean;
  options?: readonly string[];
  /** 요약 줄(회색 상자) — 중요한 설명은 3~4줄만 먼저 보여준다. */
  sum?: readonly string[];
  /** 「자세히 보기」 를 눌러야 펼쳐지는 전문. */
  detail?: string;
  /** 전문이 다른 페이지에 있을 때의 링크. */
  link?: { href: string; label: string };
  /** 시스템이 값을 쓰는 질문 — 문구는 고칠 수 있지만 삭제 · 유형 변경은 못 한다. */
  locked?: boolean;
  /** 「기타」 를 고르면 직접 입력(2~50자)을 받는다. 값은 `<id>__other` 열쇠에 담는다. */
  other?: boolean;
  /** 여러 개 고르기에서 **혼자만** 골라지는 선택지(예: 「없음」). */
  none?: string;
  /** 앞 질문의 답에 따라 보이거나 빠진다. 가리키는 질문은 반드시 이 질문보다 앞에 있어야 한다. */
  showIf?: ShowIf;
  /** 시간 질문이 어느 날짜 질문과 짝인가 — 주말이면 정해진 회차만, 평일이면 09:30~21:30. */
  dateOf?: string;
  /** 날짜 질문의 가장 이른 날(YYYY-MM-DD). 화면이 그때그때 넣는다. */
  minDate?: string;
  /** 묶음 이름(관리자 화면에서 답을 묶어 보여줄 때 쓴다). */
  section?: string;
};

export type ShowIf = {
  id: string;
  /** 그 답이 이 값일 때 */
  is?: string;
  /** 그 답이 이 중 하나일 때 */
  in?: readonly string[];
  /** 여러 개 고르기에서 이 값 말고 다른 것을 하나라도 골랐을 때 */
  anyExcept?: string;
  /** 그 답이 채워져 있을 때 */
  filled?: true;
};

/** 「기타」 선택지의 글자 — 이 값을 고르면 직접 입력 칸이 열린다. */
export const OTHER = "기타";
export const otherKey = (id: string) => `${id}__other`;

export type FormDef = {
  key: "leader" | "participant" | "review";
  version: number;
  title: string;
  /** 동의 문항을 모은 마지막 화면의 제목. 없으면 「약관을 확인해주세요」. */
  agreeTitle?: string;
  /** 「모두 동의하기」 를 둘 것인가(기본 둔다). */
  agreeAll?: boolean;
  questions: readonly Question[];
};

/** 닉네임 안내 — 계산은 폭(아스키 1 · 그 밖 1.5, 합 12 이하)이지만 화면에는 이렇게만 적는다. */
export const NICKNAME_MAX_WIDTH = 12;

export const PARTICIPANT_FORM: FormDef = {
  key: "participant",
  version: 1,
  title: "참가자 사전 설문",
  questions: [
    { id: "name", label: "이름", ask: "이름을 알려주세요", type: "text", kind: "name", required: true, min: 2, max: 20, locked: true },
    {
      id: "phone",
      label: "전화번호",
      ask: "전화번호를 알려주세요",
      help: "응답을 고칠 때 본인 확인에만 써요. 다른 참가자에게는 보이지 않아요.",
      type: "tel",
      required: true,
      locked: true,
    },
    {
      id: "nick",
      label: "현장에서 쓸 닉네임",
      ask: "현장에서 쓸 닉네임을 정해주세요",
      help: "명찰에 들어가요. 한글 8자 · 영어 12자까지 (띄어쓰기 포함)",
      type: "text",
      required: true,
      width: NICKNAME_MAX_WIDTH,
      free: true,
      locked: true,
    },
    {
      id: "age",
      label: "나이대",
      ask: "나이대를 골라주세요",
      type: "radio",
      required: true,
      options: ["만 16~18세", "만 19~24세", "25~29세", "30~39세", "40~49세", "만 50세 이상"],
      // DB 의 나이대 칸(20자 · 필수)에 들어가는 값이라 잠근다.
      locked: true,
    },
    {
      id: "exp",
      label: "방탈출 횟수 (방수)",
      ask: "방탈출은 몇 번 해보셨나요?",
      help: "지금까지 해본 횟수(방수)를 숫자로 적어주세요. 처음이면 0, 정확하지 않으면 대략이어도 괜찮아요. 방수에 따라 명찰 색이 달라져요.",
      ph: "예) 35",
      type: "number",
      min: 0,
      max: 9999,
      required: true,
      locked: true,
    },
    {
      id: "terms",
      label: "[필수] 이용약관을 확인했으며 동의합니다.",
      help: "참가는 만 16세 이상부터 가능해요.",
      sum: ["행사 진행과 안전을 위한 스태프의 안내를 따라주세요.", "시설 · 소품을 고의로 훼손하면 배상을 요청드릴 수 있어요."],
      link: { href: "/terms", label: "이용약관 전문 보기" },
      type: "agree",
      required: true,
      locked: true,
    },
    {
      id: "privacy",
      label: "[필수] 개인정보 수집 · 이용에 동의합니다.",
      sum: [
        "수집 항목: 이름, 전화번호, 닉네임, 나이대, 방탈출 횟수",
        "이용 목적: 참가자 확인, 팀 편성, 명찰 제작, 행사 안내",
        "보관 기간: 행사가 끝나고 1년 뒤 이름 · 전화번호를 지워요. 닉네임 · 방탈출 횟수는 남아요.",
        "동의하지 않을 수 있지만, 그러면 참가 신청을 받을 수 없어요.",
      ],
      link: { href: "/privacy", label: "개인정보처리방침 보기" },
      type: "agree",
      required: true,
      locked: true,
    },
    {
      id: "phoneBox",
      label: "[필수] 1부 진행 중 휴대폰 수거 · 보관에 동의합니다.",
      sum: [
        "1부 방탈출 동안 몰입과 문제 보안을 위해 휴대폰을 한곳에 모아 보관해요.",
        "1부가 끝나면 바로 돌려드려요. 급한 연락이 필요하면 스태프에게 말씀해 주세요.",
      ],
      type: "agree",
      required: true,
      locked: true,
    },
    {
      id: "photo",
      label: "[선택] 사진 · 영상을 홍보에 활용하는 데 동의합니다.",
      sum: [
        "플레이 리포트를 위해 행사 중 기본으로 촬영을 진행해요.",
        "동의하면 SNS 등 홍보물에 얼굴이 공개돼요.",
        "동의하지 않으면 알아볼 수 없게 처리한 뒤에만 올라가요.",
      ],
      type: "agree",
      required: false,
      // DB 의 사진 홍보 동의 칸에 들어가는 값이라 잠근다(선택 항목인 것도 바꾸지 못한다).
      locked: true,
    },
  ],
};

export const REVIEW_FORM: FormDef = {
  key: "review",
  version: 1,
  title: "모임 후기 설문",
  questions: [
    {
      id: "age",
      label: "연령대",
      ask: "연령대를 골라주세요",
      type: "radio",
      required: true,
      options: ["만 16~19세", "만 20~29세", "만 30~39세", "만 40~49세", "만 50세 이상"],
    },
    {
      id: "fun",
      label: "제일 재밌었던 문제 혹은 순간",
      ask: "제일 재밌었던 문제나 순간은 무엇이었나요?",
      ph: "예) 미니게임에서 역전했을 때 / 마지막 문제를 맞혔을 때 / 보물찾기",
      type: "textarea",
      required: true,
      min: 2,
      max: 500,
    },
    {
      id: "sat",
      label: "행사에 만족한 정도",
      ask: "행사는 얼마나 만족스러웠나요?",
      help: "별을 눌러 점수를 매겨주세요.",
      type: "scale",
      required: true,
      locked: true,
    },
    {
      id: "rec",
      label: "추천 여부",
      ask: "오늘의 경험을 다른 단체에 추천하실 건가요?",
      type: "radio",
      required: true,
      options: ["추천해요", "추천하지 않아요", "잘 모르겠어요"],
    },
    {
      id: "why",
      label: "그렇게 답한 이유",
      ask: "그렇게 답한 이유를 알려주세요",
      help: "즐거웠던 점이나 아쉬웠던 점을 편하게 적어주세요.",
      ph: "예) 팀 대항이라 몰입이 잘 됐어요 / 설명이 조금 길게 느껴졌어요",
      type: "textarea",
      required: true,
      min: 2,
      max: 500,
    },
    {
      id: "more",
      label: "추가됐으면 하는 콘텐츠나 개선할 점",
      ask: "추가됐으면 하는 콘텐츠나 개선할 점이 있나요?",
      ph: "예) 미니게임이 더 많았으면 좋겠어요 / 대기 공간이 조금 좁았어요",
      type: "textarea",
      max: 500,
    },
  ],
};

/** 별점의 뜻 — 별만 보여주지 않고 글자를 같이 적는다. */
export const SCALE_LABELS = ["", "아쉬웠어요", "그저 그랬어요", "보통이에요", "좋았어요", "최고였어요"] as const;
