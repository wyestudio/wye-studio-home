/**
 * 단체 프로그램 소개서 — /group 첫 화면의 「소개서 바로 보기」 뷰어와 PDF.
 *
 * 왜 PDF 만 걸지 않고 그림으로 넘겨 보게 하는가 (2026-11-24 대표님)
 *   모르는 파일을 받는 걸 꺼리는 사람이 있고(피싱 걱정), 버튼만 있으면 굳이 받아 보지 않는다.
 *   먼저 페이지 안에서 보여 주고, 회사에 공유할 사람만 PDF 를 받게 한다.
 *
 * ⚠️ 소개서를 바꿀 때는 **새 폴더(brochure-YYYY-MM)로 올리고 옛 폴더를 지운다.**
 *    같은 이름에 덮어쓰면 브라우저 · CDN 캐시에 옛 요금이 남는다. 검색 제외 헤더는
 *    next.config.ts 가 `brochure-*` 전체에 붙이므로 폴더 이름 규칙을 지킨다.
 * ⚠️ 그림은 next/image 최적화를 거치지 않고 원본 주소로 쓴다 — 최적화 주소(/_next/image)에는
 *    검색 제외 헤더가 안 붙고, 무료 이미지 변환 한도도 쓴다.
 * ⚠️ 원본은 글자 정보가 없는 그림 PDF 다. 슬라이드 그림 · PDF 는 원본을 다시 그려 만든 것
 *    (WebP 1600px · PDF 는 JPEG 1920px 로 다시 묶어 21.7MB → 2.6MB).
 */
/**
 * 화면에 보이는 이름. 대상(기업)을 이름 앞에 글자로 붙인다 — 일반 참여자용이 생기면 같은 꼴로
 * 나란히 둔다(2026-11-24 대표님). 배지로 붙였더니 휴대폰에서 두 줄로 꺾여 글자로 바꿨다.
 * PDF 링크는 '사내 공유용' 으로 쓴다.
 */
export const BROCHURE_TITLE = "기업용 프로그램 소개서";
export const BROCHURE_PDF_LABEL = "사내 공유용 PDF 받기";
export const BROCHURE_BASE = "/group/brochure-2026-11";
export const BROCHURE_PDF = `${BROCHURE_BASE}/wye-group-brochure-2026-11.pdf`;
export const BROCHURE_PDF_SIZE = "2.6MB";
export const BROCHURE_COVER = `${BROCHURE_BASE}/cover.webp`;
/** 슬라이드 원본 비율(1456 × 816). 그림이 오기 전에 자리를 잡아 화면이 튀지 않게 한다. */
export const BROCHURE_RATIO = "1456 / 816";

/** 쪽마다 그림 설명(대체 텍스트). 쪽 수도 이 배열 길이로 정한다. */
export const BROCHURE_PAGES: readonly string[] = [
  "표지 — 기업 워크숍 전용 팀빌딩 프로그램. 6~24명, 3시간, 건대입구, 단독 대관",
  "회식 대신 방탈출 팀빌딩을 고르는 이유",
  "6명이 넘으면 일반 방탈출이 어려운 이유",
  "우주이스케이프는 이렇게 플레이합니다",
  "누구나 즐길 수 있는 게임형 진행 순서",
  "회사에 맞춘 커스텀 레크리에이션",
  "공포 없이 초보도 함께 푸는 팀 대항 방탈출",
  "플레이 결과는 상품으로, 추억은 리포트로",
  "우리 회사만 단독 대관 — 인원, 시간, 요금, 장소",
  "단체 대관에만 드리는 8가지 혜택",
  "추가 옵션 — 애프터파티, 뒷정리 서비스",
  "행사 목적별 추천 조합",
  "먼저 다녀간 팀들의 후기",
  "인원, 요일, 시기별 1인 요금표(2026년 11월 기준)",
  "신청부터 행사 당일까지 5단계",
  "자주 묻는 질문과 오시는 길",
  "마무리 — 문의 안내",
];

export const brochurePage = (i: number) => `${BROCHURE_BASE}/p${String(i + 1).padStart(2, "0")}.webp`;
