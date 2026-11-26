import type { Kind } from "./xmasGameArt";

/**
 * 「산타의 어드벤트 캘린더」 소리 — 배경 음악(징글벨)과 효과음. 전부 Web Audio 로 그 자리에서 만든다
 * (내려받는 소리 파일이 없다).
 *
 * 배경 음악 · 산타 부저는 승인 시안(2026-11-26) 그대로다. 맞힌 소리만 바꿨다:
 *   눈사람 · 루돌프가 같은 소리를 내고, 콤보가 이어질수록 한 음씩 올라가다가(다장조 음계, 한 옥타브까지)
 *   콤보가 끊기면 원래 음으로 돌아온다.
 *
 * ⚠️ 브라우저는 손님이 누르기 전에는 소리를 못 낸다. start() 는 누른 직후(확인 · 이어하기)에만 부른다.
 */

const MUTE_KEY = "wye.advent.muted";

// 징글벨(다장조). 0 은 앞 음을 8분음표 하나 더 끈다.
const VERSE = [
  [67, 0, 76, 0, 74, 0, 72, 0], [67, 0, 0, 0, 0, 0, 67, 67],
  [67, 0, 76, 0, 74, 0, 72, 0], [69, 0, 0, 0, 0, 0, 0, 69],
  [69, 0, 77, 0, 76, 0, 74, 0], [71, 0, 0, 0, 0, 0, 0, 71],
  [79, 0, 79, 0, 77, 0, 74, 0], [76, 0, 0, 0, 0, 0, 0, 67],
  [67, 0, 76, 0, 74, 0, 72, 0], [67, 0, 0, 0, 0, 0, 67, 67],
  [67, 0, 76, 0, 74, 0, 72, 0], [69, 0, 0, 0, 0, 0, 0, 69],
  [69, 0, 77, 0, 76, 0, 74, 0], [79, 0, 79, 0, 79, 0, 79, 0],
  [81, 0, 79, 0, 77, 0, 74, 0], [72, 0, 0, 0, 79, 0, 0, 0],
];
const BELLS = [
  [76, 0, 76, 0, 76, 0, 0, 0], [76, 0, 76, 0, 76, 0, 0, 0],
  [76, 0, 79, 0, 72, 0, 74, 0], [76, 0, 0, 0, 0, 0, 0, 0],
  [77, 0, 77, 0, 77, 0, 77, 0], [77, 0, 76, 0, 76, 0, 76, 76],
];
const CHORUS = [
  ...BELLS, [76, 0, 74, 0, 74, 0, 76, 0], [74, 0, 0, 0, 79, 0, 0, 0],
  ...BELLS, [79, 0, 79, 0, 77, 0, 74, 0], [72, 0, 0, 0, 0, 0, 0, 0],
];
const MELODY = [...VERSE, ...CHORUS];
const C = [48, 64, 67];
const F = [53, 65, 69];
const G = [43, 62, 67];
const Dm = [50, 65, 69];
const CHORDS = [C, C, C, F, Dm, G, G, C, C, C, C, F, Dm, G, G, C, C, C, C, C, F, C, G, G, C, C, C, C, F, C, G, C];
const EIGHTH = 0.145;

/** 맞힌 소리의 기본 음(두 음). 눈사람 · 루돌프가 같은 소리다 — 달라야 할 것은 콤보에 따른 높이뿐이다(2026-11-26 대표님). */
const HIT_NOTES = [86, 93];
/** 콤보로 올라가는 한계 — 음계 7칸(한 옥타브). 더 올리면 귀가 따갑다. */
const MAX_COMBO_STEPS = 7;
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** 다장조 음계 위에서 steps 칸 올린 음. 배경 음악이 다장조라 반음씩 올리면 어긋나게 들린다. */
function scaleUp(pitch: number, steps: number): number {
  const degree = C_MAJOR.indexOf(((pitch % 12) + 12) % 12);
  if (degree < 0) return pitch + steps * 2;
  const total = degree + steps;
  return (Math.floor(pitch / 12) + Math.floor(total / 7)) * 12 + C_MAJOR[total % 7];
}

export type GameMusic = ReturnType<typeof createGameMusic>;

export function createGameMusic() {
  let ctx: AudioContext | null = null;
  let bus: GainNode | null = null;
  let backing: GainNode | null = null;
  let cueBus: GainNode | null = null;
  let clock: ReturnType<typeof setInterval> | undefined;
  let tick = 0;
  let nextBeat = 0;
  let playing = false;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* 저장소가 막힌 브라우저 — 소리를 켠 채로 둔다 */
  }

  function note(p: number, t: number, len: number, vol: number, wave: OscillatorType = "sine", output: AudioNode | null = backing) {
    if (!ctx || !output) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = 440 * Math.pow(2, (p - 69) / 12);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(env);
    env.connect(output);
    osc.start(t);
    osc.stop(t + len + 0.02);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  function scheduleMusic() {
    if (!ctx || !playing || muted || ctx.state !== "running") return;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.02;
    while (nextBeat < ctx.currentTime + 0.18) {
      const step = tick % 8;
      const bar = Math.floor(tick / 8) % MELODY.length;
      const pitch = MELODY[bar][step];
      const chord = CHORDS[bar];
      if (pitch) {
        let length = 1;
        while (step + length < 8 && !MELODY[bar][step + length]) length++;
        note(pitch, nextBeat, length * EIGHTH + 0.055, 0.067);
        note(pitch + 12, nextBeat, 0.13, 0.017);
      }
      if (step === 0 || step === 4) note(chord[0] + (step === 4 ? 7 : 0), nextBeat, 0.29, 0.085, "triangle");
      if (step === 2 || step === 6) {
        note(chord[1], nextBeat, 0.16, 0.028, "triangle");
        note(chord[2], nextBeat, 0.17, 0.023);
      }
      nextBeat += EIGHTH;
      tick++;
    }
  }

  function stop() {
    playing = false;
    clearInterval(clock);
    if (!ctx) return;
    if (cueBus) cueBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01);
    if (bus) bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.015);
  }

  function start() {
    if (muted || document.hidden) return;
    try {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!ctx) {
        ctx = new Ctor();
        bus = ctx.createGain();
        bus.connect(ctx.destination);
        backing = ctx.createGain();
        backing.connect(bus);
      }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      bus!.gain.setTargetAtTime(0.85, ctx.currentTime, 0.015);
      if (!playing) {
        playing = true;
        nextBeat = ctx.currentTime + 0.04;
        scheduleMusic();
        clock = setInterval(scheduleMusic, 90);
      }
    } catch {
      stop();
    }
  }

  /** 캐릭터를 눌렀을 때. combo 는 이번에 맞혀서 된 콤보 수(산타는 0). */
  function hit(kind: Kind, combo: number) {
    if (muted || !playing || !ctx || !bus || !backing || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.006;
    if (kind === "santa") {
      const gain = backing.gain;
      gain.cancelScheduledValues(t);
      gain.setTargetAtTime(0.28, t, 0.008);
      gain.setTargetAtTime(1, t + 0.32, 0.06);
      // 짧은 경고음 뒤에 길게 떨어지는 오락실 부저
      for (const [delay, high, low, duration] of [
        [0, 1240, 950, 0.082],
        [0.112, 900, 390, 0.21],
      ]) {
        const begin = t + delay;
        const end = begin + duration;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.28, 0.16])));
        osc.frequency.setValueAtTime(high, begin);
        osc.frequency.exponentialRampToValueAtTime(low, end);
        env.gain.setValueAtTime(0.0001, begin);
        env.gain.linearRampToValueAtTime(0.34, begin + 0.005);
        env.gain.setValueAtTime(0.28, end - 0.035);
        env.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(env);
        env.connect(bus);
        osc.start(begin);
        osc.stop(end + 0.01);
        osc.onended = () => {
          osc.disconnect();
          env.disconnect();
        };
      }
      return;
    }
    const steps = Math.min(Math.max(combo - 1, 0), MAX_COMBO_STEPS);
    HIT_NOTES.forEach((p, i) => note(scaleUp(p, steps), t + i * 0.052, 0.21, i === 0 ? 0.16 : 0.13, "sine", bus));
  }

  /**
   * 실로폰(글로켄슈필) 한 음 — 기본음에 배음 셋을 얹고 배음일수록 빨리 꺼지게 해서 금속 건반 소리를 낸다.
   * 사인파 하나(note)는 전화 신호음처럼 들린다. 축하 소리는 이걸로 친다.
   */
  function chime(p: number, t: number, len: number, vol: number, output: AudioNode) {
    for (const [ratio, gain, decay] of [
      [1, 1, 1],
      [2, 0.42, 0.55],
      [3, 0.2, 0.32],
      [4.2, 0.1, 0.2],
    ]) {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.value = 440 * Math.pow(2, (p - 69) / 12) * ratio;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(vol * gain, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len * decay);
      osc.connect(env);
      env.connect(output);
      osc.start(t);
      osc.stop(t + len * decay + 0.02);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
    }
  }

  /** 썰매 방울 한 번 — 높은 잡음을 짧게 두 번 턴다. */
  function jingle(t: number, vol: number, output: AudioNode) {
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    for (const delay of [0, 0.045]) {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      src.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = 7200;
      filter.Q.value = 2.4;
      env.gain.setValueAtTime(0.0001, t + delay);
      env.gain.exponentialRampToValueAtTime(vol, t + delay + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.075);
      src.connect(filter);
      filter.connect(env);
      env.connect(output);
      src.start(t + delay);
      src.stop(t + delay + 0.09);
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        env.disconnect();
      };
    }
  }

  /**
   * 라운드 밖에서 한 번 울리는 소리.
   *   fill   게이지가 차오른다
   *   result 결과가 떴다(실패 · 정답 화면 · 이어하기 종료)
   *   pass   이어하기에서 한 라운드를 통과했다 — "N라운드 통과!" 와 같이 울린다
   *   win    정답을 맞혔다 — 실로폰이 위로 뛰어올라 화음으로 울리고, 썰매 방울과 반짝이는 높은 음이 따라온다
   *          (2026-11-26 대표님: 결과음과 같은 삑 소리 말고 게임의 축하 소리로).
   */
  function cue(kind: "fill" | "result" | "win" | "pass") {
    if (muted || !ctx || ctx.state !== "running" || document.hidden) return;
    if (cueBus) cueBus.disconnect();
    const out = (cueBus = ctx.createGain());
    out.connect(ctx.destination);
    const t = ctx.currentTime + 0.008;
    if (kind === "fill") {
      [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84].forEach((p, i) => note(p, t + i * 0.085, 0.16, 0.105 + i * 0.004, "sine", out));
    } else if (kind === "pass") {
      // 실로폰 세 음이 짧게 올라간다 — 배경 음악 위에 얹히는 소리라 작고 짧게
      [84, 88, 91].forEach((p, i) => chime(p, t + i * 0.07, 0.45, 0.12, out));
    } else if (kind === "win") {
      // 솔-도-미-솔로 뛰어올라
      [79, 84, 88, 91].forEach((p, i) => chime(p, t + i * 0.085, 0.5, 0.16, out));
      // 높은 도에서 화음으로 울린다(아래에 낮은 도를 받쳐 준다)
      [84, 88, 91, 96].forEach((p) => chime(p, t + 0.36, 1.5, 0.13, out));
      note(60, t + 0.36, 0.9, 0.09, "triangle", out);
      // 방울 네 번
      [0.36, 0.56, 0.76, 0.96].forEach((d, i) => jingle(t + d, 0.11 - i * 0.015, out));
      // 반짝이는 높은 음이 흩어진다
      [100, 103, 96, 105, 100, 108].forEach((p, i) => chime(p, t + 0.62 + i * 0.075, 0.32, 0.05, out));
    } else {
      [72, 76, 79].forEach((p, i) => note(p, t + i * 0.065, 0.16, 0.14, "triangle", out));
      [72, 76, 79, 84].forEach((p) => note(p, t + 0.22, 0.48, 0.082, "sine", out));
    }
  }

  return {
    start,
    stop,
    hit,
    cue,
    /** 처음부터 다시 — 새 판을 시작할 때. */
    rewind() {
      stop();
      tick = 0;
    },
    isMuted: () => muted,
    setMuted(next: boolean) {
      muted = next;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {
        /* 저장 못 해도 이번 판에는 적용된다 */
      }
      if (muted) stop();
    },
    /** 창을 닫을 때 — 소리 장치를 놓아준다. */
    close() {
      stop();
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
