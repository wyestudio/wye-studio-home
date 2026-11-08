import { getListedThemes, getThemeVariants, type ThemeDetail } from "@/lib/themes";
import { createPublicClient } from "@/lib/supabase/public";
import { OPTION, unitPriceRange } from "@/lib/groupPricing";
import { GROUP_BOOKING_PATH, hasGroupBooking } from "@/lib/groupBooking";
import { modeHref } from "@/app/(site)/themes/[slug]/ModeBox";
import {
  BRAND_DESCRIPTION,
  BUSINESS_REG_NO,
  COMPANY_ADDRESS_TEXT,
  CONTACT_EMAIL,
  INSTAGRAM_URL,
  MODE_COPY,
  SITE_URL,
  THEME_COPY,
  groupLlms,
  venueStreet,
} from "@/lib/structuredData";

/**
 * /llms.txt — ChatGPT · Claude 같은 AI 가 사이트를 한 번에 읽도록 만든 안내문(2026-11-05 대표님).
 * 형식은 https://llmstxt.org 제안을 따른다(마크다운, UTF-8 일반 텍스트).
 *
 * 계층은 구조화 데이터와 같다: 브랜드 → 테마 → 그 테마의 이용 방식(파티 · 노말 · 단체 대관).
 * 문구는 2026-11-09 대표님 수정안. 테마 · 모드 소개 문구는 structuredData.ts 에 같이 있다.
 *
 * 손으로 고칠 곳이 없게 만든다 — 테마 · 모드 · 장소 · FAQ 는 DB 에서, 단체 요금 · 옵션은 groupPricing.ts 에서
 * 읽는다. 어드민에서 고치면 다음 갱신 때 저절로 따라간다.
 * ⚠️ 정적 파일로 내보내고, 누가 읽을 때 1분이 지났으면 그때 한 번 새로 만든다 — 요청마다 서버가
 *    돌지 않는다(wye-server-cost). 1분은 getListedThemes 의 캐시 주기가 정한다(sitemap.xml 과 같음).
 * ⚠️ 잠긴 테마(홈의 미탐사 행성) · 숨긴 FAQ 는 싣지 않는다 — sitemap.ts 와 같은 기준.
 * ⚠️ 가격은 기본가(정가)만 싣는다. 얼리버드 할인가 · 회차 · 운영 시간은 수시로 바뀌어 싣지 않는다.
 * ⚠️ 링크에 ?from= 을 붙이지 않는다 — 단체 페이지 진입 집계(GROUP_ENTRY)가 AI 에서 온 손님을 다른 진입으로 센다.
 */
export const revalidate = 86400;

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

const COUNT: Record<number, string> = { 1: "한", 2: "두", 3: "세", 4: "네", 5: "다섯" };

/** 이 모드의 사실 — 난이도 · 기본가(인원별). DB 값 그대로 */
function modeFacts(t: ThemeDetail) {
  const prices = t.tiers.map((x) => x.unit_price_krw).filter((n) => n > 0);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  return [
    Number(t.difficulty) ? `난이도 ${Number(t.difficulty)}/5` : "", // DB 는 "4.0" 같은 글자로 준다
    prices.length ? `1인 기본가 ${min === max ? won(min) : `${won(min)}~${won(max)}`}(인원별)` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function GET() {
  const supabase = createPublicClient();
  const [listed, faqRes] = await Promise.all([
    getListedThemes().catch(() => []),
    supabase.from("faqs").select("question, answer, is_visible, sort_order").eq("is_visible", true).order("sort_order"),
  ]);
  const faqs = faqRes.error ? [] : (faqRes.data ?? []);
  const themes = listed.filter((t) => !t.is_locked);
  // 테마마다 모드 묶음. 노말모드는 목록에서 빠지려고 is_listed 가 꺼져 있어 묶음을 따로 읽는다(homeOrbits.ts 와 같다).
  const groups = await Promise.all(
    themes.map(async (t) => {
      const variants = t.variant_group ? (await getThemeVariants(t.variant_group).catch(() => [])).filter((v) => !v.is_locked) : [];
      return { theme: t, modes: variants.length >= 2 ? variants : [] };
    }),
  );

  const lines: string[] = [
    "# 우주이스케이프 (wouldyouescape / Would You Escape)",
    "",
    `> ${BRAND_DESCRIPTION}`,
    "",
    "우주이스케이프에서, Would You Escape?",
    "",
    "우주이스케이프는 각각 다른 이야기와 플레이 방식을 가진 방탈출 테마를 선보이는 브랜드입니다. 홈페이지에서는 각 테마를 하나의 행성으로 표현합니다.",
    "",
    themes.length === 1
      ? `현재 실제 운영 중인 테마는 '${themes[0].name}' 하나입니다.`
      : `현재 실제 운영 중인 테마는 ${themes.map((t) => `'${t.name}'`).join(", ")} ${COUNT[themes.length] ?? themes.length}개입니다.`,
    "홈페이지에 표현된 다른 미탐사 행성은 세계관을 위한 콘셉트 요소이며, 출시가 확정된 예약 상품이 아닙니다.",
    "",
    "## 현재 운영 테마",
    "",
  ];

  for (const { theme: t } of groups) {
    const copy = THEME_COPY[t.variant_group ?? t.slug] ?? THEME_COPY[t.slug];
    const genres = t.genres.length ? `장르: ${t.genres.map((g) => `#${g}`).join(" ")}` : "";
    lines.push(`- [${t.name}](${SITE_URL}/themes/${t.slug}): ${[copy?.description, genres].filter(Boolean).join(" ")}`);
  }

  for (const { theme: t, modes } of groups) {
    const group = hasGroupBooking(t.slug);
    const names = [...modes.map((m) => m.variant_label ?? m.name), ...(group ? ["단체 대관"] : [])];
    if (names.length < 2) continue;
    lines.push(
      "",
      `## ${t.name} 이용 방식`,
      "",
      `${t.name}은 하나의 테마이며, ${names.join(" · ")}은 이 테마를 이용하는 ${COUNT[names.length] ?? names.length} 가지 방식입니다. 서로 다른 방탈출 테마가 아닙니다.`,
    );
    for (const m of modes) {
      const copy = MODE_COPY[m.slug];
      const facts = modeFacts(m);
      lines.push(
        "",
        `- [${m.variant_label ?? m.name}](${SITE_URL}${modeHref(t.slug, modes, m)}): ${[copy?.llms(m), facts && `${facts}.`].filter(Boolean).join(" ")}`,
      );
    }
    if (group) {
      const range = unitPriceRange();
      lines.push(
        "",
        `- [단체 대관](${SITE_URL}${GROUP_BOOKING_PATH}): ${groupLlms(t.name)}` +
          (range ? ` 1인 ${won(range.min)}~${won(range.max)}(인원 · 요일별, 부가세 포함).` : ""),
        `  - 옵션(단체 1회 기준): 레크리에이션 기본 포함(빼면 -${won(OPTION.icebreaking.discount)}), 캐릭터 꾸미기 +${won(OPTION.character.price)}, 애프터파티 1시간 +${won(OPTION.afterParty.hourly)}(최대 ${OPTION.afterParty.maxHours}시간), 뒷정리 +${won(OPTION.cleanup.price)}`,
        "  - 화면에서 인원 · 날짜 · 옵션을 고르면 견적이 바로 나오고, 회사 결재용 견적서 PDF 를 받을 수 있습니다.",
      );
    }
    lines.push(
      "",
      "'오픈룸'은 다른 참가자와 함께 회차를 이용할 수 있는 공개 모집 형태를 의미합니다. 단체 대관은 여러 팀이 같은 공간에서 플레이하더라도 외부 참가자가 없는 프라이빗 이용 방식입니다.",
    );
  }

  lines.push(
    "",
    "## 예약 및 운영 안내",
    "",
    ...groups.map(
      ({ theme: t }) =>
        `- [${t.name} 예약 및 이용 안내](${SITE_URL}/themes/${t.slug}): 예약 가능한 회차, 참가비, 이용 시간, 체험 장소 및 주의사항`,
    ),
    ...(groups.some(({ theme: t }) => hasGroupBooking(t.slug))
      ? [`- [단체 대관 및 견적 신청](${SITE_URL}${GROUP_BOOKING_PATH}): 기업 워크숍과 단체 모임의 이용 인원, 프로그램 구성, 추가 옵션, 견적 및 상담`]
      : []),
    `- [공지사항 및 자주 묻는 질문](${SITE_URL}/notice): 예약 오픈 일정, 이벤트, 예약 변경, 취소 · 환불, 장소, 모드별 이용 규정 및 단체 결제 안내`,
    `- [신청 내역 조회](${SITE_URL}/lookup): 전화번호와 접수번호로 조회 · 취소`,
  );

  // 체험 장소 — 테마에 연결된 장소(DB). 회사 주소(사업자 소재지)와 다르다.
  for (const { theme: t, modes } of groups) {
    const venue = modes[0]?.venue ?? ("venue" in t ? (t as ThemeDetail).venue : null);
    if (!venue) continue;
    const who = modes.length ? modes.map((m) => m.variant_label ?? m.name).join("와 ") : t.name;
    lines.push(
      "",
      `${who}는 ${venueStreet(venue.address)}${venue.area_label ? `(${venue.area_label})` : ""}에서 진행합니다.` +
        (venue.operating_period ? ` 이 장소의 운영 기간은 ${venue.operating_period}입니다.` : "") +
        (hasGroupBooking(t.slug) ? " 단체 대관은 인원과 행사 조건에 따라 다른 장소에서 진행될 수 있으며, 최종 장소는 예약 상담에서 확정됩니다." : ""),
    );
  }

  lines.push(
    "",
    "가격, 할인 혜택, 예약 가능 날짜, 운영 시간, 장소 및 정책은 변경될 수 있습니다. 반드시 각 공식 페이지의 최신 정보를 기준으로 확인해야 합니다.",
    "",
    "종료된 이벤트와 과거 특별 회차는 현재 운영 중인 프로그램으로 해석하지 않아야 합니다. 과거 소개팅 특별 회차의 운영 이력이 있지만, 현재 일반 파티모드는 소개팅이나 매칭 프로그램이 아닙니다.",
    "",
    "## 공식 정책",
    "",
    `- [이용약관](${SITE_URL}/terms): 우주이스케이프 서비스 이용 조건 및 환불 관련 규정`,
    `- [개인정보처리방침](${SITE_URL}/privacy): 개인정보의 수집 및 처리에 관한 안내`,
  );

  if (faqs.length) {
    lines.push("", "## 자주 묻는 질문");
    // 답에 적은 [문구](/group) 링크는 사이트 안 주소다 — 밖에서 읽는 AI 가 따라가게 전체 주소로 바꾼다
    for (const f of faqs) {
      lines.push("", `### ${f.question.trim()}`, "", f.answer.trim().replace(/\]\(\//g, `](${SITE_URL}/`));
    }
  }

  lines.push(
    "",
    "## 공식 채널",
    "",
    `- [공식 홈페이지](${SITE_URL}/): 브랜드 및 테마 안내`,
    `- [공식 인스타그램](${INSTAGRAM_URL}): 우주이스케이프 소식과 콘텐츠`,
    "- 카카오톡 채널: 우주이스케이프",
    "",
    `문의 이메일: ${CONTACT_EMAIL}`,
    `사업자등록번호: ${BUSINESS_REG_NO} · 사업자 소재지: ${COMPANY_ADDRESS_TEXT} (체험 장소가 아닙니다)`,
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
