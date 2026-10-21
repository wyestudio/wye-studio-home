/* eslint-disable @next/next/no-img-element -- 미리 줄여 둔 작은 그림이다(public/season/halloween/event). */
import { HalloweenEventBookingLink } from "./HalloweenEventBookingLink";

const ART = "/season/halloween/event";

/** 02 카드의 마스코트 — 원래 모습 그대로(시즌 의상 아님). 순서는 우쥬 · 이스 · 케이프. */
const FRIENDS = [
  { name: "우쥬", src: `${ART}/mascot-wooju.webp` },
  { name: "이스", src: `${ART}/mascot-is.webp` },
  { name: "케이프", src: `${ART}/mascot-cape.webp` },
];

/**
 * 바-ㅇ탈출 할로윈 이벤트 안내 — 회차 선택과 CONTENTS 사이(2026-10-21 승인 시안).
 *
 * 할로윈 스킨이 켜져 있고 파티모드일 때만 붙는다(page.tsx). 할로윈 회차가 파티모드에만 있다.
 * 모양은 season.css 의 .hw-event 에 있고, 글자 크기는 사이트 토큰(text-*)을 쓴다.
 *
 * ⚠️ 문구는 확정된 내용만 적는다 — 한정 서브 문제 · 행운 호박 뽑기 · 코스튬 굿즈 증정.
 *    굿즈 종류·수량·선착순·확률 같은 조건은 정해지지 않았으니 지어 넣지 않는다.
 */
export function HalloweenEventSection() {
  return (
    <section aria-labelledby="hw-event-title" className="hw-event">
      <div className="hw-event-topline">
        <span className="hw-event-badge text-micro font-extrabold">ONLY 2 DAYS</span>
        <span className="hw-event-date font-galmuri text-h2">
          10.31 <span aria-hidden>—</span> 11.01
        </span>
      </div>

      <div className="hw-event-heading">
        <div className="min-w-0">
          <p className="hw-event-kicker text-micro">HALLOWEEN SPECIAL EVENT</p>
          <h2 id="hw-event-title" className="text-h2 font-extrabold">
            딱 이틀,
            <br />
            평소와는 다른 <span className="hw-event-em">바-ㅇ탈출!</span>
          </h2>
          <p className="hw-event-lead text-body">
            특별한 문제와 깜짝 행운 호박 뽑기,
            <br className="max-sm:hidden" /> 코스튬을 입고 오면 한정 굿즈까지!
          </p>
        </div>
        <img src={`${ART}/cauldron.webp`} alt="" aria-hidden className="hw-event-cauldron" />
      </div>

      <div className="hw-event-cards">
        <article className="hw-event-card">
          <div className="hw-event-card-top">
            <span className="hw-event-num font-galmuri text-body">01</span>
            <span className="hw-event-chip text-micro font-semibold">기간 한정</span>
          </div>
          <div className="hw-event-title-art">
            <h3 className="text-h2 font-extrabold">
              할로윈 특별
              <br />
              한정 서브 문제
            </h3>
            <img src={`${ART}/candy-pink.webp`} alt="" aria-hidden className="hw-event-art" />
          </div>
          <p className="hw-event-body text-body-sm">
            기존 플레이에 특별함을 더했어요.
            <br />
            이틀 동안만 등장하는 할로윈 서브 문제에 도전해보세요!
          </p>
          <p className="hw-event-foot text-label font-semibold">풀 수 있는 기회는, 단 이틀.</p>
        </article>

        <article className="hw-event-card">
          <div className="hw-event-card-top">
            <span className="hw-event-num font-galmuri text-body">02</span>
            <span className="hw-event-chip text-micro font-semibold">깜짝 이벤트</span>
          </div>
          <div className="hw-event-title-art">
            <h3 className="text-h2 font-extrabold">
              깜짝 행운
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
            문제를 푸는 중, 우쥬·이스·케이프가 내는
            <br />
            깜짝 행운 호박 뽑기 이벤트를 만나보세요.
          </p>
          <ul className="hw-event-friends">
            {FRIENDS.map((f) => (
              <li key={f.name}>
                <img src={f.src} alt="" />
                <span className="text-micro">{f.name}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="hw-event-card hw-event-costume">
          <div className="min-w-0 flex-1">
            <div className="hw-event-card-top hw-event-costume-top">
              <span className="hw-event-num font-galmuri text-body">03</span>
              <span className="hw-event-chip text-micro font-semibold">코스튬 참여 혜택</span>
            </div>
            <h3 className="hw-event-costume-title text-h2 font-extrabold">
              할로윈 코스튬 입고,
              <br />
              한정 굿즈 받아가세요!
            </h3>
            <p className="hw-event-body text-body-sm">
              할로윈 코스튬을 하고 오시면
              <br />
              할로윈 한정 굿즈를 증정해드려요.
            </p>
            <p className="hw-event-foot text-label font-semibold">이틀간의 특별한 추억을 굿즈로 간직하세요.</p>
          </div>
          <img
            src={`${ART}/costume-witch-vampire.webp`}
            alt="보라색 마녀 코스튬과 뱀파이어 코스튬을 입은 두 캐릭터"
            className="hw-event-costume-art"
          />
        </article>
      </div>

      <div className="hw-event-bottom">
        <p>
          <strong className="hw-event-period text-body font-extrabold">10월 31일 ~ 11월 1일</strong>
          <br />
          <span className="hw-event-sub text-label">이틀간 진행되는 할로윈 특별 이벤트</span>
        </p>
        <HalloweenEventBookingLink />
      </div>
    </section>
  );
}
