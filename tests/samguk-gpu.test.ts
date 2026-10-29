import { describe, expect, it } from 'vitest';
import { FrameWatch } from '../src/games/samguk/ui/three/gpu';

const run = (w: FrameWatch, dt: number, ms: number) => { for (let t = 0; t <= ms; t += dt) w.tick(t); };

describe('FrameWatch', () => {
  it('초당 12장 아래면 한 번 알린다', () => {
    let n = 0;
    const w = new FrameWatch(() => n++);
    run(w, 200, 10000); // 5fps
    expect(n).toBe(1);
  });
  it('빠르면 알리지 않는다', () => {
    let n = 0;
    const w = new FrameWatch(() => n++);
    run(w, 16, 10000);
    expect(n).toBe(0);
  });
  it('처음 1.5초 로딩 지연은 세지 않는다', () => {
    let n = 0;
    const w = new FrameWatch(() => n++);
    w.tick(0); w.tick(1400);
    for (let t = 1416; t < 8000; t += 16) w.tick(t);
    expect(n).toBe(0);
  });
  it('reset 뒤 다시 잰다', () => {
    let n = 0;
    const w = new FrameWatch(() => n++);
    run(w, 200, 6000);
    w.reset();
    for (let t = 10000; t <= 16000; t += 200) w.tick(t);
    expect(n).toBe(2);
  });
});
