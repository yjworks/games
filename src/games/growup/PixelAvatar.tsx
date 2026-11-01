import { useEffect, useRef } from 'react';
import type { Expression } from './engine';
import { HAIR_COLORS } from './data';
import type { Friend } from './friends';
import { PERSON_W, PersonOpts, drawPerson, personRows } from './sprites';
import { Look, Stage } from './types';

interface Props {
  look: Look;
  stage: Stage;
  expr: Expression;
  /** 픽셀 하나의 크기 */
  scale?: number;
  /** 있으면 아이 대신 이 친구를 그린다 */
  friend?: Friend;
  className?: string;
}

/** 블록 마을의 아이(또는 친구)를 크게 그린 초상 — 학교급마다 키와 옷이 바뀐다 */
export function PixelAvatar({ look, stage, expr, scale = 5, friend, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts: PersonOpts = friend
    ? { hair: friend.hair, style: friend.style, stage, expr, shirt: friend.shirt }
    : { hair: HAIR_COLORS[look.hair % HAIR_COLORS.length], style: look.style, stage, expr };
  const h = personRows(opts).length;
  /* 가장 큰 고3 키에 맞춰 캔버스를 고정해, 자라면 발끝은 그대로이고 키만 커 보인다 */
  const H = 21;
  const W = PERSON_W + 2;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawPerson(ctx, opts, scale, (H - h) * scale, scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.hair, opts.style, opts.shirt, stage, expr, scale, h]);

  return (
    <canvas ref={ref} className={`gu-pixel ${className ?? ''}`} width={W * scale} height={H * scale}
      role="img" aria-label={friend ? `${friend.name} 모습` : '아이 모습'} />
  );
}
