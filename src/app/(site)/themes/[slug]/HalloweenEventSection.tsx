/* eslint-disable @next/next/no-img-element -- 미리 줄여 둔 작은 그림이다(public/season/halloween/event). */

import { creepster } from "@/components/season/creepster";

const ART = "/season/halloween/event";

/**
 * 바-ㅇ탈출 할로윈 이벤트 안내 — 회차 선택과 CONTENTS 사이(2026-10-21 승인 시안).
 *
 * 할로윈 스킨이 켜져 있고 파티모드일 때만 붙는다(page.tsx). 할로윈 회차가 파티모드에만 있다.
 * 모양은 season.css 의 .hw-event 에 있고, 글자 크기는 사이트 토큰(text-*)을 쓴다.
 *
 * 머리는 '기간 + 제목 한 줄' 만 둔다. 영문 소제목·요약 문단까지 세 겹이면 어느 것도
 * 눈에 안 들어와 부산했다 — 내용은 아래 카드 세 장이 말한다(2026-10-22 대표님).
 *
 * ⚠️ 문구는 확정된 내용만 적는다 — 한정 서브 문제 · 행운의 호박 뽑기 · 코스튬 굿즈 증정.
 *    굿즈 종류·수량·선착순·확률 같은 조건은 정해지지 않았으니 지어 넣지 않는다.
 */
export function HalloweenEventSection() {
  return (
    <section aria-labelledby="hw-event-title" className="hw-event">
      <div className="hw-event-topline">
        <span className="hw-event-badge text-micro font-extrabold">
          ONLY 2 DAYS
        </span>
        <span className="hw-event-date font-galmuri text-h2">
          10.31 <span aria-hidden>—</span> 11.01
        </span>
      </div>

      <div className="hw-event-heading">
        <div className="min-w-0">
          {/* 제목 위 이벤트 이름 — 녹아내리는 공포체로 할로윈 느낌만 얹는다(2026-10-22 대표님). */}
          <p className={`hw-event-name ${creepster.className}`}>
            <img
              src="/season/halloween/pumpkin.svg"
              alt=""
              aria-hidden
              className="hw-event-name-icon"
            />
            Halloween Event
          </p>
          <h2 id="hw-event-title" className="text-h1 font-extrabold">
            딱 이틀,
            <br />
            평소와는 다른 <span className="hw-event-em">바-ㅇ탈출!</span>
          </h2>
        </div>
        <img
          src={`${ART}/cauldron.webp`}
          alt=""
          aria-hidden
          className="hw-event-cauldron"
        />
      </div>

      <div className="hw-event-cards">
        <article className="hw-event-card">
          <div className="hw-event-card-top">
            <span className="hw-event-num font-galmuri text-body">01</span>
            <span className="hw-event-chip text-micro font-semibold">
              기간 한정
            </span>
          </div>
          <div className="hw-event-title-art">
            <h3 className="text-h2 font-extrabold">
              할로윈 한정
              <br />
              서브 문제 추가
            </h3>
            <img
              src={`${ART}/candy-pink.webp`}
              alt=""
              aria-hidden
              className="hw-event-art"
            />
          </div>
          <p className="hw-event-body text-body-sm">
            할로윈 이벤트 기간에만 만날 수 있는
            <br />
            추가 서브 문제를 풀어보세요!
          </p>
        </article>

        <article className="hw-event-card">
          <div className="hw-event-card-top">
            <span className="hw-event-num font-galmuri text-body">02</span>
            <span className="hw-event-chip text-micro font-semibold">
              깜짝 이벤트
            </span>
          </div>
          <div className="hw-event-title-art">
            <h3 className="text-h2 font-extrabold">
              행운의
              <br />
              호박 뽑기
            </h3>
            <img
              src="/season/halloween/pumpkin.svg"
              alt=""
              aria-hidden
              className="hw-event-art hw-event-art--pumpkin"
            />
          </div>
          <p className="hw-event-body text-body-sm">
            문제 풀이 중 우쥬, 이스, 케이프가 보여주는
            <br />
            행운의 호박을 뽑아보세요! Trick or treat?
          </p>
        </article>

        <article className="hw-event-card hw-event-costume">
          {/* 번호·뱃지 줄은 카드 전체 폭 — 01·02 처럼 뱃지가 우상단에 온다. */}
          <div className="hw-event-card-top">
            <span className="hw-event-num font-galmuri text-body">03</span>
            <span className="hw-event-chip text-micro font-semibold">
              코스튬 참여 혜택
            </span>
          </div>
          <div className="hw-event-costume-row">
            <div className="min-w-0 flex-1">
              <h3 className="hw-event-costume-title text-h2 font-extrabold">
                할로윈 코스튬 입고 참여 시,
                <br />
                이벤트 한정 굿즈 증정!
              </h3>
              <p className="hw-event-body text-body-sm">
                머리띠나 호박 바구니 같은 아주 간단한 소품만 착용해도 좋아요!
                <br className="max-sm:hidden" /> 참여만 해도 이벤트 한정 굿즈를
                드립니다
              </p>
            </div>
            <img
              src={`${ART}/costume-witch-vampire.webp`}
              alt="보라색 마녀 코스튬과 뱀파이어 코스튬을 입은 두 캐릭터"
              className="hw-event-costume-art"
            />
          </div>
        </article>
      </div>
    </section>
  );
}
