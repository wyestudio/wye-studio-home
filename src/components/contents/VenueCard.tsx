"use client";

import { useState } from "react";
import type { PublicVenue } from "@/types/catalog";
import { VenueMap } from "@/components/contents/VenueMap";

/**
 * 진행 장소 카드. 상호명 → 지도 → 주소(복사) → 주차 → 지도 앱 버튼 순.
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
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-panel-border bg-panel p-6 sm:max-w-2xl sm:p-10 lg:max-w-3xl lg:p-12">
      <div className="text-center">
        {/* 지도에 이미 핀이 있으면 아이콘은 겹치므로 뺀다. */}
        {!hasCoords && (
          <span
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full sm:mb-5 sm:h-14 sm:w-14"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="currentColor">
              <path d="M12 2.25a7.25 7.25 0 0 0-7.25 7.25c0 5.1 6.1 11.4 6.36 11.66a1.25 1.25 0 0 0 1.78 0c.26-.26 6.36-6.56 6.36-11.66A7.25 7.25 0 0 0 12 2.25Zm0 10a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z" />
            </svg>
          </span>
        )}
        <p className="text-xs font-semibold sm:text-sm" style={{ color: accent }}>
          {venue.area_label}
        </p>
        <p className="mt-1 text-xl font-extrabold text-foreground sm:mt-2 sm:text-3xl lg:text-4xl">
          {venue.name}
        </p>
      </div>

      {hasCoords && (
        <VenueMap
          lat={venue.lat!}
          lng={venue.lng!}
          name={venue.name}
          accent={accent}
          className="mt-5 sm:mt-7"
        />
      )}

      <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:gap-3">
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
