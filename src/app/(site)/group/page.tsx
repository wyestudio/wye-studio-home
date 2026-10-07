import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Chevron } from "@/components/ui/Chevron";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { SectionViewTracker } from "@/components/analytics/SectionViewTracker";
import { GroupEntryTracker } from "@/components/group/GroupEntryTracker";
import { GroupQuoteCta } from "@/components/group/GroupQuoteCta";
import { QuoteForm } from "@/components/group/QuoteForm";
import { GROUP_EVENT } from "@/lib/analytics";
import {
  GROUP_ACCENT,
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  GROUP_PAGE_LABEL,
  isGroupEntry,
} from "@/lib/groupBooking";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";

/*
  단체 예약(10~24명) 안내.

  왜 테마 상세와 따로 두는가
    상세 페이지는 **회차를 골라 바로 신청하는** 화면이다. 단체는 고를 회차가 없고
    (희망 일시를 협의한다), 가격도 표가 아니라 견적이고, 환불 규정도 다르다.
    같은 화면에 두 상품을 섞으면 "달력에 날짜가 없는데 왜 신청이 되냐" 가 된다.

  ⚠️ 이 페이지의 조건(3시간 · 10~24명 · 단독 진행 · 광진구)은 바-ㅇ탈출 기준이다.
     다른 테마에서 들어오게 하려면 `GROUP_BOOKING_THEME_SLUGS` 와 이 문구를 같이 본다.

  ⚠️ 블록마다 `data-screen` + `data-section-key` 를 붙인다 — 어느 블록까지 읽고
     나가는지 세는 집계용 표시다(SectionViewTracker). 레이아웃과는 상관없다.
*/
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "단체 예약",
  // 색인 대상이므로 이 페이지 내용으로 직접 적는다. 루트 레이아웃 설명으로
  // 떨어지면 한 번 색인된 뒤 고쳐도 옛 문구가 계속 검색에 나간다.
  description:
    "10~24명 단체 전용 예약 안내. 우리 모임끼리만 단독으로 진행하는 3시간 팀 대항 파티형 방탈출. 맞춤 팀 편성, 애프터파티, 견적 신청.",
  alternates: { canonical: `${SITE_URL}/group` },
  openGraph: {
    title: "단체 예약 | 우주이스케이프",
    description:
      "10~24명이면 우리 모임끼리만 단독 진행. 3시간 팀 대항 파티형 방탈출 단체 예약 안내.",
    url: `${SITE_URL}/group`,
  },
};

/** 블록 한 겹. 집계용 표시를 빼먹지 않으려고 래퍼로 묶는다. */
function Block({
  id,
  sectionKey,
  navLabel,
  className = "",
  children,
}: {
  id?: string;
  sectionKey: string;
  navLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-screen
      data-section-key={sectionKey}
      data-nav-label={navLabel}
      className={`scroll-mt-24 ${className}`}
    >
      {children}
    </section>
  );
}

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-panel-border bg-panel p-5 sm:p-7 ${className}`}>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-h3 font-extrabold" style={{ color: GROUP_ACCENT }}>
      {children}
    </h3>
  );
}

/** 번호가 붙는 순서 목록. 진행 순서·예약 절차가 같이 쓴다. */
function NumberedList({
  items,
  filled = false,
}: {
  items: { title: string; desc: string }[];
  filled?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li
          key={item.title}
          className="flex items-start gap-3.5 rounded-xl border border-panel-border bg-panel px-4 py-4 sm:px-5"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-extrabold"
            style={
              filled
                ? { backgroundColor: GROUP_ACCENT, color: "#141414" }
                : { border: `1.5px solid ${GROUP_ACCENT}`, color: GROUP_ACCENT }
            }
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-h3">{item.title}</p>
            <p className="mt-1 text-body leading-relaxed text-muted">{item.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const PROGRAM_SPECS = [
  { label: "난이도", value: "4 / 5", note: "조정 가능" },
  { label: "소요 시간", value: "3시간(180분)" },
  { label: "장르", value: "문제방 · 팀경쟁" },
];

const PROGRAM_CARDS = [
  {
    title: "소셜 프로그램",
    desc: "아이스브레이킹부터 방탈출, 미니게임까지 모든 진행을 운영진이 직접 진행해요.",
  },
  {
    title: "코인마켓",
    desc: "방탈출을 포함한 1부 플레이에서 모은 포인트로 다양한 굿즈와 먹거리를 교환해 가져갈 수 있어요.",
  },
  {
    title: "음료 & 다과 제공",
    desc: "음료(커피/아이스티 택 1)와 진행 동안 즐길 간단한 다과를 제공해 드려요.",
  },
];

const SCHEDULE = [
  {
    title: "현장 접수 & 팀별 배치 확인",
    desc: "참여 확인 후 이름표 배부, 팀별 좌석 안내에 따라 착석",
  },
  {
    title: "아이스브레이킹 · 맞춤 레크리에이션",
    desc: "단체 예약 전용. 모임 성격에 맞춘 레크리에이션으로 분위기를 풀고 시작해요.",
  },
  { title: "1부 콘텐츠 안내", desc: "방탈출 진행 규칙 안내 및 설명" },
  { title: "방탈출 진행 + 미니게임", desc: "팀별 방탈출 진행. 돌발 미니게임 발생" },
  {
    title: "2부 교류 타임 & 상품 교환",
    desc: "자유롭게 대화하며 수집한 포인트로 상품 교환 후 자율 퇴장",
  },
];

const BENEFITS = [
  {
    title: "우리끼리 단독 플레이",
    desc: "10명 이상 단체 예약 시 우리 모임끼리만 단독 진행",
  },
  {
    title: "우리 모임 커스텀 플레이",
    desc: "모임 이름이 오프닝 PPT와 게임 결과 화면에 등장",
  },
  {
    title: "단체 플레이 리포트",
    desc: "최종 순위 · 플레이 결과 · 단체사진을 담은 단체 전용 리포트 제공",
  },
  {
    title: "생일 · 기념일 이벤트",
    desc: "생일자나 특별한 기념일이 있다면 간단한 축하 이벤트 제공",
  },
];

const TEAM_MODES = [
  { title: "밸런스 편성", desc: "방탈출 경험 · 실력을 고려해 팀 전력을 고르게" },
  { title: "직접 구성", desc: "친한 사람끼리 원하는 대로" },
  { title: "친목형 편성", desc: "서로 덜 친한 사람끼리 섞어서" },
];

const AFTER_PARTY = [
  "외부 음식 반입 · 배달 가능",
  "BYOB 가능",
  "블루투스 스피커 이용",
  "화면 · 프로젝터 이용",
  "보드게임 · 간단 게임 이용",
  "단체사진 촬영",
];

const STEPS = [
  { title: "견적 신청", desc: "아래 폼에 인원 · 날짜 등 기본 정보만 남겨주세요." },
  {
    title: "일정 확인 · 개별 연락",
    desc: "희망 날짜와 시간의 진행 가능 여부를 확인한 뒤, 모임장님께 개별 연락드려 견적을 안내해요.",
  },
  {
    title: "상세 신청서 작성",
    desc: "팀 편성 방식, 모임 이름, 기념일 등 세부 내용을 신청서로 받아요.",
  },
  {
    title: "예약금 30% 입금 · 예약 확정",
    desc: "일정 협의가 끝나면 예약금과 입금 계좌를 안내드리고, 입금 확인 시 일정이 최종 확정됩니다.",
  },
  {
    title: "행사 7일 전 인원 확정 · 잔금 결제",
    desc: "확정 인원 기준으로 잔금을 결제해요. 이후 인원 추가는 최대 정원 내에서 가능하며 추가 인원분만 별도 결제합니다.",
  },
];

const REFUND_ROWS = [
  { when: "행사 14일 전까지 취소", what: "예약금 전액 환불", danger: false },
  { when: "행사 13~8일 전 취소", what: "예약금의 50% 환불", danger: false },
  { when: "행사 7일 전부터 취소", what: "예약금 환불 불가", danger: true },
];

export default async function GroupBookingPage({ searchParams }: PageProps<"/group">) {
  const params = await searchParams;
  // 주소의 값은 누구나 바꿀 수 있다 — 아는 진입 지점만 집계한다.
  const rawFrom = typeof params.from === "string" ? params.from : "";
  const entry = isGroupEntry(rawFrom) ? rawFrom : null;

  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-6 sm:pt-10 lg:max-w-3xl">
      <div className="mb-6">
        <Link
          href="/themes/baotalchul"
            // ⚠️ 문장 안이 아니라 혼자 서 있는 링크다 — 누르는 높이를 44px 로 둔다.
            //    -my-3 으로 주변 여백을 먹어 배치는 그대로(2026-10-05).
          className="-my-3 inline-flex h-11 items-center gap-1 text-body-sm text-muted hover:text-foreground"
        >
          <Chevron dir="left" className="h-3.5 w-3.5" />
          바-ㅇ탈출 테마 보기
        </Link>
      </div>

      <div className="flex flex-col gap-14 sm:gap-20">
        {/* ── 첫 화면 ── */}
        <Block sectionKey="hero" navLabel="첫 화면" className="flex flex-col gap-5">
          <span
            className="self-start rounded-full px-3.5 py-1.5 text-micro font-extrabold"
            style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
          >
            {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}명 단체 전용
          </span>
          <h1 className="text-display font-extrabold leading-tight">
            우주이스케이프
            <br />
            <span style={{ color: GROUP_ACCENT }}>단체 예약</span>
          </h1>
          <p className="text-h3 leading-relaxed text-muted">
            {GROUP_HEADCOUNT_MIN}명부터 {GROUP_HEADCOUNT_MAX}명까지, 우리 모임끼리만 단독으로
            즐기는 3시간 팀 대항 파티형 방탈출. 단체 전용 견적으로 안내드립니다.
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "인원", value: `${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명` },
              { label: "소요 시간", value: "3시간(180분)" },
              { label: "진행", value: "단독 진행", accent: true },
            ].map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-panel-border bg-panel px-3 py-3.5 text-center"
              >
                <p className="text-micro text-muted">{t.label}</p>
                <p
                  className="mt-0.5 font-semibold text-h3"
                  style={t.accent ? { color: GROUP_ACCENT } : undefined}
                >
                  {t.value}
                </p>
              </div>
            ))}
          </div>
          <GroupQuoteCta where="hero">견적 신청하기</GroupQuoteCta>
          <p className="text-center text-micro text-muted">
            1분이면 끝나요 · 확인 후 직접 연락드립니다
          </p>
        </Block>

        {/* ── 프로그램 ── */}
        <Block sectionKey="program" navLabel="프로그램" className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="PROGRAM"
            title="어떤 프로그램인가요?"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <p className="text-body leading-relaxed text-muted">
            파티형 방탈출 <strong className="text-foreground">바-ㅇ탈출</strong>은 방에 갇히는
            방탈출이 아니라, 여러 팀이 한 공간에서 동시에 문제를 풀며 경쟁하는 팀 대항
            방탈출이에요. 진행은 운영진이 처음부터 끝까지 상주하니, 방탈출이 처음인 분이 섞여
            있어도 괜찮아요.
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {PROGRAM_SPECS.map((s) => (
              <div
                key={s.label}
                // px-2: 320px 폭 폰에서 '(조정 가능)' 이 카드를 6px 넘친다(실측).
                className="rounded-xl border border-panel-border bg-panel px-2 py-4 text-center sm:px-3"
              >
                {/*
                  글자 크기는 아래 '소셜 프로그램' 카드와 맞춘다 — 같은 섹션 안에서
                  이 칸만 작으면 스펙이 곁다리로 읽힌다(2026-10-02 요청).
                */}
                <p className="text-body text-muted">
                  {s.label}
                  {/* 단서는 값 아래가 아니라 **라벨 옆**에 둔다. 아래에 두면 '4 / 5'
                      라는 숫자에 붙은 말처럼 보여서 무엇이 조정 가능한지 흐려진다. */}
                  {/* nowrap: 좁은 폭에서 '(조정' / '가능)' 으로 괄호가 쪼개진다. */}
                  {s.note && (
                    <span
                      className="ml-1 whitespace-nowrap font-semibold"
                      style={{ color: GROUP_ACCENT }}
                    >
                      ({s.note})
                    </span>
                  )}
                </p>
                <p className="mt-1 text-h3 font-extrabold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            {PROGRAM_CARDS.map((c) => (
              <Panel key={c.title}>
                <PanelTitle>{c.title}</PanelTitle>
                <p className="text-body leading-relaxed text-muted">{c.desc}</p>
              </Panel>
            ))}
          </div>
        </Block>

        {/* ── 진행 순서 ── */}
        <Block sectionKey="schedule" navLabel="진행 순서" className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="SCHEDULE"
            title="진행 순서 · 3시간"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <NumberedList items={SCHEDULE} />
          <p className="text-micro leading-relaxed text-muted">
            ※ 자세한 타임테이블은 현장 상황에 따라 달라질 수 있습니다. AFTER PARTY를 추가하면
            종료 후 같은 공간에서 이어집니다.
          </p>
          <Panel>
            <PanelTitle>단체 예약 기본 포함</PanelTitle>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body">
              <li>
                <strong className="text-foreground">3시간 풀 프로그램</strong>{" "}
                <span className="text-muted">
                  아이스브레이킹 + 1부 팀 대항 방탈출 + 2부 코인마켓 파티
                </span>
              </li>
              <li className="text-muted">전문 진행 스태프 3명 · 공간 대관</li>
              <li className="text-muted">
                다과 · 음료 · 자체 제작 굿즈 · 단체사진 촬영 및 전달
              </li>
            </ul>
            <p className="mt-4 text-body-sm leading-relaxed text-muted">
              참가비는 인원 · 일정 · 시기에 따라 달라져, 견적 신청 후 개별 안내드립니다.
            </p>
          </Panel>
        </Block>

        {/* ── 단체 전용 혜택 ── */}
        <Block sectionKey="benefit" navLabel="단체 전용 혜택" className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="SPECIAL BENEFIT"
            title="단체 예약만의 혜택"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <Panel key={b.title}>
                <PanelTitle>{b.title}</PanelTitle>
                <p className="text-body-sm leading-relaxed text-muted">{b.desc}</p>
              </Panel>
            ))}
          </div>

          <Panel>
            <PanelTitle>맞춤 팀 편성</PanelTitle>
            <p className="text-body-sm leading-relaxed text-muted">
              세 가지 방식 중 원하는 대로 팀을 구성해 드려요.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {TEAM_MODES.map((m) => (
                <div
                  key={m.title}
                  className="rounded-xl border border-panel-border bg-background/60 px-4 py-3.5"
                >
                  <p className="font-semibold text-foreground">{m.title}</p>
                  <p className="mt-1 text-micro leading-relaxed text-muted">{m.desc}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>동일 테마 재참여 가능</PanelTitle>
            <p className="text-body-sm leading-relaxed text-muted">
              일반 예약과 달리 단체 예약은 기존 참여자도 함께 참여할 수 있어요.
            </p>
            <p className="mt-2 text-micro leading-relaxed text-muted">
              ※ 재참여자가 있는 경우 참여 방식 및 이용 금액은 별도 문의해주세요.
            </p>
          </Panel>
        </Block>

        {/* ── 애프터파티 ── */}
        <Block sectionKey="after_party" navLabel="애프터파티">
          <div
            className="rounded-xl border-2 p-5 sm:p-7"
            style={{ borderColor: GROUP_ACCENT, backgroundColor: `${GROUP_ACCENT}14` }}
          >
            <p
              className="text-micro font-semibold uppercase tracking-[0.3em]"
              style={{ color: GROUP_ACCENT }}
            >
              After Party
            </p>
            <p className="mt-3 font-semibold text-h3">놀다 헤어지기 아쉽다면?</p>
            <h2
              className="text-h2 font-extrabold leading-tight"
              style={{ color: GROUP_ACCENT }}
            >
              AFTER PARTY PACKAGE
            </h2>
            <span
              className="mt-4 inline-block rounded-full px-4 py-1.5 text-micro font-extrabold"
              style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
            >
              추가 옵션 · 비용은 견적 시 안내
            </span>
            <p className="mt-4 text-body leading-relaxed">
              프로그램 종료 후 <strong style={{ color: GROUP_ACCENT }}>최대 4시간</strong>, 이용하던
              공간에서 그대로 우리끼리 뒤풀이.{" "}
              <strong style={{ color: GROUP_ACCENT }}>다른 장소로 이동할 필요 없어요.</strong>
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-2 text-body-sm text-muted sm:grid-cols-2">
              {AFTER_PARTY.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-1 text-micro leading-relaxed text-muted">
              <p>※ BYOB는 주류 판매 · 제공이 아닌, 성인 참여자가 직접 주류를 가져오는 방식입니다.</p>
              <p>※ BYOB(주류 동반)를 이용하는 경우 참여자 전원 만 19세 이상이어야 합니다.</p>
              <p>※ 진행 프로그램 없이 공간을 자유롭게 이용하는 패키지입니다.</p>
            </div>
          </div>
        </Block>

        {/* ── 이용 안내 ── */}
        <Block sectionKey="guide" navLabel="이용 안내" className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="GUIDE"
            title="이용 안내 · 예약 조건"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <Panel>
            <PanelTitle>이용 안내</PanelTitle>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-muted">
              <li>
                이용 인원{" "}
                <strong className="text-foreground">
                  {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}명
                </strong>
              </li>
              <li>
                참가 연령 <strong className="text-foreground">만 16세 이상</strong> (AFTER PARTY에서
                BYOB 이용 시에만 만 19세 이상)
              </li>
              <li>주말: 금 · 토 · 일 11:30 / 15:30 / 19:30 (희망 일시 협의)</li>
              <li>평일: 희망 일시 협의</li>
              <li>장소: 서울 광진구 아차산로51길 74-1 지하1층</li>
            </ul>
          </Panel>
          <Panel>
            <PanelTitle>예약 · 결제 조건</PanelTitle>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-muted">
              <li>예약금 30% 입금 시 확정 · 행사 7일 전 확정 인원 기준 잔금</li>
              <li>확정 이후 인원이 줄어도 확정 인원 기준 정산 (최소 {GROUP_HEADCOUNT_MIN}인)</li>
              <li>결제: 계좌이체</li>
              <li>
                일반 예약과 다른{" "}
                <a href="#refund" className="underline underline-offset-2 hover:text-foreground">
                  단체 예약 취소 · 환불 규정
                </a>
                이 적용됩니다.
              </li>
            </ul>
          </Panel>
          <Panel>
            <PanelTitle>참여 전 꼭 확인해주세요</PanelTitle>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 text-body">
              <li>
                <strong className="text-foreground">휴대폰 사용 제한</strong>{" "}
                <span className="text-muted">
                  1부 진행 동안 사진 촬영을 포함한 모든 전자기기 사용이 제한되며, 사전 휴대폰 제출에
                  동의하신 분만 참여 가능합니다.
                </span>
              </li>
              <li>
                <strong className="text-foreground">건강한 경쟁 매너</strong>{" "}
                <span className="text-muted">
                  경쟁 요소가 포함되어 있어요. 과도한 신체 접촉이나 불쾌감을 주는 언행은 즉시
                  퇴장됩니다.
                </span>
              </li>
              <li>
                <strong className="text-foreground">식사는 제공되지 않아요</strong>{" "}
                <span className="text-muted">음료와 간단한 다과가 제공됩니다.</span>
              </li>
              <li>
                <strong className="text-foreground">주차</strong>{" "}
                <span className="text-muted">인근 공영주차장 이용</span>
              </li>
            </ul>
          </Panel>
        </Block>

        {/* ── 예약 절차 ── */}
        <Block sectionKey="how_it_works" navLabel="예약 절차" className="flex flex-col gap-5">
          <SectionHeading
            eyebrow="HOW IT WORKS"
            title="예약은 이렇게 진행돼요"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <p className="text-body leading-relaxed text-muted">
            견적 신청만으로는 예약이 확정되지 않아요. 일정 협의 후{" "}
            <strong className="text-foreground">예약금 30% 입금이 확인되면</strong> 해당 일정이 최종
            확정됩니다.
          </p>
          <NumberedList items={STEPS} filled />
          <p className="text-micro leading-relaxed text-muted">
            ※ 행사 7일 이내 신청은 일정 및 준비 가능 여부 확인 후, 확정 인원 기준 전액 결제 시
            예약이 확정됩니다.
          </p>

          <div
            id="refund"
            className="scroll-mt-24 rounded-xl border border-danger/60 bg-danger-soft p-5 sm:p-7"
          >
            <h3 className="text-h3 font-extrabold text-danger">
              단체 예약 취소 · 환불 규정
            </h3>
            <p className="mt-2 text-body-sm leading-relaxed text-muted">
              단체 예약에는 홈페이지 일반 예약과 별도의 취소 · 환불 규정이 적용됩니다.
            </p>
            <dl className="mt-4">
              {REFUND_ROWS.map((r) => (
                <div
                  key={r.when}
                  className="flex items-baseline justify-between gap-3 border-t border-panel-border py-3 text-body"
                >
                  <dt className="text-muted">{r.when}</dt>
                  <dd
                    className={`shrink-0 text-right font-semibold ${
                      r.danger ? "text-danger" : "text-foreground"
                    }`}
                  >
                    {r.what}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed text-muted">
              <li>잔금 결제 후에는 인원 감소 및 취소에 따른 차액 환불이 어렵습니다.</li>
              <li>
                예약 확정 후 인원 추가는 최대 정원 내에서 가능하며, 추가 인원분을 별도 결제합니다.
              </li>
            </ul>
          </div>
        </Block>

        {/* ── 견적 신청 ── */}
        <Block
          id="quote"
          sectionKey="quote"
          navLabel="견적 신청"
          className="rounded-xl border border-panel-border bg-panel p-5 sm:p-7"
        >
          <SectionHeading
            eyebrow="QUOTE"
            title="견적 신청하기"
            align="left"
            eyebrowColor={GROUP_ACCENT}
          />
          <p className="mb-6 mt-2 text-body-sm text-muted">
            아직 확정이 아니어도 괜찮아요. 예상 기준으로 적어주세요.
          </p>
          <QuoteForm />
        </Block>

        {/* ── 카카오톡 문의 ── */}
        <Block sectionKey="contact" navLabel="문의" className="flex flex-col items-center gap-4">
          <p className="text-center text-body text-muted">
            급하게 확인이 필요하다면 카카오톡 채널로 바로 문의해주세요.
          </p>
          <a
            href="http://pf.kakao.com/_EGNBX"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[52px] w-full items-center justify-center rounded-full border px-6 font-semibold"
            style={{ borderColor: GROUP_ACCENT, color: GROUP_ACCENT }}
          >
            카카오톡 채널 &lsquo;우주이스케이프&rsquo; 문의
          </a>
        </Block>
      </div>

      {/* 어느 블록까지 읽고 멈추는지 기록한다(화면에 아무것도 그리지 않는다) */}
      <SectionViewTracker event={GROUP_EVENT.sectionView} themeLabel={GROUP_PAGE_LABEL} />
      {/* 어느 링크를 타고 들어왔는지 한 번 기록한다 */}
      {entry && <GroupEntryTracker entry={entry} />}

      {/* 화면 우하단 고정 버튼 (페이지당 하나) */}
      <KakaoChannelButton />
    </main>
  );
}
