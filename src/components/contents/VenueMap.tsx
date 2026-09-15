"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 진행 장소 카드 안의 네이버 지도 (NCP Maps · Web Dynamic Map).
 *
 * ⚠️ 이용량은 **지도를 불러올 때마다 1건**이다(줌·마커 조작은 안 센다).
 *    대표 계정 월 600만 건까지 무료. 그래서:
 *    - 페이지를 열 때가 아니라 **이 블록 근처까지 스크롤했을 때** 스크립트를 부른다.
 *      진행 장소는 상세 페이지 아래쪽이라 끝까지 안 내리는 방문자는 건수가 안 잡힌다.
 *    - 한도는 네이버 클라우드 콘솔 Maps > Application > [한도 및 알림 설정] 에서 건다.
 *
 * 키(NEXT_PUBLIC_NAVER_MAP_KEY_ID)나 좌표가 없거나, 인증·로드가 실패하면
 * **아무것도 그리지 않는다.** 지도가 없어도 아래 주소·지도 앱 버튼으로 충분하다.
 *
 * 지도 끌기·휠 확대는 끈다. 켜 두면 휴대폰에서 페이지를 내리려던 손가락이 지도를
 * 끌고, 데스크톱에서는 휠이 화면 넘김(ScreenSnap) 대신 지도를 확대한다.
 * 확대/축소 버튼만 두고, 자세히 보려면 아래 '네이버 지도' 버튼으로 넘어간다.
 */

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID;

type NaverMaps = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => { destroy?: () => void };
  LatLng: new (lat: number, lng: number) => unknown;
  Marker: new (opts: Record<string, unknown>) => unknown;
  Point: new (x: number, y: number) => unknown;
  Position: Record<string, unknown>;
  ZoomControlStyle: Record<string, unknown>;
};

declare global {
  interface Window {
    naver?: { maps?: NaverMaps };
    navermap_authFailure?: () => void;
  }
}

// 한 페이지에서 스크립트는 한 번만 부른다. 인증 실패는 전역 콜백 하나로 오므로 구독자에게 나눠 준다.
let scriptPromise: Promise<NaverMaps> | null = null;
const authFailureListeners = new Set<() => void>();

function loadNaverMaps(): Promise<NaverMaps> {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (scriptPromise) return scriptPromise;

  window.navermap_authFailure = () => authFailureListeners.forEach((fn) => fn());

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${KEY_ID}`;
    s.async = true;
    s.onload = () => (window.naver?.maps ? resolve(window.naver.maps) : reject(new Error("naver.maps 없음")));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("네이버 지도 스크립트 로드 실패"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function VenueMap({
  lat,
  lng,
  name,
  accent,
  className = "",
}: {
  lat: number;
  lng: number;
  name: string;
  accent: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !KEY_ID) return;

    let map: { destroy?: () => void } | null = null;
    let cancelled = false;
    const onAuthFailure = () => setFailed(true);
    authFailureListeners.add(onAuthFailure);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();

        loadNaverMaps()
          .then((maps) => {
            if (cancelled) return;
            const center = new maps.LatLng(lat, lng);
            map = new maps.Map(el, {
              center,
              zoom: 16,
              draggable: false,
              pinchZoom: false,
              scrollWheel: false,
              keyboardShortcuts: false,
              disableDoubleClickZoom: true,
              disableDoubleTapZoom: true,
              disableTwoFingerTapZoom: true,
              zoomControl: true,
              // 기본(LARGE)은 긴 슬라이더라 작은 지도에서 한쪽을 다 가린다. +/- 버튼만.
              zoomControlOptions: { position: maps.Position.TOP_RIGHT, style: maps.ZoomControlStyle.SMALL },
            });
            new maps.Marker({
              map,
              position: center,
              title: name,
              icon: {
                // 기본 핀은 사이트 톤과 안 맞아 강조색 핀으로 그린다. anchor 는 핀 끝(아래 가운데).
                content: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.4 17 44 17 44s17-14.6 17-27.2C34 7.5 26.4 0 17 0Z" fill="${accent}"/><circle cx="17" cy="16.5" r="6" fill="#fff"/></svg>`,
                anchor: new maps.Point(17, 44),
              },
            });
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      // 블록이 화면에 들어오기 조금 전에 불러, 도착했을 때 이미 그려져 있게.
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      authFailureListeners.delete(onAuthFailure);
      map?.destroy?.();
    };
  }, [lat, lng, name, accent]);

  if (!KEY_ID || failed) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`${name} 위치 지도`}
      className={`h-56 w-full overflow-hidden rounded-xl border border-panel-border bg-panel-raised sm:h-72 lg:h-80 ${className}`}
    />
  );
}
