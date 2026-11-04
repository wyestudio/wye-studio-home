import type { Metadata } from "next";

/**
 * 카카오톡·인스타 DM 등에 링크를 붙였을 때 뜨는 공유 카드.
 *
 * 그림과 설명은 **모든 페이지가 같다.** 제목만 페이지마다 달라서 받는 사람이 어떤
 * 페이지 링크인지 알 수 있다("바-ㅇ탈출 | 우주이스케이프", "단체 예약 | 우주이스케이프").
 *
 * ⚠️ 페이지가 `openGraph`·`twitter` 를 적으면 레이아웃의 값을 **통째로 덮는다**(필드별로
 *    합쳐지지 않는다). 그래서 페이지에서는 직접 적지 말고 `shareCard()` 를 펼쳐 쓴다 —
 *    직접 적은 단체 예약 페이지가 그림 없이 흰 카드로 나갔다.
 * ⚠️ 그림을 바꿀 때는 파일명도 바꾼다. 카카오·구글이 그림 주소째로 저장해 둔다
 *    (wye-customer-facing 스킬).
 * ⚠️ 검색 결과용 `description` 은 이것과 별개다. 페이지마다 자기 내용으로 둔다.
 */
export const SHARE_DESCRIPTION =
  "우주이스케이프에서, Would You Escape? 한 공간에서 다 같이 즐기는 팀 경쟁형 방탈출!";

const SHARE_IMAGE = {
  url: "/og-share-wye.png",
  width: 1200,
  height: 630,
  alt: "우주이스케이프 — Would You Escape?",
};

/** 공유 카드 제목. 홈만 브랜드 이름 그대로다. */
export function shareTitle(pageName?: string) {
  return pageName ? `${pageName} | 우주이스케이프` : "우주이스케이프";
}

export function shareCard(pageName?: string, url?: string): Pick<Metadata, "openGraph" | "twitter"> {
  const title = shareTitle(pageName);
  return {
    openGraph: {
      title,
      description: SHARE_DESCRIPTION,
      ...(url ? { url } : {}),
      siteName: "우주이스케이프",
      locale: "ko_KR",
      type: "website",
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: SHARE_DESCRIPTION,
      images: [SHARE_IMAGE],
    },
  };
}
