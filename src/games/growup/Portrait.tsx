import { useState } from 'react';
import { PixelAvatar } from './PixelAvatar';
import type { Expression } from './engine';
import { portraitUrl } from './portraits';
import { useGrow } from './store';
import { Look, Stage } from './types';

interface Props {
  look: Look;
  stage: Stage;
  expr: Expression;
  /** 픽셀 아바타일 때 픽셀 하나의 크기 */
  scale?: number;
  className?: string;
}

/** 초상 — 직접 그린 그림이 있으면 그 그림, 없으면 픽셀 아바타 */
export function Portrait({ look, stage, expr, scale = 4, className = '' }: Props) {
  const uploads = useGrow((s) => s.uploads);
  const url = portraitUrl(stage, expr, uploads);
  /* 작은 픽셀 그림(64px 이하)은 또렷하게 확대한다 */
  const [tiny, setTiny] = useState(false);
  return (
    <div className={`gu-portrait ${url ? 'img' : 'pixel'} ${tiny ? 'tiny' : ''} ${expr} ${className}`}>
      {url ? <img src={url} alt="초상" draggable={false} onLoad={(e) => setTiny(e.currentTarget.naturalWidth <= 64)} />
        : <PixelAvatar look={look} stage={stage} expr={expr} scale={scale} />}
    </div>
  );
}
