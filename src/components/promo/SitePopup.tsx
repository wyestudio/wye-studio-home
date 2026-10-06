"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RichText } from "@/components/ui/RichText";
import type { Popup } from "@/types/popup";

/**
 * 접속 시 뜨는 안내 팝업.
 *
 * 쇼핑몰 팝업을 참고하되 **읽고 바로 지나갈 수 있게** 만든다:
 *   - 배경을 눌러도 닫힌다. Esc 로도 닫힌다
 *   - '오늘 하루 보지 않기' 가 닫기 버튼과 같은 줄에 있다 — 체크하러 따로
 *     움직이지 않아도 된다
 *   - 화면 폭과 무관하게 **가운데**에 띄운다(2026-10-01 요청)
 *
 * ⚠️ 페이지가 그려지자마자 띄우지 않는다. 화면이 안정된 뒤(250ms) 부드럽게
 *    올라와야 "잘못 눌렀나" 싶은 느낌이 덜하다.
 */

/** 하루 숨김은 이 브라우저에만 남는다. 기기가 바뀌면 다시 보이는 게 맞다. */
const STORAGE_PREFIX = "wye_popup_hide_";
/** 이번 방문 숨김. 탭을 닫으면 사라진다 — 다음 방문에는 다시 보이는 게 맞다. */
const SESSION_PREFIX = "wye_popup_closed_";

function hiddenUntil(id: string): number {
  try {
    return Number(localStorage.getItem(STORAGE_PREFIX + id) ?? 0);
  } catch {
    // 시크릿 모드·저장소 차단에서는 읽기 자체가 던진다. 그때는 그냥 띄운다.
    return 0;
  }
}

function hideForADay(id: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch {
    // 저장이 막혀 있으면 이번만 닫히고 다음에 또 뜬다. 막을 방법이 없다.
  }
}

/*
  한 번 닫으면 **이번 방문 동안은 다시 띄우지 않는다**(2026-10-04 UX 진단 P0).

  예전에는 '오늘 하루 보지 않기' 를 체크하지 않고 닫으면, 홈 → 테마 목록 →
  테마 상세로 옮길 때마다 다시 떴다. 이미 신청하러 들어온 사람에게도 똑같이
  막아서는 게 가장 비싼 마찰이었다.

  sessionStorage 라서 탭을 닫으면 지워진다 — '하루 숨김'(localStorage)과 역할이
  다르다. 둘 중 하나만 걸려 있어도 띄우지 않는다.
*/
function closedThisVisit(id: string): boolean {
  try {
    return sessionStorage.getItem(SESSION_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function markClosedThisVisit(id: string) {
  try {
    sessionStorage.setItem(SESSION_PREFIX + id, "1");
  } catch {
    // 저장이 막혀 있으면 다음 화면에서 또 뜬다. 막을 방법이 없다.
  }
}

export function SitePopup({ popup }: { popup: Popup }) {
  // 처음에는 아무것도 그리지 않는다. 서버에는 localStorage 가 없어서
  // 띄운 채로 그리면 '하루 보지 않기' 를 누른 사람에게도 한 번 깜빡인다.
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (Date.now() < hiddenUntil(popup.id)) return;
    if (closedThisVisit(popup.id)) return;
    const t = setTimeout(() => setOpen(true), 250);
    return () => clearTimeout(t);
  }, [popup.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close 는 매 렌더마다 새로 만들어지지만 하는 일이 같아 의존성에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dontShow]);

  /*
    ⚠️ 나타나는 효과를 **transition 이 아니라 animation** 으로 준다.
       transition(opacity-0 → opacity-100)으로 만들었더니, 탭이 비활성이거나
       브라우저가 애니메이션을 눌러 둔 상황에서 전환이 중간에 멈춰
       **팝업이 반투명하게 굳은 채로** 남았다(2026-10-01 로컬 확인).
       animation 은 끝나든 중간에 멈추든 요소의 기본 opacity(1)로 돌아가고,
       prefers-reduced-motion 에서는 globals.css 가 animation 자체를 끈다.
  */

  function close() {
    if (dontShow) hideForADay(popup.id);
    // 체크를 안 했어도 이번 방문 동안은 다시 띄우지 않는다.
    markClosedThisVisit(popup.id);
    setOpen(false);
  }

  if (!open) return null;

  const hasImage = Boolean(popup.image_url);

  /* 이미지·본문 묶음. 링크가 있으면 통째로 눌러 이동한다 — 쇼핑몰 팝업처럼
     "이미지를 누르면 그 이벤트로 간다" 가 기대되는 동작이다. */
  const content = (
    <>
      {hasImage && (
        <div className="relative w-full overflow-hidden bg-surface">
          {/*
            비율을 모르는 이미지라 높이를 정해 두고 contain 으로 넣는다.
            cover 로 채우면 운영자가 올린 문구 윗줄이 잘려 나간다.
          */}
          <Image
            src={popup.image_url!}
            alt={popup.image_alt?.trim() || "이벤트 안내"}
            width={960}
            height={1200}
            className="h-auto w-full object-contain"
            sizes="(min-width: 640px) 420px, 100vw"
            priority
          />
        </div>
      )}

      {popup.body?.trim() && (
        <div className={`px-5 ${hasImage ? "pt-4" : "pt-6"} pb-1`}>
          <RichText
            text={popup.body}
            className="block whitespace-pre-wrap text-body leading-relaxed text-white/90"
          />
        </div>
      )}
    </>
  );

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="이벤트 안내"
    >
      {/* 배경. 눌러서 닫는다. */}
      <button
        type="button"
        aria-label="팝업 닫기"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-[2px]"
      />

      {/*
        ⚠️ 높이를 화면의 90% 로 묶고 **내용만** 스크롤시킨다. 가운데 모달은 길어지면
           위아래가 동시에 잘리는데, 그때 잘려 나가는 게 하필 '닫기' 줄이다.
           닫을 수 없는 팝업이 제일 나쁘므로 아래 줄은 스크롤 밖에 붙박이로 둔다.
      */}
      {/*
        ⚠️ 바탕·테두리는 **이미지가 없을 때만** 깐다(2026-10-01 요청).
           이미지 팝업은 그림이 카드를 끝까지 채우므로 바탕이 보이는 자리가
           아래 조작 줄뿐인데, 거기 어두운 띠가 깔리면 그림에 받침대를 댄 꼴이 된다.
           반대로 문구만 있는 팝업을 투명하게 두면 글자가 배경 위에 떠서 안 읽힌다.
      */}
      <div
        className={`animate-scale-in relative z-10 flex max-h-[90dvh] w-full max-w-[26rem] flex-col
                    overflow-hidden rounded-2xl shadow-2xl ${
                      hasImage ? "" : "border border-white/15 bg-background"
                    }`}
      >
        {/* 닫기 X. 글자가 아니라 SVG 다 — 본문 글꼴에 없는 기호를 쓰면 기기마다 다르게 보인다. */}
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/55 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/75 hover:text-white"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M3 3 L13 13 M13 3 L3 13"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${hasImage ? "" : "pb-4"}`}
        >
        {popup.link_url ? (
          <Link href={popup.link_url} onClick={close} className="block">
            {content}
          </Link>
        ) : (
          content
        )}

        {popup.link_url && popup.link_label?.trim() && (
          <div className={`px-5 pt-4 ${hasImage ? "bg-black/55 pb-1 backdrop-blur" : ""}`}>
            {/* ⚠️ 글자색에 text-glow-foreground 를 쓰지 않는다 — 그 이름의 색 토큰이
                없어 아무 색도 안 먹는다(어드민에 남아 있는 건 무효인 채 굴러가는 것). */}
            <Link
              href={popup.link_url}
              onClick={close}
              className="block rounded-lg bg-glow px-5 py-3 text-center text-body font-bold text-white transition-opacity hover:opacity-90"
            >
              {popup.link_label}
            </Link>
          </div>
        )}
        </div>

        {/*
          하단 줄. '오늘 하루 보지 않기' 와 '닫기' 를 한 줄에 둔다.
          체크만 하고 닫지 않는 사람이 없도록, 체크박스를 눌러도 닫히지는 않는다.
          ⚠️ 위 스크롤 영역 **바깥**이다 — 내용이 길어도 항상 보여야 한다.
        */}
        <div
          className={`flex shrink-0 items-center justify-between px-4 py-3 ${
            hasImage ? "bg-black/55 backdrop-blur" : "border-t border-white/10"
          }`}
        >
          <label className="flex cursor-pointer select-none items-center gap-2 py-1 pr-2 text-body-sm text-muted">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-glow,#3dffb0)]"
            />
            오늘 하루 보지 않기
          </label>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-1.5 text-body-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
