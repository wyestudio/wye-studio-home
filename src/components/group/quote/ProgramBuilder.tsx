"use client";

import Image from "next/image";
import { AFTER_PARTY_INCLUDES, GROUP_ACCENT } from "@/lib/groupBooking";
import { AFTER_PARTY_WEEKEND_TIME, BASE_MINUTES, OPTION, durationLabel, won } from "@/lib/groupPricing";
import { NumberStepper } from "./controls";
import { useQuoteContext } from "./quoteContext";

/*
  안내의 타임테이블 — 옵션을 넣고 빼면 순서·시간·금액이 바로 바뀐다(2026-10-26 대표님).

  왜 안내에 두는가
    옵션 설명을 글로 나열하면 "이걸 넣으면 뭐가 달라지지?" 가 안 보인다. 눌러 보면
    스테이지가 생기고 없어지면서 플레이 타임과 금액이 같이 움직이게 했다(게임의
    스테이지 해금처럼). 값은 견적 카드와 같은 것이라 여기서 켜면 견적 금액도 바뀐다.

  ⚠️ 1부·2부 각각의 길이는 정해 둔 값이 없다. 둘을 합친 길이(프로그램 − 레크리에이션)만
     계산에 있으므로 2부에는 시각을 적지 않는다. 지어낸 시각을 적지 않는다.
  ⚠️ 캐릭터 꾸미기는 시간을 늘리지 않는다(groupPricing.calcQuote 의 minutes 그대로).
*/

/** 애프터파티까지 꽉 채웠을 때의 길이. 플레이 타임 게이지의 끝. */
const MAX_MINUTES = BASE_MINUTES + OPTION.afterParty.maxHours * 60;

/**
 * 왼쪽 시각 칸은 시작부터 흐른 **분**이다(0 · +30 · +180). 회차를 골라도 실제 시각으로 바꾸지 않는다 —
 * 시각이 찍히면 '그 시간에 그걸 한다' 는 약속처럼 읽힌다(2026-10-26 대표님).
 */
function at(min: number): string {
  return min === 0 ? "0" : `+${min}`;
}

function signed(n: number): string {
  return n === 0 ? "0원" : n > 0 ? `+${won(n)}` : `-${won(-n)}`;
}

type Kind = "base" | "on" | "off" | "locked";

const CHARACTER_SAMPLES = ["minam", "minyeo", "witch"];

export function ProgramBuilder() {
  const q = useQuoteContext();
  if (!q) return null;
  const { options: o, setOptions, minutes, optionsTotal, partyOk, openTimeRow } = q;
  const set = (patch: Partial<typeof o>) => setOptions({ ...o, ...patch });
  const hours = o.afterPartyHours;
  const play = minutes + hours * 60;
  const iceMin = o.icebreaking ? OPTION.icebreaking.minutes : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 상태판 — 누를 때마다 숫자가 튄다 */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
          <p className="text-micro text-muted">플레이 타임</p>
          <p className="text-h2 font-extrabold tabular-nums">
            <span key={play} className="hud-pop inline-block">
              {durationLabel(play)}
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${(play / MAX_MINUTES) * 100}%`,
                backgroundColor: GROUP_ACCENT,
              }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
          <p className="text-micro text-muted">옵션 금액</p>
          <p className="text-h2 font-extrabold tabular-nums" style={{ color: GROUP_ACCENT }}>
            <span key={optionsTotal} className="hud-pop inline-block">
              {signed(optionsTotal)}
            </span>
          </p>
          <p className="mt-1 text-micro text-muted">단체 1회 기준</p>
        </div>
      </div>

      {/* 왼쪽 숫자가 '분' 이라는 표시 — 숫자만 있으면 무슨 단위인지 몰랐다(2026-10-26 대표님). */}
      <div className="-mb-2 flex gap-2" aria-hidden>
        <span className="w-11 shrink-0 text-right text-micro text-muted">min</span>
      </div>
      <ol className="flex flex-col gap-2.5" aria-label="타임테이블 (시작부터 흐른 분)">
        <Stage
          first
          // 뺐으면 시각이 없다 — 1부가 그 자리에서 시작한다.
          at={o.icebreaking ? at(0) : undefined}
          kind={o.icebreaking ? "base" : "off"}
          title="레크리에이션"
          sub="진행자와 함께하는 팀 빌딩 · 30분"
          price={o.icebreaking ? undefined : `-${won(OPTION.icebreaking.discount)} · 30분 단축`}
          action={
            <ToggleBtn
              add={!o.icebreaking}
              label="레크리에이션"
              onClick={() => set({ icebreaking: !o.icebreaking })}
            />
          }
        />
        <Stage
          kind={o.character ? "on" : "off"}
          title="캐릭터 꾸미기"
          sub="우리만의 캐릭터로 플레이"
          price={`+${won(OPTION.character.price)}`}
          action={<ToggleBtn add={!o.character} label="캐릭터 꾸미기" onClick={() => set({ character: !o.character })} />}
        >
          {/* 바-ㅇ탈출 캐릭터 생성기(wye-studio-webapp lib/character.js)로 그린 예시 — 도트라 픽셀을 살린다. */}
          {/* 빼 둔 상태면 글자처럼 흐리게 — 넣으면 또렷해진다. */}
          <div
            className={`mt-2.5 flex items-end gap-1 transition-opacity ${o.character ? "" : "opacity-60"}`}
            aria-label="캐릭터 예시"
          >
            {CHARACTER_SAMPLES.map((c) => (
              <Image
                key={c}
                src={`/group/characters/${c}.svg`}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="[image-rendering:pixelated]"
              />
            ))}
          </div>
        </Stage>
        <Stage at={at(iceMin)} kind="base" title="1부 팀 대항 방탈출" sub="한 공간에서 팀끼리 겨루기" />
        <Stage kind="base" title="2부 코인마켓" sub="모은 포인트로 굿즈 · 뽑기 교환" />
        <Stage
          at={at(minutes)}
          kind={hours > 0 ? "on" : partyOk ? "off" : "locked"}
          title="애프터파티"
          sub="2차 장소 찾을 필요 없이 여기서 바로 뒤풀이"
          price={`1시간 +${won(OPTION.afterParty.hourly)}`}
          action={
            hours > 0 ? (
              <ToggleBtn label="애프터파티" onClick={() => set({ afterPartyHours: 0, cleanup: false })} />
            ) : partyOk ? (
              <ToggleBtn add label="애프터파티" onClick={() => set({ afterPartyHours: 1 })} />
            ) : null
          }
        >
          {hours > 0 && (
            <div className="mt-3 flex flex-col gap-2.5">
              <ul className="flex flex-wrap gap-1" aria-label="애프터파티에서 할 수 있는 것">
                {AFTER_PARTY_INCLUDES.map((x) => (
                  <li key={x} className="rounded-md bg-fill px-2 py-0.5 text-micro text-muted">
                    {x}
                  </li>
                ))}
              </ul>
              <p className="text-micro leading-relaxed text-muted">
                ※ BYOB는 성인 참여자가 주류를 직접 가져오는 방식이며, 참여자 전원 만 19세 이상이어야 합니다.
              </p>
              <NumberStepper
                label="애프터파티 시간"
                unit="시간"
                min={1}
                max={OPTION.afterParty.maxHours}
                value={hours}
                onChange={(n) => set({ afterPartyHours: n })}
              />
            </div>
          )}
          {!partyOk && (
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-body-sm text-muted">주말은 {AFTER_PARTY_WEEKEND_TIME} 회차만</span>
              <button
                type="button"
                onClick={openTimeRow}
                className="inline-flex h-11 shrink-0 items-center text-body-sm font-semibold text-[#f082f4] underline underline-offset-4"
              >
                회차 바꾸기
              </button>
            </div>
          )}
        </Stage>
        <Stage
          kind={o.cleanup ? "on" : hours > 0 ? "off" : "locked"}
          title="뒷정리 서비스"
          sub={hours > 0 ? "정리는 저희가 할게요" : "애프터파티를 넣으면 열려요"}
          price={`+${won(OPTION.cleanup.price)}`}
          action={
            hours > 0 ? (
              <ToggleBtn add={!o.cleanup} label="뒷정리 서비스" onClick={() => set({ cleanup: !o.cleanup })} />
            ) : null
          }
        />
        <li className="flex items-center gap-2">
          <span className="w-11 shrink-0 text-right text-label font-semibold tabular-nums">{at(play)}</span>
          <span className="flex w-3 shrink-0 justify-center" aria-hidden>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GROUP_ACCENT }} />
          </span>
          <span className="text-body font-semibold">끝</span>
        </li>
      </ol>
    </div>
  );
}

function Stage({
  at,
  kind,
  title,
  sub,
  price,
  action,
  first = false,
  children,
}: {
  at?: string;
  kind: Kind;
  title: string;
  sub: string;
  price?: string;
  action?: React.ReactNode;
  first?: boolean;
  children?: React.ReactNode;
}) {
  const dim = kind === "off" || kind === "locked";
  return (
    <li className="flex gap-2">
      {/* 시각 · 점 · 선. 시각이 정해지지 않은 스테이지(2부 · 옵션)는 점만 찍는다. */}
      <span className="w-11 shrink-0 pt-4 text-right text-label tabular-nums text-muted">{at ?? ""}</span>
      <span className="relative flex w-3 shrink-0 justify-center" aria-hidden>
        <span className={`absolute -bottom-2.5 w-px bg-line ${first ? "top-5" : "-top-2.5"}`} />
        <span
          className={`relative mt-5 h-3 w-3 rounded-full border-2 ${
            kind === "on"
              ? ""
              : kind === "base"
                ? "border-line-strong bg-background"
                : "border-line bg-background"
          }`}
          style={
            kind === "on"
              ? {
                  backgroundColor: GROUP_ACCENT,
                  borderColor: GROUP_ACCENT,
                  boxShadow: `0 0 10px ${GROUP_ACCENT}`,
                }
              : undefined
          }
        />
      </span>
      {/* key 가 바뀌면 다시 그려지며 한 번 튄다 — 넣고 뺀 것이 눈에 띄게. */}
      <div
        key={kind}
        className={`stage-in min-w-0 flex-1 rounded-xl border px-4 py-3 ${
          kind === "on"
            ? "border-[#f082f4] bg-[#f082f4]/10"
            : kind === "base"
              ? "border-panel-border bg-panel"
              : "border-dashed border-line"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`min-w-0 flex-1 ${dim ? "opacity-60" : ""}`}>
            <p className="flex items-center gap-1.5 text-body font-semibold">
              {kind === "locked" && <LockIcon />}
              {title}
            </p>
            <p className="text-body-sm text-muted">{sub}</p>
            {price && (
              <p className="mt-0.5 text-body-sm font-semibold" style={{ color: GROUP_ACCENT }}>
                {price}
              </p>
            )}
          </div>
          {action}
        </div>
        {children}
      </div>
    </li>
  );
}

/** 넣기(+) / 빼기(−) 동그라미 버튼. 글자 없이 기호만 — 화면이 깔끔하다(2026-10-26 대표님). */
function ToggleBtn({ add = false, label, onClick }: { add?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} ${add ? "넣기" : "빼기"}`}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${
        add
          ? "border-[#f082f4] bg-[#f082f4] text-[#141414] hover:bg-[#f6a8f9]"
          : "border-line text-muted hover:border-line-strong hover:text-foreground"
      }`}
    >
      {/* SUIT 에 '−'(U+2212)가 없어 기호는 SVG 로 그린다. */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="h-5 w-5">
        <path d={add ? "M12 5v14M5 12h14" : "M5 12h14"} />
      </svg>
    </button>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      className="h-4 w-4 text-muted"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
