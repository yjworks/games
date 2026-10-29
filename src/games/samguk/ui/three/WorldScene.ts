import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { CITIES, MAP_H, MAP_W, ROADS, project } from '../../data/cities';
import { LAKES, REGION_LABELS, RIVERS } from '../../data/geo';
import { OFFICER_DEF } from '../../data/officers';
import type { CityId } from '../../data/types';
import type { GameState } from '../../engine/state';
import { CELLS, EDGES, HEIGHT_URL, LAND_URL, PT, TERRAIN_URL, ZHOU_LABELS } from '../mapgeo';
import { seasonOf } from '../labels';
import { surname } from '../art/util';
import { FrameWatch, type SceneOpt } from './gpu';

/**
 * 3D 천하 지도 — 실제 고도(SRTM·ETOPO1)로 솟은 땅 위에 바탕 그림과 세력권을 입히고,
 * 도시마다 성 모형·군기·이름판을, 이달 진군은 공중으로 휘는 화살로 띄운다.
 */

const SC = 0.1;                    // 2D 지도 좌표 → 3D 단위
const VERT = 5.2;                  // 가장 높은 땅(5,200m)의 높이
const FONT = '"Cheonha Serif", "Noto Serif KR", serif';
const TEX_K = 2;                   // 바탕 그림 해상도 배율

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = new URL(src, document.baseURI).href;
});
const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

interface CityView { g: THREE.Group; flag: THREE.Mesh; label: THREE.Sprite; ring: THREE.Mesh; mark: THREE.Mesh; key: string; base: number }

export class WorldScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);
  readonly controls: MapControls;
  private el: HTMLElement;
  private heights: Float32Array | null = null;
  private hw = 0;
  private hh = 0;
  private terrain: THREE.Mesh | null = null;
  private terrainImg: HTMLImageElement | null = null;
  private landImg: HTMLImageElement | null = null;
  private heightCanvas: HTMLCanvasElement | null = null;
  private mapTex: THREE.CanvasTexture | null = null;
  private mapCanvas: HTMLCanvasElement | null = null;
  private texKey = '';
  private cities = new Map<CityId, CityView>();
  private marches = new THREE.Group();
  private clouds = new THREE.Group();
  private fallers: THREE.Points | null = null;
  private timer = new THREE.Timer();
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private ready: Promise<void>;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private focusAnim: { t0: number; from: THREE.Vector3; to: THREE.Vector3; off: THREE.Vector3 } | null = null;
  private season = '';
  private low: boolean;
  private loaded = false;
  private watch: FrameWatch;

  constructor(el: HTMLElement, opt: SceneOpt = {}) {
    this.el = el;
    this.low = !!opt.low;
    /* 느리면 한 번 화소 배율을 낮춰 보고, 그래도 느리면 바깥에 알린다 */
    this.watch = new FrameWatch(() => { if (!this.low) { this.low = true; this.renderer.setPixelRatio(1); this.watch.reset(); } else opt.onSlow?.(); });
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.low, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.low ? 1 : Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'sg-map3d-canvas';

    const bg = document.createElement('canvas');
    bg.width = 4; bg.height = 256;
    const bx = bg.getContext('2d')!;
    const gr = bx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(0.6, '#1d130b'); gr.addColorStop(1, '#0b0704');
    bx.fillStyle = gr; bx.fillRect(0, 0, 4, 256);
    this.scene.background = tex(bg);
    this.scene.fog = new THREE.Fog('#1d130b', 180, 420);

    this.hemi = new THREE.HemisphereLight('#f6eed8', '#3a3020', 1.25);
    this.sun = new THREE.DirectionalLight('#fff0d2', 2.1);
    this.sun.position.set(-40, 60, 20);
    this.scene.add(this.hemi, this.sun, this.marches, this.clouds);

    /* 지도 판 아래 옻칠 탁자 */
    const table = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#24160b', roughness: 0.5 }));
    table.rotation.x = -Math.PI / 2;
    table.position.set(MAP_W * SC / 2, -2.2, MAP_H * SC / 2);
    this.scene.add(table);

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = 1.2;
    this.controls.minPolarAngle = 0.25;
    this.controls.zoomToCursor = true;
    this.controls.target.set(MAP_W * SC / 2, 0, MAP_H * SC / 2);
    this.camera.position.set(MAP_W * SC / 2, 90, MAP_H * SC / 2 + 70);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.ready = this.load().then(() => { this.loaded = true; });
    this.loop();
  }

  private async load() {
    const [terrain, land, height] = await Promise.all([loadImg(TERRAIN_URL), loadImg(LAND_URL), loadImg(HEIGHT_URL)]);
    if (this.disposed) return;
    this.terrainImg = terrain; this.landImg = land;
    const hc = document.createElement('canvas');
    hc.width = height.width; hc.height = height.height;
    const hx = hc.getContext('2d', { willReadFrequently: true })!;
    hx.drawImage(height, 0, 0);
    this.heightCanvas = hc;
    const lc = document.createElement('canvas');
    lc.width = hc.width; lc.height = hc.height;
    const lx = lc.getContext('2d', { willReadFrequently: true })!;
    lx.drawImage(land, 0, 0, lc.width, lc.height);
    const hd = hx.getImageData(0, 0, hc.width, hc.height).data;
    const ld = lx.getImageData(0, 0, lc.width, lc.height).data;
    this.hw = hc.width; this.hh = hc.height;
    this.heights = new Float32Array(this.hw * this.hh);
    const raw = new Float32Array(this.hw * this.hh);
    for (let i = 0; i < raw.length; i++) {
      const v = hd[i * 4] / 255;
      const isLand = ld[i * 4] > 110;
      raw[i] = isLand ? 0.12 + v * v * VERT : -0.5;
    }
    /* 3×3 고르게 — 칼날 같은 봉우리를 누그러뜨린다 */
    for (let j = 0; j < this.hh; j++) for (let i = 0; i < this.hw; i++) {
      let sum = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= this.hw || y >= this.hh) continue;
        sum += raw[y * this.hw + x]; n++;
      }
      this.heights[j * this.hw + i] = sum / n;
    }
    /* 지형 판 */
    const segX = this.low ? 175 : 350, segZ = this.low ? 150 : 300;
    const geo = new THREE.PlaneGeometry(MAP_W * SC, MAP_H * SC, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(MAP_W * SC / 2, 0, MAP_H * SC / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.heightAt(pos.getX(k), pos.getZ(k)));
    geo.computeVertexNormals();
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = MAP_W * TEX_K; this.mapCanvas.height = MAP_H * TEX_K;
    this.mapTex = tex(this.mapCanvas);
    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.mapTex, roughness: 0.92 }));
    this.scene.add(this.terrain);
    /* 판 옆면 */
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(MAP_W * SC + 1, 2, MAP_H * SC + 1), new THREE.MeshStandardMaterial({ color: '#3a2614', roughness: 0.8 }));
    skirt.position.set(MAP_W * SC / 2, -1.55, MAP_H * SC / 2);
    this.scene.add(skirt);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(MAP_W * SC + 2.2, 0.5, MAP_H * SC + 2.2), new THREE.MeshStandardMaterial({ color: '#7a2a1c', roughness: 0.4, metalness: 0.2 }));
    frame.position.set(MAP_W * SC / 2, -0.9, MAP_H * SC / 2);
    this.scene.add(frame);
    this.makeClouds();
  }

  heightAt(x: number, z: number): number {
    if (!this.heights) return 0;
    const gx = (x / (MAP_W * SC)) * (this.hw - 1), gz = (z / (MAP_H * SC)) * (this.hh - 1);
    const x0 = Math.max(0, Math.min(this.hw - 2, Math.floor(gx))), z0 = Math.max(0, Math.min(this.hh - 2, Math.floor(gz)));
    const fx = Math.min(1, Math.max(0, gx - x0)), fz = Math.min(1, Math.max(0, gz - z0));
    const h = (i: number, j: number) => this.heights![j * this.hw + i];
    return (h(x0, z0) * (1 - fx) + h(x0 + 1, z0) * fx) * (1 - fz) + (h(x0, z0 + 1) * (1 - fx) + h(x0 + 1, z0 + 1) * fx) * fz;
  }

  private cityPos(id: CityId): THREE.Vector3 {
    const [x, y] = PT[id];
    /* 성은 둘레의 가장 높은 곳에 얹히지 않도록 가운데 높이를 쓴다 */
    const X = x * SC, Z = y * SC;
    return new THREE.Vector3(X, this.heightAt(X, Z), Z);
  }

  /* ───────── 바탕 그림 + 세력권 ───────── */

  private paint(s: GameState, viewer: number) {
    if (!this.mapCanvas || !this.terrainImg || !this.landImg || !this.mapTex) return;
    const ownerKey = CITIES.map((c) => s.cities[c.id].owner).join(',') + s.factions.map((f) => f.color).join('') + seasonOf(s.month) + viewer;
    if (ownerKey === this.texKey) return;
    this.texKey = ownerKey;
    const W = MAP_W * TEX_K, H = MAP_H * TEX_K;
    const ctx = this.mapCanvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.terrainImg, 0, 0, W, H);
    /* 겨울엔 높은 곳에 눈 */
    const se = seasonOf(s.month);
    if (se === 'winter' && this.heightCanvas) {
      const snow = document.createElement('canvas');
      snow.width = W; snow.height = H;
      const sx = snow.getContext('2d')!;
      sx.drawImage(this.heightCanvas, 0, 0, W, H);
      const id = sx.getImageData(0, 0, W, H);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = id.data[i] / 255;
        const a = Math.max(0, Math.min(1, (v - 0.42) * 4));
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 248;
        id.data[i + 3] = a * 210;
      }
      sx.putImageData(id, 0, 0);
      ctx.drawImage(snow, 0, 0);
      ctx.fillStyle = 'rgba(225,232,238,0.18)';
      ctx.fillRect(0, 0, W, H);
    } else if (se === 'autumn') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(214,160,90,0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.setTransform(TEX_K, 0, 0, TEX_K, 0, 0);
    /* 세력권 — 따로 칠해 뭍 가면으로 자르고 곱하기로 얹는다 */
    const terr = document.createElement('canvas');
    terr.width = W; terr.height = H;
    const tx = terr.getContext('2d')!;
    tx.setTransform(TEX_K, 0, 0, TEX_K, 0, 0);
    for (const c of CELLS) {
      const o = s.cities[c.id].owner;
      if (o < 0) continue;
      tx.fillStyle = s.factions[o]?.color ?? '#888';
      tx.globalAlpha = 0.42;
      tx.fill(new Path2D(c.d));
    }
    tx.globalAlpha = 1;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.globalCompositeOperation = 'destination-in';
    tx.drawImage(this.landImg, 0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(terr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(TEX_K, 0, 0, TEX_K, 0, 0);
    /* 국경 */
    ctx.lineJoin = 'round';
    for (const e of EDGES) {
      const oa = s.cities[e.a].owner, ob = e.b ? s.cities[e.b].owner : -2;
      if (oa === ob || (e.b && oa < 0 && ob < 0) || (!e.b && oa < 0)) continue;
      const p = new Path2D(e.d);
      ctx.strokeStyle = 'rgba(243,230,196,0.35)'; ctx.lineWidth = 3.6; ctx.stroke(p);
      ctx.strokeStyle = e.b ? 'rgba(30,18,8,0.8)' : 'rgba(30,18,8,0.35)'; ctx.lineWidth = e.b ? 1.6 : 1; ctx.stroke(p);
    }
    /* 강·호수 */
    ctx.lineCap = 'round';
    for (const rv of RIVERS) {
      const pts = rv.pts.map(([lo, la]) => project(lo, la));
      for (const [w, c] of [[rv.width * 0.75 + 2, 'rgba(40,58,50,0.5)'], [rv.width * 0.75, '#6d97a0'], [Math.max(0.6, rv.width * 0.22), 'rgba(200,225,222,0.6)']] as const) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    for (const lk of LAKES) {
      const [x, y] = project(lk.at[0], lk.at[1]);
      const [x2] = project(lk.at[0] + lk.rx, lk.at[1]);
      const [, y2] = project(lk.at[0], lk.at[1] - lk.ry);
      ctx.fillStyle = '#93ada6'; ctx.strokeStyle = '#33402f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, x2 - x, y2 - y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    /* 길 */
    for (const [a, b, kind] of ROADS) {
      const [x1, y1] = PT[a], [x2, y2] = PT[b];
      const oa = s.cities[a].owner, ob = s.cities[b].owner;
      const border = oa !== ob && (oa === viewer || ob === viewer) && viewer >= 0;
      ctx.setLineDash(border ? [] : kind === 'w' ? [2, 4] : [5, 3]);
      ctx.strokeStyle = border ? 'rgba(190,40,26,0.95)' : kind === 'w' ? 'rgba(35,78,96,0.8)' : 'rgba(74,46,20,0.75)';
      ctx.lineWidth = border ? 2.4 : 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.setLineDash([]);
    /* 글씨 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillStyle = 'rgba(58,36,16,0.22)';
    for (const z of ZHOU_LABELS) ctx.fillText(z.h.split('').join(' '), z.x, z.y);
    ctx.font = `800 15px ${FONT}`;
    ctx.fillStyle = 'rgba(74,48,24,0.6)';
    for (const l of REGION_LABELS) { const [x, y] = project(l.at[0], l.at[1]); ctx.fillText(l.name.split('').join(' '), x, y); }
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = 'rgba(42,74,80,0.5)';
    for (const [n, lo, la] of [['渤 海', 120.4, 38.6], ['東 海', 123.4, 31.5], ['南 海', 116.5, 21.2]] as const) { const [x, y] = project(lo, la); ctx.fillText(n, x, y); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.mapTex.needsUpdate = true;
  }

  /* ───────── 도시 ───────── */

  async sync(s: GameState, selected: CityId | null, marks: Set<CityId> | undefined, viewer: number) {
    await this.ready;
    if (this.disposed || !this.heights) return;
    this.paint(s, viewer);
    for (const cd of CITIES) {
      const c = s.cities[cd.id];
      const fac = c.owner >= 0 ? s.factions[c.owner] : null;
      const color = fac?.color ?? '#8a8172';
      const isCap = !!fac && fac.capital === cd.id;
      const size = isCap ? 2 : cd.pop >= 60 ? 1 : 0;
      const sur = fac ? surname(OFFICER_DEF[fac.ruler]?.hanja ?? '') : '';
      const key = `${color}:${size}:${sur}:${fac?.idx === viewer}`;
      let v = this.cities.get(cd.id);
      if (!v || v.key !== key) {
        if (v) { this.scene.remove(v.g); disposeDeep(v.g); }
        v = this.makeCity(cd.id, cd.name, color, size, sur, fac?.idx === viewer);
        v.key = key;
        this.cities.set(cd.id, v);
        this.scene.add(v.g);
      }
      (v.ring.material as THREE.MeshBasicMaterial).opacity = selected === cd.id ? 0.95 : 0;
      v.mark.visible = !!marks?.has(cd.id);
    }
    this.syncMarches(s);
    this.syncSeason(s.month);
  }

  private makeCity(id: CityId, name: string, color: string, size: number, sur: string, mine: boolean): CityView {
    const g = new THREE.Group();
    const p = this.cityPos(id);
    g.position.copy(p);
    g.userData.city = id;
    const k = [0.9, 1.15, 1.45][size];
    const M = (c: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, flatShading: true });
    const wall = M('#d9cba8'), roofR = M('#8f2a1e'), roofG = M('#3f4a4c'), gold = M('#c9a13e', 0.45), door = M('#2a1a0e');
    const body = new THREE.Group();
    body.scale.setScalar(k);
    g.add(body);
    /* 기단·성벽 네모 */
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.4), wall);
    base.position.y = 0.25;
    body.add(base);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.52, 1.1), M('#a89a78'));
    inner.position.y = 0.27;
    body.add(inner);
    for (const [x, z] of [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), wall);
      t.position.set(x, 0.35, z);
      body.add(t);
      if (size >= 1) { const r = roofMesh(0.42, 0.42, 0.18, roofG); r.position.set(x, 0.78, z); body.add(r); }
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.06), door);
    gate.position.set(0, 0.16, 0.71);
    body.add(gate);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5), M('#e8d9b2'));
    hall.position.y = 0.67;
    body.add(hall);
    const r1 = roofMesh(1.0, 0.75, 0.3, size === 2 ? gold : roofR);
    r1.position.y = 0.97;
    body.add(r1);
    if (size >= 1) {
      const hall2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.3), M('#efe0bb'));
      hall2.position.y = 1.2;
      body.add(hall2);
      const r2 = roofMesh(0.62, 0.48, 0.26, size === 2 ? gold : roofR);
      r2.position.y = 1.43;
      body.add(r2);
    }
    /* 군기 */
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), M('#3a2414'));
    pole.position.set(0.95 * k, 1.1 * k + 0.3, 0);
    g.add(pole);
    const fc = document.createElement('canvas');
    fc.width = 128; fc.height = 96;
    const fx = fc.getContext('2d')!;
    fx.fillStyle = color; fx.fillRect(0, 0, 128, 96);
    fx.fillStyle = 'rgba(255,255,255,0.35)'; fx.fillRect(0, 0, 128, 12);
    if (sur) {
      fx.font = `800 ${sur.length > 1 ? 40 : 62}px ${FONT}`;
      fx.textAlign = 'center'; fx.textBaseline = 'middle';
      fx.lineWidth = 5; fx.strokeStyle = 'rgba(0,0,0,0.45)';
      fx.strokeText(sur, 60, 54);
      fx.fillStyle = '#fff8e8'; fx.fillText(sur, 60, 54);
    }
    const fgeo = new THREE.PlaneGeometry(1.1, 0.8, 8, 1);
    fgeo.translate(0.55, 0, 0);
    const flag = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: tex(fc), side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(0.97 * k, 1.1 * k + 1.0, 0);
    flag.userData.base = (fgeo.attributes.position as THREE.BufferAttribute).array.slice();
    g.add(flag);
    /* 이름판 */
    const lc = document.createElement('canvas');
    const lx = lc.getContext('2d')!;
    lx.font = `800 44px ${FONT}`;
    const w = Math.ceil(lx.measureText(name).width + 34);
    lc.width = w; lc.height = 62;
    lx.fillStyle = mine ? 'rgba(80,22,14,0.92)' : 'rgba(24,15,8,0.86)';
    lx.fillRect(0, 0, w, 62);
    lx.strokeStyle = mine ? '#e3b25a' : color;
    lx.lineWidth = 4;
    lx.strokeRect(2, 2, w - 4, 58);
    lx.font = `800 44px ${FONT}`;
    lx.textAlign = 'center'; lx.textBaseline = 'middle';
    lx.fillStyle = '#f6ead0';
    lx.fillText(name, w / 2, 33);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(lc), depthTest: false, transparent: true }));
    label.userData.aspect = w / 62;
    label.position.set(0, -0.2, 1.9 * k);
    label.renderOrder = 5;
    g.add(label);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6 * k, 0.09, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffe28a', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(1.9 * k, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: '#e0452f', transparent: true, opacity: 0.85 }));
    mark.rotation.x = Math.PI / 2;
    mark.position.y = 0.14;
    mark.visible = false;
    g.add(mark);
    return { g, flag, label, ring, mark, key: '', base: p.y };
  }

  /* ───────── 진군 ───────── */

  private syncMarches(s: GameState) {
    const list = (s.marches ?? []).filter((m) => m.y === s.year && m.m === s.month);
    const key = list.map((m) => `${m.f}${m.from}${m.to}${s.cities[m.to].owner}`).join('|');
    if (this.marches.userData.key === key) return;
    this.marches.userData.key = key;
    for (const c of [...this.marches.children]) { this.marches.remove(c); disposeDeep(c); }
    list.forEach((m, i) => {
      const a = this.cityPos(m.from).add(new THREE.Vector3(0, 1.4, 0));
      const b = this.cityPos(m.to).add(new THREE.Vector3(0, 1.4, 0));
      const mid = a.clone().lerp(b, 0.5);
      mid.y = Math.max(a.y, b.y) + a.distanceTo(b) * 0.28 + 1.5;
      const dir = b.clone().sub(a).normalize();
      const end = b.clone().sub(dir.clone().multiplyScalar(1.6));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, end);
      const col = new THREE.Color(s.factions[m.f]?.color ?? '#a33');
      const dash = document.createElement('canvas');
      dash.width = 64; dash.height = 8;
      const dx = dash.getContext('2d')!;
      dx.fillStyle = '#' + col.getHexString(); dx.fillRect(0, 0, 64, 8);
      dx.fillStyle = 'rgba(255,248,220,0.85)'; dx.fillRect(0, 0, 18, 8);
      const dt = tex(dash);
      dt.wrapS = THREE.RepeatWrapping;
      dt.repeat.set(curve.getLength() / 2.5, 1);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.22, 6, false), new THREE.MeshStandardMaterial({ map: dt, emissive: col, emissiveIntensity: 0.25, roughness: 0.5 }));
      tube.userData.dash = dt;
      tube.userData.delay = i * 0.3;
      this.marches.add(tube);
      const tan = curve.getTangent(1);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 }));
      head.position.copy(end).add(tan.clone().multiplyScalar(0.5));
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      this.marches.add(head);
      const won = s.cities[m.to].owner === m.f;
      const sc = document.createElement('canvas');
      sc.width = sc.height = 64;
      const sx = sc.getContext('2d')!;
      sx.fillStyle = won ? '#b0342a' : '#3a3a42'; sx.fillRect(4, 4, 56, 56);
      sx.strokeStyle = '#f1e4c3'; sx.lineWidth = 4; sx.strokeRect(4, 4, 56, 56);
      sx.font = `800 40px ${FONT}`; sx.textAlign = 'center'; sx.textBaseline = 'middle';
      sx.fillStyle = '#fbe7c2'; sx.fillText(won ? '破' : '退', 32, 34);
      const seal = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(sc), depthTest: false }));
      seal.position.copy(b).add(new THREE.Vector3(1.2, 2.2, 0));
      seal.scale.set(1.5, 1.5, 1);
      seal.renderOrder = 6;
      this.marches.add(seal);
    });
  }

  /* ───────── 구름·철 ───────── */

  private makeClouds() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const x = cv.getContext('2d')!;
    for (let i = 0; i < 7; i++) {
      const gr = x.createRadialGradient(30 + i * 11, 64 + Math.sin(i) * 14, 4, 30 + i * 11, 64 + Math.sin(i) * 14, 40);
      gr.addColorStop(0, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 128, 128);
    }
    const t = tex(cv);
    for (let i = 0; i < 9; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.55, depthWrite: false }));
      sp.position.set(((i * 37) % 100) / 100 * MAP_W * SC, 11 + (i % 3) * 1.5, ((i * 61) % 100) / 100 * MAP_H * SC);
      const k = 14 + (i % 4) * 5;
      sp.scale.set(k, k * 0.5, 1);
      sp.userData.v = 0.35 + (i % 3) * 0.15;
      this.clouds.add(sp);
    }
  }

  private syncSeason(month: number) {
    const se = seasonOf(month);
    if (se === this.season) return;
    this.season = se;
    if (this.fallers) { this.scene.remove(this.fallers); disposeDeep(this.fallers); this.fallers = null; }
    this.hemi.color.set(se === 'winter' ? '#eaf0f4' : se === 'autumn' ? '#f6e2c2' : '#f6eed8');
    if (se === 'summer') return;
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * MAP_W * SC; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = Math.random() * MAP_H * SC; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = se === 'winter' ? '#ffffff' : se === 'spring' ? '#f7b8c8' : '#d4782c';
    this.fallers = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: se === 'winter' ? 0.28 : 0.36, transparent: true, opacity: 0.9, depthWrite: false }));
    this.fallers.userData.kind = se;
    this.scene.add(this.fallers);
  }

  /* ───────── 고르기·보기 ───────── */

  pick(clientX: number, clientY: number): CityId | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const groups = [...this.cities.values()].map((c) => c.g);
    const hit = ray.intersectObjects(groups, true)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.city) o = o.parent;
      if (o) return o.userData.city as CityId;
    }
    if (!this.terrain) return null;
    const g = ray.intersectObject(this.terrain, false)[0];
    if (!g) return null;
    let best: CityId | null = null, bd = 2.6;
    for (const c of CITIES) {
      const [x, y] = PT[c.id];
      const d = Math.hypot(x * SC - g.point.x, y * SC - g.point.z);
      if (d < bd) { bd = d; best = c.id; }
    }
    return best;
  }

  focus(id: CityId, instant = false) {
    const p = this.cityPos(id);
    const off = this.camera.position.clone().sub(this.controls.target);
    if (off.length() > 60 || instant) off.setLength(instant ? 46 : 55);
    /* 세로 화면은 아래쪽을 도시 창이 가리므로 도시가 위쪽에 오게 본다 */
    const tall = this.el.clientHeight > this.el.clientWidth;
    const to = new THREE.Vector3(p.x, p.y * 0.5, p.z + (tall ? 9 : 2));
    if (instant) {
      this.controls.target.copy(to);
      this.camera.position.copy(to).add(new THREE.Vector3(0, tall ? 40 : 30, tall ? 30 : 25));
      this.controls.update();
      return;
    }
    this.focusAnim = { t0: this.timer.getElapsed(), from: this.controls.target.clone(), to, off };
  }

  overview() {
    this.focusAnim = null;
    this.controls.target.set(MAP_W * SC / 2, 0, MAP_H * SC / 2);
    this.camera.position.set(MAP_W * SC / 2, 92, MAP_H * SC / 2 + 64);
  }

  zoom(f: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    off.multiplyScalar(f);
    const len = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, off.length()));
    off.setLength(len);
    this.camera.position.copy(this.controls.target).add(off);
  }

  private resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.loaded) this.watch.tick(performance.now());
    this.timer.update();
    const t = this.timer.getElapsed();
    if (this.focusAnim) {
      const k = Math.min(1, (t - this.focusAnim.t0) / 0.7);
      const e = k * k * (3 - 2 * k);
      this.controls.target.lerpVectors(this.focusAnim.from, this.focusAnim.to, e);
      this.camera.position.copy(this.controls.target).add(this.focusAnim.off);
      if (k >= 1) this.focusAnim = null;
    }
    this.controls.update();
    const dist = this.camera.position.distanceTo(this.controls.target);
    const ls = Math.min(3.4, Math.max(1.1, dist / 26));
    for (const v of this.cities.values()) {
      const a = v.label.userData.aspect as number;
      v.label.scale.set(ls * a * 0.55, ls * 0.55, 1);
      const pos = v.flag.geometry.attributes.position as THREE.BufferAttribute;
      const base = v.flag.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.setZ(i, Math.sin(t * 3 + x * 5 + v.g.id) * 0.08 * x); }
      pos.needsUpdate = true;
      (v.ring.material as THREE.MeshBasicMaterial).color.setHSL(0.13, 1, 0.65 + Math.sin(t * 5) * 0.12);
      if (v.mark.visible) (v.mark.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 6) * 0.35;
    }
    for (const c of this.marches.children) {
      const d = c.userData.dash as THREE.Texture | undefined;
      if (d) d.offset.x = -t * 0.8;
    }
    for (const c of this.clouds.children) {
      c.position.x += (c.userData.v as number) * 0.02;
      if (c.position.x > MAP_W * SC + 20) c.position.x = -20;
    }
    if (this.fallers) {
      const p = this.fallers.geometry.attributes.position as THREE.BufferAttribute;
      const winter = this.fallers.userData.kind === 'winter';
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - (winter ? 0.03 : 0.02);
        let x = p.getX(i) + Math.sin(t + i) * 0.01 + 0.006;
        if (y < 0) { y = 16; x = Math.random() * MAP_W * SC; }
        p.setXY(i, x, y);
      }
      p.needsUpdate = true;
    }
    this.renderer.render(this.scene, this.camera);
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

function roofMesh(w: number, d: number, h: number, mat: THREE.Material) {
  const geo = new THREE.CylinderGeometry(0.02, 1, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w * 0.75, h, d * 0.75);
  return m;
}

function disposeDeep(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const x of list) {
      const mm = x as THREE.MeshStandardMaterial;
      if (mm.map) mm.map.dispose();
      x.dispose();
    }
  });
}
