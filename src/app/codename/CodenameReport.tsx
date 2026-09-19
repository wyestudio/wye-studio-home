"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudio } from "./audio";
import { checkExistingCodename, submitCodename } from "./actions";
import { CERT_PHRASE, CODENAME_LENGTH, COMMS, HINTS, HINT_MASKS, type Round } from "./content";

type Phase = "form" | "sealing" | "receipt";
type FieldId = "nickname" | "codename" | "phone" | "consent";
type StepState = "" | "on" | "done";

const EMPTY_ERRORS: Record<FieldId, string> = { nickname: "", codename: "", phone: "", consent: "" };

/** 자릿수만큼 찍는 가림 문자 — 이전에 낸 답안은 화면에도, 서버 응답에도 싣지 않는다. */
const MASKED = "●".repeat(CODENAME_LENGTH);

/** "2026-09-20T14:03:00"(한국 시간) → "9월 20일 14:03" */
function stampText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${Number(m[2])}월 ${Number(m[3])}일 ${m[4]}:${m[5]}`;
}

/** 011-1234-5678 꼴로 끊어 준다. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 7) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}

const RULES: Record<Exclude<FieldId, "consent">, (value: string) => string> = {
  nickname: (v) => (v.trim() ? "" : "오방카페 닉네임을 적어주세요."),
  codename: (v) => {
    const value = v.trim();
    if (!value) return "찾아낸 코드네임을 적어주세요.";
    if (!/^[A-Za-z]+$/.test(value)) return "영문 알파벳만 적어주세요.";
    if (value.length !== CODENAME_LENGTH) {
      return `코드네임은 영문 ${CODENAME_LENGTH}자입니다. 지금 ${value.length}자예요.`;
    }
    return "";
  },
  phone: (v) => (/^01\d-\d{3,4}-\d{4}$/.test(v.trim()) ? "" : "휴대폰 번호 11자리를 정확히 적어주세요."),
};

/** 제목 아래 매화 가지 — 꽃 위치(x, y) */
const BLOSSOMS = [
  [62, 13],
  [148, 17],
  [224, 9],
] as const;

export function CodenameReport({ round, dday }: { round: Round; dday: number | null }) {
  /* ---------- 기본 장치 ---------- */
  const reduced = useRef(false);
  const alive = useRef(true);
  const audio = useRef<ReturnType<typeof createAudio> | null>(null);
  const getAudio = () => {
    if (!audio.current) audio.current = createAudio();
    return audio.current;
  };
  const wait = useCallback(
    (ms: number) => new Promise((resolve) => setTimeout(resolve, reduced.current ? 0 : ms)),
    []
  );

  /* ---------- 화면 상태 ---------- */
  const [phase, setPhase] = useState<Phase>("form");
  const [gateOpen, setGateOpen] = useState(true);
  const [gateOut, setGateOut] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const [nickname, setNickname] = useState("");
  const [codename, setCodename] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [formError, setFormError] = useState("");

  const [lockFocused, setLockFocused] = useState(false);
  const [popIndex, setPopIndex] = useState(-1);
  const [openedHints, setOpenedHints] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dupAt, setDupAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [steps, setSteps] = useState<[StepState, StepState, StepState]>(["", "", ""]);
  const [stamped, setStamped] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardNote, setCardNote] = useState(
    "「바-ㅇ탈출」 1부를 마친 뒤, 현장에서 닉네임 확인 후 제공됩니다."
  );
  const [cardShake, setCardShake] = useState(false);

  /* ---------- 관제소 통신(타이핑) ---------- */
  const [shown, setShown] = useState<string>(COMMS.intro);
  const [alert, setAlert] = useState(false);
  const [caret, setCaret] = useState(false);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  const caretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const said = useRef({ codename: false, formatting: false, nickname: false, consent: false, hint: false });

  const say = useCallback((text: string, isAlert = false) => {
    if (typing.current) clearInterval(typing.current);
    if (caretTimer.current) clearTimeout(caretTimer.current);
    setAlert(isAlert);

    if (reduced.current) {
      setShown(text);
      setCaret(false);
      return;
    }

    let i = 0;
    setShown("");
    setCaret(true);
    typing.current = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        if (typing.current) clearInterval(typing.current);
        typing.current = null;
        caretTimer.current = setTimeout(() => setCaret(false), 1400);
      }
    }, 38);
  }, []);

  /* ---------- 입장 ---------- */
  useEffect(() => {
    alive.current = true;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 서버가 그린 문장을 그대로 다시 타이핑한다. 이펙트 안에서 바로 setState 하지
    // 않도록 한 틱 미룬다.
    const introAt = setTimeout(() => say(COMMS.intro), 0);
    const stampAt = setTimeout(() => getAudio().stamp(), reduced.current ? 0 : 430);
    const closeAt = setTimeout(() => closeGate(), reduced.current ? 1100 : 2100);

    return () => {
      alive.current = false;
      clearTimeout(introAt);
      clearTimeout(stampAt);
      clearTimeout(closeAt);
      if (typing.current) clearInterval(typing.current);
      if (caretTimer.current) clearTimeout(caretTimer.current);
    };
    // 마운트 때 한 번만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gateClosing = useRef(false);
  function closeGate() {
    if (gateClosing.current) return;
    gateClosing.current = true;
    setGateOut(true);
    setTimeout(() => setGateOpen(false), 560);
  }

  /* ---------- 참조 ---------- */
  const nicknameRef = useRef<HTMLInputElement>(null);
  const codenameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const sealBtnRef = useRef<HTMLButtonElement>(null);
  const dupKeepRef = useRef<HTMLButtonElement>(null);
  const receiptRef = useRef<HTMLElement>(null);

  /* ---------- Esc 로 창 닫기 ---------- */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setConfirmOpen(false);
      setDupAt(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (confirmOpen) sealBtnRef.current?.focus();
  }, [confirmOpen]);

  useEffect(() => {
    if (dupAt) dupKeepRef.current?.focus();
  }, [dupAt]);

  /* ---------- 입력 ---------- */
  const setError = (id: FieldId, message: string) =>
    setErrors((prev) => (prev[id] === message ? prev : { ...prev, [id]: message }));

  function onCodenameInput(raw: string) {
    const next = raw.replace(/[^a-zA-Z]/g, "").slice(0, CODENAME_LENGTH).toUpperCase();
    const grew = next.length > codename.length;
    setCodename(next);
    setError("codename", "");

    if (grew) {
      setPopIndex(next.length - 1);
      setTimeout(() => setPopIndex(-1), 240);
      getAudio().clack();
    } else {
      getAudio().click();
    }

    if (next.length === CODENAME_LENGTH && !said.current.formatting) {
      said.current.formatting = true;
      say(COMMS.codenameFilled);
      getAudio().unlock();
    }
  }

  function openHint(index: number) {
    if (index !== openedHints) return;
    setOpenedHints(index + 1);
    getAudio().unlock();
    if (!said.current.hint) {
      said.current.hint = true;
      say(COMMS.hint);
    }
  }

  /* ---------- 제출 ---------- */
  function validate(): HTMLElement | null {
    const next = { ...EMPTY_ERRORS };
    next.nickname = RULES.nickname(nickname);
    next.codename = RULES.codename(codename);
    next.phone = RULES.phone(phone);
    next.consent = consent ? "" : "개인정보 수집 및 이용에 동의해주세요.";
    setErrors(next);

    if (next.nickname) return nicknameRef.current;
    if (next.codename) return codenameRef.current;
    if (next.phone) return phoneRef.current;
    if (next.consent) return consentRef.current;
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    const firstBad = validate();
    if (firstBad) {
      getAudio().deny();
      say(COMMS.invalid, true);
      firstBad.focus();
      return;
    }

    // 같은 번호로 낸 적이 있으면 최종 확인 대신 중복 안내부터 띄운다.
    setChecking(true);
    const existing = await checkExistingCodename(phone);
    if (!alive.current) return;
    setChecking(false);

    if (existing.exists) {
      setDupAt(existing.at ?? "");
      getAudio().deny();
      say(COMMS.duplicate, true);
      return;
    }

    setConfirmOpen(true);
  }

  function resetSeal() {
    setSteps(["", "", ""]);
    setStamped(false);
  }

  async function runSeal(replace: boolean) {
    setConfirmOpen(false);
    setDupAt(null);
    setPhase("sealing");
    getAudio().swell();
    say(COMMS.sealing);

    // 저장과 연출을 같이 시작한다. 연출이 끝난 뒤 저장 결과를 확인한다.
    const saving = submitCodename({ nickname, codename, phone, consent, replace });

    const mark = (index: 0 | 1 | 2, state: StepState) =>
      setSteps((prev) => {
        const next = [...prev] as [StepState, StepState, StepState];
        next[index] = state;
        return next;
      });

    await wait(220);
    mark(0, "on");
    getAudio().click();
    await wait(620);
    mark(0, "done");
    mark(1, "on");
    await wait(560);
    setStamped(true);
    getAudio().unlock();
    mark(1, "done");
    mark(2, "on");
    await wait(760);
    mark(2, "done");
    getAudio().stamp();
    getAudio().resolve();
    await wait(420);

    const result = await saving;
    if (!alive.current) return;

    if (result.status === "ok") {
      setReplaced(result.replaced);
      setPhase("receipt");
      say(COMMS.sealed);
      setTimeout(() => receiptRef.current?.focus(), 0);
      return;
    }

    // 연출이 도는 사이에 같은 번호로 먼저 들어온 기록이 있었던 경우.
    resetSeal();
    setPhase("form");
    if (result.status === "duplicate") {
      setDupAt(result.previousAt);
      getAudio().deny();
      say(COMMS.duplicate, true);
      return;
    }

    setFormError(result.message);
    getAudio().deny();
    say(COMMS.failed, true);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(CERT_PHRASE);
    } catch {
      const area = document.createElement("textarea");
      area.value = CERT_PHRASE;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    getAudio().click();
    setTimeout(() => setCopied(false), 2000);
  }

  function denyCard() {
    setCardShake(false);
    requestAnimationFrame(() => setCardShake(true));
    getAudio().deny();
    setCardNote("아직 못 엽니다. 1부를 마친 뒤 스태프에게 닉네임을 말해주세요.");
  }

  /* ---------- 코드네임 칸 ---------- */
  const cells = Array.from({ length: CODENAME_LENGTH }, (_, i) => {
    if (i < codename.length) {
      return (
        <div key={i} className={`cell filled${popIndex === i ? " pop" : ""}`}>
          {codename[i]}
        </div>
      );
    }
    if (lockFocused && i === codename.length) return <div key={i} className="cell caret" />;
    return (
      <div key={i} className="cell ghost">
        ·
      </div>
    );
  });

  const complete = codename.length === CODENAME_LENGTH;

  return (
    <div className="cn">
      <div className="night" aria-hidden="true" />
      <div className="petals" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="petal" />
        ))}
      </div>

      {gateOpen && (
        <div
          className={`cn-gate${gateOut ? " out" : ""}`}
          onClick={closeGate}
          role="presentation"
        >
          <div className="gate-inner">
            <p className="line">WYE-829b / IDENTITY REPORT TERMINAL</p>
            <div className="seal" aria-hidden="true">
              入
            </div>
            <p className="granted">ACCESS GRANTED</p>
            <button type="button" className="skip" onClick={closeGate}>
              들어가기
            </button>
          </div>
        </div>
      )}

      <main className="wrap">
        <div className="channel">
          <span className="dot" aria-hidden="true" />
          <span>SECURE CHANNEL</span>
          <span className="sep">/</span>
          <span>WYE-829b</span>
          {/* 사운드는 아직 내보내지 않는다(codename.css 의 .sound-toggle 로 숨김). */}
          <button
            type="button"
            className="chip-btn sound-toggle"
            aria-pressed={soundOn}
            title="배경음 · 효과음"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              getAudio().toggle(next);
            }}
          >
            ♪ 사운드 {soundOn ? "ON" : "OFF"}
          </button>
        </div>

        <header className="dossier">
          <p className="stamp">CLASSIFIED · FILE 829b-J</p>
          <h1>
            수상한 요원의
            <br />
            신원을 <span className="bloom">보고</span>하라
          </h1>
          <svg className="branch" viewBox="0 0 280 26" aria-hidden="true">
            <path className="stem" d="M6 20 C 60 8, 118 24, 176 12 S 252 8, 274 16" />
            {BLOSSOMS.map(([x, y]) => (
              <g key={`${x}-${y}`}>
                {[0, 72, 144, 216, 288].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  // 소수점을 잘라 둔다 — 서버와 브라우저의 부동소수 문자열이 달라지면
                  // hydration 불일치 경고가 뜬다.
                  return (
                    <circle
                      key={deg}
                      className="flower"
                      cx={(x + Math.cos(rad) * 3.4).toFixed(2)}
                      cy={(y + Math.sin(rad) * 3.4).toFixed(2)}
                      r="2.6"
                    />
                  );
                })}
                <circle className="core" cx={x} cy={y} r="1.5" />
              </g>
            ))}
          </svg>
          <p className="lede">
            미남과 미녀의 첫 만남을 기록하던 중 발견된 인물.
            <br />
            남겨진 단서에서 찾아낸 코드네임을 이곳에 적어주세요.
          </p>
        </header>

        <div className={`transmission${alert ? " alert" : ""}`}>
          <span className="from">INCOMING — 관제소</span>
          <p aria-live="polite">
            {shown}
            {caret && <span className="caret" />}
          </p>
        </div>

        <div className="round">
          <b>{round.name}</b>
          <span className="dates">{round.dates}</span>
          {dday !== null && <span className="dday">{dday <= 0 ? "오늘 마감" : `D-${dday}`}</span>}
        </div>

        {round.always && (
          <p className="always-note">
            🌼 <b>비하인드 스토리 카드 이벤트 · 상시 진행</b>
            <br />
            무료 초청권 추첨은 2차 접수와 함께 종료되었습니다. 지금 제출하는 답안은 추첨 대상에는
            포함되지 않고, <b>카드 수령 대상 확인용</b>으로 등록됩니다.
          </p>
        )}

        {phase === "form" && (
          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <div className="field-head">
                <span className="code">F-01</span>
                <label className="title" htmlFor="nickname">
                  오방카페 닉네임
                </label>
                <span className="req">필수</span>
              </div>
              <p className="hint">오방카페에서 쓰는 닉네임과 똑같이 적어주세요.</p>
              <input
                type="text"
                id="nickname"
                ref={nicknameRef}
                value={nickname}
                placeholder="예) 방탈출가는우주인"
                autoComplete="off"
                maxLength={30}
                aria-invalid={errors.nickname ? "true" : "false"}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("nickname", "");
                }}
                onBlur={() => {
                  const value = nickname.trim();
                  if (value && !said.current.nickname) {
                    said.current.nickname = true;
                    say(COMMS.nickname(value));
                  }
                }}
              />
              {errors.nickname && <span className="error">{errors.nickname}</span>}
            </div>

            <div className="field">
              <div className="field-head">
                <span className="code">F-02</span>
                <label className="title" htmlFor="codename">
                  요원의 코드네임
                </label>
                <span className="req">필수</span>
              </div>
              <p className="hint">
                단서에서 찾아낸 코드네임을 입력해주세요. <b>영문 {CODENAME_LENGTH}자</b>만 입력
                가능합니다. 정답은 이 화면에서 알려드리지 않습니다.
              </p>

              <div
                className={`lock${lockFocused ? " focused" : ""}${complete ? " complete" : ""}${
                  errors.codename ? " invalid" : ""
                }`}
                onClick={() => codenameRef.current?.focus()}
                role="presentation"
              >
                <div className="cells" aria-hidden="true">
                  {cells}
                </div>
                <input
                  type="text"
                  id="codename"
                  ref={codenameRef}
                  className="lock-input"
                  value={codename}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={CODENAME_LENGTH}
                  inputMode="text"
                  aria-label={`요원의 코드네임 입력 — 영문 ${CODENAME_LENGTH}자`}
                  aria-invalid={errors.codename ? "true" : "false"}
                  onChange={(e) => onCodenameInput(e.target.value)}
                  onFocus={() => {
                    setLockFocused(true);
                    getAudio().tension(true);
                    if (!said.current.codename) {
                      said.current.codename = true;
                      say(COMMS.codenameFocus, true);
                    }
                  }}
                  onBlur={() => {
                    setLockFocused(false);
                    getAudio().tension(false);
                  }}
                />
              </div>
              <p className="lock-foot">
                {complete
                  ? `LOCK 829b — ${CODENAME_LENGTH}자리 입력 완료`
                  : `LOCK 829b — ${CODENAME_LENGTH}자리 · ${codename.length} / ${CODENAME_LENGTH}`}
              </p>
              {errors.codename && <span className="error">{errors.codename}</span>}

              <details className="hints">
                <summary>막혔나요? 관제소 자료 열람</summary>
                <div className="hints-body">
                  <p className="memo">힌트는 순서대로만 열립니다. 열어봐도 추첨엔 지장 없어요 — 관제소</p>
                  {HINTS.map((text, index) => {
                    const opened = index < openedHints;
                    const unlocked = index === openedHints;
                    return (
                      <div className="hint-row" key={index}>
                        <span className="no">H-0{index + 1}</span>
                        <span className={`text${opened ? "" : " locked"}`}>
                          {opened ? text : HINT_MASKS[index]}
                        </span>
                        {!opened && (
                          <button type="button" disabled={!unlocked} onClick={() => openHint(index)}>
                            {unlocked ? "열람" : "잠김"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>

            <div className="field">
              <div className="field-head">
                <span className="code">F-03</span>
                <label className="title" htmlFor="phone">
                  연락처
                </label>
                <span className="req">필수</span>
              </div>
              <p className="hint">
                당첨 안내용입니다. 비하인드 카드 수령 시 <b>휴대폰 뒷자리</b> 확인용으로 사용될 수
                있습니다.
              </p>
              <input
                type="tel"
                id="phone"
                ref={phoneRef}
                value={phone}
                placeholder="010-0000-0000"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={13}
                aria-invalid={errors.phone ? "true" : "false"}
                onChange={(e) => {
                  setPhone(formatPhone(e.target.value));
                  setError("phone", "");
                }}
              />
              {errors.phone && <span className="error">{errors.phone}</span>}
            </div>

            <div className="consent">
              <div className="consent-terms">
                <h2>개인정보 수집 · 이용 안내</h2>
                <dl>
                  <dt>수집 항목</dt>
                  <dd>오방카페 닉네임, 제출 답안, 연락처</dd>
                  <dt>이용 목적</dt>
                  <dd>당첨자 추첨과 개별 안내, 현장 비하인드 카드 지급 시 본인 확인</dd>
                  <dt>보유 기간</dt>
                  <dd>이벤트 경품 지급 완료 후 30일 이내 파기</dd>
                </dl>
                <p className="note">동의를 거부할 수 있으며, 이 경우 이벤트 참여가 어렵습니다.</p>
              </div>
              <label className="agree" htmlFor="consent">
                <input
                  type="checkbox"
                  id="consent"
                  ref={consentRef}
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setError("consent", "");
                    if (e.target.checked && !said.current.consent) {
                      said.current.consent = true;
                      say(COMMS.consent);
                    }
                  }}
                />
                <span>
                  위 내용을 확인했고, 개인정보 수집과 이용에 동의합니다.{" "}
                  <span className="req">필수</span>
                </span>
              </label>
            </div>
            {errors.consent && (
              <span className="error" style={{ marginTop: 8 }}>
                {errors.consent}
              </span>
            )}

            <button className="submit" type="submit" disabled={checking}>
              {checking ? "대조 중…" : "기록 봉인하기"}
            </button>
            {formError && <span className="error">{formError}</span>}
            <p className="fine">
              {round.always
                ? "추첨은 종료되었지만, 카드 수령을 위해 답안 제출은 그대로 진행해주세요."
                : "봉인 후 오방카페 게시글에 인증 댓글까지 남겨야 응모가 완료됩니다."}
            </p>
          </form>
        )}

        {phase === "sealing" && (
          <section className="sealing" aria-live="polite">
            <div
              className={`sealstamp${stamped ? " pressed" : ""}`}
              role="img"
              aria-label="기록 봉인 중"
            >
              封
            </div>
            <ol className="seal-steps">
              <li className={steps[0]}>신원 대조 중…</li>
              <li className={steps[1]}>기록 보관소 개방…</li>
              <li className={steps[2]}>봉인 — FILE 829b-J</li>
            </ol>
          </section>
        )}

        {phase === "receipt" && (
          <section className="receipt" ref={receiptRef} tabIndex={-1}>
            <span className="wax">
              <span className="glyph">封</span>
              829b-J
            </span>
            <h2>{replaced ? "기록을 교체했습니다" : "기록을 받았습니다"}</h2>
            <p className="said">
              {replaced
                ? "이전 기록은 폐기하고 이번 것으로 다시 봉인했습니다."
                : round.always
                  ? "봉인 완료. 초청권 추첨은 끝났고, 이 기록은 카드 수령 확인용으로 보관됩니다."
                  : "봉인 완료. 기록은 관제소로 넘어갔습니다."}
            </p>

            <div className="next">
              <h3>마지막 한 가지</h3>
              <p>
                오방카페 이벤트 게시글에 아래 문구를 댓글로 남겨주세요. 댓글까지 해야 추첨 대상이
                됩니다.
              </p>
              <div className="phrase">
                <code>{CERT_PHRASE}</code>
                <button
                  type="button"
                  className={`copy${copied ? " copied" : ""}`}
                  onClick={onCopy}
                >
                  {copied ? "복사했어요" : "문구 복사"}
                </button>
              </div>
            </div>

            <div className="locked-card">
              <span className="tape" aria-hidden="true" />
              <div
                className={`card-back${cardShake ? " shake" : ""}`}
                role="button"
                tabIndex={0}
                aria-label="잠긴 비하인드 스토리 카드"
                onClick={denyCard}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    denyCard();
                  }
                }}
              >
                🔒
              </div>
              <div className="meta">
                <h4>요원 J 비하인드 스토리 카드</h4>
                <p>{cardNote}</p>
              </div>
            </div>

            <ul className="after">
              <li>다른 참여자를 위해 정답과 풀이 방법은 댓글에 적지 말아주세요.</li>
              <li>당첨자는 게시글 공지와 개별 연락으로 안내드립니다.</li>
              <li>카드는 정답자 본인에게 1회, 1장 제공됩니다.</li>
            </ul>
          </section>
        )}

        <footer>
          <p className="sign">오늘도 잠복 중 — 관제소</p>
          <p className="org">WOULD YOU ESCAPE × 오방카페</p>
        </footer>
      </main>

      {dupAt !== null && (
        <div
          className="veil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDupAt(null);
          }}
          role="presentation"
        >
          <div className="confirm-card dup" role="dialog" aria-modal="true" aria-labelledby="dupTitle">
            <span className="stamp warn-stamp">DUPLICATE RECORD · 829b-J</span>
            <h2 id="dupTitle">자네, 이미 기록을 봉인했군</h2>
            <p className="warn">
              같은 연락처로 접수된 기록이 남아 있다. 이번에 적은 내용으로 바꿀 텐가?
            </p>
            <dl className="summary">
              <dt>기존 기록</dt>
              <dd className="mono">{MASKED}</dd>
              <dt>봉인 시각</dt>
              <dd>{dupAt ? stampText(dupAt) : "—"}</dd>
              <dt>이번 기록</dt>
              <dd className="mono new">{codename}</dd>
            </dl>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn-back"
                ref={dupKeepRef}
                onClick={() => {
                  setDupAt(null);
                  say(COMMS.keepOld);
                }}
              >
                그대로 두기
              </button>
              <button type="button" className="btn-seal" onClick={() => runSeal(true)}>
                이번 것으로 교체
              </button>
            </div>
            <p className="dup-note">이전에 적어 낸 답안은 보안상 보여드리지 않습니다.</p>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          className="veil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
          role="presentation"
        >
          <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
            <span className="stamp">FINAL CHECK</span>
            <h2 id="confirmTitle">봉인하면 그대로 넘어갑니다</h2>
            <p className="warn">전송된 기록은 이 화면에서 고칠 수 없어요. 한 번만 더 봐주세요.</p>
            <dl className="summary">
              <dt>닉네임</dt>
              <dd>{nickname.trim()}</dd>
              <dt>코드네임</dt>
              <dd className="mono">{codename}</dd>
              <dt>연락처</dt>
              <dd>{phone}</dd>
            </dl>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn-back"
                onClick={() => {
                  setConfirmOpen(false);
                  codenameRef.current?.focus();
                }}
              >
                다시 확인
              </button>
              <button type="button" className="btn-seal" ref={sealBtnRef} onClick={() => runSeal(false)}>
                봉인하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
