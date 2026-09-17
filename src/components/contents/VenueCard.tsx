"use client";

import { useState } from "react";
import type { PublicVenue } from "@/types/catalog";
import { VenueMap } from "@/components/contents/VenueMap";

/**
 * 진행 장소 카드. 지도 → 주소(복사) → 주차 → 지도 앱 버튼 순.
 *
 * 2026-09-15 까지는 대략 위치만 보여주고 주소는 이틀 전 문자로만 보냈다.
 * 네이버 플레이스 등록에 홈페이지의 상세 장소가 필요해 공개로 바꿨다(p34).
 *
 * 페이지 안 지도는 네이버 클라우드 Maps(VenueMap)로 그린다 — 프립·스페이스클라우드와 같은 방식.
 *   네이버 지도 iframe 임베드는 막혀 있어(map.naver.com 이 X-Frame-Options: DENY) 쓸 수 없다.
 *   장소에 좌표가 없거나 지도가 실패하면 지도만 빠지고 나머지는 그대로다.
 *
 * 네이버 버튼은 장소의 '지도 링크'(map_url, 보통 naver.me 공유 링크)를 그대로 쓴다.
 * 휴대폰에서는 네이버가 알아서 앱으로 열어 준다. 링크가 비어 있으면 주소 검색으로 연다.
 */
export function VenueCard({ venue, accent }: { venue: PublicVenue; accent: string }) {
  const [copied, setCopied] = useState(false);
  const hasCoords = venue.lat != null && venue.lng != null;

  // '서울 광진구 아차산로51길 74-1 지하1층, 어바웃모브 파티룸' 처럼 쉼표 뒤에 상세
  // 표기가 붙으면 카카오맵 검색이 못 찾는다. 검색에는 쉼표 앞 도로명 주소만 넘긴다.
  const searchAddress = venue.address.split(",")[0].trim();
  const naverUrl =
    venue.map_url || `https://map.naver.com/p/search/${encodeURIComponent(searchAddress)}`;
  const kakaoUrl = `https://map.kakao.com/link/search/${encodeURIComponent(searchAddress)}`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(venue.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 권한이 막힌 브라우저 — 주소는 화면에 그대로 있으니 무시
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-panel-border bg-panel p-5 sm:max-w-2xl sm:p-8 lg:max-w-3xl lg:p-10">
      {/*
        상호명·대략 위치 제목은 두지 않는다. 블록 제목('진행 장소')이 이미 있고,
        주소 줄에 상호명까지 들어 있어 같은 말이 세 번 반복됐다(2026-09-15 사용자 요청).
      */}
      {hasCoords && (
        <VenueMap
          lat={venue.lat!}
          lng={venue.lng!}
          name={venue.name}
          accent={accent}
          className="mb-4 sm:mb-5"
        />
      )}

      <div className="flex flex-col gap-2.5 sm:gap-3">
        {/* 주소 + 복사. 긴 주소가 버튼을 밀어내지 않게 글자 쪽이 줄바꿈된다. */}
        <div className="flex items-center gap-3 rounded-xl border border-panel-border bg-panel-raised px-4 py-3 sm:px-5 sm:py-4">
          <p className="min-w-0 flex-1 break-keep text-sm leading-relaxed text-foreground sm:text-base lg:text-lg">
            {venue.address}
          </p>
          <button
            type="button"
            onClick={copyAddress}
            aria-label={copied ? "주소가 복사되었습니다" : "주소 복사"}
            className="shrink-0 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground sm:text-sm"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>

        {venue.parking_note && (
          <p className="px-1 text-xs text-muted sm:text-sm">
            <span className="font-semibold text-foreground">주차</span> · {venue.parking_note}
          </p>
        )}

        {/*
          운영기간. 네이버 스마트플레이스 '팝업스토어' 등록이 운영기간(종료일 포함)을
          홈페이지에서 확인할 수 있어야 한다고 해서 공개한다(2026-09-17 보류 사유).
          심사는 사람이 화면을 보고 하므로 숨겨 두면 안 된다.

          ⚠️ 아래 한 줄은 지우지 말 것 — 날짜만 있으면 **우주이스케이프가 2027년 3월에
             문을 닫는 것처럼** 읽힌다. 이건 이 장소에서 진행하는 기간일 뿐이다.
        */}
        {venue.operating_period && (
          <div className="px-1">
            <p className="text-xs text-muted sm:text-sm">
              <span className="font-semibold text-foreground">운영기간</span> ·{" "}
              {venue.operating_period}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted/80 sm:text-xs">
              이 장소에서 진행하는 기간입니다. 이후 회차는 새로운 장소·기간으로 이어집니다.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3">
        <a
          href={naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-3 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 sm:py-3.5 sm:text-base"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" aria-hidden>
            <path d="M16.27 12.84 7.44 0H0v24h7.73V11.16L16.56 24H24V0h-7.73z" />
          </svg>
          네이버 지도
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-3 py-3 text-sm font-bold text-[#191919] transition-opacity hover:opacity-90 sm:py-3.5 sm:text-base"
        >
          카카오맵
        </a>
      </div>
    </div>
  );
}
