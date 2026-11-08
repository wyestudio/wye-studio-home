import "server-only";
import type { ThemeDetail } from "@/lib/themes";
import type { ThemeWithTiers } from "@/types/catalog";
import { modeHref } from "@/app/(site)/themes/[slug]/ModeBox";
import { GROUP_BOOKING_PATH, GROUP_BOOKING_THEME_SLUGS, GROUP_HEADCOUNT_MAX, GROUP_HEADCOUNT_MIN, hasGroupBooking } from "@/lib/groupBooking";
import { BASE_MINUTES } from "@/lib/groupPricing";

/**
 * 검색엔진 · AI 가 읽는 구조화 데이터(JSON-LD). 2026-11-09 대표님이 브랜드 · 서비스 마스터 문서로 정한 문구.
 *
 * 계층: 브랜드(Organization) → 테마(Service) → 그 테마의 이용 방식(파티 · 노말 · 단체 대관, Service).
 * 파티 · 노말 · 단체는 서로 다른 테마가 아니라 **한 테마를 이용하는 방식**이다 — 따로 세우면 테마가 셋인 줄 안다.
 *
 * - 사이트 공통(브랜드 · 웹사이트)은 루트 레이아웃이 한 번 싣고, 페이지는 @id 로 가리키기만 한다(중복 없이).
 * - 시간 · 인원 · 장소 · 목록은 DB 와 groupPricing.ts 에서 읽는다. 손으로 적은 숫자는 화면과 갈린다.
 * - 가격 · 운영 시간 · 회차는 싣지 않는다 — 얼리버드 · 회차 오픈으로 수시로 바뀌어, 검색엔진에 남은 옛 값이 화면과 어긋난다.
 * - 잠긴 테마(홈의 미탐사 행성)는 싣지 않는다 — 예약 상품이 아니다.
 * - 회사 주소(사업자 소재지)와 체험 장소는 다르다. 회사는 Organization.address, 체험 장소는 테마의 Place(DB venues).
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export const BRAND_NAME = "우주이스케이프";
export const BRAND_DESCRIPTION =
  "우주이스케이프는 방탈출의 원초적인 문제 해결의 즐거움과 능동적인 플레이의 재미를 다양하고 색다른 방식으로 확장하는 방탈출 콘텐츠 브랜드입니다.";
export const INSTAGRAM_URL = "https://www.instagram.com/wouldyouescape/";
export const CONTACT_EMAIL = "wouldyouescape@gmail.com";
export const BUSINESS_REG_NO = "820-04-03772";
/** 사업자 소재지(푸터와 같다). 체험 장소가 아니다. */
const COMPANY_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "낙성대로 2, 4층",
  addressLocality: "관악구",
  addressRegion: "서울특별시",
  addressCountry: "KR",
};

/**
 * 테마 소개 · 모드 소개 문구. DB 의 한 줄 소개(tagline)는 극중 대사("미남아, 소개팅 받아볼래?")라 쓸 수 없어 여기 둔다.
 * 시간 · 인원은 DB 값으로 채운다. 새 테마 · 모드를 열면 여기 한 줄 넣는다 — 없으면 설명 없이 이름 · 주소만 나간다.
 */
export const THEME_COPY: Record<string, { serviceType: string; description: string }> = {
  baotalchul: {
    serviceType: "레트로 아케이드형 방탈출 테마",
    description:
      "우주이스케이프의 첫 번째 테마인 바-ㅇ탈출은 레트로 아케이드 콘셉트의 문제 해결형 방탈출입니다. 참가자가 직접 단서를 찾고 게임패드로 답을 입력하며 포인트를 획득합니다.",
  },
};

/**
 * key 는 @id 꼬리(#party-mode). 없으면 주소의 ?mode= 값을 쓴다.
 * llms 는 /llms.txt 의 한 줄 — 구조화 데이터 설명과 뜻은 같고 AI 가 읽기 좋게 풀었다(대표님 수정안 그대로).
 */
export const MODE_COPY: Record<
  string,
  { key: string; serviceType: string; description: (t: ThemeDetail) => string; llms: (t: ThemeDetail) => string }
> = {
  baotalchul: {
    key: "party",
    serviceType: "공개 모집형 팀 경쟁 방탈출",
    description: (t) =>
      `혼자 또는 일행과 함께 신청할 수 있는 ${t.duration_minutes}분 오픈룸 방탈출 프로그램입니다. 다른 참가자들이 같은 회차에 합류할 수 있으며, 여러 팀이 한 공간에서 실시간으로 경쟁합니다. 아이스브레이킹, 방탈출, 미니게임, 코인마켓 등으로 구성됩니다. 팀 편성은 운영진이 진행하며 일행의 동일 팀 배정은 보장되지 않습니다.`,
    llms: (t) =>
      `혼자 또는 일행과 함께 신청할 수 있는 ${t.duration_minutes}분 공개 모집형 오픈룸 방탈출. 다른 참가자가 같은 회차에 합류할 수 있으며, 여러 팀이 한 공간에서 실시간으로 경쟁합니다. 아이스브레이킹, 방탈출, 미니게임, 코인마켓 등이 포함됩니다. 팀은 운영진이 편성하며 일행과 같은 팀 배정은 보장되지 않습니다.`,
  },
  "baotalchul-normal": {
    key: "normal",
    serviceType: "프라이빗 소그룹 방탈출",
    description: (t) =>
      `예약한 일행 ${headcount(t)}이 한 팀으로 프라이빗하게 즐기는 ${t.duration_minutes}분 방탈출 프로그램입니다. 방탈출 90분과 코인마켓 10분으로 구성되며, 다른 팀과의 실시간 경쟁이나 아이스브레이킹, 별도 미니게임 없이 문제 풀이와 기록 도전에 집중합니다.`,
    llms: (t) =>
      `예약한 일행 ${headcount(t)}이 프라이빗하게 즐기는 ${t.duration_minutes}분 방탈출. 방탈출 90분과 코인마켓 10분으로 구성됩니다. 다른 팀과의 실시간 경쟁 및 별도 아이스브레이킹 · 미니게임 없이 문제 풀이에 집중하며 월간 랭킹에 도전할 수 있습니다.`,
  },
};

export const GROUP_SERVICE_TYPE = "기업 워크숍 및 단체 팀빌딩 방탈출 프로그램";
export function groupDescription(themeName: string) {
  return `우주이스케이프의 ${themeName} 테마를 기업 워크숍, 팀빌딩, 송년회, 동호회 등 각종 모임에서 외부 참가자 없이 단독으로 즐기는 프라이빗 방탈출 프로그램입니다. 여러 팀이 한 공간에서 동일한 테마를 플레이하며 실시간으로 경쟁합니다. 기본 ${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명, 약 ${BASE_MINUTES}분으로 운영되며 팀 편성, 난이도, 레크리에이션, 결과 리포트 등은 목적에 맞춰 조정할 수 있습니다. ${GROUP_HEADCOUNT_MAX + 1}명 이상은 별도 상담을 통해 장소와 운영 방식을 협의합니다.`;
}

/** 2~6명 · 2명 이상 · 1~6명 */
function headcount(t: ThemeDetail) {
  const min = t.min_group_size ?? 1;
  return t.max_group_size ? `${min}~${t.max_group_size}명` : `${min}명 이상`;
}

const COUNT: Record<number, string> = { 2: "두", 3: "세", 4: "네", 5: "다섯" };

/** 단체 대관을 받는 테마. /group 화면도 이 테마 이름 · 주소를 그대로 적고 있다 */
export const GROUP_THEME = { slug: GROUP_BOOKING_THEME_SLUGS[0], name: "바-ㅇ탈출" };

/** /llms.txt 의 단체 대관 한 줄 */
export function groupLlms(themeName: string) {
  return `기업 워크숍, 팀빌딩, 동호회, 송년회 등을 위한 프라이빗 단체 프로그램. 외부 참가자 없이 여러 팀이 같은 공간에서 동일한 ${themeName} 테마를 체험합니다. 기본 ${GROUP_HEADCOUNT_MIN}~${GROUP_HEADCOUNT_MAX}명, 약 ${BASE_MINUTES}분으로 운영하며 팀 구성, 난이도, 레크리에이션 등 맞춤 구성이 가능합니다. ${GROUP_HEADCOUNT_MAX + 1}명 이상은 별도 상담이 필요합니다.`;
}

/** 사업자 소재지 한 줄(llms.txt) */
export const COMPANY_ADDRESS_TEXT = "서울특별시 관악구 낙성대로 2 4층";

type Node = Record<string, unknown>;
const graph = (nodes: Node[]) => ({ "@context": "https://schema.org", "@graph": nodes });

/** 페이지 제목 — 루트 레이아웃 템플릿("우주이스케이프 | %s")과 같은 모양이어야 검색 결과 제목과 맞는다 */
const pageName = (name?: string) => (name ? `${BRAND_NAME} | ${name}` : BRAND_NAME);

function breadcrumb(id: string, items: { name: string; url: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

const themeUrl = (slug: string) => `${SITE_URL}/themes/${slug}`;
const themeId = (slug: string) => `${themeUrl(slug)}#theme`;
const GROUP_URL = `${SITE_URL}${GROUP_BOOKING_PATH}`;
const GROUP_ID = `${GROUP_URL}#group-mode`;

/** 사이트 공통 — 루트 레이아웃이 모든 페이지에 한 번 싣는다 */
export function siteJsonLd() {
  return graph([
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: BRAND_NAME,
      alternateName: ["wouldyouescape", "Would You Escape", "WYE"],
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/logo-black.png`,
      description: BRAND_DESCRIPTION,
      email: CONTACT_EMAIL,
      taxID: BUSINESS_REG_NO,
      sameAs: [INSTAGRAM_URL],
      address: COMPANY_ADDRESS,
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: BRAND_NAME,
      alternateName: "Would You Escape",
      url: `${SITE_URL}/`,
      inLanguage: "ko-KR",
      publisher: { "@id": ORG_ID },
    },
  ]);
}

/** 홈 — 운영 중인 테마 목록. 잠긴 테마(미탐사 행성)는 뺀다 */
export function homeJsonLd(themes: ThemeWithTiers[]) {
  const open = themes.filter((t) => !t.is_locked);
  const listId = `${SITE_URL}/#theme-list`;
  return graph([
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: pageName(),
      inLanguage: "ko-KR",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": ORG_ID },
      mainEntity: { "@id": listId },
    },
    {
      "@type": "ItemList",
      "@id": listId,
      name: `${BRAND_NAME} 운영 테마`,
      numberOfItems: open.length,
      itemListElement: open.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t.name,
        url: themeUrl(t.slug),
      })),
    },
  ]);
}

/**
 * 장소 주소에서 쉼표 뒤 상세(파티룸 상호 등)를 뗀다 — VenueCard 의 지도 검색과 같은 규칙.
 * 우리가 빌려 쓰는 다른 회사 상호가 우리 장소 이름처럼 검색엔진에 올라가지 않게.
 */
export function venueStreet(address: string) {
  return address.split(",")[0].trim();
}

/** 서울 광진구 아차산로51길 74-1 지하1층 → 시 · 구 · 나머지. 모양이 다르면 통째로 한 줄로 둔다 */
function postalAddress(full: string): Node {
  const address = venueStreet(full);
  const m = address.match(/^서울(?:특별시)?\s+(\S+구)\s+(.+)$/);
  return m
    ? { "@type": "PostalAddress", streetAddress: m[2], addressLocality: m[1], addressRegion: "서울특별시", addressCountry: "KR" }
    : { "@type": "PostalAddress", streetAddress: address, addressCountry: "KR" };
}

/**
 * 테마 상세 — 테마 하나와 그 이용 방식들. 모드 화면(?mode=normal)도 같은 그래프를 싣고,
 * 페이지(WebPage)의 주소와 주인공(mainEntity)만 그 모드로 바꾼다.
 */
export function themeJsonLd({
  base,
  variants,
  current,
  url,
  title,
}: {
  /** 묶음 대표(기본 모드) */
  base: ThemeDetail;
  variants: ThemeDetail[];
  current: ThemeDetail;
  /** 이 화면의 대표 주소(canonical) */
  url: string;
  /** 이 화면의 제목(브랜드 없이) */
  title: string;
}) {
  const modes = (variants.length >= 2 ? variants : [base]).filter((v) => !v.is_locked);
  const tId = themeId(base.slug);
  const copy = THEME_COPY[base.variant_group ?? base.slug] ?? THEME_COPY[base.slug];
  const venue = base.venue ?? current.venue;
  const venueId = venue ? `${themeUrl(base.slug)}#venue` : null;
  const group = hasGroupBooking(base.slug);
  const multi = modes.length >= 2;
  const modeId = (v: ThemeDetail) => `${themeUrl(base.slug)}#${MODE_COPY[v.slug]?.key ?? modeKeyOf(base, v)}-mode`;
  const modeUrl = (v: ThemeDetail) => `${SITE_URL}${modeHref(base.slug, modes, v)}`;

  const offers = [
    ...(multi ? modes : []).map((v) => ({
      "@type": "Offer",
      name: v.variant_label ?? v.name,
      url: modeUrl(v),
      itemOffered: { "@id": modeId(v) },
    })),
    ...(group ? [{ "@type": "Offer", name: "단체 대관", url: GROUP_URL, itemOffered: { "@id": GROUP_ID } }] : []),
  ];

  const pageId = `${url}#webpage`;
  const mainEntity = multi && current.id !== modes[0].id ? modeId(current) : tId;

  const nodes: Node[] = [
    {
      "@type": "WebPage",
      "@id": pageId,
      url,
      name: pageName(title),
      inLanguage: "ko-KR",
      isPartOf: { "@id": WEBSITE_ID },
      mainEntity: { "@id": mainEntity },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    breadcrumb(`${url}#breadcrumb`, [
      { name: "홈", url: `${SITE_URL}/` },
      { name: base.name, url: themeUrl(base.slug) },
      ...(multi && current.id !== modes[0].id ? [{ name: current.variant_label ?? current.name, url }] : []),
    ]),
    {
      "@type": "Service",
      "@id": tId,
      name: base.name,
      ...(copy ? { serviceType: copy.serviceType } : {}),
      ...(copy
        ? {
            description:
              copy.description +
              (offers.length >= 2 ? ` ${offers.map((o) => o.name).join(", ")}의 ${COUNT[offers.length] ?? offers.length} 가지 방식으로 이용할 수 있습니다.` : ""),
          }
        : {}),
      url: themeUrl(base.slug),
      provider: { "@id": ORG_ID },
      ...(offers.length ? { hasOfferCatalog: { "@type": "OfferCatalog", name: `${base.name} 이용 방식`, itemListElement: offers } } : {}),
      ...(!multi && venueId ? { availableChannel: { "@type": "ServiceChannel", serviceLocation: { "@id": venueId } } } : {}),
    },
  ];

  if (venue && venueId) {
    nodes.push({
      "@type": "Place",
      "@id": venueId,
      name: `${base.name} 체험 장소`,
      ...(venue.area_label ? { description: venue.area_label } : {}),
      address: postalAddress(venue.address),
      ...(venue.lat != null && venue.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lng } }
        : {}),
      ...(venue.map_url ? { hasMap: venue.map_url } : {}),
    });
  }

  if (multi) {
    for (const v of modes) {
      const mc = MODE_COPY[v.slug];
      nodes.push({
        "@type": "Service",
        "@id": modeId(v),
        name: `${base.name} ${v.variant_label ?? ""}`.trim(),
        ...(mc ? { serviceType: mc.serviceType, description: mc.description(v) } : {}),
        url: modeUrl(v),
        provider: { "@id": ORG_ID },
        isRelatedTo: { "@id": tId },
        ...(venueId ? { availableChannel: { "@type": "ServiceChannel", serviceLocation: { "@id": venueId } } } : {}),
      });
    }
  }

  return graph(nodes);
}

/** baotalchul-normal → normal (주소의 ?mode= 값과 같다) */
function modeKeyOf(base: ThemeDetail, v: ThemeDetail) {
  return v.slug.startsWith(`${base.slug}-`) ? v.slug.slice(base.slug.length + 1) : v.slug;
}

/** 단체 대관 — 바-ㅇ탈출을 이용하는 세 번째 방식. 장소는 인원에 따라 달라져 Place 를 걸지 않는다 */
export function groupJsonLd(theme: { slug: string; name: string } = GROUP_THEME) {
  const pageId = `${GROUP_URL}#webpage`;
  return graph([
    {
      "@type": "WebPage",
      "@id": pageId,
      url: GROUP_URL,
      name: pageName(`${theme.name} 단체 예약`),
      inLanguage: "ko-KR",
      isPartOf: { "@id": WEBSITE_ID },
      mainEntity: { "@id": GROUP_ID },
      breadcrumb: { "@id": `${GROUP_URL}#breadcrumb` },
    },
    breadcrumb(`${GROUP_URL}#breadcrumb`, [
      { name: "홈", url: `${SITE_URL}/` },
      { name: theme.name, url: themeUrl(theme.slug) },
      { name: "단체 대관", url: GROUP_URL },
    ]),
    {
      "@type": "Service",
      "@id": GROUP_ID,
      name: `${theme.name} 단체 대관`,
      serviceType: GROUP_SERVICE_TYPE,
      description: groupDescription(theme.name),
      url: GROUP_URL,
      provider: { "@id": ORG_ID },
      isRelatedTo: { "@id": themeId(theme.slug) },
      areaServed: { "@type": "AdministrativeArea", name: "서울특별시" },
    },
  ]);
}

/** <script type="application/ld+json"> 에 넣을 글자. `<` 를 이스케이프해 </script> 로 끊기지 않게 한다 */
export function jsonLdHtml(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
