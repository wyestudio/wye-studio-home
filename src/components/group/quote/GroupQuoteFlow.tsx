"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Chevron } from "@/components/ui/Chevron";
import { GROUP_EVENT, pushGa4Event } from "@/lib/analytics";
import { readAttribution } from "@/lib/attribution";
import { formatPhoneInput } from "@/lib/phone";
import {
  AFTER_PARTY_INCLUDES,
  CONTACT_METHODS,
  GROUP_ACCENT,
  GROUP_HEADCOUNT_MIN,
  GROUP_KINDS,
  GROUP_PAGE_LABEL,
  REPEAT_PLAYER,
  TEAM_STYLES,
  contactMethodLabel,
} from "@/lib/groupBooking";
import {
  AFTER_PARTY_WEEKEND_TIME,
  DEFAULT_OPTIONS,
  OPTION,
  PRICE_BANDS,
  PRICED_HEADCOUNT_MAX,
  QUOTE_HEADCOUNT_MAX,
  QUOTE_LAST_DATE,
  WEEKDAY_TIME_FIRST,
  WEEKDAY_TIME_LAST,
  WEEKEND_TIMES,
  addMinutes,
  bandIndex,
  bandUnit,
  calcQuote,
  canAfterParty,
  dateLabel,
  dayTypeRates,
  isWeekdayTime,
  isWeekend,
  normalizeOptions,
  unitPriceRange,
  won,
  type Quote,
  type QuoteOptions,
} from "@/lib/groupPricing";
import { QuoteCalendar } from "./QuoteCalendar";
import { QuoteContext, type QuoteCtx } from "./quoteContext";
import { CheckRow, ChipGroup, FieldError, FieldLabel, NumberStepper, Switch } from "./controls";

/** 견적 선택값(개인정보 아님)만 새로고침에 살아남게 둔다. 연락처는 저장하지 않는다. */
const STORE_KEY = "wye-group-quote-v2";

const field = "w-full rounded-lg border border-line bg-fill px-3.5 py-3 text-input outline-none focus:border-[#f082f4]";

type RowKey = "headcount" | "date" | "time" | "options";

/*
  신청 전 필수 확인 — 가시안(wouldyouescape-group-v2)의 네 줄 그대로(2026-10-26 대표님).
  넷 다 필수라 모두 굵게 둔다. 접수 API 는 약관(앞 셋)·개인정보(넷째) 두 칸으로 받는다.
*/
const AGREE_ITEMS = [
  { key: "deposit", text: "신청만으로 예약이 확정되지 않으며, 예약금 입금순으로 확정됨을 확인했습니다." },
  {
    key: "availability",
    text: "선택 가능한 날짜·시간이라도 다른 단체의 선입금으로 마감될 수 있으며, 신청으로 일정이 선점되지 않음을 확인했습니다.",
  },
  { key: "terms", text: "위의 단체 이용·결제·취소 및 환불 안내를 확인했습니다." },
  { key: "privacy", text: "신청 상담을 위한 개인정보 수집·이용에 동의합니다." },
] as const;
type AgreeKey = (typeof AGREE_ITEMS)[number]["key"];
type Closure = { date: string; time: string | null };
type Errors = Partial<Record<string, string>>;
type Done = {
  quote: Quote;
  headcount: number;
  date: string;
  time: string;
  contact: string;
};
type Saved = {
  headcount?: number;
  date?: string | null;
  weekendTime?: string | null;
  weekdayTime?: string;
  options?: Partial<QuoteOptions>;
};

/*
  저장해 둔 선택값 읽기.
  서버는 sessionStorage 를 모르므로 첫 화면은 기본값으로 그리고(server snapshot = null),
  하이드레이션 직후 저장값이 있으면 key 를 바꿔 그 값으로 다시 시작한다. 아직 아무것도
  누르기 전이라 다시 그려도 잃는 것이 없다. effect 안에서 setState 로 되살리면 화면을
  두 번 그리게 된다(react-hooks/set-state-in-effect).
  한 번 읽은 값은 붙잡아 둔다 — 고를 때마다 저장값이 바뀌어 다시 읽으면 계속 새로 시작한다.
*/
let savedCache: string | undefined;
const noSubscribe = () => () => {};
function readSaved(): string {
  if (savedCache === undefined) {
    try {
      savedCache = sessionStorage.getItem(STORE_KEY) ?? "";
    } catch {
      savedCache = "";
    }
  }
  return savedCache;
}
function parseSaved(raw: string | null, firstDate: string): Saved {
  if (!raw) return {};
  try {
    const s = JSON.parse(raw) as Saved;
    // 지난 날짜는 되살리지 않는다.
    if (typeof s.date !== "string" || s.date < firstDate || s.date > QUOTE_LAST_DATE) s.date = null;
    return s;
  } catch {
    return {};
  }
}

type Props = {
  closures: Closure[];
  firstDate: string;
  /** 첫 화면(서버에서 그린다). 데스크톱 왼쪽 맨 위, 모바일 맨 위. */
  hero: React.ReactNode;
  /** 안내(서버에서 그린다). 데스크톱 왼쪽 아래, 모바일은 첫 화면 바로 아래. */
  info: React.ReactNode;
};

/**
 * 단체 예약 한 페이지(/group) — 견적 카드 + 연락처.
 *
 * 왜 이 모양인가 (2026-10-25~26, 시안 A·B·C 를 놓고 대표님이 C-1 을 골랐다)
 *   · 에어비앤비 상세처럼 왼쪽은 안내, 오른쪽에 **견적 카드 한 장**이 따라온다.
 *     카드에는 '인원 · 날짜 · 시간 · 옵션' 줄만 있고 누른 줄만 펼쳐진다(한 번에 하나).
 *     처음엔 입력할 게 거의 없어 보이고, 무엇을 골랐는지가 줄마다 그대로 보인다.
 *   · 회차에 따라 애프터파티 가능 여부가 갈린다. 단계형(이전 버튼)으로 하면 회차를 다시
 *     고르러 되돌아가야 해서 귀찮다 — 줄을 다시 열면 된다.
 *   · 인원은 **구간 버튼**이고 버튼마다 1인 요금이 붙는다. 구간 꼭대기면 "1명만 더 모이면
 *     1인 ○원씩 내려가요" — 9명이 비싸서 망설이던 모임이 10명을 맞춰 오게 하려는 것.
 *   · 데스크톱 카드는 **늘 헤더 바로 아래에 붙어 있다**(2026-10-26 대표님). 줄을 열면 그만큼 길어지고,
 *     화면을 넘을 때만 줄 부분이 안쪽으로 스크롤된다 — 금액·버튼은 바닥에 남는다.
 *     한때 긴 카드는 바닥이 보일 때까지 페이지와 같이 올라가게 했는데, 그러면 아래로 내려온 뒤
 *     다른 줄을 누르려고 맨 위까지 다시 올라가야 했다.
 *   · 모바일은 페이지에 안내만 두고, 하단 「견적 내보기」를 누르면 같은 카드가 **아래서 올라오는
 *     시트**로 뜬다(시안 A 의 흐름, 2026-10-26 대표님). 첫 화면과 안내 사이에 입력이 끼면 번잡했다.
 *     시트를 내려 안내를 보다가 「이어서 작성」으로 다시 올리면 고른 값이 그대로다.
 *   · 넓은 견적 카드를 본문 가운데 두는 안(C-2)은 안내 글 사이에 입력이 끼어 오히려 혼란스러웠다.
 *   · 돈이 드는 옵션은 꺼진 채 시작한다(특정 옵션 사전선택 금지, 전자상거래법 2025-02-14).
 *   · '예약금 입금순 확정' 경고는 연락처 단계와 완료 두 곳에만 — 반복하면 안 읽는다.
 *
 * ⚠️ 금액은 서버(API)가 groupPricing.ts 로 다시 계산해 저장한다. 여기 숫자는 안내용이다.
 */
export function GroupQuoteFlow(props: Props) {
  const raw = useSyncExternalStore(noSubscribe, readSaved, () => null);
  return <QuoteFlowInner key={raw ? "restored" : "fresh"} {...props} saved={parseSaved(raw, props.firstDate)} />;
}

function QuoteFlowInner({ closures, firstDate, hero, info, saved }: Props & { saved: Saved }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  // 모바일 견적 시트. 한 번 열었거나 되살린 값이 있으면 아래 막대가 '이어서 작성' 이 된다.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSeen, setSheetSeen] = useState(Object.keys(saved).length > 0);

  // ── 견적 ──
  const [headcount, setHeadcount] = useState(typeof saved.headcount === "number" ? saved.headcount : 15);
  const [date, setDate] = useState<string | null>(saved.date ?? null);
  const [weekendTime, setWeekendTime] = useState<string | null>(saved.weekendTime ?? null);
  const [weekdayTime, setWeekdayTime] = useState(saved.weekdayTime ?? "");
  const [options, setOptions] = useState<QuoteOptions>({
    ...DEFAULT_OPTIONS,
    ...saved.options,
  });
  // ── 연락처 ──
  const [organizerName, setOrganizerName] = useState("");
  const [contactMethod, setContactMethod] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [groupName, setGroupName] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [groupKind, setGroupKind] = useState<string | null>(null);
  const [groupKindNote, setGroupKindNote] = useState("");
  const [teamStyle, setTeamStyle] = useState<string>(TEAM_STYLES[0].code);
  const [repeatPlayer, setRepeatPlayer] = useState("unknown");
  const [occasion, setOccasion] = useState("");
  const [note, setNote] = useState("");
  const [agrees, setAgrees] = useState<Record<AgreeKey, boolean>>({
    deposit: false,
    availability: false,
    terms: false,
    privacy: false,
  });
  const [showRules, setShowRules] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const weekend = date ? isWeekend(date) : false;
  const time = date ? (weekend ? weekendTime : isWeekdayTime(weekdayTime) ? weekdayTime : null) : null;
  const opts = useMemo(() => normalizeOptions(options, date, time), [options, date, time]);
  const validHeadcount =
    Number.isInteger(headcount) && headcount >= GROUP_HEADCOUNT_MIN && headcount <= QUOTE_HEADCOUNT_MAX;
  const quote = useMemo(
    () =>
      calcQuote({
        headcount: validHeadcount ? headcount : GROUP_HEADCOUNT_MIN,
        date,
        time,
        options: opts,
      }),
    [headcount, validHeadcount, date, time, opts]
  );
  // 날짜 전에는 그 인원 구간의 가장 낮은 1인 요금으로 '~부터' 금액을 보여 준다.
  const band = validHeadcount ? bandIndex(headcount) : null;
  const fromUnit = !date && band != null ? bandUnit(band, null).price : null;
  const previewTotal = quote.total ?? (fromUnit != null ? fromUnit * headcount + quote.optionsTotal : null);

  const closedSlot = (d: string, t: string | null) =>
    closures.some((c) => c.date === d && (c.time == null || c.time === t));
  // 주말은 세 회차가 다 막히면 그날이 마감이다. 평일은 시간을 자유롭게 고르므로 종일 마감만 본다.
  const dayClosed = (d: string) =>
    closures.some((c) => c.date === d && c.time == null) ||
    (isWeekend(d) && WEEKEND_TIMES.every((t) => closedSlot(d, t)));

  // ── 새로고침에도 견적 선택값 유지 ──
  // ⚠️ 이 화면이 열린 뒤 **바뀐 것이 있을 때만** 저장한다. 기본값으로 먼저 그려지는 첫
  //    화면이 저장값을 기본값으로 덮어써서 되살릴 값이 사라졌다(로컬 확인에서 실제로 그랬다).
  //    '첫 실행만 건너뛰기' 로는 안 된다 — 개발 모드는 effect 를 두 번 돌린다.
  const snapshot = JSON.stringify({
    headcount,
    date,
    weekendTime,
    weekdayTime,
    options,
  });
  const [initialSnapshot] = useState(snapshot);
  // 한 번 바뀐 뒤로는 처음 값으로 되돌려도 저장한다 — 안 그러면 중간 값이 남는다.
  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current && snapshot === initialSnapshot) return;
    changed.current = true;
    try {
      sessionStorage.setItem(STORE_KEY, snapshot);
    } catch {
      // 무시
    }
  }, [snapshot, initialSnapshot]);
  // 이 화면을 떠났다 돌아오면 저장값을 새로 읽게 한다(제출 뒤 지운 값이 되살아나지 않게).
  useEffect(
    () => () => {
      savedCache = undefined;
    },
    []
  );

  // ── 브라우저 뒤로가기 = 견적으로 돌아가기 / 시트 내리기 ──
  // 안 쌓으면 연락처 화면에서 뒤로가기 한 번에 페이지를 떠나 고른 것이 다 날아간다.
  // 모바일 시트도 한 칸 쌓는다 — 휴대폰 뒤로가기로 시트를 닫으려다 페이지를 떠나지 않게.
  // 새로고침해도 history.state 는 남으므로 처음에 시트 표시를 지운다(닫힌 시트가 열린 것으로 남는다).
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, groupStep: 0, groupSheet: false }, "");
    const onPop = (e: PopStateEvent) => {
      const st = e.state as { groupStep?: number; groupSheet?: boolean } | null;
      const s = st?.groupStep;
      if (s === 0 || s === 1) setStep(s);
      setSheetOpen(!!st?.groupSheet);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 연락처 화면 도달 — 견적만 보고 나가는 사람과 신청까지 가는 사람을 가른다.
  useEffect(() => {
    if (done || step === 0) return;
    pushGa4Event(GROUP_EVENT.sectionView, {
      themeLabel: GROUP_PAGE_LABEL,
      sectionKey: "quote_contact",
      sectionLabel: "연락처",
    });
  }, [step, done]);

  const cardRef = useRef<HTMLElement>(null);
  const cardBoxRef = useRef<HTMLDivElement>(null);
  useCardMaxHeight(cardRef, cardBoxRef, step === 0 && !done);

  function openSheet() {
    markStart();
    setSheetSeen(true);
    window.history.pushState({ ...window.history.state, groupStep: 0, groupSheet: true }, "");
    setSheetOpen(true);
  }
  function closeSheet() {
    if ((window.history.state as { groupSheet?: boolean } | null)?.groupSheet) window.history.back();
    else setSheetOpen(false);
  }
  const sheetActive = sheetOpen && step === 0 && !done;
  useSheetLock(sheetActive, closeSheet);
  const drag = useSheetDrag(cardRef, closeSheet);

  const startSent = useRef(false);
  function markStart() {
    if (startSent.current) return;
    startSent.current = true;
    pushGa4Event(GROUP_EVENT.quoteStart, { themeLabel: GROUP_PAGE_LABEL });
  }

  const clearError = (...keys: string[]) =>
    setErrors((x) => {
      const n = { ...x };
      for (const k of keys) delete n[k];
      return n;
    });

  function toggleRow(k: RowKey) {
    const opening = openRow !== k;
    setOpenRow(opening ? k : null);
    // 카드 안쪽이 스크롤된 상태에서 연 줄이 밀려나 있으면 보이게 당긴다.
    if (opening)
      requestAnimationFrame(() =>
        document.getElementById(`row-${k}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      );
  }

  function reportError(label: string) {
    pushGa4Event(GROUP_EVENT.quoteError, {
      themeLabel: GROUP_PAGE_LABEL,
      sectionKey: "quote",
      sectionLabel: label,
    });
  }

  /** 견적에서 빠진 줄을 열어 보여 준다. 한 번에 하나만 열리므로 가장 앞의 것부터. */
  function validateQuote(): boolean {
    let key: RowKey | null = null;
    const e: Errors = {};
    if (!validHeadcount) {
      e.headcount = `참여 인원을 ${GROUP_HEADCOUNT_MIN}~${QUOTE_HEADCOUNT_MAX}명 사이로 입력해주세요.`;
      key = "headcount";
    } else if (!date) {
      e.date = "희망 날짜를 골라주세요.";
      key = "date";
    } else if (!time) {
      e.time = weekend
        ? "시작 시간을 골라주세요."
        : weekdayTime
          ? `평일은 ${WEEKDAY_TIME_FIRST}~${WEEKDAY_TIME_LAST} 사이로 입력해주세요.`
          : "희망 시작 시간을 입력해주세요.";
      key = "time";
    } else if (closedSlot(date, time)) {
      e.time = "마감된 시간이에요. 다른 시간을 골라주세요.";
      key = "time";
    }
    if (!key) return true;
    setErrors(e);
    setOpenRow(key);
    reportError(key);
    requestAnimationFrame(() =>
      document.getElementById(`row-${key}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
    return false;
  }

  function goContact() {
    if (!validateQuote()) return;
    setErrors({});
    setServerError("");
    // 시트에서 넘어왔으면 뒤로가기(견적 수정)로 시트가 열린 화면에 돌아온다.
    window.history.pushState({ ...window.history.state, groupStep: 1, groupSheet: false }, "");
    setSheetOpen(false);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateContact(): Errors {
    const e: Errors = {};
    if (!organizerName.trim()) e.name = "담당자 이름을 입력해주세요.";
    if (!contactMethod) e.contact = "연락 수단을 골라주세요.";
    else if (!contact.trim()) e.contact = "연락처를 입력해주세요.";
    else if ((contactMethod === "phone" || contactMethod === "sms") && contact.replace(/\D/g, "").length < 9)
      e.contact = "전화번호를 확인해주세요.";
    else if (contactMethod === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim()))
      e.contact = "이메일 주소를 확인해주세요.";
    if (!AGREE_ITEMS.every((a) => agrees[a.key])) e.agree = "필수 확인 항목에 모두 체크해주세요.";
    return e;
  }

  async function submit() {
    const e = validateContact();
    if (Object.keys(e).length) {
      setErrors(e);
      const firstKey = Object.keys(e)[0];
      reportError(firstKey);
      requestAnimationFrame(() =>
        document.getElementById(`f-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
      return;
    }
    if (!date || !time) return window.history.back();

    setSending(true);
    setServerError("");
    try {
      const res = await fetch("/api/group-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headcount,
          preferredDate: date,
          preferredTime: time,
          options: opts,
          organizerName: organizerName.trim(),
          contactMethod,
          contact: contact.trim(),
          groupName: groupName.trim() || null,
          groupKind,
          groupKindNote: groupKindNote.trim() || null,
          teamStyle,
          repeatPlayer,
          occasion: occasion.trim() || null,
          note: note.trim() || null,
          // API 는 두 칸으로 받는다 — 예약·일정·이용 안내 셋이 '약관 확인', 나머지가 개인정보 동의.
          agreeTerms: agrees.deposit && agrees.availability && agrees.terms,
          agreePrivacy: agrees.privacy,
          attribution: readAttribution(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setServerError(json.error || "접수에 실패했어요. 잠시 후 다시 시도해주세요.");
        reportError("서버");
        return;
      }
      pushGa4Event(GROUP_EVENT.quoteSubmit, { themeLabel: GROUP_PAGE_LABEL });
      try {
        sessionStorage.removeItem(STORE_KEY);
      } catch {
        // 무시
      }
      setDone({
        quote,
        headcount,
        date,
        time,
        // '전화(010-…)로' — 번호 뒤에 조사를 바로 붙이면 '으로/로' 가 어색해진다.
        contact: `${contactMethodLabel(contactMethod ?? "")}(${contact.trim()})`,
      });
      window.scrollTo({ top: 0 });
    } catch {
      setServerError("접수에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  const primary = step === 0 ? goContact : () => void submit();
  const primaryLabel = step === 0 ? "신청서 작성하기" : sending ? "접수 중…" : "신청하기";
  const shownQuote: Quote = validHeadcount
    ? quote
    : {
        ...quote,
        lines: [],
        total: null,
        perPerson: null,
        unpricedReason: "인원을 확인해주세요.",
      };
  const totalText = !validHeadcount
    ? "-"
    : quote.total != null
      ? won(quote.total)
      : previewTotal != null
        ? `${won(previewTotal)}~`
        : "상담 후 안내";

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <QuoteDone done={done} />
      </div>
    );
  }

  // ── 연락처 화면 ── 왼쪽(모바일은 전체)이 신청서로 바뀌고, 오른쪽 카드는 읽기 전용 요약이 된다.
  if (step === 1) {
    return (
      <div className="group-quote-flow lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12" onFocusCapture={markStart}>
        <div className="flex min-w-0 flex-col gap-7">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="-my-3 inline-flex h-11 items-center gap-1 self-start text-body-sm text-muted hover:text-foreground"
          >
            <Chevron dir="left" className="h-3.5 w-3.5" />
            견적 수정
          </button>
          {/* 끝이 가깝다는 걸 먼저 보여 준다 — 입력이 세 묶음뿐이라는 것도(2026-10-26 대표님). */}
          <h1 className="-mt-4 text-h1 font-extrabold">
            모임 정보만 입력하면 {/* 휴대폰에서 '완료!' 만 다음 줄로 떨어지지 않게 */}
            <br className="sm:hidden" />
            신청 완료!
          </h1>

          {/* 무엇을 신청하는지 한 줄로(모바일은 오른쪽 요약이 없다). */}
          {date && time && (
            <p className="rounded-lg bg-fill px-4 py-3 text-body-sm lg:hidden">
              {headcount}명 · {dateLabel(date)} {time} · <span className="font-semibold">{totalText}</span>
              {quote.total != null && validHeadcount && (
                <span className="text-muted"> · 예약금(30%) {won(quote.deposit ?? 0)}</span>
              )}
            </p>
          )}

          {/* 입력을 세 공간으로 나눈다 — 처음 봤을 때 '크게 세 개만 하면 되네' 가 보이게(가시안의 좋았던 점). */}
          <FormSection n={1} title="모임 정보">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="f-name" required>
                담당자 이름
              </FieldLabel>
              <input
                id="f-name"
                value={organizerName}
                maxLength={40}
                autoComplete="name"
                placeholder="일정과 견적을 안내받을 분"
                aria-invalid={!!errors.name}
                onChange={(e) => {
                  setOrganizerName(e.target.value);
                  clearError("name");
                }}
                className={field}
              />
              <FieldError id="e-name" message={errors.name} />
            </div>

            <div id="f-contact" className="flex flex-col gap-2">
              <FieldLabel required>연락받을 곳</FieldLabel>
              <ChipGroup
                label="연락 수단"
                options={CONTACT_METHODS}
                value={contactMethod}
                onPick={(c) => {
                  setContactMethod(c);
                  setContact("");
                  clearError("contact");
                }}
              />
              {contactMethod && (
                <input
                  value={contact}
                  maxLength={100}
                  aria-label={`${contactMethodLabel(contactMethod)} 연락처`}
                  aria-invalid={!!errors.contact}
                  {...contactInputProps(contactMethod)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setContact(contactMethod === "phone" || contactMethod === "sms" ? formatPhoneInput(v) : v);
                    clearError("contact");
                  }}
                  className={`${field} mt-1`}
                />
              )}
              <FieldError id="e-contact" message={errors.contact} />
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="f-group" required={false}>
                모임·단체 이름
              </FieldLabel>
              <input
                id="f-group"
                value={groupName}
                maxLength={80}
                autoComplete="organization"
                placeholder="회사, 동아리, 모임 이름"
                onChange={(e) => setGroupName(e.target.value)}
                className={field}
              />
              <p className="text-body-sm text-muted">오프닝 화면과 게임 결과 화면에 이 이름이 나와요.</p>
            </div>
          </FormSection>

          <MoreAboutUs
            open={moreOpen}
            setOpen={setMoreOpen}
            groupKind={groupKind}
            setGroupKind={setGroupKind}
            groupKindNote={groupKindNote}
            setGroupKindNote={setGroupKindNote}
            teamStyle={teamStyle}
            setTeamStyle={setTeamStyle}
            repeatPlayer={repeatPlayer}
            setRepeatPlayer={setRepeatPlayer}
            occasion={occasion}
            setOccasion={setOccasion}
            note={note}
            setNote={setNote}
          />

          <FormSection n={3} title="확인 및 동의" id="f-agree">
            {/* 이 흐름에서 이 경고가 나오는 곳은 여기와 완료 화면 두 곳뿐이다. */}
            <NotYetBooked />

            {/* 동의 항목 셋째 줄이 '위의 안내' 를 가리킨다 — 그래서 동의 목록 바로 위에 둔다. */}
            <div>
              <button
                type="button"
                onClick={() => setShowRules((v) => !v)}
                aria-expanded={showRules}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-line px-4 text-left text-body-sm font-semibold hover:border-line-strong"
              >
                이용 · 결제 · 취소 안내 보기
                <Chevron dir={showRules ? "up" : "down"} className="h-4 w-4 shrink-0 text-muted" />
              </button>
              {showRules && <UsageRules className="mt-2" />}
            </div>

            <AgreeList
              agrees={agrees}
              onChange={(next) => {
                setAgrees(next);
                clearError("agree");
              }}
            />

            <div>
              <button
                type="button"
                onClick={() => setShowPrivacy((v) => !v)}
                aria-expanded={showPrivacy}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-line px-4 text-left text-body-sm font-semibold hover:border-line-strong"
              >
                개인정보 수집·이용 내용 보기
                <Chevron dir={showPrivacy ? "up" : "down"} className="h-4 w-4 shrink-0 text-muted" />
              </button>
              {showPrivacy && <PrivacyNotice className="mt-2" />}
            </div>
            <FieldError id="e-agree" message={errors.agree} />
          </FormSection>

          {serverError && (
            <p role="alert" className="text-body-sm font-semibold text-danger">
              {serverError}
            </p>
          )}

          {/* 데스크톱 신청 버튼은 폼 끝에. 모바일은 아래 고정 막대가 맡는다. */}
          <button
            type="button"
            onClick={primary}
            disabled={sending}
            className="hidden min-h-[52px] rounded-lg bg-[#f082f4] px-6 text-body font-semibold text-[#141414] transition hover:bg-[#f6a8f9] disabled:opacity-60 lg:block"
          >
            {primaryLabel}
          </button>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-xl border border-panel-border bg-panel p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-h3 font-extrabold">신청할 견적</h2>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-my-3 inline-flex h-11 items-center text-body-sm text-muted underline underline-offset-4 hover:text-foreground"
              >
                견적 수정
              </button>
            </div>
            <p className="mt-2 text-body-sm">
              {headcount}명 · {date ? dateLabel(date) : "-"} {time ?? ""}
            </p>
            <QuoteTotals quote={shownQuote} />
          </div>
        </aside>

        <MobileBar caption="예상 금액" total={totalText} label={primaryLabel} onClick={primary} disabled={sending} />
      </div>
    );
  }

  // ── 견적 화면 ──
  // 데스크톱: 왼쪽 첫 화면·안내 / 오른쪽 견적 카드(두 줄을 걸쳐 따라온다)
  // 모바일: 첫 화면 → 안내. 견적 카드는 아래 막대를 누르면 시트로 올라온다.
  //   ⚠️ 카드는 데스크톱·모바일이 **같은 요소**다. 둘로 나누면 id(row-*) 가 겹치고 입력 상태가 갈린다.
  const minUnit = unitPriceRange()?.min ?? null;
  // 안내의 타임테이블이 쓰는 값. 거기서 옵션을 바꾸면 아래 막대도 견적 금액으로 바뀐다.
  const ctx: QuoteCtx = {
    options: opts,
    setOptions: (o) => {
      setOptions(o);
      setSheetSeen(true);
    },
    time,
    minutes: quote.minutes,
    optionsTotal: quote.optionsTotal,
    partyOk: date && time ? canAfterParty(date, time) : true,
    openTimeRow: () => {
      if (!window.matchMedia(LG_QUERY).matches) openSheet();
      setOpenRow("time");
      requestAnimationFrame(() =>
        document.getElementById("row-time")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      );
    },
  };
  return (
    <QuoteContext.Provider value={ctx}>
      <div
        className="group-quote-flow grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-12"
        onFocusCapture={markStart}
        onPointerDownCapture={markStart}
      >
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{hero}</div>

        {/* 시트 뒤 어둡게 — 누르면 시트가 내려간다(고른 값은 그대로). */}
        <div
          aria-hidden
          onClick={closeSheet}
          className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 lg:hidden ${
            sheetActive ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <section
          ref={cardRef}
          id="quote"
          data-screen
          data-section-key="quote"
          data-nav-label="견적"
          aria-label="우리 모임 견적"
          // 모바일: 화면 아래 붙은 시트. 닫혀 있으면 아래로 내려가 있고 invisible 이라 Tab 으로도 안 들어간다.
          // 데스크톱: 오른쪽 칸에서 헤더 아래(top-24)에 붙어 따라온다.
          className={`fixed inset-x-0 bottom-0 z-50 transition-[translate,visibility] duration-300 ${
            sheetActive ? "visible translate-y-0" : "invisible translate-y-full"
          } lg:visible lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:translate-y-0 lg:self-start lg:transition-none`}
        >
          {/* 줄을 열면 카드가 그만큼 길어진다. 화면에 남은 높이를 넘을 때만 줄 부분이 안쪽으로
            스크롤된다 — 제목과 금액·버튼은 늘 보인다. 데스크톱 높이는 useCardMaxHeight 가 정한다. */}
          <div
            ref={cardBoxRef}
            className="flex max-h-[92dvh] flex-col rounded-t-xl border-t border-panel-border bg-panel lg:rounded-xl lg:border"
          >
            <div {...drag} className="touch-none px-4 pt-2 sm:px-5 lg:touch-auto lg:pt-5">
              {/* 잡고 끌어내리는 손잡이(모바일). */}
              <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-fill-strong lg:hidden" />
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-h2 font-extrabold">우리 모임 견적</h2>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="-mr-2 inline-flex h-11 shrink-0 items-center gap-1 px-2 text-body-sm text-muted hover:text-foreground lg:hidden"
                >
                  내리기
                  <Chevron dir="down" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-width:thin] sm:px-5">
              <Row
                id="headcount"
                label="인원"
                open={openRow === "headcount"}
                onToggle={() => toggleRow("headcount")}
                value={
                  <>
                    {Number.isFinite(headcount) ? `${headcount}명` : "-"}
                    <span className="ml-1.5 text-body-sm font-normal text-muted">
                      {headcount > PRICED_HEADCOUNT_MAX
                        ? "별도 상담"
                        : band != null
                          ? `1인 ${won((date ? quote.unit : fromUnit) ?? 0)}${date ? "" : "~"}`
                          : ""}
                    </span>
                  </>
                }
              >
                <HeadcountPicker
                  headcount={headcount}
                  date={date}
                  setHeadcount={(n) => {
                    setHeadcount(n);
                    clearError("headcount");
                  }}
                />
                <FieldError id="e-headcount" message={errors.headcount} />
              </Row>

              <Row
                id="date"
                label="날짜"
                open={openRow === "date"}
                onToggle={() => toggleRow("date")}
                value={date ? dateLabel(date) : <Placeholder>골라주세요</Placeholder>}
              >
                <DayTypeNote headcount={validHeadcount ? headcount : null} date={date} firstDate={firstDate} />
                <QuoteCalendar
                  bare
                  value={date}
                  first={firstDate}
                  last={QUOTE_LAST_DATE}
                  isClosed={dayClosed}
                  onPick={(d) => {
                    setDate(d);
                    clearError("date", "time");
                    // 고르고 나면 바로 시간 줄로 넘어간다.
                    setOpenRow("time");
                  }}
                />
                <FieldError id="e-date" message={errors.date} />
              </Row>

              <Row
                id="time"
                label="시간"
                open={openRow === "time"}
                onToggle={() => toggleRow("time")}
                value={time ?? <Placeholder>{date ? "골라주세요" : "날짜 먼저"}</Placeholder>}
              >
                <TimePicker
                  date={date}
                  weekendTime={weekendTime}
                  weekdayTime={weekdayTime}
                  closedSlot={closedSlot}
                  onWeekend={(t) => {
                    setWeekendTime(t);
                    clearError("time");
                    setOpenRow(null);
                  }}
                  onWeekday={(t) => {
                    setWeekdayTime(t);
                    clearError("time");
                  }}
                  openDate={() => setOpenRow("date")}
                />
                <FieldError id="e-time" message={errors.time} />
              </Row>

              <Row
                id="options"
                label="옵션"
                open={openRow === "options"}
                onToggle={() => toggleRow("options")}
                value={optionsSummary(opts)}
              >
                <OptionsPicker
                  date={date}
                  time={time}
                  options={opts}
                  setOptions={setOptions}
                  minutes={quote.minutes}
                  openTime={() => setOpenRow("time")}
                />
              </Row>

              {/* 항목별 금액 */}
              {shownQuote.lines.length > 0 && (
                <div className="mt-2 border-t border-line-subtle pt-4">
                  <QuoteLines quote={shownQuote} />
                </div>
              )}
            </div>

            {/* 카드 바닥 — 금액과 버튼. 모바일 시트에서도 늘 바닥에 보인다. */}
            <div className="border-t border-line-subtle px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 lg:pb-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body-sm text-muted">예상 금액</p>
                <p className="text-h2 font-extrabold tabular-nums" style={{ color: GROUP_ACCENT }}>
                  {totalText}
                </p>
              </div>
              {/* 견적 단계에서는 금액 하나만 — 1인 · 예약금은 신청서 화면 요약에서 보여 준다(2026-10-26 대표님). */}
              <button
                type="button"
                onClick={primary}
                className="mt-4 block min-h-[52px] w-full rounded-lg bg-[#f082f4] px-6 text-body font-semibold text-[#141414] transition hover:bg-[#f6a8f9]"
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </section>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">{info}</div>

        {/* 시트가 닫혀 있을 때의 입구. 처음엔 '1인 ○원부터', 한 번 골라 봤으면 지금 견적 금액. */}
        {sheetSeen ? (
          <MobileBar caption="예상 금액" total={totalText} label="이어서 작성" onClick={openSheet} />
        ) : (
          <MobileBar
            caption="1인"
            total={minUnit != null ? `${won(minUnit)}부터` : "견적 안내"}
            label="견적 내보기"
            onClick={openSheet}
          />
        )}
      </div>
    </QuoteContext.Provider>
  );
}

/** 데스크톱 폭. 이보다 좁으면 견적 카드가 아래서 올라오는 시트다. */
const LG_QUERY = "(min-width: 1024px)";
/** 카드 바닥과 화면 바닥 사이 여백(px). */
const CARD_BOTTOM_GAP = 16;

/**
 * 데스크톱 견적 카드의 최대 높이 = 화면 바닥까지 남은 높이.
 *
 * 카드는 헤더 아래(top-24)에 붙지만, 페이지 맨 위에서는 첫 화면 옆 제자리(그보다 아래)에 있다.
 * 높이를 '붙었을 때' 기준으로만 잡으면 맨 위에서 줄을 열었을 때 금액·버튼이 화면 밖으로
 * 밀려났다(로컬 1280×800 에서 확인). 그래서 지금 카드 위치에서 바닥까지를 매번 잰다.
 * 모바일은 시트라 max-h-[92dvh] 클래스가 맡는다 — 여기서는 지운다.
 */
function useCardMaxHeight(
  sectionRef: React.RefObject<HTMLElement | null>,
  boxRef: React.RefObject<HTMLDivElement | null>,
  active: boolean
) {
  useEffect(() => {
    const section = sectionRef.current;
    const box = boxRef.current;
    if (!section || !box || !active) return;
    const mql = window.matchMedia(LG_QUERY);
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!mql.matches) {
        box.style.maxHeight = "";
        return;
      }
      const top = Math.max(0, section.getBoundingClientRect().top);
      box.style.maxHeight = `${window.innerHeight - top - CARD_BOTTOM_GAP}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mql.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mql.removeEventListener("change", schedule);
      box.style.maxHeight = "";
    };
  }, [sectionRef, boxRef, active]);
}

/**
 * 모바일 시트가 떠 있는 동안 뒤 페이지 스크롤을 막고, Esc 로 내린다.
 * 데스크톱 폭에서는 시트가 아니므로 막지 않는다(창을 넓히면 그때 푼다).
 */
function useSheetLock(active: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const mql = window.matchMedia(LG_QUERY);
    const apply = () => {
      root.style.overflow = mql.matches ? "" : "hidden";
    };
    apply();
    mql.addEventListener("change", apply);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = "";
      mql.removeEventListener("change", apply);
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);
}

/** 이만큼(px) 끌어내리면 시트를 내린다. 덜 끌면 제자리로 돌아간다. */
const SHEET_DRAG_CLOSE = 80;

/**
 * 시트 머리(손잡이·제목)를 잡고 끌어내리기(모바일).
 * 끄는 동안은 transform 으로 따라 움직이고, 놓으면 지운다 — 열림·닫힘 위치는 translate 클래스가 정한다.
 */
function useSheetDrag(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  const startY = useRef<number | null>(null);
  const dy = useRef(0);
  const reset = () => {
    const el = ref.current;
    if (el) {
      el.style.transform = "";
      el.style.transition = "";
    }
    startY.current = null;
  };
  return {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      if (window.matchMedia(LG_QUERY).matches || (e.target as HTMLElement).closest("button")) return;
      startY.current = e.clientY;
      dy.current = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      if (ref.current) ref.current.style.transition = "none";
    },
    onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
      if (startY.current == null || !ref.current) return;
      dy.current = Math.max(0, e.clientY - startY.current);
      ref.current.style.transform = `translateY(${dy.current}px)`;
    },
    onPointerUp() {
      if (startY.current == null) return;
      const far = dy.current > SHEET_DRAG_CLOSE;
      reset();
      if (far) close();
    },
    onPointerCancel: reset,
  };
}

function contactInputProps(method: string): React.InputHTMLAttributes<HTMLInputElement> {
  if (method === "email")
    return {
      type: "email",
      inputMode: "email",
      autoComplete: "email",
      placeholder: "name@example.com",
    };
  if (method === "kakao") return { type: "text", autoComplete: "off", placeholder: "카카오톡 ID" };
  return {
    type: "tel",
    inputMode: "numeric",
    autoComplete: "tel",
    placeholder: "010-0000-0000",
  };
}

function optionsSummary(o: QuoteOptions): string {
  const picks = [
    o.icebreaking ? null : "레크리에이션 뺌",
    o.character ? "캐릭터 꾸미기" : null,
    o.afterPartyHours ? `애프터파티 ${o.afterPartyHours}시간` : null,
    o.cleanup ? "뒷정리" : null,
  ].filter(Boolean);
  return picks.length ? picks.join(" · ") : "기본 구성";
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted">{children}</span>;
}

/* ───────────────────────── 카드의 한 줄 ───────────────────────── */

/** 접힌 상태에서는 '무엇을 골랐는지' 만, 누르면 그 줄만 펼쳐진다. */
function Row({
  id,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  id: RowKey;
  label: string;
  value: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`row-${id}`}
      className={`scroll-mt-4 rounded-lg border transition-colors ${open ? "border-[#f082f4]" : "border-line"} bg-fill`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`row-${id}-body`}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left"
      >
        <span className="w-10 shrink-0 text-body-sm text-muted">{label}</span>
        <span className="min-w-0 flex-1 truncate text-body font-semibold">{value}</span>
        <Chevron dir={open ? "up" : "down"} className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div id={`row-${id}-body`} className="flex flex-col gap-3 px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** 고른 상태가 분명히 보이는 선택 칸. 인원 구간 · 회차가 같이 쓴다. */
function PickButton({
  on,
  disabled = false,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[48px] w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-[#f082f4] bg-[#f082f4]/15" : "border-line bg-panel hover:border-line-strong"
      }`}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── 인원 ───────────────────────── */

function HeadcountPicker({
  headcount,
  date,
  setHeadcount,
}: {
  headcount: number;
  date: string | null;
  setHeadcount: (n: number) => void;
}) {
  const band = Number.isInteger(headcount) ? bandIndex(headcount) : null;
  const large = headcount > PRICED_HEADCOUNT_MAX;

  // 구간 꼭대기(9 · 14 · 19명)에 있으면 1명만 더 오면 1인 요금이 내려간다는 걸 알려 준다.
  const nudge = (() => {
    if (band == null || band >= PRICE_BANDS.length - 1 || headcount !== PRICE_BANDS[band].max) return null;
    const now = bandUnit(band, date).price;
    const nextUp = bandUnit(band + 1, date).price;
    if (now == null || nextUp == null || nextUp >= now) return null;
    return { diff: now - nextUp, nextUp };
  })();

  return (
    <>
      <div role="radiogroup" aria-label="인원 구간" className="flex flex-col gap-1.5">
        {PRICE_BANDS.map((b, i) => {
          const { price, from } = bandUnit(i, date);
          return (
            <PickButton key={b.label} on={band === i} onClick={() => band !== i && setHeadcount(b.min)}>
              <span className="flex-1 text-body font-semibold">{b.label}</span>
              <span className="text-body-sm font-semibold tabular-nums" style={{ color: GROUP_ACCENT }}>
                {price != null ? `1인 ${won(price)}${from ? "~" : ""}` : "상담"}
              </span>
            </PickButton>
          );
        })}
        <PickButton on={large} onClick={() => !large && setHeadcount(PRICED_HEADCOUNT_MAX + 1)}>
          <span className="flex-1 text-body font-semibold">25명 이상</span>
          <span className="text-body-sm text-muted">별도 상담</span>
        </PickButton>
      </div>

      {/* 총액은 정확한 인원으로 계산한다 — 구간 안에서 몇 명인지 한 번 더 맞춘다. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-label font-semibold">정확한 인원</span>
        <NumberStepper
          typeable
          label="참여 인원"
          unit="명"
          min={GROUP_HEADCOUNT_MIN}
          max={QUOTE_HEADCOUNT_MAX}
          value={headcount}
          onChange={setHeadcount}
        />
      </div>

      {nudge && (
        <div className="rounded-lg border border-[#f082f4]/50 bg-[#f082f4]/10 px-3.5 py-2.5">
          <p className="text-body-sm">
            1명만 더 모이면 <span className="font-semibold">1인 {won(nudge.diff)}씩</span> 내려가요
          </p>
          <button
            type="button"
            onClick={() => setHeadcount(headcount + 1)}
            className="-my-1 inline-flex h-11 items-center text-body-sm font-semibold text-[#f082f4] underline underline-offset-4"
          >
            {headcount + 1}명으로 보기 (1인 {won(nudge.nextUp)})
          </button>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── 날짜 · 시간 ───────────────────────── */

/** 평일과 주말 1인 요금 차이. 날짜를 고르기 전이면 고를 수 있는 첫날의 시기를 본다. */
function DayTypeNote({
  headcount,
  date,
  firstDate,
}: {
  headcount: number | null;
  date: string | null;
  firstDate: string;
}) {
  const rates = headcount != null ? dayTypeRates(date ?? firstDate, headcount) : null;
  if (!rates || rates.weekday === rates.weekend) return null;
  return (
    // 한 줄로 이으면 금액이 줄 끝에서 꺾인다 — 평일 · 주말을 두 줄로 나눠 금액을 오른쪽에 맞춘다.
    <dl className="flex flex-col gap-1 rounded-lg bg-panel px-3.5 py-2.5 text-body-sm">
      {[
        { label: "평일", days: "월~목", price: rates.weekday },
        { label: "주말", days: "금~일", price: rates.weekend },
      ].map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">
            {r.label} <span className="ml-0.5">({r.days})</span>
          </dt>
          <dd className="font-semibold tabular-nums">1인 {won(r.price)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TimePicker({
  date,
  weekendTime,
  weekdayTime,
  closedSlot,
  onWeekend,
  onWeekday,
  openDate,
}: {
  date: string | null;
  weekendTime: string | null;
  weekdayTime: string;
  closedSlot: (d: string, t: string | null) => boolean;
  onWeekend: (t: string) => void;
  onWeekday: (t: string) => void;
  openDate: () => void;
}) {
  if (!date) {
    return (
      <button
        type="button"
        onClick={openDate}
        className="-my-2 inline-flex h-11 items-center self-start text-body-sm text-muted underline underline-offset-4 hover:text-foreground"
      >
        날짜를 먼저 골라주세요
      </button>
    );
  }
  if (!isWeekend(date)) {
    return (
      <>
        <WeekdayTimePicker value={weekdayTime} onChange={onWeekday} />
      </>
    );
  }
  return (
    <div role="radiogroup" aria-label="시작 시간" className="flex flex-col gap-1.5">
      {WEEKEND_TIMES.map((t) => {
        const closed = closedSlot(date, t);
        const party = t === AFTER_PARTY_WEEKEND_TIME;
        return (
          <PickButton key={t} on={weekendTime === t} disabled={closed} onClick={() => onWeekend(t)}>
            <span className={`text-body font-semibold ${closed ? "line-through" : ""}`}>{t} 시작</span>
            {/* 애프터파티 되는 회차는 표시 하나로 충분하다 — 나머지에 '불가' 를 적으면 줄만 늘어난다. */}
            <span className="flex-1 text-body-sm text-muted">{closed ? "마감" : ""}</span>
            {party && !closed && (
              <span
                className="rounded-md px-1.5 py-0.5 text-micro font-semibold"
                style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
              >
                애프터파티 가능
              </span>
            )}
          </PickButton>
        );
      })}
    </div>
  );
}

/*
  평일 시작 시간 — 오전/오후 → 시 → 분(2026-10-26 대표님).
  · 오전/오후를 고르면 그 안에서 고를 수 있는 '시' 만 보인다(오전 9~11시, 오후 12~9시).
    25칸짜리 드롭다운은 화면을 꽉 채웠다.
  · 분은 자유 입력이다. 30분 단위로 묶지 않는다. 범위(09:30~21:30)는 isWeekdayTime 이 본다.
*/
const AM_HOURS = [9, 10, 11];
const PM_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const hourLabel = (h: number) => String(h > 12 ? h - 12 : h);
const pad2 = (n: number) => String(n).padStart(2, "0");

function WeekdayTimePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const init = /^\d{2}:\d{2}$/.test(value) ? { h: Number(value.slice(0, 2)), m: value.slice(3) } : null;
  const [half, setHalf] = useState<"am" | "pm">(init && init.h < 12 ? "am" : "pm");
  const [hour, setHour] = useState<number | null>(init?.h ?? null);
  const [minute, setMinute] = useState(init?.m ?? "");
  const hours = half === "am" ? AM_HOURS : PM_HOURS;

  const emit = (h: number | null, m: string) => {
    if (h == null) return onChange("");
    onChange(`${pad2(h)}:${m === "" ? "00" : pad2(Number(m))}`);
  };
  const pickHour = (h: number) => {
    // 오전 9시는 30분부터 — 분을 아직 안 넣었으면 30분으로 채워 준다.
    const m = minute === "" && h === 9 ? "30" : minute;
    setHour(h);
    setMinute(m);
    emit(h, m);
  };
  const out = value !== "" && !isWeekdayTime(value);

  return (
    <>
      <p className="text-body-sm text-muted">
        평일은 {WEEKDAY_TIME_FIRST}~{WEEKDAY_TIME_LAST} 사이에 시작해요
      </p>
      <div role="tablist" aria-label="오전 오후" className="grid grid-cols-2 gap-1 rounded-lg bg-panel p-1">
        {(["am", "pm"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={half === k}
            onClick={() => setHalf(k)}
            className={`min-h-[40px] rounded-md text-body-sm font-semibold transition ${
              half === k ? "bg-fill-strong text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {k === "am" ? "오전" : "오후"}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="시" className="grid grid-cols-5 gap-1.5">
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={hour === h}
            onClick={() => pickHour(h)}
            className={`min-h-[44px] rounded-lg border text-body-sm font-semibold tabular-nums transition ${
              hour === h ? "border-[#f082f4] bg-[#f082f4]/15" : "border-line bg-panel hover:border-line-strong"
            }`}
          >
            {hourLabel(h)}시
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          id="f-time-input"
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={minute}
          disabled={hour == null}
          aria-label="분"
          aria-invalid={out}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 2);
            const m = d === "" ? "" : String(Math.min(59, Number(d)));
            setMinute(d.length === 2 ? pad2(Number(m)) : m);
            emit(hour, m);
          }}
          // field 는 w-full 이라 그대로 쓰면 w-20 과 부딪쳐 칸이 늘어난다.
          className={`${field.replace("w-full ", "")} w-20 text-center tabular-nums disabled:opacity-40`}
        />
        <span className="text-body-sm text-muted">분</span>
        {hour != null && (
          <span className="ml-auto text-body font-semibold whitespace-nowrap tabular-nums">
            {/* 탭만 바꾸고 시를 안 골랐을 수 있다 — 표시는 고른 시 기준. */}
            {hour < 12 ? "오전" : "오후"} {hourLabel(hour)}:{minute === "" ? "00" : pad2(Number(minute))}
          </span>
        )}
      </div>
      {out && (
        <p className="text-body-sm font-semibold text-danger">
          {WEEKDAY_TIME_FIRST}~{WEEKDAY_TIME_LAST} 사이로 입력해주세요.
        </p>
      )}
    </>
  );
}

/* ───────────────────────── 옵션 ───────────────────────── */

function OptionItem({
  title,
  desc,
  price,
  control,
  muted = false,
  children,
}: {
  title: string;
  desc: string;
  price: string;
  control: React.ReactNode;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div className={`min-w-0 flex-1 ${muted ? "opacity-60" : ""}`}>
          <p className="text-body font-semibold">{title}</p>
          <p className="text-body-sm text-muted">{desc}</p>
          {/* 고르면 얼마가 붙는지가 가장 먼저 보여야 한다. */}
          <p className="mt-0.5 text-body-sm font-semibold" style={{ color: GROUP_ACCENT }}>
            {price}
          </p>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

function OptionsPicker({
  date,
  time,
  options,
  setOptions,
  minutes,
  openTime,
}: {
  date: string | null;
  time: string | null;
  options: QuoteOptions;
  setOptions: (o: QuoteOptions) => void;
  minutes: number;
  openTime: () => void;
}) {
  const set = (patch: Partial<QuoteOptions>) => setOptions({ ...options, ...patch });
  const partyOk = date && time ? canAfterParty(date, time) : true;
  const end = time ? addMinutes(time, minutes) : null;
  const partyEnd = time && options.afterPartyHours ? addMinutes(time, minutes + options.afterPartyHours * 60) : null;

  return (
    <>
      <OptionItem
        title="레크리에이션 30분"
        desc="진행자와 함께하는 팀 빌딩"
        price={options.icebreaking ? "기본 포함" : `-${won(OPTION.icebreaking.discount)} · 30분 단축`}
        control={
          <Switch label="레크리에이션 포함" checked={options.icebreaking} onChange={(v) => set({ icebreaking: v })} />
        }
      />

      <OptionItem
        title="캐릭터 꾸미기"
        desc="우리만의 캐릭터로 플레이"
        price={`+${won(OPTION.character.price)}`}
        control={
          <Switch label="캐릭터 꾸미기 추가" checked={options.character} onChange={(v) => set({ character: v })} />
        }
      />

      <OptionItem
        title="애프터파티"
        desc="2차 장소 찾을 필요 없이 여기서 바로 뒤풀이"
        price={`1시간당 +${won(OPTION.afterParty.hourly)} · 최대 ${OPTION.afterParty.maxHours}시간`}
        muted={!partyOk}
        // 다른 옵션처럼 켜고 끄는 토글. 켜면 1시간부터 시작하고, 끄면 뒷정리도 같이 꺼진다.
        control={
          <Switch
            label="애프터파티 추가"
            checked={options.afterPartyHours > 0}
            disabled={!partyOk}
            onChange={(v) => set({ afterPartyHours: v ? 1 : 0, cleanup: v && options.cleanup })}
          />
        }
      >
        {/* 켰을 때만 펼친다 — 늘 펼쳐 두면 옵션 줄이 냅다 길어진다(2026-10-26 대표님).
            애프터파티가 뭔지는 고르는 자리에서 말한다. 다른 데 두면 '애프터파티가 뭔데?' 가 된다. */}
        {options.afterPartyHours > 0 && (
          <>
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="애프터파티에서 할 수 있는 것">
              {AFTER_PARTY_INCLUDES.map((x) => (
                <li key={x} className="rounded-md bg-fill px-2 py-0.5 text-micro text-muted">
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-micro leading-relaxed text-muted">
              ※ BYOB는 성인 참여자가 주류를 직접 가져오는 방식이며, 참여자 전원 만 19세 이상이어야 합니다.
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line-subtle pt-2">
              <span className="text-body-sm text-muted">시간</span>
              <NumberStepper
                label="애프터파티 시간"
                unit="시간"
                min={1}
                max={OPTION.afterParty.maxHours}
                value={options.afterPartyHours}
                onChange={(n) => set({ afterPartyHours: n })}
              />
            </div>
          </>
        )}
        {!partyOk && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line-subtle pt-2">
            <span className="text-body-sm text-muted">주말은 {AFTER_PARTY_WEEKEND_TIME} 회차만 가능해요</span>
            <button
              type="button"
              onClick={openTime}
              className="inline-flex h-11 shrink-0 items-center text-body-sm font-semibold text-[#f082f4] underline underline-offset-4"
            >
              회차 바꾸기
            </button>
          </div>
        )}
      </OptionItem>

      {/* 애프터파티를 고른 사람에게만 필요한 옵션 — 그때 나타난다. */}
      {options.afterPartyHours > 0 && (
        <OptionItem
          title="뒷정리 서비스"
          desc="애프터파티 뒤 정리는 저희가 할게요"
          price={`+${won(OPTION.cleanup.price)}`}
          control={
            <Switch label="뒷정리 서비스 추가" checked={options.cleanup} onChange={(v) => set({ cleanup: v })} />
          }
        />
      )}

      {time && end && (
        <p className="text-body-sm text-muted">
          이용 시간{" "}
          <span className="font-semibold text-foreground">
            {time} ~ {partyEnd ?? end}
          </span>
          {partyEnd && ` (프로그램 ${end}까지)`}
        </p>
      )}
      {/* 오픈룸 얼리버드가를 정가로 알고 단체에도 요구하는 문의가 있었다(2026-10-19). */}
      <p className="text-body-sm text-muted">오픈룸 얼리버드 할인은 단체 대관에 적용되지 않아요.</p>
    </>
  );
}

/* ───────────────────────── 금액 ───────────────────────── */

function QuoteLines({ quote }: { quote: Quote }) {
  return (
    <dl className="flex flex-col gap-2">
      {quote.lines.map((l) => (
        <div key={l.label} className="flex items-baseline justify-between gap-3 text-body-sm">
          <dt className="min-w-0 text-muted">
            {l.label}
            {l.detail && <span className="ml-1.5">{l.detail}</span>}
          </dt>
          <dd className="shrink-0 tabular-nums">
            {l.amount < 0 ? `-${won(-l.amount)}` : l.label === "기본 프로그램" ? won(l.amount) : `+${won(l.amount)}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 연락처 화면 오른쪽 요약 — 항목 + 총액. */
function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <>
      {quote.lines.length > 0 && (
        <div className="mt-4 border-t border-line-subtle pt-4">
          <QuoteLines quote={quote} />
        </div>
      )}
      <div className="mt-4 border-t border-line-subtle pt-4">
        <p className="text-body-sm text-muted">예상 금액</p>
        {quote.total != null ? (
          <>
            <p className="text-h1 font-extrabold tabular-nums" style={{ color: GROUP_ACCENT }}>
              {won(quote.total)}
            </p>
            <p className="mt-1 text-body-sm text-muted">예약금(30%) {won(quote.deposit ?? 0)}</p>
          </>
        ) : (
          <p className="mt-1 text-body font-semibold">{quote.unpricedReason}</p>
        )}
      </div>
    </>
  );
}

/** 모바일 하단 고정 막대 — 금액 + 다음. 화면에 붙는 것은 이것 하나다. */
function MobileBar({
  caption,
  total,
  label,
  onClick,
  disabled = false,
}: {
  caption: string;
  total: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="mobile-cta-bar fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-micro text-muted">{caption}</p>
            <p className="truncate text-h3 font-extrabold tabular-nums">{total}</p>
          </div>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="min-h-[48px] shrink-0 rounded-lg bg-[#f082f4] px-5 text-body font-semibold text-[#141414] transition disabled:opacity-60"
          >
            {label}
          </button>
        </div>
      </div>
      {/* 고정 막대에 마지막 줄이 가리지 않게 */}
      <div className="h-24 lg:hidden" aria-hidden />
    </>
  );
}

function NotYetBooked() {
  return (
    <div className="flex gap-3 rounded-lg bg-fill p-4">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-micro font-extrabold"
      >
        !
      </span>
      <div>
        <p className="text-body font-semibold">신청만으로는 예약이 아니에요</p>
        <p className="mt-1 text-body-sm leading-relaxed text-muted">
          예약은 신청순이 아니라 <span className="font-semibold text-foreground">예약금 입금순</span>
          으로 확정돼요. 입금 전에 다른 단체가 먼저 입금하면 이 일정이 마감될 수 있어요.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── 연락처 화면 접힘 영역 ───────────────────────── */

function MoreAboutUs(p: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupKind: string | null;
  setGroupKind: (v: string) => void;
  groupKindNote: string;
  setGroupKindNote: (v: string) => void;
  teamStyle: string;
  setTeamStyle: (v: string) => void;
  repeatPlayer: string;
  setRepeatPlayer: (v: string) => void;
  occasion: string;
  setOccasion: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
}) {
  return (
    // 신청서의 두 번째 공간. 전부 선택이라 접어 두고, 머리를 누르면 펼친다.
    <section className="rounded-xl border border-panel-border bg-panel">
      <button
        type="button"
        onClick={() => p.setOpen(!p.open)}
        aria-expanded={p.open}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
      >
        <span className="min-w-0">
          <SectionTitle n={2} title="모임 추가 정보" tag="선택" />
          <span className="mt-1.5 block pl-[2.375rem] text-body-sm text-muted">
            모임 성격 · 팀 구성 · 재참여 · 기념일 · 요청사항
          </span>
        </span>
        <Chevron dir={p.open ? "up" : "down"} className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {p.open && (
        <div className="flex flex-col gap-7 border-t border-panel-border p-4 sm:p-5">
          <div className="flex flex-col gap-2">
            <FieldLabel required={false}>어떤 모임인가요?</FieldLabel>
            <ChipGroup label="모임 성격" options={GROUP_KINDS} value={p.groupKind} onPick={p.setGroupKind} />
            {p.groupKind === "etc" && (
              <input
                value={p.groupKindNote}
                maxLength={80}
                aria-label="기타 모임 성격"
                placeholder="모임 성격을 간단히 알려주세요"
                onChange={(e) => p.setGroupKindNote(e.target.value)}
                className={`${field} mt-1`}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel required={false}>팀은 어떻게 나눌까요?</FieldLabel>
            <div role="radiogroup" aria-label="팀 구성" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEAM_STYLES.map((t) => {
                const on = p.teamStyle === t.code;
                return (
                  <button
                    key={t.code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => p.setTeamStyle(t.code)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      on ? "border-[#f082f4] bg-[#f082f4]/10" : "border-line bg-fill hover:border-line-strong"
                    }`}
                  >
                    <span className="block text-body-sm font-semibold">{t.label}</span>
                    <span className="block text-micro text-muted">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel required={false}>바-ㅇ탈출에 참여했던 분이 있나요?</FieldLabel>
            <ChipGroup label="재참여 여부" options={REPEAT_PLAYER} value={p.repeatPlayer} onPick={p.setRepeatPlayer} />
            {p.repeatPlayer === "some" && (
              <p className="text-body-sm text-muted">
                재참여자는 참여 방식과 금액을 따로 안내해 드려요. 몇 분인지 아래 요청사항에 적어주세요.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="f-occasion" required={false}>
              생일·기념일이 있나요?
            </FieldLabel>
            <input
              id="f-occasion"
              value={p.occasion}
              maxLength={200}
              placeholder="예: 동아리 창립 5주년, 팀원 생일"
              onChange={(e) => p.setOccasion(e.target.value)}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="f-note" required={false}>
              요청사항
            </FieldLabel>
            <textarea
              id="f-note"
              rows={4}
              value={p.note}
              maxLength={1500}
              placeholder="모임 분위기, 다른 후보 날짜 등 자유롭게 적어주세요."
              onChange={(e) => p.setNote(e.target.value)}
              className={`${field} resize-y`}
            />
            <p className="flex justify-between gap-3 text-micro text-muted">
              <span>다른 참여자의 민감한 개인정보는 적지 말아주세요.</span>
              <span className="tabular-nums">{p.note.length} / 1,500</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/** 신청서의 한 공간 — 번호 · 제목 · 내용. 세 공간이 눈에 띄게 나뉘어 보이게 한다. */
function FormSection({
  n,
  title,
  id,
  children,
}: {
  n: number;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-panel-border bg-panel p-4 sm:p-5">
      <SectionTitle n={n} title={title} />
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

function SectionTitle({ n, title, tag }: { n: number; title: string; tag?: string }) {
  return (
    <span className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-extrabold"
        style={{ border: `1.5px solid ${GROUP_ACCENT}`, color: GROUP_ACCENT }}
      >
        {n}
      </span>
      {/* 제목이 길면 꺾이므로 표시(tag)는 제목 글줄에 붙여 같이 흐르게 — 따로 두면 좁은 칸에 갇혀 두 줄이 된다. */}
      <span className="pt-0.5 text-h3 font-extrabold">
        {title}
        {tag && <span className="ml-2 text-micro font-normal whitespace-nowrap text-muted">{tag}</span>}
      </span>
    </span>
  );
}

/** 전체 동의 + 필수 네 줄. 전체 동의는 하나라도 빠지면 '일부 체크' 표시가 된다. */
function AgreeList({
  agrees,
  onChange,
}: {
  agrees: Record<AgreeKey, boolean>;
  onChange: (next: Record<AgreeKey, boolean>) => void;
}) {
  const count = AGREE_ITEMS.filter((a) => agrees[a.key]).length;
  const all = count === AGREE_ITEMS.length;
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  const setAll = (v: boolean) =>
    onChange(Object.fromEntries(AGREE_ITEMS.map((a) => [a.key, v])) as Record<AgreeKey, boolean>);

  return (
    <div className="flex flex-col">
      <label htmlFor="agree-all" className="flex min-h-[48px] cursor-pointer items-center gap-3">
        <input
          ref={allRef}
          id="agree-all"
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[#f082f4]"
        />
        <span className="text-body font-semibold">필수 확인사항에 모두 동의합니다.</span>
      </label>
      <div className="my-2 border-t border-line-subtle" />
      {AGREE_ITEMS.map((a) => (
        <CheckRow
          key={a.key}
          id={`agree-${a.key}`}
          checked={agrees[a.key]}
          onChange={(v) => onChange({ ...agrees, [a.key]: v })}
        >
          <span className="font-semibold">[필수] {a.text}</span>
        </CheckRow>
      ))}
    </div>
  );
}

/** 동의 셋째 줄이 가리키는 '단체 이용·결제·취소 및 환불 안내'. 안내 페이지의 접힘 안내와 같은 내용이다. */
function UsageRules({ className = "" }: { className?: string }) {
  const block = "flex flex-col gap-1";
  return (
    <div className={`flex flex-col gap-4 rounded-lg bg-fill px-4 py-4 text-body-sm leading-relaxed text-muted ${className}`}>
      <div className={block}>
        <p className="font-semibold text-foreground">이용 안내</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>1부 동안 사진 촬영을 포함한 전자기기 사용이 제한돼요. 휴대폰 사전 제출에 동의한 분만 참여할 수 있어요.</li>
          <li>음료와 다과가 나오고, 식사는 제공되지 않아요.</li>
          <li>참가 연령은 만 16세 이상이에요(애프터파티에서 BYOB 이용 시 전원 만 19세 이상).</li>
        </ul>
      </div>
      <div className={block}>
        <p className="font-semibold text-foreground">예약 · 결제</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>예약금은 최종 안내 금액의 30%이고, 예약금 입금순으로 확정돼요. 결제는 계좌이체예요.</li>
          <li>행사 7일 전 인원을 확정하고 잔금을 결제해요. 행사 7일 이내 신청은 준비 가능 여부를 확인한 뒤 전액 결제로 확정돼요.</li>
          <li>확정 이후 인원이 줄어도 확정 인원 기준으로 정산해요(최소 {GROUP_HEADCOUNT_MIN}인).</li>
        </ul>
      </div>
      <div className={block}>
        <p className="font-semibold text-foreground">취소 · 환불</p>
        <ul className="flex flex-col gap-1">
          <li>행사 14일 전까지 취소: 예약금 전액 환불</li>
          <li>행사 13~8일 전 취소: 예약금의 50% 환불</li>
          <li className="text-danger">행사 7일 전부터 취소: 예약금 환불 불가</li>
          <li>잔금 결제 후에는 인원 감소·취소에 따른 차액 환불이 어려워요.</li>
        </ul>
      </div>
    </div>
  );
}

function PrivacyNotice({ className = "" }: { className?: string }) {
  // ⚠️ 이 목록은 /privacy 제2조 4항과 같아야 한다. 칸을 더하면 둘 다 고친다.
  return (
    <div className={`rounded-lg bg-fill px-4 py-3 text-body-sm leading-relaxed text-muted ${className}`}>
      <p>
        <span className="font-semibold text-foreground">필수</span> 담당자 이름, 연락처, 희망 일시·인원·옵션
      </p>
      <p>
        <span className="font-semibold text-foreground">선택</span> 모임·단체 이름, 모임 성격, 팀 구성, 재참여 여부,
        기념일, 요청사항
      </p>
      <p className="mt-1">목적: 단체 예약 상담과 일정·견적 안내 · 보유: 상담 종료 후 1년</p>
      <p className="mt-1">
        동의하지 않으실 수 있지만, 그러면 상담 신청을 받을 수 없어요.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          개인정보처리방침
        </Link>
      </p>
    </div>
  );
}

/* ───────────────────────── 완료 ───────────────────────── */

function QuoteDone({ done }: { done: Done }) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke={GROUP_ACCENT}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l3 3 5-6" />
        </svg>
        <h1 className="text-h1 font-extrabold">신청이 접수됐어요</h1>
      </div>

      {/* 완료 화면에서 가장 크게 해야 할 말 — 예약이 됐다고 믿고 안 오는 사람이 생기면 안 된다. */}
      <div className="rounded-xl border-2 p-5" style={{ borderColor: GROUP_ACCENT }}>
        <p className="text-h3 font-extrabold">아직 예약이 확정된 건 아니에요</p>
        <p className="mt-2 text-body leading-relaxed text-muted">
          예약은 예약금 입금순으로 확정돼요. 그 전에 다른 단체가 먼저 입금하면 이 일정이 마감될 수 있어요.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {[
          "운영자가 희망 일시를 확인해요",
          `일정과 최종 견적을 ${done.contact}로 안내해 드려요`,
          "예약금(30%) 입금이 확인되면 예약이 확정돼요",
        ].map((t, i) => (
          <li key={t} className="flex items-start gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-extrabold"
              style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
            >
              {i + 1}
            </span>
            <span className="text-body">{t}</span>
          </li>
        ))}
      </ol>

      <dl className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-body-sm">
        {[
          ["인원", `${done.headcount}명`],
          ["일정", `${dateLabel(done.date)} ${done.time}`],
          ["예상 금액", done.quote.total != null ? won(done.quote.total) : "상담 후 안내"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link
          href="/themes/baotalchul"
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-line px-5 text-body font-semibold hover:border-line-strong"
        >
          바-ㅇ탈출 보러 가기
        </Link>
        <a
          href="http://pf.kakao.com/_EGNBX"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-line px-5 text-body font-semibold hover:border-line-strong"
        >
          카카오톡으로 문의
        </a>
      </div>
    </div>
  );
}
