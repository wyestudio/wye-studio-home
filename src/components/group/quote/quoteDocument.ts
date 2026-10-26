import {
  OPTION,
  addMinutes,
  durationLabel,
  weekdayOf,
  type Quote,
  type QuoteOptions,
} from "@/lib/groupPricing";

/*
  단체 예상 견적서(PDF)에 들어갈 내용 — 회사 결재용(2026-10-26 대표님).

  ⚠️ 품목 이름은 사이트 표현(레크리에이션 · 캐릭터 꾸미기 · 애프터파티)이 아니라 결재 서류에 맞는
     공식 표현으로 쓴다. 단, 실제 제공 내용과 다른 성격으로 바꿔 부르지 않는다(교육 · 세미나 등) —
     회사가 비용 처리할 때 품목이 실제 용도와 맞아야 한다. 세금계산서 품목도 이 이름에 맞춘다.
  ⚠️ 금액은 신청 시점의 견적(groupPricing.calcQuote)을 그대로 쓴다. 합계는 부가세 포함이다(대표님).
*/

/** 공급자 — 사업자등록증 기준. 사업장 소재지(자택)는 넣지 않는다. */
export const SUPPLIER = {
  regNo: "820-04-03772",
  name: "우주이스케이프",
  owner: "김시온",
  email: "wouldyouescape@gmail.com",
  kakao: "카카오톡 채널 「우주이스케이프」",
} as const;

export const VENUE_ADDRESS = "서울특별시 광진구 아차산로51길 74-1 지하1층";

export type QuoteDocMode = "basic" | "detail";

export type QuoteDocInput = {
  id: string;
  quote: Quote;
  options: QuoteOptions;
  headcount: number;
  date: string;
  time: string;
  organizerName: string;
  groupName: string | null;
  contact: string;
};

export type QuoteDocRow = { name: string; desc: string; qty: string; unit: number; amount: number };

export type QuoteDoc = {
  number: string;
  issuedAt: string;
  recipient: string;
  organizerName: string;
  contact: string;
  eventDate: string;
  eventTime: string;
  headcount: number;
  total: number;
  totalWords: string;
  supply: number;
  vat: number;
  deposit: number;
  balance: number;
  rows: QuoteDocRow[];
};

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const BIG = ["", "만", "억", "조"];

/** 735000 → '칠십삼만오천'. 수표 관례처럼 '일십' 이 아니라 '십' 으로 읽는다. */
export function koreanAmount(n: number): string {
  if (n === 0) return "영";
  let out = "";
  let group = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let s = "";
      String(chunk)
        .padStart(4, "0")
        .split("")
        .forEach((ch, i) => {
          const d = Number(ch);
          if (d === 0) return;
          const pos = 3 - i;
          s += (d === 1 && pos > 0 ? "" : DIGITS[d]) + SMALL[pos];
        });
      out = s + BIG[group] + out;
    }
    n = Math.floor(n / 10000);
    group++;
  }
  return out;
}

const DAY = ["일", "월", "화", "수", "목", "금", "토"];

function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function buildQuoteDoc(input: QuoteDocInput, issuedYmd: string, mode: QuoteDocMode): QuoteDoc | null {
  const { quote, options: o, headcount } = input;
  if (quote.total == null || quote.unit == null) return null;

  const total = quote.total;
  const supply = Math.round(total / 1.1);
  const deposit = quote.deposit ?? 0;
  const playMinutes = quote.minutes + o.afterPartyHours * 60;

  const detail: QuoteDocRow[] = [
    {
      name: `단체 팀빌딩 프로그램 운영 (${durationLabel(quote.minutes)})`,
      desc: "진행 인력 3명, 행사 공간 단독 대관, 다과, 기념품, 단체 사진 촬영 포함",
      qty: `${headcount}명`,
      unit: quote.unit,
      amount: quote.unit * headcount,
    },
  ];
  if (!o.icebreaking) {
    const v = -OPTION.icebreaking.discount;
    detail.push({ name: "오프닝 세션 제외", desc: `${OPTION.icebreaking.minutes}분 단축`, qty: "1", unit: v, amount: v });
  }
  if (o.character) {
    const v = OPTION.character.price;
    detail.push({ name: "프로그램 맞춤 콘텐츠 제작", desc: "참가자 캐릭터 제작", qty: "1", unit: v, amount: v });
  }
  if (o.afterPartyHours > 0) {
    const v = OPTION.afterParty.hourly;
    detail.push({
      name: "행사 공간 연장 이용",
      desc: "프로그램 종료 후 연장",
      qty: `${o.afterPartyHours}시간`,
      unit: v,
      amount: v * o.afterPartyHours,
    });
  }
  if (o.cleanup) {
    const v = OPTION.cleanup.price;
    detail.push({ name: "행사 후 정리 서비스", desc: "", qty: "1", unit: v, amount: v });
  }

  // 품목 합이 견적 합계와 다르면 서류가 틀린 것이다 — 만들지 않는다.
  if (detail.reduce((s, r) => s + r.amount, 0) !== total) return null;

  const hasOptions = detail.length > 1;
  const basic: QuoteDocRow[] = [
    {
      name: "단체 팀빌딩 프로그램 일체",
      desc: hasOptions ? "진행 인력, 공간 대관, 선택 옵션 포함" : "진행 인력, 공간 대관 포함",
      qty: "1",
      unit: total,
      amount: total,
    },
  ];

  return {
    number: `WYE-G-${issuedYmd.replace(/-/g, "")}-${input.id.slice(0, 4).toUpperCase()}`,
    issuedAt: longDate(issuedYmd),
    recipient: input.groupName?.trim() || input.organizerName,
    organizerName: input.organizerName,
    contact: input.contact,
    eventDate: `${longDate(input.date)}(${DAY[weekdayOf(input.date)]})`,
    eventTime: `${input.time}~${addMinutes(input.time, playMinutes)}, 총 ${durationLabel(playMinutes)}`,
    headcount,
    total,
    totalWords: `일금 ${koreanAmount(total)}원정`,
    supply,
    vat: total - supply,
    deposit,
    balance: total - deposit,
    rows: mode === "basic" ? basic : detail,
  };
}
