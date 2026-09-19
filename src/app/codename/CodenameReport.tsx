"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudio } from "./audio";
import { checkExistingCodename, revealHint, submitCodename } from "./actions";
import { CERT_PHRASE, CODENAME_LENGTH, COMMS, HINT_MASKS, type Round } from "./content";

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
  // 열어 본 힌트 원문. 서버에서 한 줄씩 받아 채운다(hints.ts 참고).
  const [hintTexts, setHintTexts] = useState<string[]>([]);
  const [hintPending, setHintPending] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dupAt, setDupAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [steps, setSteps] = useState<[StepState, StepState, StepState]>(["", "", ""]);
  const [stamped, setStamped] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [filedAt, setFiledAt] = useState("");
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

  async function openHint(index: number) {
    if (index !== openedHints || hintPending) return;

    // 원문은 서버에 있다. 받아오기 전에는 칸을 열지 않는다 — 열어 놓고 빈 줄을
    // 보여 주면 잠금이 풀린 것처럼 보이면서 내용이 없다.
    setHintPending(true);
    const text = await revealHint(index);
    if (!alive.current) return;
    setHintPending(false);
    if (text === null) return;

    setHintTexts((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
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
      const now = new Date();
      setFiledAt(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-` +
          `${String(now.getDate()).padStart(2, "0")} ` +
          `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      );
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
      {gateOpen && (
        <div
          className={`cn-gate${gateOut ? " out" : ""}`}
          onClick={closeGate}
          role="presentation"
        >
          <div className="gate-inner">
            <p className="line">WYE-829b / IDENTITY REPORT TERMINAL</p>
            <p className="stamped">ACCESS GRANTED</p>
            <button type="button" className="skip" onClick={closeGate}>
              들어가기
            </button>
          </div>
        </div>
      )}

      <div className="sheet-holder">
        <div className="clip" aria-hidden="true" />
        {/* 서류철 옆에 붙은 색인 탭 */}
        <div className="side-tabs" aria-hidden="true">
          <span>SUBJECT</span>
          <span>NOTES</span>
          <span>RECORD</span>
        </div>

        <main className="wrap">
          <div className="channel">
            {/* 서류 위쪽 관인란 — 장식용 라벨이라 읽어 줄 필요가 없다 */}
            <span className="division" aria-hidden="true">
              <b>WYE ARCHIVE DIVISION</b>
              INTERNAL CASE SYSTEM
            </span>
            <span className="tab">CASE FILE</span>
            <span className="fileno">No. 829b-J</span>
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
            <p className="stamp">
              CONFIDENTIAL
              <small>FILE 829b-J</small>
            </p>
            {/* 제목 위 타자기 라벨. 장식이라 읽어 줄 필요가 없다 */}
            <p className="file-kind" aria-hidden="true">
              INVESTIGATION FILE
            </p>
            <h1>
              수상한 요원의
              <br />
              신원을 <span className="bloom">보고</span>하라
            </h1>
            <div className="rule-double" aria-hidden="true" />
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

          <div className="filemeta">
            <dl className="meta-rows">
              <div>
                <dt>STATUS</dt>
                <dd>{round.name}</dd>
              </div>
              <div>
                <dt>FILED</dt>
                <dd className="plain">{round.dates}</dd>
              </div>
            </dl>
            {dday !== null && (
              <div className="access-box">
                <span className="label">DEADLINE</span>
                <span className="value">{dday <= 0 ? "오늘 마감" : `D-${dday}`}</span>
              </div>
            )}
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
                    {HINT_MASKS.map((mask, index) => {
                      const opened = index < openedHints;
                      const unlocked = index === openedHints;
                      return (
                        <div className="hint-row" key={index}>
                          <span className="no">H-0{index + 1}</span>
                          <span className={`text${opened ? "" : " locked"}`}>
                            {opened ? hintTexts[index] : mask}
                          </span>
                          {!opened && (
                            <button
                              type="button"
                              disabled={!unlocked || hintPending}
                              onClick={() => openHint(index)}
                            >
                              {unlocked ? (hintPending ? "여는 중…" : "열람") : "잠김"}
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
              {/* 서류에 그려 넣은 판화풍 자물쇠 — 몸통 위 이음선과 네 귀퉁이 리벳까지 */}
              <svg
                className={`padlock${stamped ? " open" : ""}`}
                viewBox="0 0 72 96"
                role="img"
                aria-label="기록 봉인 중"
              >
                <path className="shackle" d="M23 46 V30 a13 13 0 0 1 26 0 v16" />
                <rect className="body" x="9" y="44" width="54" height="46" rx="5" />
                <path className="seam" d="M9 54 H63" />
                <circle className="rivet" cx="15.5" cy="49" r="1.5" />
                <circle className="rivet" cx="56.5" cy="49" r="1.5" />
                <circle className="rivet" cx="15.5" cy="85" r="1.5" />
                <circle className="rivet" cx="56.5" cy="85" r="1.5" />
                <circle className="keyhole" cx="36" cy="66" r="5" />
                <path className="keyhole" d="M33.4 70 h5.2 l1.5 11 h-8.2 z" />
              </svg>
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
                SEALED
                <br />
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

              {/* 노끈으로 묶어 매단 증거 태그 */}
              <div className="evidence">
                {/* 노끈 두 겹 — 아래는 심, 위는 끊어 그려 꼬인 결을 낸다 */}
                <svg className="tag-string" viewBox="0 0 150 60" aria-hidden="true">
                  <path className="core" d="M3 5 C 24 24, 41 7, 55 21 S 69 45, 74 55" />
                  <path className="twist" d="M3 5 C 24 24, 41 7, 55 21 S 69 45, 74 55" />
                </svg>
                <div className="evidence-tag">
                  <span className="hole" aria-hidden="true" />
                  <div className="tag-body">
                    <span className="tag-label">EVIDENCE TAG</span>
                    <b className="tag-no">829b-J</b>
                    <span className="tag-meta">FILED {filedAt}</span>
                    <span className="tag-meta">BY 관제소</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <footer>
            {/* 요원에게 꽃 이름을 붙이는 조직이라 직인 가운데에 꽃을 새겼다 */}
            <svg className="office-seal" viewBox="0 0 80 80" aria-hidden="true">
              <circle className="ring" cx="40" cy="36" r="30" />
              <circle className="ring-in" cx="40" cy="36" r="25" />
              {[0, 72, 144, 216, 288].map((deg) => (
                <ellipse
                  key={deg}
                  className="petal"
                  cx="40"
                  cy="29"
                  rx="3.6"
                  ry="6.4"
                  transform={`rotate(${deg} 40 36)`}
                />
              ))}
              <circle className="core" cx="40" cy="36" r="2" />
              <text x="40" y="76" textAnchor="middle">829b</text>
            </svg>
            <p className="sign">오늘도 잠복 중 — 관제소</p>
            <p className="org">WOULD YOU ESCAPE × 오방카페</p>
          </footer>
        </main>
      </div>

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
