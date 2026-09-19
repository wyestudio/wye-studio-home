/**
 * /codename 전용 효과음·배경음 (Web Audio 합성, 기본 OFF).
 *
 * 5음 음계(계면조 느낌) 오스티나토 + 가야금 뜯는 소리 + 장구 테 + 대금 한 음.
 * BPM / MIX 두 값만 바꾸면 전체 분위기가 움직인다.
 *
 * ⚠️ 지금 화면에는 사운드 토글 버튼이 **숨겨져 있다**(codename.css 의 .sound-toggle).
 *    소리를 켤 방법이 없으니 아무 소리도 나지 않지만, 나중에 버튼만 다시 보이면
 *    그대로 동작하도록 배선은 살려 둔다. 지우지 말 것.
 */

type AudioApi = {
  readonly enabled: boolean;
  toggle: (next: boolean) => void;
  /** 코드네임 칸에 들어갔을 때 — 살짝 조여지는 느낌 */
  tension: (active: boolean) => void;
  /** 봉인 시퀀스 — 몰아침 */
  swell: () => void;
  /** 봉인 완료 — 해소 */
  resolve: () => void;
  click: () => void;
  clack: () => void;
  unlock: () => void;
  stamp: () => void;
  deny: () => void;
};

export function createAudio(): AudioApi {
  const AC: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  const MIX = 0.8;
  const BPM = 84;
  const STEP = 60 / BPM / 2; // 8분음표

  // 5음 음계(D-F-G-A-C) 위의 4마디. 서양 7음계를 피해 동양적인 색을 낸다.
  const BARS = [
    { bass: [73.42, 73.42, 98, 73.42, 110, 98, 73.42, 87.31], chord: [146.83, 220, 261.63, 329.63] },
    { bass: [73.42, 73.42, 98, 73.42, 110, 98, 73.42, 87.31], chord: [146.83, 220, 261.63, 329.63] },
    { bass: [87.31, 87.31, 110, 87.31, 130.81, 110, 87.31, 98], chord: [174.61, 261.63, 329.63, 392] },
    { bass: [98, 98, 110, 98, 146.83, 110, 98, 87.31], chord: [196, 293.66, 349.23, 440] },
  ];
  const MELODY = [293.66, 349.23, 392, 440, 523.25];

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let space: DelayNode | null = null;
  let chordFilter: BiquadFilterNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextTime = 0;
  let step = 0;
  let on = false;
  let built = false;
  let mode: "groove" | "drive" | "calm" = "groove";
  let tense = false;

  function build() {
    if (built || !ctx) return;
    built = true;

    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(master);

    space = ctx.createDelay(1.6);
    space.delayTime.value = 3 * STEP;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    space.connect(feedback);
    feedback.connect(space);
    space.connect(wet);
    wet.connect(musicGain);

    chordFilter = ctx.createBiquadFilter();
    chordFilter.type = "lowpass";
    chordFilter.frequency.value = 1500;
    chordFilter.Q.value = 0.9;
    chordFilter.connect(musicGain);
    chordFilter.connect(space);

    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
  }

  function envelope(target: AudioNode, at: number, peak: number, attack: number, release: number) {
    const amp = ctx!.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(peak, at + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + release);
    amp.connect(target);
    return amp;
  }

  /** 가야금 — 뜯고 바로 떨어지는 소리 */
  function pluck(freq: number, at: number, peak: number, length: number) {
    if (!ctx || !musicGain) return;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, at);
    const amp = envelope(musicGain, at, peak, 0.008, length);
    osc.connect(amp);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  /** 대금 — 길게 끄는 한 음 */
  function flute(freq: number, at: number, peak: number, length: number, dry?: boolean) {
    if (!ctx || !musicGain || !chordFilter) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    // 살짝 흔들어 준다 — 대금의 요성(떨기)
    osc.frequency.linearRampToValueAtTime(freq * 1.006, at + length * 0.6);
    const amp = envelope(dry ? musicGain : chordFilter, at, peak, 0.06, length);
    osc.connect(amp);
    osc.start(at);
    osc.stop(at + length + 0.06);
  }

  /** 장구 채편 — 짧은 잡음 */
  function brush(at: number, peak: number, open: boolean) {
    if (!ctx || !musicGain || !noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = open ? 4200 : 6400;
    const amp = envelope(musicGain, at, peak, 0.004, open ? 0.18 : 0.05);
    source.connect(filter);
    filter.connect(amp);
    source.start(at);
    source.stop(at + 0.3);
  }

  /** 장구 궁편 — 낮게 떨어지는 소리 */
  function drum(at: number, peak: number) {
    if (!ctx || !musicGain) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, at);
    osc.frequency.exponentialRampToValueAtTime(74, at + 0.08);
    const amp = envelope(musicGain, at, peak, 0.004, 0.13);
    osc.connect(amp);
    osc.start(at);
    osc.stop(at + 0.2);
  }

  function playStep(index: number, time: number) {
    const bar = BARS[Math.floor(index / 8) % 4];
    const pos = index % 8;
    const at = time;

    if (mode !== "calm") {
      const accent = pos === 0 || pos === 4;
      pluck(bar.bass[pos], at, accent ? 0.095 : 0.055, mode === "drive" ? 0.26 : 0.2);
      brush(at, pos % 2 ? 0.014 : 0.008, pos === 6);
      if (pos === 0 || pos === 5) drum(at, pos === 0 ? 0.05 : 0.03);
      if (mode === "drive" && (pos === 0 || pos === 4)) pluck(bar.bass[pos] / 2, at, 0.07, 0.45);
    }

    if (pos === 0) {
      bar.chord.forEach((freq, i) => {
        flute(freq, at + i * 0.05, mode === "calm" ? 0.05 : 0.034, mode === "calm" ? 3 : 1.8);
      });
    }

    if (pos === 5 && Math.random() < (mode === "calm" ? 0.5 : 0.3)) {
      flute(MELODY[Math.floor(Math.random() * MELODY.length)], at, 0.042, 2.2);
    }

    if (tense && pos === 4) brush(at, 0.018, true);
  }

  function scheduler() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.2) {
      playStep(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % 32;
    }
    timer = setTimeout(scheduler, 45);
  }

  function ensure() {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    build();
    return ctx;
  }

  function ramp(param: AudioParam, value: number, seconds: number) {
    if (!ctx) return;
    param.cancelScheduledValues(ctx.currentTime);
    param.setValueAtTime(Math.max(param.value, 0.0001), ctx.currentTime);
    param.exponentialRampToValueAtTime(Math.max(value, 0.0001), ctx.currentTime + seconds);
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (!on || !ctx || !sfxGain) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const amp = envelope(sfxGain, ctx.currentTime, gain, 0.006, dur);
    osc.connect(amp);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  return {
    get enabled() {
      return on;
    },
    toggle(next: boolean) {
      on = next;
      if (on) {
        if (!ensure() || !ctx || !master) return;
        mode = "groove";
        step = 0;
        nextTime = ctx.currentTime + 0.08;
        if (timer) clearTimeout(timer);
        scheduler();
        ramp(master.gain, MIX, 1.8);
      } else if (ctx && master) {
        if (timer) clearTimeout(timer);
        ramp(master.gain, 0.0001, 0.6);
        setTimeout(() => {
          if (!on && ctx) void ctx.suspend();
        }, 800);
      }
    },
    tension(active: boolean) {
      tense = active;
      if (!on || !chordFilter) return;
      ramp(chordFilter.frequency, active ? 2600 : 1500, 1.2);
    },
    swell() {
      if (!on || !ctx || !musicGain || !chordFilter) return;
      mode = "drive";
      ramp(musicGain.gain, 1.35, 1.6);
      ramp(chordFilter.frequency, 3200, 1.6);
    },
    resolve() {
      if (!on || !ctx || !musicGain || !chordFilter) return;
      mode = "calm";
      ramp(musicGain.gain, 1, 2.6);
      ramp(chordFilter.frequency, 1400, 2.6);
      [146.83, 220, 293.66, 392, 523.25].forEach((freq, i) => {
        flute(freq, ctx!.currentTime + 0.05 + i * 0.16, 0.05, 3.8);
      });
    },
    click() {
      tone(1046.5, 0.05, "triangle", 0.028);
    },
    clack() {
      tone(392, 0.07, "triangle", 0.05);
    },
    unlock() {
      tone(392, 0.12, "sine", 0.055);
      setTimeout(() => tone(587.33, 0.22, "sine", 0.045), 110);
    },
    stamp() {
      tone(98, 0.22, "sawtooth", 0.06);
    },
    deny() {
      tone(138.59, 0.16, "square", 0.042);
    },
  };
}
