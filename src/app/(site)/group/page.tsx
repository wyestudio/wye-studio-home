import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Chevron } from "@/components/ui/Chevron";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { SectionViewTracker } from "@/components/analytics/SectionViewTracker";
import { GroupEntryTracker } from "@/components/group/GroupEntryTracker";
import { GroupQuoteFlow } from "@/components/group/quote/GroupQuoteFlow";
import { ProgramBuilder } from "@/components/group/quote/ProgramBuilder";
import { GROUP_EVENT } from "@/lib/analytics";
import {
  GROUP_ACCENT,
  GROUP_HEADCOUNT_MAX,
  GROUP_HEADCOUNT_MIN,
  GROUP_PAGE_LABEL,
  isGroupEntry,
} from "@/lib/groupBooking";
import { getGroupBusySlots, getGroupClosures } from "@/lib/groupClosures";
import { quoteFirstDate } from "@/lib/groupPricing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";

/*
  단체 예약(6~24명) — 안내와 견적·신청을 한 페이지에(2026-10-25).

  왜 테마 상세와 따로 두는가
    상세 페이지는 **회차를 골라 바로 신청하는** 화면이다. 단체는 고를 회차가 없고
    (희망 일시를 협의한다), 가격도 표가 아니라 견적이고, 환불 규정도 다르다.

  왜 한 페이지인가
    고객에게 가장 중요한 건 가격이라, 들어오자마자 고르면서 금액이 바뀌는 걸 보게 한다.
    안내 페이지와 입력 페이지를 나눠 봤더니 한 번 더 넘어가야 해서 오히려 불편했다
    (같은 날 대표님). 견적 구성·연락처 2단계는 GroupQuoteFlow 가 맡고, 이 파일은
    첫 화면(hero)과 아래 안내(info)를 그려 넘긴다.

  ⚠️ 이 페이지의 조건(3시간 · 6~24명 · 단독 진행 · 광진구)은 바-ㅇ탈출 기준이다.
     다른 테마에서 들어오게 하려면 `GROUP_BOOKING_THEME_SLUGS` 와 이 문구를 같이 본다.
  ⚠️ 금액은 전부 groupPricing.ts 에서 읽는다. 여기 숫자를 따로 적으면 견적과 갈린다.
  ⚠️ 블록마다 `data-screen` + `data-section-key` 를 붙인다 — 어느 블록까지 읽고
     나가는지 세는 집계용 표시다(SectionViewTracker). 레이아웃과는 상관없다.
*/
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "단체 예약",
  // 색인 대상이므로 이 페이지 내용으로 직접 적는다. 루트 레이아웃 설명으로
  // 떨어지면 한 번 색인된 뒤 고쳐도 옛 문구가 계속 검색에 나간다.
  description:
    "6~24명 단체 전용 예약. 우리 모임끼리만 단독으로 진행하는 3시간 팀 대항 파티형 방탈출. 인원·날짜·옵션을 고르면 예상 견적이 바로 나와요.",
  alternates: { canonical: `${SITE_URL}/group` },
  openGraph: {
    title: "단체 예약 | 우주이스케이프",
    description:
      "6~24명이면 우리 모임끼리만 단독 진행. 3시간 팀 대항 파티형 방탈출 단체 예약 안내.",
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

/** 필요한 사람만 여는 안내. 전부 펼쳐 두면 정작 읽어야 할 것이 묻힌다. */
function Fold({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-24 border-b border-line-subtle">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-h3 font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <Chevron dir="down" className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-body leading-relaxed text-muted">{children}</div>
    </details>
  );
}

/*
  단체 기본 구성 — 글로 풀지 않고 '무엇을 기본으로 주는지' 만 한눈에(2026-10-26 대표님).
  칸마다 한 줄로 끝나게 짧게 쓴다(두 줄이 섞이면 지저분하다). 진행 스태프는 큰 차별점이
  아니라 맨 끝에 둔다. 그림은 **여러 색이 든 도트 아이콘**이다 — 바-ㅇ탈출 캐릭터처럼.
  맞는 공개 세트가 없어 직접 찍었다: scripts/group-pixel-icons.py → public/group/pixel/. 특별 서비스 카드(3D 그림 · 색 바탕)와 똑같으면 재미없어서
  바탕은 기본 카드 그대로 둔다(2026-10-26 대표님). 옵션은 아래 타임테이블(ProgramBuilder)에서 눌러 본다.
*/
const INCLUDED = [
  { label: "기본 3시간 단독 대관", icon: "hourglass" },
  { label: "레크리에이션", icon: "party-popper" },
  { label: "음료 · 다과", icon: "drink" },
  { label: "자체 제작 굿즈", icon: "gift" },
  { label: "단체사진 촬영", icon: "camera" },
  { label: "스태프가 진행", icon: "mic" },
];

/*
  단체 전용 특별 서비스 — 카드마다 그림과 색을 바꿔 심심하지 않게(2026-10-26 대표님).
  · 색은 두 가지를 바둑판으로 번갈아 칠한다(세 가지는 조잡했다).
  · 그림은 기기 이모지가 아니라 Fluent Emoji 3D 이미지다 — 기본 이모지는 폰마다 모양이 달라진다.
    public/group/emoji/ (MIT, 출처·라이선스는 같은 폴더 LICENSE.txt).
  · 설명은 전부 명사형으로 끝낸다. 문장과 명사가 섞이면 통일감이 없다.
*/
const BENEFIT_COLORS = [GROUP_ACCENT, "#a78bfa"];

const BENEFITS = [
  { img: "crown", title: "우리끼리 단독 진행", desc: "다른 손님 없이 우리 모임만" },
  { img: "label", title: "모임 이름 커스텀", desc: "오프닝 · 결과 화면에 모임 이름 표시" },
  { img: "trophy", title: "단체 플레이 리포트", desc: "최종 순위 · 결과 · 단체사진" },
  { img: "birthday-cake", title: "생일 · 기념일 이벤트", desc: "특별한 날 간단한 축하" },
  { img: "handshake", title: "팀 구성 선택", desc: "실력 밸런스 · 직접 구성 · 친목형" },
  { img: "revolving-hearts", title: "재참여자도 함께", desc: "이미 참여한 분도 참여 가능" },
];

export default async function GroupBookingPage({ searchParams }: PageProps<"/group">) {
  const params = await searchParams;
  // 주소의 값은 누구나 바꿀 수 있다 — 아는 진입 지점만 집계한다.
  const rawFrom = typeof params.from === "string" ? params.from : "";
  const entry = isGroupEntry(rawFrom) ? rawFrom : null;
  const [closures, busy] = await Promise.all([getGroupClosures(), getGroupBusySlots()]);

  // ── 첫 화면 ── 무엇을 · 얼마부터인지만. 데스크톱은 오른쪽에 견적 카드, 모바일은 아래 막대에서 연다.
  const hero = (
    <Block sectionKey="hero" navLabel="첫 화면" className="flex flex-col gap-5">
      {/* 첫 화면 안에 둔다 — 연락처 화면에서는 '견적 수정' 하나만 보이게(뒤로 가는 링크가 둘이면 헷갈린다). */}
      <Link
        href="/themes/baotalchul"
        // ⚠️ 문장 안이 아니라 혼자 서 있는 링크다 — 누르는 높이를 44px 로 둔다.
        //    -my-3 으로 주변 여백을 먹어 배치는 그대로(2026-10-05).
        className="-my-3 mb-1 inline-flex h-11 items-center gap-1 self-start text-body-sm text-muted hover:text-foreground"
      >
        <Chevron dir="left" className="h-3.5 w-3.5" />
        바-ㅇ탈출 테마 보기
      </Link>
      <span
        className="self-start rounded-full px-3.5 py-1.5 text-micro font-extrabold"
        style={{ backgroundColor: GROUP_ACCENT, color: "#141414" }}
      >
        {GROUP_HEADCOUNT_MIN}~{GROUP_HEADCOUNT_MAX}명 단체 전용
      </span>
      <h1 className="text-display font-extrabold leading-tight">
        우리 모임끼리만,
        <br />
        <span style={{ color: GROUP_ACCENT }}>바-ㅇ탈출 단독 대관</span>
      </h1>
      <p className="text-h3 leading-relaxed text-muted">
        친구, 동료, 동아리끼리 팀을 나눠 바-ㅇ탈출을 통째로 즐겨 보세요. 인원과 날짜만 고르면 견적이 바로 나와요.
      </p>
      {/* 가격은 오른쪽 견적 카드(모바일은 아래 막대)에 늘 보이므로 여기엔 넣지 않는다. */}
      <dl className="grid grid-cols-3 gap-2.5">
        {[
          { label: "제공", value: "음료 · 다과" },
          { label: "인원", value: `${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명` },
          // 옵션에 따라 길이가 달라진다(레크리에이션 빼기 · 애프터파티) — '기본' 을 붙인다.
          { label: "진행", value: "3시간", prefix: "기본" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-panel-border bg-panel px-2 py-3.5 text-center">
            <dt className="text-micro text-muted">{t.label}</dt>
            <dd className="mt-0.5 text-h3 font-semibold break-keep">
              {t.prefix && <span className="mr-1 text-body-sm font-normal text-muted">{t.prefix}</span>}
              {t.value}
            </dd>
          </div>
        ))}
      </dl>
    </Block>
  );

  // ── 안내 ── 기본 구성 → 옵션 → 진행 → 혜택 → 확인할 것. 가격과 바로 닿는 것부터.
  const info = (
    <div className="mt-14 flex flex-col gap-16 lg:mt-20 lg:gap-20">
      <Block sectionKey="included" navLabel="기본 구성" className="flex flex-col gap-5">
        <SectionHeading eyebrow="INCLUDED" title="단체 기본 구성" align="left" eyebrowColor={GROUP_ACCENT} />
        {/* 휴대폰은 두 칸 — 세 칸이면 '기본 3시간 단독 대관' 이 두 줄로 꺾인다. */}
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {INCLUDED.map((x) => (
            <li
              key={x.label}
              className="group/inc flex flex-col items-center gap-2 rounded-xl border border-panel-border bg-panel px-2 py-4 text-center"
            >
              {/* 16px 격자 그림을 정확히 3배(48px)로 — 정수배가 아니면 픽셀 크기가 들쭉날쭉해진다. */}
              <Image
                src={`/group/pixel/${x.icon}.svg`}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="[image-rendering:pixelated] transition-transform group-hover/inc:-translate-y-1"
              />
              <span className="text-label font-semibold break-keep">{x.label}</span>
            </li>
          ))}
        </ul>
      </Block>

      {/* 프로그램과 옵션을 하나로 — 옵션을 넣고 빼면 타임테이블이 바로 바뀐다. 값은 견적 카드와 같다. */}
      <Block sectionKey="program" navLabel="타임테이블" className="flex flex-col gap-5">
        <SectionHeading eyebrow="TIMETABLE" title="옵션을 넣고 빼 보세요" align="left" eyebrowColor={GROUP_ACCENT} />
        <ProgramBuilder />
      </Block>

      <Block sectionKey="benefit" navLabel="단체 전용 혜택" className="flex flex-col gap-5">
        <SectionHeading eyebrow="ONLY FOR GROUPS" title="단체 모임만을 위한 특별 서비스" align="left" eyebrowColor={GROUP_ACCENT} />
        <div className="grid grid-cols-2 gap-2.5">
          {BENEFITS.map((b, i) => {
            // 두 칸씩 한 줄 — 줄마다 시작 색을 바꿔 바둑판이 되게.
            const c = BENEFIT_COLORS[(i + Math.floor(i / 2)) % 2];
            return (
              <div
                key={b.title}
                className="group/benefit rounded-xl border p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
                // 색마다 옅은 바탕과 테두리 — 16진수 뒤 두 자리가 투명도(1f ≈ 12%, 55 ≈ 33%).
                style={{ backgroundColor: `${c}1f`, borderColor: `${c}55` }}
              >
                <Image
                  src={`/group/emoji/${b.img}.png`}
                  alt=""
                  width={40}
                  height={40}
                  className="transition-transform group-hover/benefit:-rotate-12 group-hover/benefit:scale-110"
                />
                <p className="mt-2.5 text-body font-semibold" style={{ color: c }}>
                  {b.title}
                </p>
                <p className="mt-1 text-body-sm text-muted">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </Block>

      <Block id="guide" sectionKey="guide" navLabel="이용 안내" className="flex flex-col gap-2">
        <SectionHeading eyebrow="GUIDE" title="신청 전에 확인해주세요" align="left" eyebrowColor={GROUP_ACCENT} />
        <div className="mt-2 border-t border-line-subtle">
          <Fold title="예약은 이렇게 확정돼요">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              <li>견적을 확인하고 신청서를 보내요.</li>
              <li>운영자가 일정을 확인한 뒤 최종 견적과 함께 연락드려요.</li>
              <li>
                <strong className="text-foreground">예약금 30%가 입금되면 확정</strong>돼요. 신청순이 아니라
                입금순이에요.
              </li>
              <li>행사 7일 전 인원을 확정하고 잔금을 결제해요.</li>
            </ol>
            <p className="mt-2 text-body-sm">
              행사 7일 이내 신청은 준비 가능 여부를 확인한 뒤 전액 결제로 확정돼요. 결제는 계좌이체예요.
            </p>
          </Fold>
          <Fold id="refund" title="취소 · 환불 규정">
            <dl>
              {[
                { when: "행사 14일 전까지", what: "예약금 전액 환불" },
                { when: "행사 13~8일 전", what: "예약금의 50% 환불" },
                { when: "행사 7일 전부터", what: "예약금 환불 불가", danger: true },
              ].map((r) => (
                <div key={r.when} className="flex justify-between gap-3 py-1.5">
                  <dt>{r.when}</dt>
                  <dd className={`font-semibold ${r.danger ? "text-danger" : "text-foreground"}`}>{r.what}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body-sm">
              <li>확정 이후 인원이 줄어도 확정 인원 기준으로 정산해요(최소 {GROUP_HEADCOUNT_MIN}인).</li>
              <li>잔금 결제 후에는 인원 감소·취소에 따른 차액 환불이 어려워요.</li>
              <li>인원 추가는 최대 정원 안에서 가능하고, 추가 인원분만 따로 결제해요.</li>
            </ul>
          </Fold>
          <Fold title="이용 안내">
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>참가 연령 만 16세 이상 (애프터파티에서 BYOB 이용 시 만 19세 이상)</li>
              <li>주말(금·토·일) 11:30 / 15:30 / 19:30, 평일은 원하는 시간</li>
              <li>장소: 서울 광진구 아차산로51길 74-1 지하1층 · 주차는 인근 공영주차장</li>
            </ul>
          </Fold>
          <Fold title="참여 전 꼭 알아두세요">
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                1부 동안 사진 촬영을 포함한 전자기기 사용이 제한돼요. 휴대폰 사전 제출에 동의한 분만 참여할 수
                있어요.
              </li>
              <li>경쟁 요소가 있어요. 과도한 신체 접촉이나 불쾌감을 주는 언행은 바로 퇴장이에요.</li>
              <li>식사는 제공되지 않아요. 음료와 간단한 다과가 나와요.</li>
            </ul>
          </Fold>
        </div>
      </Block>

      <Block sectionKey="contact" navLabel="문의" className="flex justify-center">
        <a
          href="http://pf.kakao.com/_EGNBX"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] items-center justify-center text-body-sm text-muted underline underline-offset-4 hover:text-foreground"
        >
          추가 문의는 카카오톡 채널
        </a>
      </Block>
    </div>
  );

  return (
    // 견적 + 오른쪽 금액 카드 두 칸이 들어가야 해서 사이트 틀 폭(5xl)을 쓴다.
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:pt-10">
      <GroupQuoteFlow closures={closures} busy={busy} firstDate={quoteFirstDate()} hero={hero} info={info} />

      {/* 어느 블록까지 읽고 멈추는지 기록한다(화면에 아무것도 그리지 않는다) */}
      <SectionViewTracker event={GROUP_EVENT.sectionView} themeLabel={GROUP_PAGE_LABEL} />
      {/* 어느 링크를 타고 들어왔는지 한 번 기록한다 */}
      {entry && <GroupEntryTracker entry={entry} />}

      {/* 화면 우하단 고정 버튼 (페이지당 하나). 하단 금액 막대가 있으면 그 위로 비켜 간다. */}
      <KakaoChannelButton />
    </main>
  );
}
