import { buildTileableTexture, loadPlanetImage, PERIOD_SEC, SphereRenderer } from "@/lib/planetSurface";

/**
 * 홈 Planets to Escape 의 3D 장면 — 캔버스 하나에 행성 · 위성 · 항로 · 별을 원근으로 그린다.
 *
 * React 바깥의 평범한 클래스다. 매 프레임 바뀌는 값(카메라 · 시간)을 React 상태로 두면
 * 초당 60번 다시 그리게 되므로, 화면(PlanetSystem.tsx)은 이 객체에 명령만 넘기고
 * 선택 · 위성 같은 "사건" 만 콜백으로 돌려받는다.
 *
 * 좌표계: x 오른쪽, y 아래, z 화면 안쪽(멀어질수록 +). 카메라는 기준점(pivot) 둘레를
 * yaw(좌우) · pitch(상하)로 돌고, 원근은 FOCAL / (z + DIST) 로 준다.
 *
 * ⚠️ 서버를 부르지 않는다. 손님 브라우저에서만 돈다(wye-server-cost 의 "움직이는 화면").
 *    대신 화면 밖 · 백그라운드 탭에서는 프레임을 아예 돌리지 않는다(start/stop).
 */

export type Vec3 = [number, number, number];

export type SceneSlot = {
  pos: Vec3;
  /** 세계 좌표 반지름 */
  r: number;
  accent: string;
  logo: string | null;
  locked: boolean;
  soon: boolean;
  orbits: { key: string; label: string; color: string }[];
};

type Callbacks = {
  /** 행성을 눌렀다(null = 빈 곳). 휴대폰에서는 그 행성으로 넘어간다. */
  onSelect: (index: number | null) => void;
  /** 위성을 눌렀다 */
  onSatellite: (index: number, key: string) => void;
  /** 위성에 커서가 올라갔다 / 내려갔다 — 패널의 같은 줄을 밝힌다 */
  onHoverSatellite: (key: string | null) => void;
  /** 휴대폰에서 좌우로 밀었다 */
  onSwipe: (dir: 1 | -1) => void;
};

type Hit = { x: number; y: number; r: number; slot: number; key?: string };

const FOCAL = 850;
const DIST = 1100;
const YAW0 = -0.12;
const PITCH0 = 0.14;
/** 휴대폰 기본 각 — 다음 행성이 없는 마지막 행성에서만 쓴다(그 밖에는 aim() 이 다음 행성 쪽을 본다) */
const MOBILE_YAW0 = -0.32;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.65;

/** 위성 궤도 — 위성마다 기울기 · 방향 · 속도가 다르다. 위성이 셋을 넘으면 되돌아 쓴다 */
const ORBIT_TILT = [0.27, -0.65, 0.95];
const ORBIT_ROT = [-0.2, 0.65, -0.8];
const ORBIT_SPEED = [0.26, -0.19, 0.14];

const STAR_COLOR = "202,217,237";

/**
 * 행성 자리. 첫 행성이 원점(= 카메라 기준점이라 화면 가운데)이고, 다음 행성들은 깊이 방향으로
 * 크게 멀어지며(1600 · 3000) 좌우로 엇갈린다. 넷째부터는 1400 씩 더 멀어진다.
 * 간격이 좁으면(예전 580) 원근으로 줄어드는 폭이 작아 "멀리 있다" 는 느낌이 약했다.
 * 멀리 갈수록 화면에서 가운데로 모이므로, 좌우 거리는 화면 안에 들어오게 함께 키운다.
 */
export function slotLayout(i: number): { pos: Vec3; r: number } {
  const preset: { pos: Vec3; r: number }[] = [
    { pos: [0, 0, 0], r: 145 },
    { pos: [700, -60, 1600], r: 82 },
    { pos: [-1050, -220, 3000], r: 76 },
  ];
  if (i < preset.length) return preset[i];
  return { pos: [i % 2 ? 900 : -600, -100 * i, 3000 + 1400 * (i - 2)], r: 70 };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

export class SpaceScene {
  private readonly ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private raf = 0;
  private running = false;
  private onScreen = false;
  private last = 0;
  private time = 0;
  private hits: Hit[] = [];
  private needsDraw = true;

  // 카메라 — 현재값과 목표값. 매 프레임 목표 쪽으로 조금씩 따라간다(부드러운 이동).
  private yaw = YAW0;
  private pitch = PITCH0;
  private zoom = 1;
  private pivot: Vec3 = [0, 0, 0];
  private cx = 0.5;
  private cy = 0.56;
  private tYaw = YAW0;
  private tPitch = PITCH0;
  private tZoom = 1;
  private tPivot: Vec3 = [0, 0, 0];
  private tCx = 0.5;
  private tCy = 0.56;
  /** 버튼 · 핀치로 사용자가 정한 배율 */
  private userZoom = 1;
  /** 페이지 스크롤 진행도(0~1) — 스크롤하면 카메라가 다가간다 */
  private scroll = 0.5;
  private tScroll = 0.5;

  private selected: number | null = null;
  private focus = 0;
  private activeKey: string | null = null;
  private hoverKey: string | null = null;
  private paused: boolean;
  private cinema = false;
  private mobile = false;

  private drag: { x: number; y: number; yaw: number; pitch: number; id: number; touch: boolean } | null = null;
  private moved = 0;

  private readonly stars: { p: Vec3; size: number; alpha: number; phase: number }[];
  private readonly textures: (HTMLCanvasElement | null)[];
  private readonly renderers: SphereRenderer[];
  private readonly font: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly slots: SceneSlot[],
    private readonly labels: () => (HTMLElement | null)[],
    private readonly cb: Callbacks,
    reduceMotion: boolean
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.paused = reduceMotion;
    this.font = getComputedStyle(document.body).fontFamily;
    this.textures = slots.map(() => null);
    this.renderers = slots.map(() => new SphereRenderer());

    // 별 — 장면 안의 별은 카메라와 함께 움직여야 깊이가 산다. 사이트 전체 별(StarfieldCanvas)은 뒤에 그대로 있다.
    this.stars = Array.from({ length: 280 }, () => ({
      p: [(Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 2500, Math.random() * 5000 - 450] as Vec3,
      size: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    slots.forEach((s, i) => {
      if (!s.logo) return;
      loadPlanetImage(s.logo)
        .then((img) => {
          this.textures[i] = buildTileableTexture(img);
          this.needsDraw = true;
        })
        .catch(() => {}); // 못 읽으면 색 구슬로 그린다
    });

    this.resize();
    this.bind();
  }

  // ── 바깥에서 부르는 명령 ──────────────────────────────

  setScroll(local: number) {
    this.tScroll = local;
  }

  setSelected(i: number | null) {
    this.selected = i;
    this.aim();
  }

  setFocus(i: number) {
    this.focus = i;
    this.aim();
  }

  setActiveKey(key: string | null) {
    this.activeKey = key;
    this.needsDraw = true;
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.needsDraw = true;
  }

  setCinema(c: boolean) {
    this.cinema = c;
    if (!c) this.aim();
  }

  zoomBy(step: number) {
    this.userZoom = clamp(this.userZoom + step, ZOOM_MIN, ZOOM_MAX);
    this.aim();
  }

  reset() {
    this.userZoom = 1;
    this.cinema = false;
    this.tYaw = this.mobile ? MOBILE_YAW0 : YAW0;
    this.tPitch = PITCH0;
    this.aim();
  }

  /** 화면에 보일 때만 돈다. PlanetSystem 이 IntersectionObserver 로 부른다. */
  setOnScreen(v: boolean) {
    this.onScreen = v;
    this.sync();
  }

  destroy() {
    this.stop();
    this.unbind();
  }

  // ── 카메라 목표 ──────────────────────────────────────

  /** 지금 상태(휴대폰 · 선택)에 맞는 카메라 목표를 다시 잡는다. */
  private aim() {
    const fit = this.fit();
    const sized = (i: number, want: number) => want / (this.slots[i].r * (FOCAL / DIST) * fit);
    if (this.mobile) {
      const i = this.focus;
      this.tPivot = [...this.slots[i].pos];
      this.tCx = 0.5;
      this.tCy = 0.38;
      // 다음 행성이 오른쪽 뒤에 살짝 보이도록 그쪽을 바라본다. 행성이 좌우로 엇갈려 있어서
      // 고정된 각도로는 한쪽 행성만 보인다. 넘길 때 카메라가 돌며 날아가는 느낌도 여기서 나온다.
      const next = this.slots[i + 1];
      if (next) {
        const dx = next.pos[0] - this.slots[i].pos[0];
        const dz = next.pos[2] - this.slots[i].pos[2];
        this.tYaw = Math.atan2(dx, dz) - 0.45;
      }
      this.tZoom = sized(i, Math.min(this.W * 0.2, this.H * 0.13)) * this.userZoom;
    } else if (this.selected !== null) {
      const i = this.selected;
      this.tPivot = [...this.slots[i].pos];
      // 패널이 오른쪽에 열리므로 행성은 왼쪽 가운데로
      this.tCx = 0.32;
      this.tCy = 0.55;
      // 바깥 위성 궤도(반지름의 약 2배)까지 화면 안에 들어오는 크기 — 더 키우면 위성 이름표가 제목에 닿는다
      this.tZoom = sized(i, Math.min(this.H * 0.15, this.W * 0.11)) * this.userZoom;
    } else {
      // 첫 행성을 화면 가운데에 둔다 — 끌어서 돌려도 그 행성을 축으로 돈다
      this.tPivot = [...this.slots[0].pos];
      this.tCx = 0.5;
      this.tCy = 0.56;
      this.tZoom = this.userZoom;
    }
    this.needsDraw = true;
  }

  private fit() {
    return this.mobile ? Math.min(this.W / 700, 1) : Math.min(this.W / 1150, 1.3);
  }

  // ── 투영 ─────────────────────────────────────────────

  private project(p: Vec3) {
    const scrollZoom = this.scrollZoom();
    // 스크롤하면 카메라가 살짝 옆으로 돈다 — 가만히 있어도 앞뒤 행성이 어긋나 깊이가 보인다
    const yaw = this.yaw + (this.mobile ? 0 : (this.scroll - 0.5) * 0.35);
    const x0 = p[0] - this.pivot[0];
    const y0 = p[1] - this.pivot[1];
    const z0 = p[2] - this.pivot[2];
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const x = x0 * cy - z0 * sy;
    const z1 = x0 * sy + z0 * cy;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const y = y0 * cp - z1 * sp;
    const z = y0 * sp + z1 * cp;
    const s = (FOCAL / Math.max(z + DIST, 60)) * this.zoom * scrollZoom * this.fit();
    return { x: this.W * this.cx + x * s, y: this.H * this.cy + y * s, s, z };
  }

  /**
   * 스크롤 진행도 → 카메라 거리. SceneShell 의 rise 구간(들어옴 0.2 · 다가감 0.34 · 머묾 0.62 ·
   * 물러남 0.8)과 같은 박자다. CSS 로 확대하던 것을 원근 카메라로 바꿨다 — 글자가 흐려지지 않고
   * 앞뒤 행성이 다른 속도로 커져 깊이가 생긴다.
   */
  private scrollZoom() {
    const l = this.scroll;
    const zin = clamp01((l - 0.12) / 0.22);
    const zout = clamp01((l - 0.62) / 0.25);
    return 0.82 + 0.2 * zin * (1 - zout);
  }

  private orbitPoint(slot: SceneSlot, i: number, a: number): Vec3 {
    const r = slot.r * (1.42 + i * 0.29);
    const tilt = ORBIT_TILT[i % 3];
    const rot = ORBIT_ROT[i % 3];
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * Math.sin(tilt);
    const z = Math.sin(a) * r * Math.cos(tilt);
    const c = slot.pos;
    return [c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot), c[2] + z];
  }

  /** 행성 사이 항로 — 직선이 아니라 옆 · 위로 부푼 곡선이 깊이 방향으로 이어진다 */
  private route(a: Vec3, b: Vec3, t: number): Vec3 {
    const v = 1 - t;
    const bulge = Math.sin(t * Math.PI);
    return [v * a[0] + t * b[0] + bulge * 140, v * a[1] + t * b[1] + bulge * 95, v * a[2] + t * b[2]];
  }

  /**
   * 카메라보다 앞에 있는 행성은 흐리게 지운다. 먼 행성을 보러 들어가면 가까운 행성이 화면을
   * 통째로 덮기 때문이다(휴대폰에서 둘째 행성으로 넘어갈 때 첫째가 화면을 가렸다).
   */
  private fade(z: number) {
    return clamp01((z + 300) / 240);
  }

  // ── 루프 ─────────────────────────────────────────────

  private sync() {
    const should = this.onScreen && !document.hidden;
    if (should && !this.running) this.start();
    if (!should && this.running) this.stop();
  }

  private start() {
    this.running = true;
    this.last = 0;
    this.needsDraw = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0;
    this.last = now;

    if (!this.paused) this.time += dt;
    if (this.cinema && !this.paused) {
      this.tYaw = YAW0 + Math.sin(this.time * 0.12) * 0.34;
      this.tPitch = 0.12 + Math.sin(this.time * 0.09) * 0.14;
    }

    // 목표 쪽으로 따라가기. 움직임이 거의 없고 시간도 멈췄으면 그리지 않는다(배터리).
    const k = 1 - Math.pow(1 - 0.075, dt * 60 || 1);
    let moving = 0;
    const ease = (cur: number, to: number) => {
      const d = (to - cur) * k;
      moving += Math.abs(to - cur);
      return cur + d;
    };
    this.yaw = ease(this.yaw, this.tYaw);
    this.pitch = ease(this.pitch, this.tPitch);
    this.zoom = ease(this.zoom, this.tZoom);
    this.cx = ease(this.cx, this.tCx);
    this.cy = ease(this.cy, this.tCy);
    this.scroll = ease(this.scroll, this.tScroll);
    this.pivot = [
      ease(this.pivot[0], this.tPivot[0]),
      ease(this.pivot[1], this.tPivot[1]),
      ease(this.pivot[2], this.tPivot[2]) as number,
    ];

    if (this.paused && moving < 0.0005 && !this.needsDraw) return;
    this.needsDraw = false;
    this.draw();
  };

  // ── 그리기 ───────────────────────────────────────────

  private draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    this.hits = [];

    // 별 — 깜빡임은 아주 옅게. 크기는 거리에 따라.
    ctx.fillStyle = `rgb(${STAR_COLOR})`;
    for (const s of this.stars) {
      const q = this.project(s.p);
      if (q.z < -700) continue;
      const tw = this.paused ? 0 : Math.sin(this.time * 0.5 + s.phase) * 0.15;
      ctx.globalAlpha = clamp01(s.alpha + tw);
      const r = s.size * Math.max(0.3, q.s);
      ctx.fillRect(q.x, q.y, r, r);
    }
    ctx.globalAlpha = 1;

    // 항로 — 점선 곡선과 그 위를 흐르는 빛 하나
    for (let i = 0; i < this.slots.length - 1; i++) {
      const a = this.slots[i].pos;
      const b = this.slots[i + 1].pos;
      ctx.beginPath();
      for (let j = 0; j <= 80; j++) {
        const q = this.project(this.route(a, b, j / 80));
        if (j) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = "rgba(165,177,218,0.22)";
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      const t = (this.time * 0.045 + i * 0.31) % 1;
      const q = this.project(this.route(a, b, t));
      this.glow(q.x, q.y, 8, "rgba(197,210,255,0.55)");
      ctx.fillStyle = "#d1e6ff";
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 행성 · 궤도 조각 · 위성을 깊이순으로 — 행성 뒤를 지나는 궤도와 위성이 실제로 가려진다
    const objects: { z: number; draw: () => void }[] = [];
    this.slots.forEach((slot, i) => {
      const q = this.project(slot.pos);
      const alpha = this.fade(q.z);
      if (alpha <= 0.01) return;
      objects.push({ z: q.z, draw: () => this.drawPlanet(slot, i, q, alpha) });

      slot.orbits.forEach((o, k) => {
        const N = 72;
        for (let j = 0; j < N; j++) {
          const pa = this.orbitPoint(slot, k, (j / N) * Math.PI * 2);
          const pb = this.orbitPoint(slot, k, ((j + 1) / N) * Math.PI * 2);
          const qa = this.project(pa);
          const qb = this.project(pb);
          objects.push({
            z: (qa.z + qb.z) / 2,
            draw: () => {
              ctx.globalAlpha = alpha * (o.key === this.activeKey || o.key === this.hoverKey ? 0.55 : 0.22);
              ctx.strokeStyle = o.color;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(qa.x, qa.y);
              ctx.lineTo(qb.x, qb.y);
              ctx.stroke();
              ctx.globalAlpha = 1;
            },
          });
        }
        const ang = this.time * ORBIT_SPEED[k % 3] + k * 2.1 + 0.5;
        const qs = this.project(this.orbitPoint(slot, k, ang));
        objects.push({ z: qs.z, draw: () => this.drawSatellite(o, i, qs, alpha) });
      });
    });
    objects.sort((a, b) => b.z - a.z).forEach((o) => o.draw());

    this.placeLabels();
  }

  private glow(x: number, y: number, r: number, color: string) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  private drawPlanet(slot: SceneSlot, i: number, q: { x: number; y: number; s: number; z: number }, alpha: number) {
    const { ctx } = this;
    const r = slot.r * q.s;
    if (r < 1) return;
    ctx.globalAlpha = alpha;

    const picked = this.mobile ? i === this.focus : i === this.selected;
    this.glow(q.x, q.y, r * (picked ? 1.8 : 1.5), hexA(slot.accent, slot.locked || slot.soon ? 0.08 : picked ? 0.3 : 0.18));

    // 표면
    const tex = this.textures[i];
    if (slot.soon || !tex) {
      const g = ctx.createRadialGradient(q.x - r * 0.32, q.y - r * 0.4, 0, q.x, q.y, r);
      if (slot.soon) {
        g.addColorStop(0, "#6a6a76");
        g.addColorStop(0.62, "#3a3a44");
        g.addColorStop(1, "#22222a");
      } else {
        g.addColorStop(0, hexA(slot.accent, 0.9));
        g.addColorStop(1, "#14141c");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const angle = (this.time / PERIOD_SEC) * Math.PI * 2 * (i === 0 ? 1 : 0.7);
      const img = this.renderers[i].draw(tex, angle, r * 2 * this.dpr);
      ctx.drawImage(img, q.x - r, q.y - r, r * 2, r * 2);
    }

    // 구체 조명 — 표면과 달리 움직이지 않는다. 빛이 왼쪽 위 앞에서 고정으로 들어오고(곱하기),
    // 가장자리에 보랏빛 테두리광이 얹힌다(더하기). 두 장 다 처음 한 번만 만든다(lightSprites).
    const light = lightSprites();
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(light.shade, q.x - r, q.y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(light.rim, q.x - r, q.y - r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.clip();
    if (slot.locked) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    }
    // 먼 행성은 우주색 안개에 살짝 묻힌다 — 크기만 줄이는 것보다 거리감이 훨씬 산다
    const fog = clamp((q.z - 300) / 2600, 0, 0.5);
    if (fog > 0) {
      ctx.fillStyle = `rgba(4,7,13,${fog})`;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    }
    ctx.restore();

    // 가장자리 선 — 고른 행성은 강조색으로
    ctx.strokeStyle = picked && !slot.locked && !slot.soon ? hexA(slot.accent, 0.8) : "rgba(220,225,255,0.18)";
    ctx.lineWidth = picked ? 1.2 : 0.7;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (slot.locked) drawLock(ctx, q.x, q.y, clamp(r * 0.42, 14, 34));
    if (slot.soon) {
      ctx.fillStyle = "rgba(200,204,220,0.75)";
      ctx.font = `800 ${Math.round(clamp(r * 0.55, 12, 40))}px ${this.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", q.x, q.y + 1);
    }
    ctx.globalAlpha = 1;
    this.hits.push({ x: q.x, y: q.y, r: Math.max(r + 6, 22), slot: i });
  }

  private drawSatellite(o: { key: string; label: string; color: string }, slot: number, q: { x: number; y: number; s: number }, alpha: number) {
    const { ctx } = this;
    const on = o.key === this.activeKey || o.key === this.hoverKey;
    const r = Math.max(3.5, (on ? 8 : 6) * q.s);
    ctx.globalAlpha = alpha;
    this.glow(q.x, q.y, Math.max(14, (on ? 34 : 24) * q.s), hexA(o.color, on ? 0.6 : 0.4));
    ctx.fillStyle = o.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexA(o.color, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    // 이름 — 고른 행성의 위성이거나 넓은 화면일 때만. 작은 화면에서는 패널 줄이 대신한다.
    const show = !this.mobile || slot === this.focus;
    if (show) {
      ctx.font = `600 ${this.mobile ? 11 : 12}px ${this.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hexA(o.color, on ? 1 : 0.8);
      ctx.fillText(o.label, q.x + r + 9, q.y - 1);
    }
    ctx.globalAlpha = 1;
    // 누르는 자리는 최소 44px — 손가락으로도 잡히게
    this.hits.push({ x: q.x, y: q.y, r: 22, slot, key: o.key });
  }

  /** 행성 이름표(HTML 버튼)를 행성 옆으로 옮긴다. 키보드 · 화면낭독기는 이 버튼으로 행성을 고른다. */
  private placeLabels() {
    const els = this.labels();
    this.slots.forEach((slot, i) => {
      const el = els[i];
      if (!el) return;
      const q = this.project(slot.pos);
      const r = slot.r * q.s;
      const alpha = this.fade(q.z);
      let x = q.x + r * 0.72;
      let y = q.y + r * 0.72;
      if (i >= 2) y = q.y - r - 64; // 멀리 있는 행성은 위로 — 아래 행성 이름표와 겹치지 않게
      // 행성이 화면 밖이면 이름표도 감춘다 — 가장자리에 붙여 두면 엉뚱한 구석에 이름만 떠 있다
      const off = q.x < -40 || q.x > this.W + 40 || q.y < -40 || q.y > this.H + 40;
      x = clamp(x, 12, this.W - 190);
      y = clamp(y, 8, this.H - 80);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity = String(this.selected !== null && this.selected !== i ? alpha * 0.45 : alpha);
      el.style.visibility = alpha < 0.05 || off ? "hidden" : "visible";
    });
  }

  // ── 입력 ─────────────────────────────────────────────

  private resize = () => {
    this.W = this.host.clientWidth;
    this.H = this.host.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const mobile = this.W < 640;
    if (mobile !== this.mobile) {
      this.mobile = mobile;
      this.tYaw = mobile ? MOBILE_YAW0 : YAW0;
      this.yaw = this.tYaw;
    }
    this.aim();
    this.needsDraw = true;
  };

  private ro = new ResizeObserver(this.resize);

  private hitAt(e: PointerEvent | MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 위성이 행성보다 우선 — 행성 앞을 지나는 위성을 눌렀는데 행성이 잡히면 안 된다
    const near = this.hits.filter((h) => Math.hypot(x - h.x, y - h.y) < h.r);
    return near.find((h) => h.key) ?? near[near.length - 1] ?? null;
  }

  private onDown = (e: PointerEvent) => {
    const touch = e.pointerType !== "mouse";
    this.drag = { x: e.clientX, y: e.clientY, yaw: this.tYaw, pitch: this.tPitch, id: e.pointerId, touch };
    this.moved = 0;
    // 마우스만 붙잡는다. 손가락을 붙잡으면 세로 스크롤을 브라우저가 못 가져간다.
    if (!touch) this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      this.moved = Math.max(this.moved, Math.hypot(dx, dy));
      if (this.mobile) return; // 휴대폰은 손을 뗄 때 좌우 밀기로만 읽는다
      if (this.moved > 4) {
        this.cinema = false;
        // 먼 행성까지 화면 밖으로 너무 쉽게 빠지지 않게 좌우 폭을 좁게 둔다
        this.tYaw = clamp(d.yaw + dx * 0.002, -0.5, 0.45);
        // 손가락 드래그는 좌우만 — 위아래는 페이지 스크롤 몫이다
        if (!d.touch) this.tPitch = clamp(d.pitch + dy * 0.002, -0.25, 0.55);
      }
      return;
    }
    if (e.pointerType !== "mouse") return;
    const h = this.hitAt(e);
    this.canvas.style.cursor = h ? "pointer" : "grab";
    const key = h?.key ?? null;
    if (key !== this.hoverKey) {
      this.hoverKey = key;
      this.needsDraw = true;
      this.cb.onHoverSatellite(key);
    }
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (this.mobile && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      this.cb.onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (this.moved > 6) return;
    const h = this.hitAt(e);
    if (h?.key) this.cb.onSatellite(h.slot, h.key);
    else if (h) this.cb.onSelect(h.slot);
    else if (!this.mobile) this.cb.onSelect(null);
  };

  private onCancel = () => {
    this.drag = null;
  };

  private onLeave = () => {
    if (this.hoverKey) {
      this.hoverKey = null;
      this.needsDraw = true;
      this.cb.onHoverSatellite(null);
    }
  };

  /**
   * 휠은 페이지 스크롤 몫이다 — 여기서 가로채면 홈이 이 장면에서 아래로 내려가지 않는다.
   * 트랙패드 핀치(브라우저가 ctrlKey 휠로 보낸다)와 Ctrl+휠만 확대로 쓴다.
   */
  private onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    this.userZoom = clamp(this.userZoom - e.deltaY * 0.004, ZOOM_MIN, ZOOM_MAX);
    this.aim();
  };

  private onVisibility = () => this.sync();

  private bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onCancel);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.ro.observe(this.host);
  }

  private unbind() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onCancel);
    c.removeEventListener("pointerleave", this.onLeave);
    c.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro.disconnect();
  }
}

let sprites: { shade: HTMLCanvasElement; rim: HTMLCanvasElement } | null = null;

/**
 * 구체 조명 그림 두 장 — 원 안의 점마다 표면 방향(법선)을 구해 빛과의 각도로 밝기를 낸다.
 *
 * shade: 램버트 조명. 빛 방향이 왼쪽 위 앞(-0.58, -0.44, 0.55)이라 오른쪽 아래로 갈수록
 *        자연스럽게 어두워지고, 등 쪽도 완전히 검지 않게 바닥값(0.055)을 둔다. 곱하기로 얹는다.
 * rim:   가장자리일수록 강해지는 보랏빛 테두리광. 더하기로 얹는다.
 *
 * 예전에는 가운데 밝은 점 + 둘레를 고르게 어둡게 하는 그라디언트였다. 사방이 똑같이 어두워서
 * 공이 아니라 원판처럼 보였다. 값은 대표님이 고른 참고 시안의 조명식과 같다.
 */
function lightSprites() {
  if (sprites) return sprites;
  const N = 256;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = N;
    c.height = N;
    return c;
  };
  const shade = make();
  const rim = make();
  const sc = shade.getContext("2d")!;
  const rc = rim.getContext("2d")!;
  const sd = sc.createImageData(N, N);
  const rd = rc.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x + 0.5 - N / 2) / (N / 2);
      const ny = (y + 0.5 - N / 2) / (N / 2);
      const q = nx * nx + ny * ny;
      if (q >= 1) continue;
      const nz = Math.sqrt(1 - q);
      const l = Math.min(1, Math.max(0.055, -nx * 0.58 - ny * 0.44 + nz * 0.55) * 0.95 * 1.2);
      const edge = Math.pow(1 - nz, 4);
      // 원 테두리는 한 픽셀 안에서 부드럽게 — 계단이 지면 행성 윤곽이 거칠어 보인다
      const a = Math.round(255 * Math.min(1, (1 - Math.sqrt(q)) * N * 0.5));
      const i = (y * N + x) * 4;
      sd.data[i] = sd.data[i + 1] = sd.data[i + 2] = Math.round(255 * l);
      sd.data[i + 3] = a;
      rd.data[i] = Math.round(45 * edge);
      rd.data[i + 1] = Math.round(35 * edge);
      rd.data[i + 2] = Math.round(75 * edge);
      rd.data[i + 3] = a;
    }
  }
  sc.putImageData(sd, 0, 0);
  rc.putImageData(rd, 0, 0);
  sprites = { shade, rim };
  return sprites;
}

/** #rrggbb → rgba(…, a). 형식이 다르면 그대로 돌려준다. */
function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 자물쇠 — 홈 · 목록의 SVG 자물쇠(24 칸 격자)와 같은 모양을 캔버스로 그린다 */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, px: number) {
  const u = px / 24;
  ctx.save();
  ctx.translate(x - px / 2, y - px / 2);
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 6 * u;
  ctx.fillStyle = "#fff";
  ctx.fillRect(4 * u, 9 * u, 16 * u, 14 * u);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.2 * u;
  ctx.beginPath();
  ctx.moveTo(9 * u, 9 * u);
  ctx.lineTo(9 * u, 4.5 * u);
  ctx.lineTo(15 * u, 4.5 * u);
  ctx.lineTo(15 * u, 9 * u);
  ctx.stroke();
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(11 * u, 13 * u, 2 * u, 5 * u);
  ctx.restore();
}
