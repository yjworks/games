import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { BattleState, Unit } from '../../engine/battle';
import type { TileType } from '../../engine/battlemap';
import { KINDS, type UnitKind } from '../../engine/units';
import { HEX_R, HEX_W, hexCenter, paintGround } from '../art/battlefield';
import { FrameWatch, type SceneOpt } from './gpu';

/**
 * 3D 전장 — 2D 전장과 같은 칸·같은 규칙을 three.js로 세운다.
 * 땅은 높이를 준 판에 2D 바닥 그림을 입히고, 숲·바위산·집·성벽·성문·본진·다리·부대는 3D 모형으로 올린다.
 * 화면(React)은 칸 누르기와 수치만 맡고, 이 클래스는 그리기와 움직임만 맡는다.
 */

const S = 1 / HEX_R;                       // 2D 픽셀 → 3D 단위(칸 반지름 = 1)
const FONT = '"Cheonha Serif", "Noto Serif KR", serif';

const HEIGHT: Record<TileType, number> = {
  plain: 0, road: 0, forest: 0.06, hill: 0.5, mountain: 1.05, peak: 1.7, marsh: -0.08, water: -0.42, ford: -0.2, bridge: -0.42,
  village: 0.02, dam: 0.3, wall: 0.14, gate: 0.14, pass: 0.7, inner: 0.14, keep: 0.2, breach: 0.12,
};
const WATERY = new Set<TileType>(['water', 'ford', 'bridge']);
const WALLISH = new Set<TileType>(['wall', 'gate', 'breach']);
const DIRS_EVEN: [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const DIRS_ODD: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

export interface Overlay { q: number; r: number; kind: 'reach' | 'target' | 'special'; label?: string; color?: string }
export type Fx =
  | { id: number; type: 'float'; q: number; r: number; text: string; color: string; delay: number }
  | { id: number; type: 'shot'; from: [number, number]; to: [number, number]; delay: number; volley: number; fire?: boolean; stone?: boolean }
  | { id: number; type: 'lunge'; uid: number; to: [number, number] }
  | { id: number; type: 'shake' };

interface UnitView {
  g: THREE.Group;
  body: THREE.Group;
  flag: THREE.Mesh;
  bar: THREE.Sprite;
  barKey: string;
  ring: THREE.Mesh;
  key: string;
  at: THREE.Vector3;
  from: THREE.Vector3;
  t0: number;
  lungeTo: THREE.Vector3 | null;
  lungeT0: number;
}

interface Anim { t0: number; dur: number; step: (k: number) => void; done?: () => void }

const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

function textSprite(text: string, color: string, size = 64, stroke = '#120a04'): THREE.Sprite {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  ctx.font = `800 ${size}px ${FONT}`;
  const w = Math.ceil(ctx.measureText(text).width + size * 0.5);
  cv.width = w; cv.height = Math.ceil(size * 1.4);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, w / 2, cv.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, cv.height / 2);
  const m = new THREE.SpriteMaterial({ map: tex(cv), depthTest: false, transparent: true });
  const sp = new THREE.Sprite(m);
  const k = 0.0062;
  sp.scale.set(cv.width * k, cv.height * k, 1);
  sp.userData.w = sp.scale.x;
  sp.userData.h = sp.scale.y;
  sp.renderOrder = 10;
  return sp;
}

export class BattleScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: MapControls;
  private el: HTMLElement;
  private W = 0;
  private H = 0;
  private heights: Float32Array = new Float32Array(0);
  private hgW = 0;
  private hgH = 0;
  private terrain: THREE.Group = new THREE.Group();
  private ground: THREE.Mesh | null = null;
  private water: THREE.Mesh | null = null;
  private waterTex: THREE.Texture | null = null;
  private overlays = new THREE.Group();
  private fxg = new THREE.Group();
  private fires = new THREE.Group();
  private labels = new THREE.Group();
  private units = new Map<number, UnitView>();
  private anims: Anim[] = [];
  private fieldKey = '';
  private raf = 0;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private clock = new THREE.Timer();
  private shakeT = -1;
  private ro: ResizeObserver;
  private flameTex: THREE.Texture;
  private seen = new Set<number>();
  private disposed = false;
  private ready = false;
  private low: boolean;
  private watch: FrameWatch;

  constructor(el: HTMLElement, opt: SceneOpt = {}) {
    this.el = el;
    this.low = !!opt.low;
    /* 느리면 한 번 화질을 낮춰 보고, 그래도 느리면 바깥에 알린다 */
    this.watch = new FrameWatch(() => { if (!this.low) { this.degrade(); this.watch.reset(); } else opt.onSlow?.(); });
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.low, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.low ? 1 : Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const shadows = Math.min(window.innerWidth, window.innerHeight) >= 700 && !this.low;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'sg-bt3d-canvas';

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    /* 어두운 옻칠 탁자 위에 놓인 전장 모형 */
    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 256;
    const bx = bg.getContext('2d')!;
    const bgr = bx.createLinearGradient(0, 0, 0, 256);
    bgr.addColorStop(0, '#4a3524'); bgr.addColorStop(0.55, '#24170d'); bgr.addColorStop(1, '#0c0704');
    bx.fillStyle = bgr; bx.fillRect(0, 0, 4, 256);
    this.scene.background = tex(bg);
    this.scene.fog = new THREE.Fog('#1a110a', 60, 160);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 0.55, metalness: 0.05 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.65;
    table.receiveShadow = true;
    this.scene.add(table);

    this.hemi = new THREE.HemisphereLight('#f4ecd6', '#4a4030', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    this.sun.position.set(-18, 30, 14);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.terrain, this.overlays, this.fires, this.labels, this.fxg);

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = 1.18;
    this.controls.minPolarAngle = 0.35;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 60;
    this.controls.zoomToCursor = true;

    const fc = document.createElement('canvas');
    fc.width = 64; fc.height = 96;
    const fx = fc.getContext('2d')!;
    const gr = fx.createRadialGradient(32, 64, 2, 32, 56, 40);
    gr.addColorStop(0, 'rgba(255,250,200,1)');
    gr.addColorStop(0.35, 'rgba(255,170,60,0.95)');
    gr.addColorStop(0.7, 'rgba(220,70,20,0.6)');
    gr.addColorStop(1, 'rgba(120,20,0,0)');
    fx.fillStyle = gr;
    fx.beginPath();
    fx.moveTo(32, 2); fx.quadraticCurveTo(62, 50, 50, 84); fx.quadraticCurveTo(32, 96, 14, 84); fx.quadraticCurveTo(2, 50, 32, 2);
    fx.fill();
    this.flameTex = tex(fc);
    (this.flameTex as THREE.Texture & { shared?: boolean }).shared = true;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.loop();
  }

  /* ───────── 좌표 ───────── */

  private world(q: number, r: number): THREE.Vector3 {
    const [x, y] = hexCenter(q, r);
    return new THREE.Vector3(x * S, this.heightAt(x * S, y * S), y * S);
  }

  /** 땅 높이(높이 격자에서 겹선형으로) */
  heightAt(x: number, z: number): number {
    if (!this.hgW) return 0;
    const gx = (x / (this.W * HEX_W * S + HEX_W * S / 2)) * (this.hgW - 1);
    const gz = (z / ((this.H * 1.5 + 0.5) * HEX_R * S)) * (this.hgH - 1);
    const x0 = Math.max(0, Math.min(this.hgW - 2, Math.floor(gx))), z0 = Math.max(0, Math.min(this.hgH - 2, Math.floor(gz)));
    const fx = Math.min(1, Math.max(0, gx - x0)), fz = Math.min(1, Math.max(0, gz - z0));
    const h = (i: number, j: number) => this.heights[j * this.hgW + i];
    return (h(x0, z0) * (1 - fx) + h(x0 + 1, z0) * fx) * (1 - fz) + (h(x0, z0 + 1) * (1 - fx) + h(x0 + 1, z0 + 1) * fx) * fz;
  }

  /** 화면 점 → 칸 */
  pick(clientX: number, clientY: number): [number, number] | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    /* 부대를 먼저 */
    const bodies = [...this.units.values()].map((u) => u.g);
    const hitU = ray.intersectObjects(bodies, true)[0];
    if (hitU) {
      let o: THREE.Object3D | null = hitU.object;
      while (o && o.userData.qr === undefined) o = o.parent;
      if (o) return o.userData.qr as [number, number];
    }
    if (!this.ground) return null;
    const hit = ray.intersectObject(this.ground, false)[0];
    if (!hit) return null;
    return this.toHex(hit.point.x / S, hit.point.z / S);
  }

  private toHex(px: number, py: number): [number, number] | null {
    const X = px - HEX_W / 2, Y = py - HEX_R;
    const qa = ((Math.sqrt(3) / 3) * X - Y / 3) / HEX_R;
    const ra = ((2 / 3) * Y) / HEX_R;
    let rx = Math.round(qa), rz = Math.round(ra), ry = Math.round(-qa - ra);
    const dx = Math.abs(rx - qa), dz = Math.abs(rz - ra), dy = Math.abs(ry + qa + ra);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy <= dz) rz = -rx - ry;
    const row = rz, col = rx + (rz - (rz & 1)) / 2;
    if (col < 0 || row < 0 || col >= this.W || row >= this.H) return null;
    return [col, row];
  }

  /* ───────── 땅 ───────── */

  setField(bs: BattleState, month: number) {
    const key = `${month}:${bs.tiles.map((t) => t.t[0] + t.t[1]).join('')}`;
    if (key === this.fieldKey) return;
    const first = !this.fieldKey;
    this.fieldKey = key;
    this.W = bs.W; this.H = bs.H;
    for (const c of [...this.terrain.children]) { this.terrain.remove(c); disposeDeep(c); }
    const fw = (bs.W * HEX_W + HEX_W / 2) * S, fh = (bs.H * 1.5 + 0.5) * HEX_R * S;

    /* 높이 격자 */
    const segX = bs.W * 9, segZ = bs.H * 8;
    this.hgW = segX + 1; this.hgH = segZ + 1;
    const raw = new Float32Array(this.hgW * this.hgH);
    for (let j = 0; j < this.hgH; j++) for (let i = 0; i < this.hgW; i++) {
      const px = (i / segX) * fw / S, py = (j / segZ) * fh / S;
      const h = this.toHex(px, py);
      const t = h ? bs.tiles[h[1] * bs.W + h[0]].t : 'plain';
      raw[j * this.hgW + i] = HEIGHT[t];
    }
    this.heights = blur(raw, this.hgW, this.hgH, 2, 2);
    /* 산은 더 뾰족하게: 덜 번진 높이를 섞는다 */
    const sharp = blur(raw, this.hgW, this.hgH, 1, 1);
    for (let k = 0; k < this.heights.length; k++) {
      const n = Math.sin(k * 12.9898) * 43758.5453;
      this.heights[k] = this.heights[k] * 0.55 + sharp[k] * 0.45 + ((n - Math.floor(n)) - 0.5) * 0.03;
    }

    const geo = new THREE.PlaneGeometry(fw, fh, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(fw / 2, 0, fh / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.heights[k]);
    geo.computeVertexNormals();
    const cv = paintGround(bs, month);
    const mat = new THREE.MeshStandardMaterial({ map: cv ? tex(cv) : null, roughness: 0.95, metalness: 0 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.terrain.add(this.ground);

    /* 판 옆면(흙 단면) */
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.6, 1.2, fh + 0.6), new THREE.MeshStandardMaterial({ color: '#4a3622', roughness: 1 }));
    skirt.position.set(fw / 2, -1.05, fh / 2);
    this.terrain.add(skirt);

    /* 물 */
    const wc = document.createElement('canvas');
    wc.width = wc.height = 128;
    const wx = wc.getContext('2d')!;
    wx.fillStyle = '#3d7b96';
    wx.fillRect(0, 0, 128, 128);
    wx.strokeStyle = 'rgba(210,235,240,0.35)';
    wx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { wx.beginPath(); const y = i * 15 + 6; wx.moveTo(0, y); for (let x = 0; x <= 128; x += 16) wx.quadraticCurveTo(x + 8, y - 4, x + 16, y); wx.stroke(); }
    this.waterTex = tex(wc);
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(fw / 3, fh / 3);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: this.waterTex, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.1 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(fw / 2, -0.16, fh / 2);
    this.terrain.add(this.water);

    this.buildProps(bs, month);

    const lc = this.labels;
    for (const c of [...lc.children]) { lc.remove(c); disposeDeep(c); }
    for (const l of bs.labels) {
      const sp = textSprite(l.text, '#fff1cf', 54);
      const p = this.world(l.q, l.r);
      sp.position.set(p.x, p.y + 1.5, p.z - 0.6);
      lc.add(sp);
    }

    /* 빛·그림자 범위 */
    const sh = this.sun.shadow.camera as THREE.OrthographicCamera;
    sh.left = -fw * 0.7; sh.right = fw * 0.7; sh.top = fh * 0.9; sh.bottom = -fh * 0.9; sh.near = 1; sh.far = 90;
    sh.updateProjectionMatrix();
    this.sun.target.position.set(fw / 2, 0, fh / 2);
    this.sun.position.set(fw / 2 - 16, 30, fh / 2 + 14);
    if (first) {
      /* 처음에는 전장 가운데와 사람이 지휘하는 부대 사이를 본다 */
      const side = bs.human[0] ? 0 : 1;
      const mine = bs.units.filter((u) => !u.gone && u.side === side);
      let cx = fw / 2, cz = fh / 2;
      if (mine.length) {
        const ax = mine.reduce((a, u) => a + hexCenter(u.q, u.r)[0] * S, 0) / mine.length;
        const az = mine.reduce((a, u) => a + hexCenter(u.q, u.r)[1] * S, 0) / mine.length;
        cx = cx * 0.45 + ax * 0.55; cz = cz * 0.45 + az * 0.55;
      }
      const wide = this.el.clientWidth / Math.max(1, this.el.clientHeight);
      const k = wide > 1.2 ? 0.6 : 0.7;
      this.controls.target.set(cx, 0, cz + 0.6);
      this.camera.position.set(cx, Math.max(fw, fh) * k, cz + Math.max(fw, fh) * k * 0.78);
      this.controls.update();
    }
  }

  setWeather(weather: string, month: number) {
    const winter = month >= 10;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(weather === '안개' ? '#b9bcb6' : '#1a110a');
    fog.near = weather === '안개' ? 10 : 60;
    fog.far = weather === '안개' ? 42 : 160;
    this.hemi.color.set(weather === '비' ? '#c9d2d8' : winter ? '#e8eef2' : '#f4ecd6');
    this.sun.intensity = weather === '맑음' ? 2.3 : weather === '강풍' ? 2 : 1.1;
    this.hemi.intensity = weather === '맑음' ? 1.05 : 1.35;
  }

  private buildProps(bs: BattleState, month: number) {
    const winter = month >= 10;
    const autumn = month >= 7 && month <= 9;
    const rnd = mulberry(bs.W * 131 + bs.H * 7 + bs.tiles.length);
    const g = this.terrain;
    const add = (m: THREE.Object3D) => { m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(m); };
    const M = (color: string, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });
    const mats = {
      leaf: M(winter ? '#9aa79a' : autumn ? '#b0662c' : '#3f6327'),
      leaf2: M(winter ? '#e9ece6' : autumn ? '#c99634' : '#56792f'),
      trunk: M('#4a3220'),
      rock: M('#8d8068'), rock2: M('#6d634f'), snow: M('#f3f2ee', 0.6),
      wall: M(winter ? '#cfcac0' : '#a99d80'), wallTop: M(winter ? '#e6e3dc' : '#c1b597'),
      roofRed: M(winter ? '#e2e2de' : '#8f2a1e'), roofGray: M(winter ? '#e2e2de' : '#3f4a4c'), roofGold: M(winter ? '#e9e7df' : '#c9a13e', 0.5),
      wood: M('#7a4a26'), door: M('#3a2210'), plaster: M('#e2d3ac'), earth: M('#8f7c52'), plank: M('#8a6239'),
    };

    /* 숲 — 나무 인스턴스 */
    const trees: THREE.Matrix4[] = [], trees2: THREE.Matrix4[] = [];
    const rocks: THREE.Matrix4[] = [], snows: THREE.Matrix4[] = [];
    const houses: [THREE.Vector3, number, number][] = [];
    bs.tiles.forEach((t, i) => {
      const q = i % bs.W, r = Math.floor(i / bs.W);
      const c = this.world(q, r);
      if (t.t === 'forest') {
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2 + rnd() * 0.6, d = k === 8 ? 0 : 0.35 + rnd() * 0.45;
          const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d * 0.9;
          const s = 0.75 + rnd() * 0.45;
          const m = new THREE.Matrix4().compose(new THREE.Vector3(x, this.heightAt(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(s, s * (0.9 + rnd() * 0.4), s));
          (rnd() < 0.5 ? trees : trees2).push(m);
        }
      } else if (t.t === 'mountain' || t.t === 'peak' || t.t === 'pass') {
        const n = t.t === 'pass' ? 2 : 3;
        for (let k = 0; k < n; k++) {
          const a = rnd() * Math.PI * 2, d = t.t === 'pass' ? 0.8 : rnd() * 0.45;
          const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
          const hgt = (t.t === 'peak' ? 1.6 : 0.95) * (0.75 + rnd() * 0.5);
          const w = 0.55 + rnd() * 0.3;
          const y = this.heightAt(x, z) - 0.05;
          rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + hgt / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(w, hgt, w)));
          if (t.t === 'peak' || winter) snows.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + hgt * 0.83, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.36, hgt * 0.34, w * 0.36)));
        }
      } else if (t.t === 'village') {
        for (let k = 0; k < 3; k++) houses.push([new THREE.Vector3(c.x + (rnd() - 0.5) * 1.1, 0, c.z + (rnd() - 0.5) * 1), rnd() * 6, 0.9 + rnd() * 0.25]);
      } else if (t.t === 'inner') {
        for (let k = 0; k < 2; k++) houses.push([new THREE.Vector3(c.x + (rnd() - 0.5) * 1, 0, c.z + (rnd() - 0.5) * 0.9), rnd() < 0.5 ? 0 : Math.PI / 2, 0.75 + rnd() * 0.2]);
      }
    });
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[]) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = true; im.receiveShadow = true;
      g.add(im);
    };
    const crown = new THREE.ConeGeometry(0.3, 0.75, 7); crown.translate(0, 0.62, 0);
    const crownR = new THREE.IcosahedronGeometry(0.3, 0); crownR.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5); trunk.translate(0, 0.15, 0);
    inst(crown, mats.leaf, trees);
    inst(crownR, mats.leaf2, trees2);
    inst(trunk, mats.trunk, [...trees, ...trees2]);
    const rockG = new THREE.ConeGeometry(0.5, 1, 6, 1);
    inst(rockG, mats.rock, rocks.filter((_, k) => k % 2 === 0));
    inst(rockG, mats.rock2, rocks.filter((_, k) => k % 2 === 1));
    inst(new THREE.ConeGeometry(0.5, 1, 6, 1), mats.snow, snows);

    houses.forEach(([p, rot, sc], k) => add(house(p.x, this.heightAt(p.x, p.z), p.z, rot, sc, mats, k % 3 === 0 ? mats.roofRed : mats.roofGray)));

    /* 성벽 — 이웃 성벽·성문과 잇는다 */
    const nb = (q: number, r: number) => (r % 2 === 0 ? DIRS_EVEN : DIRS_ODD).map(([dq, dr]) => [q + dq, r + dr] as [number, number]).filter(([x, y]) => x >= 0 && y >= 0 && x < bs.W && y < bs.H);
    const tt = (q: number, r: number) => bs.tiles[r * bs.W + q].t;
    bs.tiles.forEach((t, i) => {
      const q = i % bs.W, r = Math.floor(i / bs.W);
      if (!WALLISH.has(t.t)) return;
      const a = this.world(q, r);
      for (const [nq, nr] of nb(q, r)) {
        if (!WALLISH.has(tt(nq, nr)) || nr * bs.W + nq < i) continue;
        if (t.t === 'breach' || tt(nq, nr) === 'breach') continue;
        const b = this.world(nq, nr);
        add(wallSeg(a, b, mats));
      }
      if (t.t === 'wall') add(tower(a, mats, t.max ? t.hp < t.max * 0.5 : false));
      if (t.t === 'gate') add(gatehouse(a, mats, nb(q, r).filter(([x, y]) => WALLISH.has(tt(x, y))).map(([x, y]) => this.world(x, y))));
      if (t.t === 'breach') add(rubble(a, mats, rnd));
    });
    bs.tiles.forEach((t, i) => {
      const q = i % bs.W, r = Math.floor(i / bs.W);
      const c = this.world(q, r);
      if (t.t === 'keep') add(palace(c, mats));
      if (t.t === 'pass') add(passGate(c, mats));
      if (t.t === 'dam') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.6), mats.earth);
        m.position.set(c.x, c.y + 0.12, c.z);
        add(m);
      }
      if (t.t === 'bridge') {
        const link = nb(q, r).find(([x, y]) => !WATERY.has(tt(x, y)) || tt(x, y) === 'bridge');
        const ang = link ? Math.atan2(this.world(link[0], link[1]).z - c.z, this.world(link[0], link[1]).x - c.x) : 0;
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.55), mats.plank);
        m.position.set(c.x, -0.08, c.z);
        m.rotation.y = -ang;
        add(m);
        for (const sd of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.04), mats.wood);
          rail.position.set(c.x - Math.sin(ang) * 0.27 * sd, 0.0, c.z + Math.cos(ang) * 0.27 * sd);
          rail.rotation.y = -ang;
          add(rail);
        }
      }
    });
  }

  /* ───────── 부대 ───────── */

  syncUnits(bs: BattleState, colorOf: (u: Unit) => string, labelOf: (u: Unit) => string, sel: number | null, sideToAct: number) {
    const now = this.clock.getElapsed();
    const alive = new Set<number>();
    for (const u of bs.units) {
      if (u.gone) continue;
      alive.add(u.uid);
      const col = colorOf(u);
      const men = u.kind === '공성' ? 1 : u.kind === '기병' || u.kind === '수군' ? 2 + (u.troops >= 6000 ? 1 : 0) : u.troops >= 7000 ? 5 : u.troops >= 4000 ? 4 : u.troops >= 1500 ? 3 : 2;
      const key = `${u.kind}:${col}:${men}:${labelOf(u)}:${u.commander}`;
      let v = this.units.get(u.uid);
      const target = this.world(u.q, u.r);
      if (!v || v.key !== key) {
        const old = v;
        if (old) { this.scene.remove(old.g); disposeDeep(old.g); }
        v = this.makeUnit(u, col, labelOf(u), men);
        v.key = key;
        v.at.copy(old ? old.at : target);
        v.from.copy(v.at);
        v.g.position.copy(v.at);
        this.units.set(u.uid, v);
        this.scene.add(v.g);
        if (!old && this.ready && !this.seen.has(u.uid)) {
          /* 새로 나타난 부대(원군)는 떨어지듯 내려앉는다 */
          v.g.position.y += 3;
          v.from.copy(v.g.position);
          v.t0 = now;
        }
        this.seen.add(u.uid);
      }
      v.g.userData.qr = [u.q, u.r];
      if (!v.at.equals(target)) {
        v.from.copy(v.g.position);
        v.at.copy(target);
        v.t0 = now;
      }
      /* 병력 띠 */
      const ratio = Math.max(0, Math.min(1, u.troops / Math.max(1, u.maxTroops)));
      const bk = `${Math.round(ratio * 40)}:${u.morale > 30 ? 1 : 0}:${u.confused > 0 ? 1 : 0}`;
      if (bk !== v.barKey) { v.barKey = bk; drawBar(v.bar, ratio, u.troops, u.confused > 0); }
      (v.ring.material as THREE.MeshBasicMaterial).opacity = sel === u.uid ? 0.95 : 0.0;
      const dim = u.acted && sideToAct === u.side;
      v.g.scale.setScalar(dim ? 0.92 : 1);
      (v.flag.material as THREE.MeshStandardMaterial).opacity = dim ? 0.55 : 1;
    }
    this.ready = true;
    for (const [uid, v] of this.units) {
      if (alive.has(uid)) continue;
      this.units.delete(uid);
      /* 무너진 부대는 가라앉으며 사라진다 */
      const g = v.g;
      const y0 = g.position.y;
      this.anims.push({ t0: now, dur: 0.7, step: (k) => { g.position.y = y0 - k * 0.8; g.rotation.z = k * 0.5; g.scale.setScalar(1 - k * 0.6); }, done: () => { this.scene.remove(g); disposeDeep(g); } });
    }
  }

  private makeUnit(u: Unit, color: string, label: string, men: number): UnitView {
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(1.45);
    g.add(body);
    const col = new THREE.Color(color);
    const dark = col.clone().multiplyScalar(0.45);
    const M = (c: THREE.ColorRepresentation, rough = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });
    const cloth = M(dark), trim = M(col), skin = M('#d9b089'), steel = M('#c9ced6', 0.35), wood = M('#5a3a1e'), horse = M('#6b4529');

    /* 바닥 원판(진영 색) */
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.05, 24), new THREE.MeshStandardMaterial({ color: u.side === 0 ? '#c2412e' : '#2e5fb0', roughness: 0.6, transparent: true, opacity: 0.85 }));
    disc.position.y = 0.03;
    g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffe28a', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);

    const spots: [number, number][] = [[0.0, 0.25], [-0.42, -0.05], [0.42, -0.05], [-0.22, -0.42], [0.22, -0.42]];
    const kind: UnitKind = u.kind;
    for (let i = 0; i < men; i++) {
      const [x, z] = spots[i];
      const f = new THREE.Group();
      f.position.set(x, 0.05, z);
      if (kind === '기병') {
        const hb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.55), horse); hb.position.y = 0.36; f.add(hb);
        const hn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.14), horse); hn.position.set(0, 0.52, 0.28); hn.rotation.x = -0.5; f.add(hn);
        for (const [lx, lz] of [[-0.07, -0.2], [0.07, -0.2], [-0.07, 0.2], [0.07, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), horse); l.position.set(lx, 0.14, lz); f.add(l); }
        const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.3, 6), cloth); rb.position.set(0, 0.62, -0.02); f.add(rb);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin); hd.position.set(0, 0.84, -0.02); f.add(hd);
        const hm = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 6), steel); hm.position.set(0, 0.92, -0.02); f.add(hm);
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), wood); sp.position.set(0.12, 0.85, 0.15); sp.rotation.x = 0.9; f.add(sp);
      } else if (kind === '공성') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.8), wood); base.position.y = 0.24; f.add(base);
        const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.42, 0.35, 4, 1), M('#4a2e18')); roofM.position.y = 0.52; roofM.rotation.y = Math.PI / 4; roofM.scale.z = 1.4; f.add(roofM);
        const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), M('#3a2a1a')); ram.rotation.x = Math.PI / 2; ram.position.set(0, 0.3, 0.15); f.add(ram);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 6), steel); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.3, 0.72); f.add(tip);
        for (const [wx, wz] of [[-0.32, -0.25], [0.32, -0.25], [-0.32, 0.25], [0.32, 0.25]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), M('#2a1a0e')); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.11, wz); f.add(w); }
      } else if (kind === '수군') {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.9), wood); hull.position.y = 0.12; f.add(hull);
        const prow = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), wood); prow.rotation.x = Math.PI / 2; prow.position.set(0, 0.12, 0.58); prow.rotation.y = Math.PI / 4; f.add(prow);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), wood); mast.position.y = 0.55; f.add(mast);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.45), M('#e8dcc0')); sail.position.set(0, 0.6, 0.02); sail.material.side = THREE.DoubleSide; f.add(sail);
        const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 6), cloth); rb.position.set(0, 0.28, -0.25); f.add(rb);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin); hd.position.set(0, 0.43, -0.25); f.add(hd);
      } else {
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.08), M('#2a2018')); legs.position.y = 0.11; f.add(legs);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 6), cloth); torso.position.y = 0.37; f.add(torso);
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 6), trim); belt.position.y = 0.28; f.add(belt);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skin); hd.position.y = 0.6; f.add(hd);
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.1, 6), kind === '궁병' || kind === '노병' ? M('#3a2a1a') : steel); hat.position.y = 0.68; f.add(hat);
        if (kind === '창병') {
          const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 4), wood); sp.position.set(0.12, 0.6, 0.05); sp.rotation.x = 0.15; f.add(sp);
          const tp = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), steel); tp.position.set(0.12, 1.16, 0.13); f.add(tp);
        } else if (kind === '궁병') {
          const bow = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 10, Math.PI), wood); bow.position.set(0.12, 0.42, 0.06); bow.rotation.set(0, Math.PI / 2, Math.PI / 2); f.add(bow);
        } else if (kind === '노병') {
          const xb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.05), wood); xb.position.set(0, 0.42, 0.14); f.add(xb);
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), wood); st.position.set(0, 0.42, 0.05); f.add(st);
        } else {
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 8), trim); sh.rotation.z = Math.PI / 2; sh.position.set(-0.12, 0.38, 0.04); f.add(sh);
          const sw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.03), steel); sw.position.set(0.13, 0.42, 0.06); sw.rotation.x = 0.4; f.add(sw);
        }
      }
      f.rotation.y = u.side === 0 ? Math.PI * 0.85 : -Math.PI * 0.15;
      f.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
      body.add(f);
    }

    /* 군기 */
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.9, 5), wood);
    pole.position.set(-0.55, 0.95, 0.1);
    pole.castShadow = true;
    g.add(pole);
    if (u.commander) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M('#e7c25a', 0.3));
      knob.position.set(-0.55, 1.93, 0.1);
      g.add(knob);
    }
    const fc = document.createElement('canvas');
    fc.width = 128; fc.height = 160;
    const fx = fc.getContext('2d')!;
    fx.fillStyle = color;
    fx.fillRect(0, 0, 128, 160);
    fx.fillStyle = '#' + col.clone().lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
    fx.fillRect(0, 0, 128, 18);
    fx.fillStyle = '#' + dark.getHexString();
    for (let k = 0; k < 4; k++) { fx.beginPath(); fx.moveTo(118, 30 + k * 34); fx.lineTo(128, 40 + k * 34); fx.lineTo(118, 50 + k * 34); fx.fill(); }
    fx.font = `800 ${label.length > 1 ? 50 : 78}px ${FONT}`;
    fx.textAlign = 'center';
    fx.textBaseline = 'middle';
    fx.lineWidth = 6;
    fx.strokeStyle = 'rgba(0,0,0,0.5)';
    const lines = label.length > 1 ? [label.slice(0, 1), label.slice(1)] : [label];
    lines.forEach((t, k) => { const y = lines.length > 1 ? 62 + k * 52 : 90; fx.strokeText(t, 60, y); fx.fillStyle = '#fff8e8'; fx.fillText(t, 60, y); });
    fx.fillStyle = '#f1e4c3';
    fx.beginPath(); fx.arc(100, 140, 16, 0, Math.PI * 2); fx.fill();
    fx.fillStyle = '#3a2614';
    fx.font = `800 22px ${FONT}`;
    fx.fillText(KINDS[kind].hanja, 100, 141);
    const fgeo = new THREE.PlaneGeometry(0.62, 0.78, 6, 1);
    fgeo.translate(0.31, 0, 0);
    const flag = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: tex(fc), side: THREE.DoubleSide, roughness: 0.8, transparent: true }));
    flag.position.set(-0.53, 1.45, 0.1);
    flag.castShadow = true;
    flag.userData.base = (fgeo.attributes.position as THREE.BufferAttribute).array.slice();
    g.add(flag);

    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    bar.scale.set(1.3, 0.22, 1);
    bar.position.set(0, 2.15, 0);
    bar.renderOrder = 9;
    g.add(bar);

    return { g, body, flag, bar, barKey: '', ring, key: '', at: new THREE.Vector3(), from: new THREE.Vector3(), t0: -10, lungeTo: null, lungeT0: -10 };
  }

  /* ───────── 칸 표시 ───────── */

  setOverlays(list: Overlay[]) {
    for (const c of [...this.overlays.children]) { this.overlays.remove(c); disposeDeep(c); }
    const hexG = new THREE.CircleGeometry(0.9, 6);
    hexG.rotateX(-Math.PI / 2);
    hexG.rotateY(Math.PI / 6);
    const ringG = new THREE.RingGeometry(0.78, 0.95, 6);
    ringG.rotateX(-Math.PI / 2);
    ringG.rotateY(Math.PI / 6);
    for (const o of list) {
      const p = this.world(o.q, o.r);
      const color = o.color ?? (o.kind === 'reach' ? '#7fe69a' : o.kind === 'target' ? '#ff5a45' : '#c88bff');
      const m = new THREE.Mesh(o.kind === 'reach' ? hexG : ringG, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o.kind === 'reach' ? 0.32 : 0.9, depthWrite: false }));
      m.position.set(p.x, p.y + 0.06, p.z);
      m.renderOrder = 2;
      m.userData.pulse = o.kind !== 'reach';
      this.overlays.add(m);
      if (o.label) {
        const sp = textSprite(o.label, '#ffffff', 40);
        sp.position.set(p.x, p.y + 1.1, p.z);
        this.overlays.add(sp);
      }
    }
  }

  setHazards(bs: BattleState) {
    const key = bs.tiles.map((t) => `${t.fire > 0 ? 1 : 0}${t.flood > 0 ? 1 : 0}`).join('');
    if (this.fires.userData.key === key) return;
    this.fires.userData.key = key;
    for (const c of [...this.fires.children]) { this.fires.remove(c); disposeDeep(c); }
    bs.tiles.forEach((t, i) => {
      const q = i % bs.W, r = Math.floor(i / bs.W);
      const p = this.world(q, r);
      if (t.fire > 0) {
        for (let k = 0; k < 4; k++) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
          sp.position.set(p.x + (k % 2 ? 0.35 : -0.35), p.y + 0.5, p.z + (k > 1 ? 0.3 : -0.3));
          sp.scale.set(0.8, 1.2, 1);
          sp.userData.flame = Math.random() * 6;
          this.fires.add(sp);
        }
        const light = new THREE.PointLight('#ff8a3a', 3, 4);
        light.position.set(p.x, p.y + 1, p.z);
        light.userData.flame = Math.random() * 6;
        this.fires.add(light);
      }
      if (t.flood > 0) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(1.0, 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 6), new THREE.MeshStandardMaterial({ color: '#4c8fb8', transparent: true, opacity: 0.7, roughness: 0.2 }));
        m.position.set(p.x, p.y + 0.18, p.z);
        m.userData.flood = true;
        this.fires.add(m);
      }
    });
  }

  /* ───────── 연출 ───────── */

  play(list: Fx[]) {
    const now = this.clock.getElapsed();
    for (const f of list) {
      if (f.type === 'float') {
        const p = this.world(f.q, f.r);
        const sp = textSprite(f.text, f.color, 72);
        sp.position.set(p.x, p.y + 2.3, p.z);
        sp.visible = false;
        this.fxg.add(sp);
        const t0 = now + f.delay / 1000;
        this.anims.push({
          t0, dur: 1.3,
          step: (k) => {
            sp.visible = true;
            sp.position.y = p.y + 2.3 + k * 1.2;
            (sp.material as THREE.SpriteMaterial).opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            const sc = k < 0.12 ? 0.6 + k * 4 : 1;
            sp.scale.set(sp.userData.w * sc, sp.userData.h * sc, 1);
          },
          done: () => { this.fxg.remove(sp); disposeDeep(sp); },
        });
      } else if (f.type === 'shot') {
        const a = this.world(f.from[0], f.from[1]).add(new THREE.Vector3(0, 0.9, 0));
        const b = this.world(f.to[0], f.to[1]).add(new THREE.Vector3(0, 0.5, 0));
        for (let k = 0; k < f.volley; k++) {
          const off = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
          const mesh = f.stone
            ? new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#8a8070', flatShading: true }))
            : new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: f.fire ? '#ffb24a' : '#f3e6c4' }));
          mesh.visible = false;
          this.fxg.add(mesh);
          const t0 = now + f.delay / 1000 + k * 0.05;
          const top = Math.max(a.y, b.y) + a.distanceTo(b) * 0.35 + 0.6;
          const A = a.clone().add(off), B = b.clone().add(off);
          this.anims.push({
            t0, dur: f.stone ? 0.8 : 0.55,
            step: (t) => {
              mesh.visible = true;
              const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t;
              const y = (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * top + t * t * B.y;
              const nx = A.x + (B.x - A.x) * Math.min(1, t + 0.02), nz = A.z + (B.z - A.z) * Math.min(1, t + 0.02);
              const t2 = Math.min(1, t + 0.02);
              const ny = (1 - t2) * (1 - t2) * A.y + 2 * (1 - t2) * t2 * top + t2 * t2 * B.y;
              mesh.position.set(x, y, z);
              mesh.lookAt(nx, ny, nz);
            },
            done: () => { this.fxg.remove(mesh); disposeDeep(mesh); },
          });
        }
      } else if (f.type === 'lunge') {
        const v = this.units.get(f.uid);
        if (v) { v.lungeTo = this.world(f.to[0], f.to[1]); v.lungeT0 = now; }
      } else if (f.type === 'shake') {
        this.shakeT = now;
      }
    }
  }

  /** 카메라를 한 칸 쪽으로 부드럽게 옮긴다 */
  focus(q: number, r: number) {
    const p = this.world(q, r);
    const d = this.camera.position.clone().sub(this.controls.target);
    const from = this.controls.target.clone();
    const to = new THREE.Vector3(p.x, 0, p.z);
    this.anims.push({ t0: this.clock.getElapsed(), dur: 0.6, step: (k) => {
      const e = k * k * (3 - 2 * k);
      this.controls.target.lerpVectors(from, to, e);
      this.camera.position.copy(this.controls.target).add(d);
    } });
  }

  /* ───────── 돌리기 ───────── */

  private resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 낮은 화질로 — 화소 배율 1, 그림자 끔 */
  private degrade() {
    this.low = true;
    this.renderer.setPixelRatio(1);
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
      });
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.ready) this.watch.tick(performance.now());
    this.clock.update();
    const t = this.clock.getElapsed();
    this.controls.update();
    /* 부대 이동(살짝 뛰듯이)·돌진 */
    for (const v of this.units.values()) {
      const k = Math.min(1, (t - v.t0) / 0.42);
      const e = k * k * (3 - 2 * k);
      const p = v.from.clone().lerp(v.at, e);
      p.y += Math.sin(k * Math.PI) * (v.from.distanceTo(v.at) > 0.1 ? 0.35 : 0);
      if (v.lungeTo) {
        const lk = (t - v.lungeT0) / 0.32;
        if (lk >= 1) v.lungeTo = null;
        else p.lerp(v.lungeTo, Math.sin(lk * Math.PI) * 0.38);
      }
      v.g.position.copy(p);
      /* 깃발 펄럭임 */
      const pos = v.flag.geometry.attributes.position as THREE.BufferAttribute;
      const base = v.flag.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.setZ(i, Math.sin(t * 4 + x * 7 + v.g.id) * 0.06 * x);
      }
      pos.needsUpdate = true;
      v.body.position.y = Math.abs(Math.sin(t * 2 + v.g.id)) * 0.015;
    }
    /* 불·물 */
    for (const c of this.fires.children) {
      if ((c as THREE.Sprite).isSprite) {
        const f = c.userData.flame as number;
        c.scale.set(0.75 + Math.sin(t * 9 + f) * 0.12, 1.15 + Math.sin(t * 7 + f * 2) * 0.22, 1);
      } else if ((c as THREE.PointLight).isPointLight) {
        (c as THREE.PointLight).intensity = 2.5 + Math.sin(t * 11 + c.userData.flame) * 0.8;
      }
    }
    if (this.waterTex) this.waterTex.offset.set(t * 0.02, t * 0.035);
    for (const c of this.overlays.children) if (c.userData.pulse) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 6) * 0.3;
    /* 연출 */
    this.anims = this.anims.filter((a) => {
      if (t < a.t0) return true;
      const k = Math.min(1, (t - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { a.done?.(); return false; }
      return true;
    });
    let shake = new THREE.Vector3();
    if (this.shakeT >= 0) {
      const k = (t - this.shakeT) / 0.45;
      if (k >= 1) this.shakeT = -1;
      else shake = new THREE.Vector3((Math.random() - 0.5) * 0.5 * (1 - k), (Math.random() - 0.5) * 0.3 * (1 - k), 0);
    }
    this.camera.position.add(shake);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(shake);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    disposeDeep(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/* ───────── 모형 ───────── */

type Mats = Record<string, THREE.MeshStandardMaterial>;

function roofMesh(w: number, d: number, h: number, mat: THREE.Material) {
  const geo = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w * 0.75, h, d * 0.75);
  return m;
}

function house(x: number, y: number, z: number, rot: number, s: number, mats: Mats, roofMat: THREE.Material) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.3), mats.plaster);
  body.position.y = 0.12;
  g.add(body);
  const roof = roofMesh(0.6, 0.44, 0.2, roofMat);
  roof.position.y = 0.34;
  g.add(roof);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  g.scale.setScalar(s);
  return g;
}

function wallSeg(a: THREE.Vector3, b: THREE.Vector3, mats: Mats) {
  const g = new THREE.Group();
  const len = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const h = 0.72;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.42), mats.wall);
  wall.position.y = h / 2;
  g.add(wall);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.46), mats.wallTop);
  walk.position.y = h + 0.02;
  g.add(walk);
  const n = Math.floor(len / 0.22);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), mats.wallTop);
    c.position.set(-len / 2 + 0.11 + i * (len / n), h + 0.1, 0.2);
    g.add(c);
  }
  g.position.set(mid.x, Math.min(a.y, b.y) - 0.05, mid.z);
  g.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  return g;
}

function tower(p: THREE.Vector3, mats: Mats, damaged: boolean) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.95, 0.56), mats.wall);
  base.position.y = 0.47;
  g.add(base);
  if (!damaged) {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.38), mats.plaster);
    hut.position.y = 1.06;
    g.add(hut);
    const roof = roofMesh(0.62, 0.62, 0.24, mats.roofGray);
    roof.position.y = 1.28;
    g.add(roof);
  } else {
    base.scale.y = 0.75;
    base.position.y = 0.36;
    base.rotation.z = 0.08;
  }
  g.position.set(p.x, p.y - 0.05, p.z);
  return g;
}

function gatehouse(p: THREE.Vector3, mats: Mats, links: THREE.Vector3[]) {
  const g = new THREE.Group();
  let ang = 0;
  if (links.length >= 2) ang = -Math.atan2(links[1].z - links[0].z, links[1].x - links[0].x);
  else if (links.length === 1) ang = -Math.atan2(links[0].z - p.z, links[0].x - p.x);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.7), mats.wall);
  base.position.y = 0.42;
  g.add(base);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.74), mats.door);
  door.position.y = 0.27;
  g.add(door);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.5), mats.plaster);
  hall.position.y = 1.0;
  g.add(hall);
  for (const x of [-0.3, -0.1, 0.1, 0.3]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.52), mats.roofRed);
    col.position.set(x, 1.0, 0);
    g.add(col);
  }
  const roof = roofMesh(1.35, 0.85, 0.36, mats.roofRed);
  roof.position.y = 1.34;
  g.add(roof);
  g.position.set(p.x, p.y - 0.05, p.z);
  g.rotation.y = ang;
  return g;
}

function passGate(p: THREE.Vector3, mats: Mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.6), mats.wall);
  base.position.y = 0.37;
  g.add(base);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.64), mats.door);
  door.position.y = 0.25;
  g.add(door);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.45), mats.plaster);
  hall.position.y = 0.89;
  g.add(hall);
  const roof = roofMesh(1.2, 0.8, 0.32, mats.roofRed);
  roof.position.y = 1.18;
  g.add(roof);
  g.position.set(p.x, p.y - 0.1, p.z);
  return g;
}

function palace(p: THREE.Vector3, mats: Mats) {
  const g = new THREE.Group();
  const plat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.1), mats.wallTop);
  plat.position.y = 0.11;
  g.add(plat);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.7), mats.plaster);
  hall.position.y = 0.42;
  g.add(hall);
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.72), mats.roofRed);
    c.position.set(-0.45 + i * 0.18, 0.42, 0);
    g.add(c);
  }
  const roof1 = roofMesh(1.55, 1.05, 0.3, mats.roofGold);
  roof1.position.y = 0.77;
  g.add(roof1);
  const hall2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.42), mats.plaster);
  hall2.position.y = 0.98;
  g.add(hall2);
  const roof2 = roofMesh(0.95, 0.7, 0.3, mats.roofGold);
  roof2.position.y = 1.26;
  g.add(roof2);
  g.position.set(p.x, p.y - 0.02, p.z);
  return g;
}

function rubble(p: THREE.Vector3, mats: Mats, rnd: () => number) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.12, 0), i % 2 ? mats.wall : mats.wallTop);
    m.position.set((rnd() - 0.5) * 1, 0.08, (rnd() - 0.5) * 0.8);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(m);
  }
  g.position.set(p.x, p.y - 0.02, p.z);
  return g;
}

/* ───────── 도구 ───────── */

function drawBar(sp: THREE.Sprite, ratio: number, troops: number, confused: boolean) {
  const cv = document.createElement('canvas');
  cv.width = 192; cv.height = 34;
  const x = cv.getContext('2d')!;
  x.fillStyle = 'rgba(10,6,3,0.8)';
  x.fillRect(0, 10, 192, 22);
  x.fillStyle = ratio > 0.5 ? '#8be08f' : ratio > 0.25 ? '#e8c25a' : '#ef7d6b';
  x.fillRect(3, 13, 186 * ratio, 16);
  x.font = `800 17px ${FONT}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 4;
  x.strokeStyle = '#000';
  const t = (confused ? '混 ' : '') + troops.toLocaleString('ko-KR');
  x.strokeText(t, 96, 22);
  x.fillStyle = '#fff';
  x.fillText(t, 96, 22);
  const m = sp.material as THREE.SpriteMaterial;
  m.map?.dispose();
  m.map = tex(cv);
  m.needsUpdate = true;
}

function blur(src: Float32Array, w: number, h: number, rx: number, passes: number): Float32Array {
  let a = src.slice();
  const b = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, n = 0;
      for (let k = -rx; k <= rx; k++) { const x = i + k; if (x >= 0 && x < w) { s += a[j * w + x]; n++; } }
      b[j * w + i] = s / n;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, n = 0;
      for (let k = -rx; k <= rx; k++) { const y = j + k; if (y >= 0 && y < h) { s += b[y * w + i]; n++; } }
      a[j * w + i] = s / n;
    }
  }
  return a;
}

function mulberry(seed: number) {
  let s = seed | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function disposeDeep(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const x of list) {
      const mm = x as THREE.MeshStandardMaterial;
      if (mm.map && !(mm.map as THREE.Texture & { shared?: boolean }).shared) mm.map.dispose();
      x.dispose();
    }
  });
}
